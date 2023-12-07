import {
  Application,
  existsSync,
  join,
  parse,
  parseFlags,
  path,
  Router,
  send,
  Status,
} from "./deps.ts";
import { start_up } from "./manifest.ts";
import {
  EndpointNotFoundError,
  FileNotFoundError,
  InvalidInputParameterError,
  KONotFoundError,
} from "./exceptions.ts";
import { set_collection_path } from "./load.ts";
import jsonld from "https://cdn.skypack.dev/jsonld";

let manifest: { [key: string]: string }[] = [{}];
let routing_dictionary: {
  [key: string]: {
    data: {
      someProperty: string;
    };
    function: (input: Record<string, string>) => void;
  };
} = {};
const collection_path = set_collection_path();
const app = new Application();
const router = new Router();

//load and install kos
const activation_data = await start_up();

if (activation_data !== undefined) {
  routing_dictionary = activation_data.routing_dictionary;
  manifest = activation_data.manifest;
}

// Add middleware for redirecting root to /doc
app.use(async (ctx, next) => {
  if (ctx.request.url.pathname === "/") {
    ctx.response.redirect("/docs");
  } else {
    await next();
  }
});

// Add middleware to serve static files from the "public" directory. Needed for /kos/:path*/doc.
app.use(async (ctx, next) => {
  const staticPath = "./public";
  if (ctx.request.url.pathname.startsWith("/public")) {
    const path = ctx.request.url.pathname.substring(7); // Remove "/public" prefix
    await send(ctx, path, {
      root: staticPath,
    });
  } else {
    await next();
  }
});

// Add Middleware for custom error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (
      error instanceof EndpointNotFoundError ||
      error instanceof InvalidInputParameterError ||
      error instanceof KONotFoundError ||
      error instanceof FileNotFoundError
    ) {
      ctx.response.status = error.status;
      ctx.response.body = {
        title: error.name,
        detail: error.message,
      };
    } else {
      // Handle other exceptions here
      ctx.response.status = Status.InternalServerError;
      ctx.response.body = "An unexpected error occurred.";
    }
  }
});

//provide access to OpenAPI documentation using swagger editor for the app APIs at /doc
router.get("/docs", async (ctx) => {
  const openapi = await Deno.readTextFile("public/openapi.json");
  const html = await Deno.readTextFile("public/index.html");
  ctx.response.type = "text/html";
  ctx.response.body = html.replace("{{apiDoc}}", openapi);
});

//Get list of activated endpoints
router.get("/endpoints", (ctx) => {
  ctx.response.body = Object.keys(routing_dictionary).map((key) => ({
    "@id": key,
    ...routing_dictionary[key],
  }));
});

//Get specific endpoint
router.get("/endpoints/:endpoint_path*", (ctx) => {
  const capturedPath = ctx.params.endpoint_path || "";
  if (capturedPath in routing_dictionary) {
    ctx.response.body = {
      "@id": capturedPath,
      ...routing_dictionary[capturedPath],
    };
  } else {
    throw new EndpointNotFoundError(
      `KeyError: Key '${capturedPath}' not found.`,
    );
  }
});

//Execute the function for a specific endpoint
router.post("/endpoints/:endpoint_path*", async (ctx) => {
  const capturedPath = await ctx.params.endpoint_path || "";
  if (!(capturedPath in routing_dictionary)) {
    throw new EndpointNotFoundError(
      `KeyError: Key '${capturedPath}' not found.`,
    );
  }

  try {
    const input = await ctx.request.body().value;
    ctx.response.body = {
      "result": routing_dictionary[capturedPath].function(input),
      "info": { endpoint: routing_dictionary[capturedPath], "inputs": input },
    };
  } catch (error) {
    throw new InvalidInputParameterError(error.message);
  }
});

//Provide access to service.yaml for each ko at /kos/{ko_id}/service
router.get("/kos/:ko_id*/service", async (ctx) => {
  const openapiSpec = await readService(ctx.params.ko_id);
  ctx.response.type = "application/yaml"; //Serve the requested OpenAPI specification as YAML
  ctx.response.body = openapiSpec;
});

//Get list of KOs
router.get("/kos", (ctx) => {
  for (const item of manifest) {
    if (item["status"] == "activated") {
      item["documentation"] = ctx.request.url + "/" + item["@id"] + "/doc"; //join method only works for path and joining for URL is done using + in Deno
    }
  }
  ctx.response.body = manifest;
});

//Provide access to OpenAPI documentation using swagger editir for each ko at /kos/{ko_id}/doc
router.get("/kos/:ko_id*/doc", async (ctx) => {
  const openapiSpec = await readService(ctx.params.ko_id);
  const apiDoc = parse(openapiSpec);
  const html = await Deno.readTextFile("public/index.html");
  ctx.response.type = "text/html";
  ctx.response.body = html.replace("{{apiDoc}}", JSON.stringify(apiDoc));
});

//Get specific KO
router.get("/kos/:ko_id*", (ctx) => {
  const capturedPath = ctx.params.ko_id || "";
  const koIndex = manifest.findIndex((item) => item["@id"] === capturedPath);
  if (koIndex == -1) {
    throw new KONotFoundError(`KeyError: Key '${capturedPath}' not found.`);
  }

  if (manifest[koIndex]["status"] == "activated") {
    manifest[koIndex]["documentation"] = ctx.request.url + "/doc"; //join method only works for path and joining for URL is done using + in Deno
  }
  ctx.response.body = manifest[koIndex];
});

// Add the router as middleware
app.use(router.routes());
app.use(router.allowedMethods());

// Start the server
const { args } = Deno;
const argPort = parseFlags(args).port;
const port = argPort ? Number(argPort) : 3000;
console.info(`Server is running on http://localhost:${port}`);
await app.listen({ port });

async function readService(ko_id: string | undefined ) {
  const capturedPath = ko_id || "";
  const koIndex = manifest.findIndex((item) => item["@id"] === capturedPath);
  if (koIndex == -1) {
    throw new KONotFoundError(`KeyError: Key '${capturedPath}' not found.`);
  }
  const service_specification = manifest[koIndex]["hasServiceSpecification"] ||
    "service.yaml";
  let specPath = join(
    collection_path,
    manifest[koIndex]["local_url"],
    service_specification,
  );

  if (manifest[koIndex]["koio:kgrid"] == "2") { //KO model kgrid version 2's specific code to read services
    type Data = {
      "@id": string;
      "@type"?: string | string[];
      serviceSpec?: string;
      dependsOn?: string;
      implementedBy: [{ "@id": string; "@type": string }];
    };
    const services: Data[] =
      manifest[koIndex]["koio:hasService"] as unknown as Data[];
    for (const service of services) {
      if (service["@type"] === "API") {
        const implementations = service["implementedBy"];
        for (const implementation in implementations) {
          if (
            implementations[implementation]["@type"] &&
            implementations[implementation]["@type"].includes(
              "https://kgrid.org/specs/activationSpec.html#object",
            ) && implementations[implementation]["@type"].includes("javascript")
          ) {
            // load context
            let context = { "@context": manifest[koIndex]["@context"] };
            if (String(manifest[koIndex]["@context"]).includes(".jsonld")) {
              const response = await fetch(manifest[koIndex]["@context"]);
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
            context["@context"]["@base"] = path.join(
              collection_path,
              manifest[koIndex]["local_url"],
              " ",
            );

            // exoand the service using the context
            await jsonld.expand({ "@context": context["@context"], ...service })
              .then((expanded) => {
                // use resolved hasServiceSpcification
                specPath =
                  expanded[0]["http://kgrid.org/koio#hasServiceSpcification"][
                    0
                  ]["@id"];
              });

            break;
          }
        }
      }
    }
  }

  if (!existsSync(specPath)) {
    throw new FileNotFoundError(
      `FileNotFoundError: file '${service_specification}' not found.`,
    );
  }
  const openapiSpec = Deno.readTextFileSync(specPath);
  return openapiSpec;
}
