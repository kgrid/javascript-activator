/// <reference lib="deno.ns" />
import { existsSync, isURL, join, parse, path } from "./deps.ts";
import {
  download,
  getFilenameFromURL,
  isLocalPathOrURL,
  resolveRelativeURL,
  unzip,
} from "./load.ts";

let manifest_path = "";
let collection_path = "./pyshelf";
let manifest: [{ [key: string]: string }] = [{}];
const routing_dictionary: {
  [key: string]: (input: Record<string, string>) => void;
} = {};

/**
 * reads and returns content of manifet file
 */
async function get_Manifest(): Promise<[{ [key: string]: string }]> { //works with remote or local path (relative or absolute)
  try {
    if (isLocalPathOrURL(manifest_path)) { //local manifest
      const fileContent = await Deno.readFile(manifest_path);
      const text = new TextDecoder().decode(fileContent);
      const jsonData = JSON.parse(text);
      return jsonData;
    } else { //remote manifest
      const response = await fetch(manifest_path);
      if (response.status === 200) {
        const json = await response.json();
        return json;
      } else {
        console.error(`Failed to fetch JSON. Status code: ${response.status}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
  return [{}];
}

/**
 * loads ko at koItem.url, downloads and unzips if needed
 */
async function loadKO(koItem: Record<string, string>) {
  //resolve koItem.url
  if (!path.isAbsolute(koItem.url) && !isURL(koItem.url)) { //if koItem.url is relative, need to resolve towards manifest path
    if (isLocalPathOrURL(manifest_path)) {
      koItem.url = resolveRelativeURL(
        path.toFileUrl(manifest_path).href,
        koItem.url,
      ); //make manifest path a uri so that it could be resolved
    } else koItem.url = resolveRelativeURL(manifest_path, koItem.url);
  }

  //Download to localLocation if not local
  let localLocation = koItem.url;
  let metadata: Record<string, string> = {
    "@id": koItem["@id"],
    "status": "uninitialized",
  };
  const cacheFolder = collection_path + "/" +
    getFilenameFromURL(koItem.url).replace(path.extname(koItem.url), "");

  try {
    if (!isLocalPathOrURL(koItem.url)) {
      localLocation = collection_path + "/" + getFilenameFromURL(koItem.url);
      await download(koItem.url, localLocation);
    } else {
      localLocation = path.fromFileUrl(localLocation);
    }

    //unzip if local file exist and ko does not exist in cache
    if (existsSync(localLocation) && !existsSync(cacheFolder)) {
      await unzip(localLocation, collection_path);
    }

    //read metadata to manifest
    metadata = JSON.parse(
      Deno.readTextFileSync(cacheFolder + "/metadata.json"),
    );

    //add deployment data to metadata
    const yamlContent = await Deno.readTextFile(
      cacheFolder + "/deployment.yaml",
    );
    const parsedYaml = parse(yamlContent);
    metadata["hasDeploymentSpecification"] = parsedYaml as string;
    metadata.status = "loaded";
  } catch (error) {
    console.error(
      "Error loading ko at ",
      koItem.url,
      ". error: ",
      error.message,
    );
    metadata.error = error.message;
  }
  metadata["local_url"] = cacheFolder;
  metadata["url"] = koItem.url;

  //add metadata to manifest
  const indexToUpdate = manifest.findIndex((item) =>
    item["@id"] === koItem["@id"]
  );
  if (indexToUpdate !== -1) {
    manifest[indexToUpdate] = { ...koItem, ...metadata }; //need to use index in manifest (array) to change entire value of one item.
  }
}

/**
 * install ko from koItem.local_url
 */
async function installKO(koItem: Record<string, string>) {
  //add deployment info to manifest
  const endpoints = JSON.parse(
    JSON.stringify(koItem.hasDeploymentSpecification),
  );

  let all_endpoints_activated = true;
  for (const route in endpoints) {
    try {
      if (
        endpoints[route].post.engine.name != "org.kgrid.javascript-activator"
      ) {
        return;
      }
      const artifact = endpoints[route].post.engine.artifact;
      const function_name = endpoints[route].post.engine.function;
      const importedFunction =
        (await import(join(Deno.cwd(), koItem.local_url, artifact)))[
          function_name
        ];
      routing_dictionary[koItem["@id"] + route] = importedFunction;
    } catch (error) {
      all_endpoints_activated = false;
      koItem["error"] = error;
    }
    if (all_endpoints_activated) {
      koItem["status"] = "activated";
    }
  }
}

async function main() {
  //set collection path
  collection_path =
    Deno.env.get("ORG_KGRID_JAVASCRIPT_ACTIVATOR_COLLECTION_PATH") ?? "";
  if (collection_path == "" || undefined) {
    collection_path = "./pyshelf";
  }

  //set manifest path
  manifest_path =
    Deno.env.get("ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH") ?? "";
  if (manifest_path == "" || undefined) {
    console.log(`ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH is not defined.`);
    return;
  }
  if (!path.isAbsolute(manifest_path) && isLocalPathOrURL(manifest_path)) {
    manifest_path = path.resolve(manifest_path); //used to support relative manifest path
  }

  try {
    //load
    console.log("Loading from maniefest at", manifest_path);
    manifest = await get_Manifest();
    for (const item of manifest) { //for each ko in manifest load them
      console.log("loading " + item.url);
      await loadKO(item);
    }

    //create local_manifest.json
    await Deno.writeTextFile(
      collection_path + "/local_manifest.json",
      JSON.stringify(manifest, null, 2),
    );

    //install
    for (const item of manifest) { //for each ko in manifest install them
      if (item["status"] == "loaded") {
        console.log("installing " + item["@id"]);
        await installKO(item);
      }
    }
  } catch (error) {
    console.error("An error occurred:", error.message);
  }
}

main();
