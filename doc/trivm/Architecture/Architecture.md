# triVM Architecture

**triVM** is stack-based virtual machine.
It provides simple instruction set containing integer,
bit operations, control flow and memory access instructions.
It has no high level functionality like object manipulation
or garbage collector.

## Table of contents

 * [Memory](Memory.md)
   * [Memory organization](Memory.md#memory-organization)
   * [Common Address Space](Memory.md#xommon-address-space)
     * [Individual Address Space](Memory.md#individual-address-space)
     * [Auxiliary Stack](Memory.md#auxiliary-stack)
   * [Program Memory](Memory.md#program-memory)
     * [Entry Points](Memory.md#entry-points)
   * [Data Memory](Memory.md#data-memory)
     * [Stack](Memory.md#stack)
     * [Registers](Memory.md#Registers)
 * [Instructions](Instructions.md)
   * [Encoding](Instructions.md#encoding)
   * [Binary operation instructions](Instructions.md#binary-operation-instructions)
   * [Unary operation instructions](Instructions.md#unary-operation-instructions)
   * [Branch instructions](Instructions.md#branch-instructions)
   * [Memory access instructions](Instructions.md#memory-access-instructions)
   * [Extensions](Instructions.md#extensions)
     * [Reduce Extension](ReduceExt.md)
     * [Int64 Extension](Int64Ext.md)
     * [Floating Point Extensions](FloatExt.md)
 * [VM Faults](VMFaults.md)
