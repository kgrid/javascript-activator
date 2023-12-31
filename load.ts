import { dirname, writeAll } from "./deps.ts";
export function getFilenameFromURL(urlString: string): string {
  try {
    const url = new URL(urlString);
    // Split the pathname using '/' and get the last segment (the filename)
    const pathnameSegments = url.pathname.split("/");
    return pathnameSegments[pathnameSegments.length - 1];
  } catch (error) {
    console.error("Invalid URL:", error);
    return "";
  }
}

export function isLocalPathOrURL(pathOrURL: string): boolean {
  // Check if the pathOrURL starts with common local file system protocols
  return /^(file:|\/|\.\/|\.\.\/)/.test(pathOrURL);
}

export function resolveRelativeURL(
  baseURL: string,
  relativeFilename: string,
): string {
  const baseUrl = new URL(baseURL);
  const resolvedURL = new URL(relativeFilename, baseUrl);
  return resolvedURL.toString();
}

export async function download(
  source: string,
  destination: string,
): Promise<void> {
  //create cache folder if does not exist
  if (!await Deno.stat(dirname(destination)).catch(() => null)) {
    // The folder does not exist, so we can create it.
    try {
      await Deno.mkdir(dirname(destination));
    } catch (error) {
      console.error(`Error creating cache folder: ${error}`);
    }
  }

  // We use browser fetch API
  const response = await fetch(source);
  const blob = await response.blob();

  // We convert the blob into a typed array
  // so we can use it to write the data into the file
  const buf = await blob.arrayBuffer();
  const data = new Uint8Array(buf);

  // We then create a new file and write into it
  const file = await Deno.create(destination);
  await writeAll(file, data);

  // We can finally close the file
  Deno.close(file.rid);
}

/**
 * Unzip the file
 */
export async function unzip(
  filepath: string,
  destinationDir: string,
): Promise<void> {
  // We execute the command
  // The function returns details about the spawned process
  const process = new Deno.Command("unzip", {
    args: [
      "-q",
      filepath,
      "-d",
      destinationDir,
    ],
  });

  // create subprocess and collect output
  const { code, stdout, stderr } = await process.output();
  console.log("---->", code, stdout, stderr);
}

export function set_collection_path() {
  let collection_path =
    Deno.env.get("ORG_KGRID_JAVASCRIPT_ACTIVATOR_COLLECTION_PATH") ?? "";
  if (collection_path == "" || undefined) {
    collection_path = "./shelf";
  }
  return collection_path;
}
