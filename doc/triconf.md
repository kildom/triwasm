

# Simple values

Simple values are configured using `#define`, for example:

```c
#define TRIVM_EXT_MEM64 1
```

The value must be a literal.
You cannot use there any defines or macros.
If configuration option requires:
* boolean value, then use `0` or `1`.
* integer value, then use decimal or hexadecimal value.
* identifier, then use it without quotes.

This way simple values can be used in both C sources and development tools like `triwasm`.

## List of simple values

* `TRIVM_EXT_UNWIND` - enable [unwind extension](trivm/Architecture/UnwindExt.md).
* `TRIVM_EXT_MEM64` - enable [mem64 extension](trivm/Architecture/Mem64Ext.md).
* `TRIVM_EXT_INT64` - enable [int64 extension](trivm/Architecture/Int64Ext.md).
* `TRIVM_EXT_FLOAT32` - enable [float32 extension](trivm/Architecture/Float32Ext.md).
* `TRIVM_EXT_FLOAT64` - enable [float64 extension](trivm/Architecture/Float64Ext.md).
* `TRIVM_ENABLE_STDLIB` - use stdlib functions in VM core source code, for example: `memset`, `memcpy`.
* `TRIVM_ENABLE_ALL_FAULTS` - enable all VM faults. Configuration of individual faults will be ignored.
* `TRIVM_ENABLE_FAULT_STACK_OVERFLOW` - enable [STACK_OVERFLOW](trivm/Architecture/VMFaults.md#STACK_OVERFLOW) fault.
* `TRIVM_ENABLE_FAULT_STACK_UNDERFLOW` - enable [STACK_UNDERFLOW](trivm/Architecture/VMFaults.md#STACK_UNDERFLOW) fault.
* `TRIVM_ENABLE_FAULT_INSTR_OUT_OF_BOUNDS` - enable [INSTR_OUT_OF_BOUNDS](trivm/Architecture/VMFaults.md#INSTR_OUT_OF_BOUNDS) fault.
* `TRIVM_ENABLE_FAULT_INSTR_INVALID` - enable [INSTR_INVALID](trivm/Architecture/VMFaults.md#INSTR_INVALID) fault.
* `TRIVM_ENABLE_FAULT_ACCESS_OUT_OF_BOUNDS` - enable [ACCESS_OUT_OF_BOUNDS](trivm/Architecture/VMFaults.md#ACCESS_OUT_OF_BOUNDS) fault.
* `TRIVM_ENABLE_FAULT_READ_ONLY` - enable [READ_ONLY](trivm/Architecture/VMFaults.md#READ_ONLY) fault.
* `TRIVM_ENABLE_FAULT_DIVISION_BY_ZERO` - enable [DIVISION_BY_ZERO](trivm/Architecture/VMFaults.md#DIVISION_BY_ZERO) fault.
* `TRIVM_ENABLE_FAULT_AUX_STACK_OVERFLOW` - enable [AUX_STACK_OVERFLOW](trivm/Architecture/VMFaults.md#AUX_STACK_OVERFLOW) fault.
* `TRIVM_ENABLE_FAULT_AUX_STACK_UNDERFLOW` - enable [AUX_STACK_UNDERFLOW](trivm/Architecture/VMFaults.md#AUX_STACK_UNDERFLOW) fault.
* TODO: more 

# Import/export declarations

Import/export direction is assumed to be from gest perspective.
For example, `import` is a function that is implemented in the host and called by the guest,
`export` is a function that is implemented in the gest and called by the host.

The import/export declarations are placed in the multiline comments in configuration file.
The comments start with the `triVM interface` statement, for example:

```c
/* triVM interface:
 * export function[0] void startup();
 * export function[1] i32 my_function(i32 param);
 */
```

Leading `*` characters and whitespaces are ignored at the beginning of each line.
You can use single line comments in this comment. They starts with the `#` character.

Declaration uses C-like syntax prefixed with interface declaration.

All types used in the declarations are delivered from WebAssembly:
* `i32` - 32-bit integer (sign is not defined)
* `i64` - 64-bit integer (sign is not defined)
* `f32` - 32-bit floating point number (`float`)
* `f64` - 64-bit floating point number (`double`)
* `v128` - 128-bit vector
* `funcref` - function reference
* `externref` - external (host) reference

## Functions

The function import/export declarations syntax is following:

> *direction* `function[` *index* `]` *attributes* *return_type* *name* `(` *parameters* `);`

where:
 * *direction* is `import` or `export`
 * *index* is a function index that identifies the function in host-guest interface.
   The index space for imports and exports are different, so two function can have
   the same index as long as one is exported and one is imported.
 * optional *attributes* can have `regcall` attribute that changes calling convention.
 * *return_type* is a function return type.
   * It can be simple type.
   * It can be `void` if function returns nothing.
   * It can have multiple types surrounded by the `( )` characters.
     Each returned value can also have a name.
 * *name* is a function name. Imported functions starts with the module name followed by the `.` character.
 * *parameters* are function parameters. The parameter names are optional.

Examples:
```c
/* triVM interface:
import function[1] void env.log(i32 text_ptr);
export function[1] i32 calc_sum_of(i32 a, i32 b);
export function[2] (i64 value, i32 error) get_item_with_bounds_check(i32 index);
export function[3] (i32 distance) func_with_named_result(i32 src, i32 dst);
import function[2] (i32, i64) env.unnamed(i32, i32, i64);
import function[3] void env.halt();
*/
```

## Tables

Imported table is stored and handled by the host and the guest can access them via dedicated imported function.
Exported table is stored and handled by the guest and the host can access it via dedicated exported function.

The table import/export declarations syntax is following:

> *direction* `table[` *index* `]` *table_type* *name* `;`

where:
 * *direction* is `import` or `export`
 * *index* is a function index that identifies the table in host-guest interface.
   A table is access using dedicated function (one function per table), so
   tables shares index space with functions.
 * *table_type* `funcref` or `externref`.
 * *name* is a table name. Imported tables starts with the module name followed by the `.` character.

Examples:
```c
/* triVM interface:
export table[5] funcref main_table;
import table[5] externref env.host_objects;
*/
```

## Globals

Exported globals are located at specific place in VM memory.
Host can access them directly using this address.

Imported globals are not implemented, but you can use it in Wasm module.
They will be treaded as exported globals.

The global export declarations syntax is following:

> `export global[` *index* `]` *global_type* *name* `;`

where:
 * *index* is a global starting index. Global takes one index per 32-bit word, so `i64` and `f64` takes 2 indexes, `v128` takes 4 indexes. Globals have its own index space that is not shared with the functions or the tables.
 * *global_type* is a type.
 * *name* is a global name. Globals can optionally start with the module name followed by the `.` character.

Examples:
```c
/* triVM interface:
export global[0] i64 some_counter;
# skipping one global index, because previous global is 64-bit.
export global[2] i32 global_val;
*/
```