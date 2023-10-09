Environment variables are used for manifest and collection path:
ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH
ORG_KGRID_JAVASCRIPT_ACTIVATOR_COLLECTION_PATH

Manifest path is required while collection path is optional and defaults to
./pyshelf

To execute this deno project use a command like:

```
ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH=https://github.com/kgrid/python-activator/releases/download/0.6/manifest.json deno run -A manifest.ts
```

or

```
ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH=./fixtures/installfiles/manifest.json deno run -A manifest.ts
```

before pushing commits run the follwoing commands:

```
deno fmt
deno lint
deno test
```

## Knowledge Object Development

To create a KO using javascript, the service needs to be implemented as a js
function. To make the function accessible from outside the module, you should
explicitly export it using the 'export' keyword. Here is an example:

```
export function welcome(inputs) {
  let name = inputs.name;
  return "Welcome to Knowledge Grid, " + name;
}
```
