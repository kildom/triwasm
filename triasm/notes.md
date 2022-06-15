
Block reduction process:
* Prapare initial state:
  * Assume all blocks as not discarded
  * Calculate all constant expressions:
    * assume non-const if expression (or its dependencies) contains non-const element e.g. `addr()` (are there any more examples?)
    * Create map of all assignment positions: `variable name => [ position1, position2, ... ]`
    * Calculate values of all assignments using values from previous assignment, if not exists, last assigment.
    * In case of circular dependencies, report error.
    * Calculate rest of expressions
    * Replace const expressions with actual number and list of variable dependencies (or block dependencies)
  * Replace independent const instructions (e.g. `add 1`) by actual bytecode and list of dependecies
  * Assume fixed size for instructions that fixed size can be calculated (are there such instructions at all?)
  * Assume smallest size for all other instructions
  * Place instructions in the memory using assumed sizes
* Create block dependency graph based on all expressions
* Discard unused blocks - replace them with empty instructions
* Mark variables from discarded blocks as unusable (using it will report error)

Simplyfied System.register function for `System` tsc module merging

```javascript
const System = (function() {
	const System = {};
	const modules = {};
	function execModule(module) {
		if (module.__executed__) {
			return;
		}
		module.__executed__ = true;
		for (let dep of module.__deps__) {
			execModule(modules[dep]);
		}
		module.__execute__();
		delete module.__execute__;
	}
	System.register = function(name, deps, declare) {
		let module = {
			__deps__: deps,
			__declare__: declare,
			__executed__: false,
		};
		module.__exports__ = function(name, value) {
			module[name] = value;
		};
		modules[name] = module;
	};
	System.__execute__ = function() {
		for (let name in modules) {
			let module = modules[name];
			let {setters, execute} = module.__declare__(module.__exports__);
			delete module.__declare__;
			module.__setters__ = setters;
			module.__execute__ = execute;
		}
		for (let name in modules) {
			let module = modules[name];
			for (let i = 0; i < module.__deps__.length; i++) {
				let dep = module.__deps__[i];
				module.__setters__[i](modules[dep]);
			}
			delete module.__setters__;
		}
		for (let module of Object.values(modules).reverse()) {
			execModule(module);
		}
	}
	return System;
})();

// ... The tsc merged modules


System.__execute__();

```

```JavaScript
{
	"files": [
		"SystemRegisterBegin.js",
		"triasm.mts",
		"SystemRegisterEnd.js"
	],
	"compilerOptions": {
		"target": "es2016", /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */
		"module": "system", /* Specify what module code is generated. */
		"allowJs": true,                                  /* Allow JavaScript files to be a part of your program. Use the 'checkJS' option to get errors from these files. */
		"sourceMap": true,                                /* Create source map files for emitted JavaScript files. */
		"outFile": "triasm.js", /* Specify a file that bundles all outputs into one JavaScript file. If 'declaration' is true, also designates a file that bundles all .d.ts output. */
		"removeComments": true,                           /* Disable emitting comments. */
		"esModuleInterop": true, /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */
		"forceConsistentCasingInFileNames": true, /* Ensure that casing is correct in imports. */
		"strict": true, /* Enable all strict type-checking options. */
		"skipLibCheck": true /* Skip type checking all .d.ts files. */
	}
}
```
