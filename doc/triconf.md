
# triVM Configuration File

The configuration file is a C header file.
Normally it is called `trivm-config.h`, but it can be changed with `TRIVM_CONFIG_FILE` definition.

It configures how the triVM is compiled and what is the interface between host and guest.
The configuration file describes the virtual machine, but not the gest program, so it does not
define, for example, stack sizes.

The configuration file is used in the following:
* It is included in the triVM source code to do conditional compilation.
* The tools use it to generate guest program bytecode compatible with specific virtual machine.
* It can be used to generate host-guest interface implementation helpers.

> [!NOTE]
> Generation of the host-guest interface is not fully implemented yet.

## Defines

Simple values are configured using `#define`, for example:

```c
#define TRIVM_EXT_MEM64 1
```

The value must be a literal integer (decimal or hex).
You cannot use there any expressions, other defines or macros.
For configuration options that enable or disable something, use `0` or `1`.

This way simple values can be used in both C sources and development tools like `triwasm`.

### Extensions

* `TRIVM_EXT_UNWIND` - enable [unwind extension](trivm/Architecture/UnwindExt.md).
  Enabled by default.
* `TRIVM_EXT_MEM64` - enable [mem64 extension](trivm/Architecture/Mem64Ext.md).
  Disabled by default.
* `TRIVM_EXT_INT64` - enable [int64 extension](trivm/Architecture/Int64Ext.md).
  Disabled by default.
* `TRIVM_EXT_FLOAT32` - enable [float32 extension](trivm/Architecture/Float32Ext.md).
  Disabled by default.
* `TRIVM_EXT_FLOAT64` - enable [float64 extension](trivm/Architecture/Float64Ext.md).
  Disabled by default.

See [extensions](trivm/Architecture/Extensions.md) for details.

### Data Memory

* `TRIVM_MEM_GROWABLE` - virtual machine supports memory growth.
  Disabled by default.
* `TRIVM_MEM_SIZE_MIN` - minimum memory size in bytes.
  By default, minimum size supported by the triVM.
* `TRIVM_MEM_SIZE_MAX` - maximum memory size in bytes.
  By default, maximum size supported by the triVM.
* `TRIVM_MEM_SIZE` - fixed memory size in bytes.
  This is shortcut to set non-growable memory with maximum and minimum set to the same value.

> [!WARNING]
> Growable memory is not implemented, use only `TRIVM_MEM_SIZE` option.

See [growable memory](trivm/Architecture/Memory.md#growable-memory) for details.

### Program Memory

* `TRIVM_PROGRAM_SIZE_MAX` - Maximum guest program size. Compilation will fail if
  the output bytecode is bigger than this value.
  By default, maximum size supported by the triVM.
* `TRIVM_ENABLE_ROM` - the triVM uses separate read-only memory that contains guest program.
  Enabled by default.

> [!WARNING]
> Non-ROM mode is no fully implemented yet. You cannot set `TRIVM_ENABLE_ROM` to `0`.

See [program memory](trivm/Architecture/Program.md) for details.

### Faults

* `TRIVM_ALL_FAULTS` - enable all VM faults. Configuration of individual faults will be ignored.
  Disabled by default.
* `TRIVM_FAULT_STACK_OVERFLOW` - enable [STACK_OVERFLOW](trivm/Architecture/VMFaults.md#STACK_OVERFLOW) fault.
  Disabled by default.
* `TRIVM_FAULT_STACK_UNDERFLOW` - enable [STACK_UNDERFLOW](trivm/Architecture/VMFaults.md#STACK_UNDERFLOW) fault.
  Disabled by default.
* `TRIVM_FAULT_INSTR_OUT_OF_BOUNDS` - enable [INSTR_OUT_OF_BOUNDS](trivm/Architecture/VMFaults.md#INSTR_OUT_OF_BOUNDS) fault.
  Disabled by default.
* `TRIVM_FAULT_INSTR_INVALID` - enable [INSTR_INVALID](trivm/Architecture/VMFaults.md#INSTR_INVALID) fault.
  Disabled by default.
* `TRIVM_FAULT_ACCESS_OUT_OF_BOUNDS` - enable [ACCESS_OUT_OF_BOUNDS](trivm/Architecture/VMFaults.md#ACCESS_OUT_OF_BOUNDS) fault.
  Disabled by default.
* `TRIVM_FAULT_READ_ONLY` - enable [READ_ONLY](trivm/Architecture/VMFaults.md#READ_ONLY) fault.
  Disabled by default.
* `TRIVM_FAULT_DIVISION_BY_ZERO` - enable [DIVISION_BY_ZERO](trivm/Architecture/VMFaults.md#DIVISION_BY_ZERO) fault.
  Disabled by default.
* `TRIVM_FAULT_AUX_STACK_OVERFLOW` - enable [AUX_STACK_OVERFLOW](trivm/Architecture/VMFaults.md#AUX_STACK_OVERFLOW) fault.
  Disabled by default.
* `TRIVM_FAULT_AUX_STACK_UNDERFLOW` - enable [AUX_STACK_UNDERFLOW](trivm/Architecture/VMFaults.md#AUX_STACK_UNDERFLOW) fault.
  Disabled by default.

See [faults](trivm/Architecture/VMFaults.md) for details.

### Capabilities

* `TRIVM_CALLBACKS` - Enable [callbacks](trivm/Architecture/Callbacks.md) on the triVM.
  Disabled by default.
* `TRIVM_IMPORT_TABLE_GROWABLE` - guest can request host to increase size of the imported table.
  Disabled by default.
* `TRIVM_EXPORT_TABLE_GROWABLE` - host can request guest to increase size of the exported table.
  Disabled by default.

> [!WARNING]
> Those feature are not fully implemented yet. You cannot set those to `1`.

See [tables](trivm/Architecture/Tables.md) for details.

### General

* `TRIVM_STDLIB` - use stdlib functions in VM core source code, for example: `memset`, `memcpy`.
  Enabled by default.

## Host-guest interface

Special comment that starts with `/* triVM interface:` defines API interface
between host and guest.

Below, you can see an example of such comment:

```c
/* triVM interface:
 * export function[0] void startup();
 * export function[1] i32 my_function(i32 param);
 */
```

Import/export direction is assumed to be from gest point of view.
For example, `import` is a function that is implemented in the host and called by the guest,
`export` is a function that is implemented in the gest and called by the host.

Leading `*` characters and whitespaces are ignored at the beginning of each line.
You can use `#` character to start a single line comment within import/export
declarations.

Declaration uses C-like syntax prefixed with interface declaration.

Types used in the declarations are delivered from the WebAssembly:
* `i32` - 32-bit integer (sign is not defined)
* `i64` - 64-bit integer (sign is not defined)
* `f32` - 32-bit floating point number (`float`)
* `f64` - 64-bit floating point number (`double`)
* `v128` - 128-bit vector
* `funcref` - function reference
* `externref` - external (host) reference

## Functions

The function import/export declarations syntax is following:

> *direction* `function[` *function_index* `]` *attributes* *return_type* *name* `(` *parameters* `);`

where:
 * *direction* is `import` or `export`
 * *function_index* is a function index that identifies the function in host-guest interface.
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

> [!WARNING]
> Import/export tables are not fully implemented yes. Do not use this feature.

Imported table is stored and handled by the host and the guest can access them via dedicated imported function.
Exported table is stored and handled by the guest and the host can access it via dedicated exported function.

The table import/export declarations syntax is following:

> *direction* `table[` *function_index* `]` *type* *name* `;`

where:
 * *direction* is `import` or `export`
 * *function_index* is a function index that identifies the table in host-guest interface.
   A table is access using dedicated function (one function per table), so
   tables shares index space with functions.
 * *type* is table element type which can be `funcref` or `externref`.
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

> `export global[` *global_index* `]` *type* *name* `;`

where:
 * *global_index* is a global starting index. Global takes one index per 32-bit word, so `i64` and `f64` takes 2 indexes, `v128` takes 4 indexes. Globals have its own index space that is not shared with the functions or the tables.
 * *type* is a type.
 * *name* is a global name. Globals can optionally start with the module name followed by the `.` character.

Examples:
```c
/* triVM interface:
export global[0] i64 some_counter;
# skipping one global index, because previous global is 64-bit.
export global[2] i32 global_val;
*/
```

