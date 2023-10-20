## Environment variables

Environment variables are used for manifest and collection path:
ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH
ORG_KGRID_JAVASCRIPT_ACTIVATOR_COLLECTION_PATH

Manifest path is required while collection path is optional and defaults to
./shelf

## Execution

To execute this deno project use a command like:

```
ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH=./fixtures/installfiles/manifest.json deno run --allow-net --allow-env --allow-read --allow-write --allow-run --unstable -A api.ts
```

or

```
ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH=https://github.com/kgrid/python-activator/releases/download/0.6/manifest.json deno run --allow-net --allow-env --allow-read --allow-write --allow-run --unstable -A api.ts
```

<!-- A command line may later use something like the following to run the startup function in manifest
```
ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH=https://github.com/kgrid/python-activator/releases/download/0.6/manifest.json deno run -A manifest.ts
``` -->

## Github pushes

before pushing commits run the following commands:

```
deno fmt
deno lint
deno test
```

## Knowledge Object Development

To create a KO using JavaScript, the service needs to be implemented as a js
function. To make the function accessible from outside the module, you should
explicitly export it using the 'export' keyword. Here is an example:

```
export function welcome(inputs) {
  let name = inputs.name;
  return "Welcome to Knowledge Grid, " + name;
}
```
