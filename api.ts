// app.ts
import { Application, parse, parseFlags, Router, send } from "./deps.ts";
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

// Define routes
router.get("/", (ctx) => {
  ctx.response.body = "Welcome to the REST API";
});

router.get("/kos", (ctx) => {
  ctx.response.body = manifest;
});

//provide access to swagger editir for each ko at /kos/{endpointid}/doc
router.get("/kos/:path*/doc", async (ctx) => {
  const capturedPath = ctx.params.path || "";

  const koIndex = manifest.findIndex((item) => item["@id"] === capturedPath);

  if (koIndex == -1) ctx.throw(404, "KO " + capturedPath + " is not found.");
  if (manifest[koIndex]["status"] != "activated") {
    ctx.throw(404, "KO " + capturedPath + " is not activated.");
  }

  const apiSpec = await Deno.readTextFile(
    manifest[koIndex]["local_url"] + "/service.yaml",
  );
  const apiDoc = parse(apiSpec);

  ctx.response.type = "text/html";
  ctx.response.body = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>API Documentation</title>
        </head>
        <body>
          <div id="swagger-ui"></div>
          <script src="/public/swagger-ui-bundle.js"></script>
          <script src="/public/swagger-ui-standalone-preset.js"></script>
          <link rel="stylesheet" type="text/css" href="/public/swagger-ui.css" />
          <link rel="stylesheet" type="text/css" href="/public/swagger-ui.css.map" />
          <script>
            const spec1 = ${JSON.stringify(apiDoc)};
            SwaggerUIBundle({
              spec: spec1,
              dom_id: "#swagger-ui",
            });            
          </script>
        </body>
      </html>
    `;
});

// Define a middleware to serve static files. Needed for /kos/:path*/doc above.
app.use(async (ctx, next) => {
  // Serve static files from the "public" directory
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

//provide access to service.yaml for each ko at /kos/{endpointid}/service.yaml
router.get("/kos/:path*/service.yaml", (ctx) => {
  const capturedPath = ctx.params.path || "";

  const koIndex = manifest.findIndex((item) => item["@id"] === capturedPath);

  if (koIndex == -1) ctx.throw(404, "KO " + capturedPath + " is not found.");
  if (manifest[koIndex]["status"] != "activated") {
    ctx.throw(404, "KO " + capturedPath + " is not activated.");
  }

  const specPath = manifest[koIndex]["local_url"] + "/service.yaml";

  const openapiSpec = Deno.readTextFileSync(specPath);
  // Serve the requested OpenAPI specification as YAML
  ctx.response.type = "application/yaml";
  ctx.response.body = openapiSpec;
});

router.get("/kos/:path*", (ctx) => {
  const capturedPath = ctx.params.path || "";
  const koIndex = manifest.findIndex((item) => item["@id"] === capturedPath);

  ctx.response.body = manifest[koIndex];
});

router.get("/endpoints", (ctx) => {
  ctx.response.body = Object.keys(routing_dictionary).map((key) => ({
    "@id": key,
    ...routing_dictionary[key],
  }));
});

router.get("/endpoints/:path*", (ctx) => {
  const capturedPath = ctx.params.path || "";

  ctx.response.body = {
    "@id": capturedPath,
    ...routing_dictionary[capturedPath],
  };
});

router.post("/endpoints/:path*", async (ctx) => {
  const capturedPath = await ctx.params.path || "";
  const input = await ctx.request.body().value;
  ctx.response.body = {
    "result": routing_dictionary[capturedPath].function(input),
    "info": { endpoint: routing_dictionary[capturedPath], "inputs": input },
  };
});

// Add the router as middleware
app.use(router.routes());
app.use(router.allowedMethods());

// Start the server
const { args } = Deno;
const argPort = parseFlags(args).port;
const port = argPort ? Number(argPort) : 3000;

console.log(`Server is running on http://localhost:${port}`);
await app.listen({ port });
