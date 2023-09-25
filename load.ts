import { writeAll } from "https://deno.land/std@0.202.0/streams/write_all.ts";
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
