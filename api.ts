// app.ts
import { Application, Router } from "./deps.ts";
import { start_up } from "./manifest.ts";

//load and install kos
const activation_data = await start_up();
let manifest: { [key: string]: string }[] = [{}];
let routing_dictionary: {
  [key: string]: (input: Record<string, string>) => void;
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

router.get("/kos/:path*", (ctx) => {
  const capturedPath = ctx.params.path || "";
  const indexToUpdate = manifest.findIndex((item) =>
    item["@id"] === capturedPath
  );

  ctx.response.body = manifest[indexToUpdate];
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

// Add the router as middleware
app.use(router.routes());
app.use(router.allowedMethods());

// Start the server
const port = 3001;
console.log(`Server is running on http://localhost:${port}`);
await app.listen({ port });
