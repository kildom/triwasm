
# Software fault

Software faults are faults triggered by the guest software, not the virtual machine.
They are handled the same way as the VM faults.

The triWASM compiler will generate code that detects invalid situations and trigger the fault.
You can disable all or specified faults. If fault condition happens and associated fault is disabled,
the behavior will be undefined (the same way as for VM faults).

The `--disable-fault-all` command line option will disable all software faults.
The `--disable-fault-*` command line options will disable specific software fault.

Software fault indexes starts at 64 to avoid collisions with VM faults.

## Faults

### `TRIWASM_FAULT_UNREACHABLE = 64`

WebAssembly `unreachable` instruction occurred. Compiler may generate this instruction in
unreachable part of program, e.g. after C standard library `exit()` function call.

### `TRIWASM_FAULT_TABLE_INDEX = 65`

Trying to access a table index outside of the WebAssembly table.
This may happen, for example, when C/C++ code tries to call a function pointer that is
invalid.

### `TRIWASM_FAULT_NULL_CALL = 66`

Trying to call function indirectly (e.g. using function pointer) and the function
reference is null.

### `TRIWASM_FAULT_INVALID_EXPORT = 67`

Host trying to call function using unknown export index.
This may indicate mismatched host-guest interface.

