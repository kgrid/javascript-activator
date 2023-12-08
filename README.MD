# JavaScript Activator
JavaScript activator is a reference implementation of [Knowledge Grid Activator Specification](https://kgrid.org/specs/activationSpec.html), and it adheres meticulously to this specification. It serves as a reliable and compliant model for the activation of computable biomedical knowledge objects as per the specified guidelines. 

In the course of implementing the JavaScript activator, certain aspects of the application required nuanced considerations due to rules that were not explicitly defined or were presented with a degree of flexibility in the specifications. To see more detail on these customizations and adaptations, please see [Customizations and Adaptations](#customizations-and-adaptations) section.

In areas where the specifications did not explicitly define rules for certain aspects of the application, the JavaScript activator was implemented with additional features, incorporating assumptions, and following certain approaches, ensuring that they do not infringe upon or violate the specification. To see more detail on these features and assumptions, you can refer to the [Extended Features and Implementation Considerations](#extended-features-and-implementation-considerations) section. 

Deno is used to implement this JavaScript activator.

## Run the app
### Environment variables
When running the JavaScript activator, a path to a manifest file could be provided as a list of knowledge objects to be activated and their locations. This path could be provided using ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH as an environment variable. The knowledge objects that are listed on the manifest will be loaded to a cache location that would be used for activation. The location of this cache folder could be provided using ORG_KGRID_JAVASCRIPT_ACTIVATOR_COLLECTION_PATH as an environment variable. If no cache folder is provided the activator will use ./shelf by default. The activator creates a local manifest file in the cache when it loads knowledge objects before activating them. If you have a cache that already have loaded knowledge objects with a local manifest, you can run an activator and just provide the cache location as the collection path without an input manifest path to load the same knowledge objects from the cache.

### Deno permissions
Deno is secure by default. Therefore, unless you specifically enable it, a program run with Deno has no file, network, or environment access. Access to security sensitive functionality requires that permissions have been granted to an executing script through command line flags, or a runtime permission prompt. But even if a permission is granted, Deno's permission system is designed to be explicit and grant access only if both Deno permissions and operating system permissions allow it. This is a major difference from Node, where dependencies are automatically granting full access to everything, introducing hidden vulnerabilities in your project. For more detail see Deno [Permissions](https://docs.deno.com/runtime/manual/basics/permissions)

Command line flags that are used to provide required access for the JavaScript activator in the following examples include: --allow-net, --allow-env, --allow-read --allow-write --allow-run --allow-sys. You may use each flag to either give full access in that category or you may restrict it to what is needed by assigning a value to the flag in the command line command. For example --allow-write=shelf/ is only providing write access to the ./shelf folder content. To see what specific permissions needed you can run the app with no permission and check the runtime permission prompts that show the specific required permissions.

### Run the app using a compiled binary
To execute this JavaScript project, from a compiled binary, use a command like:
```bash
ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH=<path> DENO_ENV=compiled ./javascript-activator
```

This example assumes the binary file is called javascript-activator and it is in the current working directory. You can set the manifest path or collection path as required but you must set the environment variable 'DENO_ENV' with the value "compiled". Please note that this setting is intended specifically for cases involving compiled Deno binaries and should not be applied in other scenarios.

### Run the app using source code
Make sure [Deno](https://docs.deno.com/runtime/manual/getting_started/installation) is installed. 

To execute this JavaScript project, from the source code, use a command like:

``` bash
ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH=<path> ORG_KGRID_JAVASCRIPT_ACTIVATOR_COLLECTION_PATH=<path> deno run --allow-net --allow-env --allow-read --allow-write --allow-run --unstable -A api.ts --port=3000
```

 For examples of this command see [Using reference objects](#using-reference-objects) or [Using other legacy examples](#using-other-legacy-examples)

### Test the knowledge objects in the running app
Use http://localhost:3000/kos to get the list of knowledge objects and their status.

Use http://localhost:3000/endpoints to get the list of endpoints. Each endpoint is accessible via an http POST request (e.g. using postman) to http://localhost:3000/endpoints/{ko id}/{endpoint id}  with a Json body.

For activated KOs that have a service specification, the JavaScript activator provides access to swagger and OpenAPI editor for each activated KO at {server address}/kos/{KO id}/doc.

As an example, once the BMI Calculator KO (in folder bmi-calc-ko with id BMICalculator) from the reference objects is activated, a post request could be sent to `POST http://localhost:3000/endpoints/BMICalculator/bmi` with the following body to use the bmi endpoint 
```json
{
    "height": 175,
    "weight": 70,
    "unit_system": "metric"
}
```
or swagger editor could be accessed at http://localhost:3000/kos/BMICalculator/doc for this KO to test  its endpoint.
## Development

### Setting up the project
The javascript-activator is a Deno project. Deno is used to build the project using deno third party modules together with Node and npm modules. Make sure [Deno](https://docs.deno.com/runtime/manual/getting_started/installation) is installed. 

Clone the app.
```bash
git clone https://github.com/kgrid/javascript-activator.git
```

Then, open the app in your IDE from root of the project. 
```bash
code .  
```

### Github pushes

before pushing commits run the following commands:

```
deno fmt
deno lint
deno test
```
- 'deno fmt' automatically formats and styles the code according to a predefined set of rules. 
- 'deno lint' analyzes the code for potential errors, coding style violations, and other issues based on a specified set of linting rules.
- 'deno test' runs unit tests to ensure the correctness of the code
### Using reference objects
This activator supports [kgrid 2.0 Knowledge objects](https://github.com/kgrid/koio/blob/master/kgrid_knowledge_objects.md). [Reference Knowledge Objects Collection](https://github.com/kgrid/reference-objects) has knowledge objects that have API services implemented for JavaScript activator. A [Local Manifest file](https://github.com/kgrid/reference-objects/blob/main/local_manifest.json) is provided in this repository to help loading these KOs from a cloned location. Clone this repository using

    ```bash
    git clone https://github.com/kgrid/reference-objects.git
    ``` 
Then run the JavaScript activator and give the path to the cloned repository as the collection path. for example:

    ```bash
    ORG_KGRID_JAVASCRIPT_ACTIVATOR_COLLECTION_PATH=/home/code/reference-objects deno run --allow-net=github.com,objects.githubusercontent.com,kgrid.org,0.0.0.0 --allow-env --allow-read --allow-write=shelf/ --allow-run=unzip --allow-sys=osRelease --unstable  api.ts --port=3000
    ```
### Using other legacy examples
The new activator does not support legacy knowledge objects. But examples of kgrid 1.0 knowledge objects that are updated to be activated by this version of activator are included in ./tests/fixtures/installfiles/ in this repository. A manifest file is also located in this folder for testing.  

Use the following command, from the root of this repository to deploy these knowledge objects to the JavaScript activator:
```bash
ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH=./fixtures/installfiles/manifest.json deno run --allow-net=github.com,objects.githubusercontent.com,kgrid.org,0.0.0.0 --allow-env --allow-read --allow-write=shelf/ --allow-run=unzip --allow-sys=osRelease --unstable  api.ts --port=3000
```

## Knowledge Object Development
The JavaScript activator supports [kgrdi 2.0 knowledge objects](https://github.com/kgrid/koio/blob/master/kgrid_knowledge_objects.md). kgrid 1.0 knowledge objects, however require some minor updates to work with JavaScript activator:
1. The deployment files need to be restructured using the following example:
    ```
    /{route name}:
    post:    
        engine: 
        name: org.kgrid.javascript-activator
        artifact: {artifact name}
        function: {function name}
    ```
2. The function listed in deployment file should be tagged with keyword export in the artifact where it is implemented.    
3. the server field of the service specification file should contain the value with the following format:
    ```
    servers:
    - url: /endpoints/{ko_id}
    ```

For kgrid 2.0 knowledge objects, the JavaScript implementation of API services should  be implemented as a js function. To make the function accessible from outside the module, you should explicitly export it using the 'export' keyword. Here is an example:

```
export function welcome(inputs) {
  let name = inputs.name;
  return "Welcome to Knowledge Grid, " + name;
}
```

JavaScript exhibits a high tolerance for implicit type conversions. Silent failure occurs when certain operations involving undefined or non-numeric values result in NaN, enabling the program to continue execution without throwing explicit exceptions. 

These characteristics makes it impossible for JavaScript activator to catch and report the right error related to issues of the KO function input parameters. Therefore, an input validation process must be implemented as part of the KO service implementation that would check input parameters and would throw an error (exception) with a relevant message, reporting the issue with the input parameters. 

Here is an example of such mechanisms that validates the input types:
```JavaScript
export function bmi_category(input:any):string{
    const example={
        weight:1.0,
        height:1.0,
        unit_system:"string"
    }
    validate_type(input,example);
    //... service implementation goes here
}

function validate_type(input:any,type_obj:any){
    for (const key in type_obj){
          if((typeof input[key]) != (typeof type_obj[key])){
                throw new Error("Invalid type");
          }
    }
}
```
## Deployment
A Procfile is needed for Heroku deployment with the following content
```
web: deno run --allow-net=github.com,objects.githubusercontent.com,kgrid.org,0.0.0.0 --allow-env --allow-read --allow-write --allow-run=unzip --allow-sys=osRelease api.ts --port=${PORT}  
```

Environment variables needs to be setup under Config Vars on Heroku. For the deployment of compiled Deno binaries, ensure to set the environment variable 'DENO_ENV' with the value "compiled". Please note that this setting is intended specifically for cases involving compiled Deno binaries and should not be applied in other scenarios.

## Customizations and Adaptations
In the course of implementing the JavaScript activator, certain aspects of the application required nuanced considerations due to rules that were not explicitly defined or were presented with a degree of flexibility in the specifications. This section outlines the thoughtful customizations and adaptations made during the development process to address such scenarios. By delving into the rationale behind each modification, we aim to provide transparency into how these tailored adjustments enhance the overall functionality of the activator while maintaining alignment with the overarching goals outlined in the specifications. Our commitment to adherence and optimization ensures a robust and tailored implementation that complements the specified guidelines.

JavaScript activator uses ORG_KGRID_JAVASCRIPT_ACTIVATOR_MANIFEST_PATH as the environment variable name for the path to a manifest file. This activator supports Local and remote Paths for manifest path. Local Paths could be absolute or relative to the current working directory.

When using manifest file, this activator only accepts zipped knowledge objects. The local or remote (URL) paths to zip files should be listed on the input manifest. Relative local paths of zip files on the manifest file will be resolved towards the location of the manifest file. 

The JavaScript activator creates an unzipped local copy of KOs and a local manifest file in the cache folder when it activates knowledge objects from a manifest. (See [local manifest file created for reference objects](https://github.com/kgrid/reference-objects/blob/main/local_manifest.json) as an example of local manifest). To unzip remote zip files, this activator downloads them in the cache folder first.

If no manifest path is provided, JAVASCRIPT activator can activate knowledge objects from a local cache that contains unzipped knowledge objects and the local manifest. 

The activator uses ORG_KGRID_JAVASCRIPT_ACTIVATOR_COLLECTION_PATH as an environment variable for the location of the cache. If it is not provided it will use ./shelf as a relative path. 

JavaScript activators reports loading status and errors for all KOs at {server address}/kos.

The JavaScript activator supports kgrid 2.0 knowledge objects. kgrid 1.0 knowledge objects, however, require some [minor updates](#knowledge-object-development) to work with JavaScript activator

## Extended Features and Implementation Considerations 
In areas where the specifications did not explicitly define rules for certain aspects of the application, the JavaScript activator was implemented with additional features, incorporating assumptions and following certain approaches. It's important to note that these additions were made carefully, ensuring that they do not infringe upon or violate the specified guidelines. While the specification did not impose constraints in these particular areas, the implemented features align with the overall objectives and principles outlined in the specifications, contributing to a more comprehensive and robust implementation.

The JavaScript activator provides access to swagger and OpenAPI editor for each activated KO at {server address}/kos/{KO id}/doc. It uses the provided service specification file for this, to enable users to try service endpoints.

The JavaScript activator provides access to service specification file at {server address}/kos/{KO id}/service

If a KO has more than one service, this version of JavaScript activator will only activate the last service.

If a service has more than one endpoint with the same name, the JavaScript activator will keep and route to the last one.

## Related links
- [Kgrid Website](https://kgrid.org/)
- [Knowledge Grid Activator Specifications](https://kgrid.org/specs/activationSpec.html) 
- [Python Activator](https://github.com/kgrid/python-activator)
- [kgrid Reference Objects](https://github.com/kgrid/reference-objects)
- [Kgrid Knowledge Objects](https://github.com/kgrid/koio/blob/master/kgrid_knowledge_objects.md) 
- [Knowledge Object Implementation Ontology (KOIO)](https://github.com/kgrid/koio)
