
* Add µVM extensions:
  * External memory:
    * User can provide list of buffers (pointer and size) that virtual machine can access
    * List is valid only during specific function call
    * It is mapped to the beginning of a linear memory (unused part)
    * it is less safer than copying data to linear memory, so it should not be recommended
    * it it useful for passing large buffers that will take too much space in the linear memory
    * only READ/WRITE instructions can access external memory, stack cannot be there
    * Memory will be fragmented: | normal memory | allocable space for external memory | linear memory |
    * it is compiler independent, so this option is not needed to generate the bytecode.
  * int64-partial:
    * int32 instructions uses additional register as a carry to perform faster int64 operations
  * int64-full:
    * full int64 instruction set
  * float
  * double

* Optimization tips:
  * Put second const operant into destination instruction: `PUSH X ... SUB  ->  SUB X`
  * Put first const operant into destination instruction if they can be inverted (add, mul, and, or, xor): `PUSH X ... ADD  ->  ADD X`
  * If value comes from uvm `NOT` instruction, delete `NOT` and replace destination instruction from `BRT` to `BRF` or the opposite: `EQ ; NOT ; ... ; BRT  ->  EQ ; ... ; BRF`
  * If value comes from uvm `NOT` instruction, and destination is also `NOT` delete both: `NOT ; ... ; NOT  ->  ...`
  * Combine immutable globals with the same value
  * Replace repeating 32-bit const values into immutable globals:
    * (5 bytes) `PUT x  ->  READ -offset` (2 or 3 bytes + 4 common bytes) or
    * (5 bytes) `ADD x  ->  READ -offset ; ADD` (3 or 4 bytes + 4 common bytes)
    * It should be calculated if this optimization is gaining anything
  * Replace short immutable globals into inline consts: (2-3 bytes + 4 common) `READ -offset  ->  PUSH x` (2-3 bytes)
  * Replace `PUT X:i32` (5 byte) with `PUT X:i8 ; U/SSHR n` (4 bytes) if possible
  * Order globals (both mutable and immutable) by the number of uses, so the most common instructions will be shortest.

Compilation flow:
1. Parse wasm file and check basic integrity *WasmParser* and *WasmReader*
2. Do data association (e.g. convert index into actual data) and do full validation *WasmParser*
3. Generate abstract µVM instructions (as objects), keep the blocks as in wasm *IRGenerator*
4. Execute code optimization passes: *IROptimizer*
   1. inline operand *InlineOperandOpt*
   2. reduced negation *ReduceNegationOpt*
   3. common immediate to globals *CommonImmediateOpt*
   4. integer constant calculated *CalculateConstOpt*
5. Generate µVM code for each function *UVMAsmGenerator*
6. Add used buildins and startup code, data, immutable globals, bindings, e.t.c. *UVMAsmLinker*
7. Compile µVM code to final representation *UVMAsmBinGenerator* or *UVMAsmTextGenerator*



uVM instructions
----------------

```
CORE:     int64-full

BR
BRT
BRF
PUSH
POP
ADD       ADDQ
SUB       SUBQ
MUL       MULQ
SDIV      SDIVQ
SMOD      SMODQ
UDIV      UDIVQ
UMOD      UMODQ
NOT
NEG       NEGQ
SLT       SLTQ
SGT       SGTQ
ULT       ULTQ
UGT       UGTQ
EQ        EQQ
AND       ANDQ
OR        ORQ
XOR       XORQ
SSHR      SSHRQ
USHR      USHRQ
          READQ
          WRITEQ

READ[B|H] addr
WRITE[B|H] addr

addr:
    offset
    [SP] + offset
    [POP] + offset
    [LMP] + [POP] + offset

```


Stack
-----

In function:

```
| operand32    | <- SP + 0
| operand64_lo | <- SP + 4
| operand64_hi | <- SP + 8
| ...          |
|--------------|
| local1       |
| local2_lo    |
| local2_hi    |
| ...          |
|--------------|
| param1       |
| param2_lo    |
| param2_hi    |
| ...          |
|--------------|
```