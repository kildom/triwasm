
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
