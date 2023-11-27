/// <reference lib="deno.ns" />
import { existsSync, isURL, join, parse, path } from "./deps.ts";
import {
  download,
  getFilenameFromURL,
  isLocalPathOrURL,
  resolveRelativeURL,
  set_collection_path,
  unzip,
} from "./load.ts";
import jsonld from "https://cdn.skypack.dev/jsonld";

let manifest_path = "";
let collection_path = "./shelf";
let manifest: { [key: string]: string }[] = [{}];
const supported_kgrid_ko_model_versions = ["1", "2"];
const routing_dictionary: {
  [key: string]: {
    data: {
      someProperty: string;
    };
    function: (input: Record<string, string>) => void;
  };
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
  const local_url = getFilenameFromURL(koItem.url).replace(
    path.extname(koItem.url),
    "",
  );
  const cacheFolder = join(
    collection_path,
    local_url,
  );

  try {
    if (!isLocalPathOrURL(koItem.url)) {
      localLocation = join(collection_path, getFilenameFromURL(koItem.url));
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
      Deno.readTextFileSync(join(cacheFolder, "metadata.json")),
    );
    //check if this kgrid version of activator supports this KO's model
    metadata["status"] = "uninitialized";
    if (
      !supported_kgrid_ko_model_versions.includes(metadata["koio:kgrid"] || "1")
    ) {
      throw new Error(
        "KOs with kgrid version " + metadata["koio:kgrid"] +
          " are not supported in this activator.",
      );
    }

    metadata.status = "loaded";
  } catch (error) {
    metadata.error = error.message;
  }
  metadata["local_url"] = local_url;
  metadata["url"] = koItem.url;

  //add metadata to manifest
  const indexToUpdate = manifest.findIndex((item) =>
    item["@id"] === koItem["@id"]
  );
  if (indexToUpdate !== -1) {
    manifest[indexToUpdate] = { ...koItem, ...metadata }; //need to use index in manifest (array) to change entire value of one item.
  }
  return metadata;
}

/**
 * install ko from koItem.local_url
 */
async function installKO(koItem: Record<string, string>) {
  //use deployment data to get endpoints
  const cacheFolder = join(
    collection_path,
    koItem["local_url"],
  );
  let artifact_location = cacheFolder;
  let deployment_file_location = join(
    cacheFolder,
    koItem["hasDeploymentSpecification"] ?? "deployment.yaml",
  );
  if (koItem["koio:kgrid"] == "2") { //KO model kgrid version 2's specific code to read services
    deployment_file_location = ""; // reinitialize for kgrid 2 objects
    type Data = {
      "@id": string;
      "@type"?: string | string[];
      serviceSpec?: string;
      dependsOn?: string;
      implementedBy: { "@id": string; "@type": string };
    };
    const services: Data[] = koItem["koio:hasService"] as unknown as Data[];
    for (const service of services) {
      if (
        service["@type"] === "API"
      ) {
        const implementations = service["implementedBy"];
        for (const implementation in implementations) {
          if (
            implementations[implementation]["@type"] &&
            implementations[implementation]["@type"].includes(
              "https://kgrid.org/specs/activationSpec.html#object",
            ) && implementations[implementation]["@type"].includes("javascript")
          ) {
            // load context
            let context = { "@context": koItem["@context"] };
            if (String(koItem["@context"]).includes(".jsonld")) {
              const response = await fetch(koItem["@context"]);
              if (response.ok) {
                const fileContent = await response.text();
                context = JSON.parse(fileContent);
              } else {
                console.error(
                  `Error fetching the context file. Status code: ${response.status}`,
                );
                continue;
              }
            }

            // add @base to context
            context["@context"]["@base"] = path.join(cacheFolder, " ");

            // expand implementation
            await jsonld.expand({
              "@context": context["@context"],
              ...implementations[implementation],
            }).then((expanded) => {
              // use resolved implementation id
              deployment_file_location = join(
                expanded[0]["@id"],
                "deployment.yaml",
              );
              artifact_location = expanded[0]["@id"];
            });
            break;
          }
        }
      }
    }
  }

  if (deployment_file_location == "") {
    // if has no value means it is a kgrid 2 object with no python service
    return;
  }
  const transformedArray = [];

  try {
    const yamlContent = await Deno.readTextFile(
      deployment_file_location,
    );

    const parsedYaml = parse(yamlContent);
    const originalJSON = JSON.parse(JSON.stringify(parsedYaml));

    for (const path in originalJSON) {
      // Create a new object with the desired structure
      const transformedObject = {
        "@id": `${koItem["@id"]}${path}`,
        "post": originalJSON[path]["post"],
      };
      transformedArray.push(transformedObject);
    }
  } catch (error) {
    koItem["error"] = error.message;
    console.error(error);
    return;
  }

  const endpoints = JSON.parse(
    JSON.stringify(transformedArray, null),
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

      let module_path = join(artifact_location, artifact);
      if (!path.isAbsolute(module_path)) {
        module_path = join(Deno.cwd(), module_path);
      }

      const importedFunction = (await import(module_path))[
        function_name
      ];
      endpoints[route]["function"] = importedFunction;
      routing_dictionary[endpoints[route]["@id"]] = endpoints[route];
    } catch (error) {
      all_endpoints_activated = false;
      koItem["error"] = error;
      console.error(error);
    }
    if (all_endpoints_activated) {
      koItem["status"] = "activated";
    }
  }
}

export async function start_up() {
  console.info(">>>>>> running startup event");

  //set collection path
  collection_path = set_collection_path();

  //set manifest path
  let has_input_manifest = true;
  manifest_path =
    Deno.env.get("ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH") ?? "";
  if (manifest_path == "" || undefined) {
    if (existsSync(join(collection_path, "local_manifest.json"))) {
      //read local_manifest.json
      manifest = JSON.parse(
        Deno.readTextFileSync(join(collection_path, "local_manifest.json")),
      );
      has_input_manifest = false;
    } else {
      console.info(
        `ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH is not defined.`,
      );
      return;
    }
  }

  try {
    if (has_input_manifest) {
      if (!path.isAbsolute(manifest_path) && isLocalPathOrURL(manifest_path)) {
        manifest_path = path.resolve(manifest_path); //used to support relative manifest path
      }

      //load
      console.info("Loading from maniefest at", manifest_path);
      manifest = await get_Manifest();
      for (const item of manifest) { //for each ko in manifest load them
        const metadata = await loadKO(item);
        console.info(
          JSON.stringify({
            "@id": metadata["@id"],
            "status": metadata["status"],
            "error": metadata["error"],
          }),
        );
      }

      //create local_manifest.json
      await Deno.writeTextFile(
        join(collection_path, "local_manifest.json"),
        JSON.stringify(manifest, null, 2),
      );
      console.info("Installing loaded objects");
    } else console.info("Installing objects from local manifest");

    //install
    for (const item of manifest) { //for each ko in manifest install them
      if (item["status"] == "loaded") {
        console.info("installing " + item["@id"]);
        await installKO(item);
      }
    }
    return { manifest: manifest, routing_dictionary: routing_dictionary };
  } catch (error) {
    console.error("An error occurred:", error.message);
  }
}
