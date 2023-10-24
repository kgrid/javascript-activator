import { Application, join, parse, parseFlags, Router, send } from "./deps.ts";
import { start_up } from "./manifest.ts";

//load and install kos
const activation_data = await start_up();
let manifest: { [key: string]: string }[] = [{}];
let routing_dictionary: {
  [key: string]: {
    data: {
      someProperty: string;
    };
    function: (input: Record<string, string>) => void;
  };
} = {};
if (activation_data !== undefined) {
  routing_dictionary = activation_data.routing_dictionary;
  manifest = activation_data.manifest;
}

const app = new Application();
const router = new Router();

// Middleware for redirecting root to /doc
app.use(async (ctx, next) => {
  if (ctx.request.url.pathname === "/") {
    ctx.response.redirect("/doc");
  } else {
    await next();
  }
});

// Middleware to serve static files from the "public" directory. Needed for /kos/:path*/doc above.
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

//provide access to swagger editir for app APIs at /doc
router.get("/doc", async (ctx) => {
  const openapi = await Deno.readTextFile("public/openapi.json");
  const html = await Deno.readTextFile("public/index.html");
  ctx.response.type = "text/html";
  ctx.response.body = html.replace("{{apiDoc}}", openapi);
});

router.get("/endpoints", (ctx) => {
  ctx.response.body = Object.keys(routing_dictionary).map((key) => ({
    "@id": key,
    ...routing_dictionary[key],
  }));
});

router.get("/endpoints/:endpoint_path*", (ctx) => {
  const capturedPath = ctx.params.endpoint_path || "";
  ctx.response.body = {
    "@id": capturedPath,
    ...routing_dictionary[capturedPath],
  };
});

router.post("/endpoints/:endpoint_path*", async (ctx) => {
  const capturedPath = await ctx.params.endpoint_path || "";
  const input = await ctx.request.body().value;
  ctx.response.body = {
    "result": routing_dictionary[capturedPath].function(input),
    "info": { endpoint: routing_dictionary[capturedPath], "inputs": input },
  };
});

//provide access to service.yaml for each ko at /kos/{ko_id}/service
router.get("/kos/:ko_id*/service", (ctx) => {
  const capturedPath = ctx.params.ko_id || "";
  const koIndex = manifest.findIndex((item) => item["@id"] === capturedPath);

  if (koIndex == -1) ctx.throw(404, "KO " + capturedPath + " is not found.");

  const service_specification=manifest[koIndex]["hasServiceSpecification"] || "service.yaml";

  const specPath = join(
    manifest[koIndex]["local_url"],
    service_specification,
  );
  const openapiSpec = Deno.readTextFileSync(specPath);
  // Serve the requested OpenAPI specification as YAML
  ctx.response.type = "application/yaml";
  ctx.response.body = openapiSpec;
});

router.get("/kos", (ctx) => {
 
  for(const item of manifest){
    if (item["status"] == "activated") {
      item["documentation"]=ctx.request.url+"/"+item["@id"]+"/doc" //join method only works for path and joining for URL is done using + in Deno
    }
  }          
  ctx.response.body = manifest;
});

//provide access to swagger editir for each ko at /kos/{ko_id}/doc
router.get("/kos/:ko_id*/doc", async (ctx) => {
  const capturedPath = ctx.params.ko_id || "";
  const koIndex = manifest.findIndex((item) => item["@id"] === capturedPath);

  if (koIndex == -1) ctx.throw(404, "KO " + capturedPath + " is not found.");

  const service_specification=manifest[koIndex]["hasServiceSpecification"] || "service.yaml";

  const apiSpec = await Deno.readTextFile(
    join(
      manifest[koIndex]["local_url"],
      service_specification,
    ),
  );
  const apiDoc = parse(apiSpec);
  const html = await Deno.readTextFile("public/index.html");
  ctx.response.type = "text/html";
  ctx.response.body = html.replace("{{apiDoc}}", JSON.stringify(apiDoc));
});

router.get("/kos/:ko_id*", (ctx) => {
  const capturedPath = ctx.params.ko_id || "";
  const koIndex = manifest.findIndex((item) => item["@id"] === capturedPath);
  if (manifest[koIndex]["status"] == "activated") {
    manifest[koIndex]["documentation"]=ctx.request.url+"/doc" //join method only works for path and joining for URL is done using + in Deno
  }
  ctx.response.body = manifest[koIndex];
});

// Add the router as middleware
app.use(router.routes());
app.use(router.allowedMethods());

// Start the server
const { args } = Deno;
const argPort = parseFlags(args).port;
const port = argPort ? Number(argPort) : 3002;

console.log(`Server is running on http://localhost:${port}`);
await app.listen({ port });
