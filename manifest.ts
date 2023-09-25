/// <reference lib="deno.ns" />
import { existsSync, isURL, path } from "./deps.ts";
import {
  download,
  getFilenameFromURL,
  isLocalPathOrURL,
  resolveRelativeURL,
  unzip,
} from "./load.ts";

let manifest_path = "";
let collection_path = "./pyshelf";

/**
 * reads and returns content of manifet file
 */
async function get_Manifest() { //works with remote or local path (relative or absolute)
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
  return {};
}

/**
 * loads ko at itemLocation, downloads and unzips if needed
 */
async function loadKO(itemLocation: string) {
  //resolve itemLocation
  if (!path.isAbsolute(itemLocation) && !isURL(itemLocation)) { //if itemLocation is relative, need to resolve towards manifest path
    if (isLocalPathOrURL(manifest_path)) {
      itemLocation = resolveRelativeURL(
        path.toFileUrl(manifest_path).href,
        itemLocation,
      ); //make manifest path a uri so that it could be resolved
    } else itemLocation = resolveRelativeURL(manifest_path, itemLocation);
  }

  //Download to localLocationif not local
  let localLocation = itemLocation;
  try {
    if (!isLocalPathOrURL(itemLocation)) {
      localLocation = collection_path + "/" + getFilenameFromURL(itemLocation);
      await download(itemLocation, localLocation);
    } else {
      localLocation = path.fromFileUrl(localLocation);
    }

    //unzip if local file exist and ko does not exist in cache
    const cacheFolder = collection_path + "/" +
      getFilenameFromURL(itemLocation).replace(path.extname(itemLocation), "");
    if (existsSync(localLocation) && !existsSync(cacheFolder)) {
      await unzip(localLocation, collection_path);
    }
  } catch (error) {
    console.error(
      "Error loading ko at ",
      itemLocation,
      ". error: ",
      error.message,
    );
  }
}

async function main() {
  collection_path =
    Deno.env.get("ORG_KGRID_JAVASCRIPT_ACTIVATOR_COLLECTION_PATH") ?? "";
  if (collection_path == "" || undefined) {
    collection_path = "./pyshelf";
  }

  manifest_path =
    Deno.env.get("ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH") ?? "";
  if (manifest_path == "" || undefined) {
    console.log(`ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH is not defined.`);
  } else {
    if (!path.isAbsolute(manifest_path) && isLocalPathOrURL(manifest_path)) {
      manifest_path = path.resolve(manifest_path); //used to support relative manifest path
    }
    console.log(manifest_path);

    try {
      const manifest = await get_Manifest();
      for (const item of manifest) { //for each ko in manifest load them
        console.log("loading " + item.url);
        loadKO(item.url);
      }
    } catch (error) {
      console.error("An error occurred:", error);
    }
  }
}

main();
