* General
  * Add option to ignore some or all unresolved imports. Calling ignored import function will cause µVM exception.
  * Allow compilation of µVM assembly file.
  * Abiliti to watch C stack (only for clang):
    * µVM need to have optional feature that adds a register that contains linked list of structures that describes watched memory:
      * structure: address, min_value, max_value, exception_code, next_entry
      * all stuctures are in µVM memory
    * Second option (better): Add three registers: WPTR, WMIN, WMAX
    * A way to determinate which global is a C stack pointer:
      * dummy exported function that must be linked during wasm generation and will be deleted during the compilation.
      * it creates some volatile buffer on the stack and passes it to some dummy imported function.
      * If there is no dummy function and there is only one global, this global is used.
    * A way to determinate its limits:
      * maximum is in global initialization
      * minimum is maximum minus stack size, which is known at the clang compilation stage.
  * Add memory tips at the end of compilation, e.g.
    * µVM stack size is 62K, minimum is 8K, you can increase `global-base` by 54K to provide more space for your wasm module.

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
  * int64-partial: (is it really needed?)
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
  * Merge locals that does not overlap. This may not be optimized by wasm-opt, because they are different types.
  * Use TMP registers for the mostly used locals that not need to be kept during calls.
  * Reduce shift count operant in i64 shift operations to 32-bit
  * Put constant address into memory access instruction (4 - 8 bytes) `PUSH X ... READ [LPM] + [POP] + offset  ->  READ offset_combined` (3 - 5 bytes)
  * Remove unused stack entries (may appear after i64 optimizations). Back-track stack entries that are not used and delete or modify instruction that put it there. `i64.const 1 ... i32.wrap_i64; call __uvmlib__shl64  ->  i32.const 1 ... call __uvmlib__shl64`
  * Use param as local if they are not overlapping, especially if param is moved to local and never touched again, then moving part may be removed
  * Inline simple `uvmlib` functions if they are not used many times `CALL __uvmlib__eq64  ->  READ [SP]+2; EQ; WRITE [SP]+2; READ [SP]+2; EQ; WRITE [SP]+2; AND`
  * Put second const operant into calls like `__uvmlib__xor64` and inline it, `PUSH hi ... PUSH lo; CALL __uvmlib__xor64  ->  XOR lo ; XOR hi` 
  * Put constant offset to memory load/store instructions `PUSH 32 ; ADD ; I32.LOAD [POP] ->  I32.LOAD [POP]+32`

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


Buildins
--------

* Maybe rename to uvmlib for all the functions. `buildins` stays for functions that are actually handled by *IRGenerator* or *UVMAsmGenerator*.
* `uvmlib` source is in C and in uvm assembler
* it is compiled into .cc file and added to `src` directory and pushed to the repository
* buildins:
  * `i64 __uvmbuildin__make64(i32, i32)` - it will translate into nothing, because two words are already on the stack
* `uvmlib` functions written in uvm assembler:
  * Reduce functions `REDUCE8`, `REDUCE16`, `REDUCE`
  * Startup functions
* `uvmlib` functions written in C:
  * WASM Instruction polyfill, e.g. `__uvmlibbuildin__clz`, `__uvmlibbuildin__clz64`
  * i64 emulation: `__uvmlibbuildin__add64`, `__uvmlibbuildin__udiv64`, ...
  * floating point emulation

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

TODO: EXTS imm ->  return (uint32_t)(((int32_t)arg0 << arg1) >> arg1);

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


64-bit emulation example
------------------------

```

$ADD64:                //                     RET, lo1, hi1, lo2, hi2, ...
1    READ [SP] + 3     //                lo2, RET, lo1, hi1, lo2, hi2, ...
1    READ [SP] + 2     //           lo1, lo2, RET, lo1, hi1, lo2, hi2, ...
1    ADD               //                loR, RET, lo1, hi1, lo2, hi2, ...
1    READ [SP] + 2     //           lo1, loR, RET, lo1, hi1, lo2, hi2, ...
1    READ [SP] + 1     //      loR, lo1, loR, RET, lo1, hi1, lo2, hi2, ...
1    ULT               //      loR<lo1,  loR, RET, lo1, hi1, lo2, hi2, ...
2    READ [SP] + 5     //      lo2, R<1, loR, RET, lo1, hi1, lo2, hi2, ...
1    READ [SP] + 2     // loR, lo2, R<1, loR, RET, lo1, hi1, lo2, hi2, ...
1    ULT               // loR<lo2,  R<1, loR, RET, lo1, hi1, lo2, hi2, ...
1    AND               //       R<2&R<1, loR, RET, lo1, hi1, lo2, hi2, ...
2    READ [SP] + 4
1    ADD               //         c+hi1, loR, RET, lo1, hi1, lo2, hi2, ...
2    READ [SP] + 6
1    ADD               //           hiR, loR, RET, lo1, hi1, lo2, hi2, ...
1    READ [SP] + 1     //      loR, hiR, loR, RET, lo1, hi1, lo2, hi2, ...
2    PUSH 0x26      | (or with reduce) | 1     READ [SP] + 3
1    READ [SP] + 3  |                  | 2     REDUCE 0x36
3    BR $REDUCE8    |                  |
---                                      ---
24                                       21

$REDUCE:
READ SP
        // sp, skip, keep, RET, ... keep-1 ..., ... skip ...
        
                                                WASM_EXPORT($REDUCE_inner)
                                                void $REDUCE_inner(uint32_t *addr, uint32_t skip, uint32_t keep)
                                                {
                                                    // TODO Opposite direction of memory coping
                                                    uint32_t *src = addr + 3;
                                                    uint32_t *dst = src + skip;
                                                    uint32_t *end = src + keep;
                                                    while (src < end) {
                                                        *dst++ = *src++;
                                                    }
                                                }

                    local.get $p0
READ [SP] + 0     1
                    i32.const 12
                    i32.add
ADD 12            1
                    local.tee $p0
READ  [SP] + 0    2
WRITE [SP] + 2    1
                    local.get $p2
READ [SP] + 3     2
                    i32.const 2
                    i32.shl
USHR -2           2
                    i32.add
ADD               1
                    local.set $p2
WRITE [SP] + 3    0
                    local.get $p1
READ [SP] + 1     1
                    i32.const 2
                    i32.shl
USHR -2           1
                    local.set $p1
WRITE [SP] + 2    0
$REDUCE$start:
                    loop $L0
                    local.get $p0
READ [SP] + 0     1
                    local.get $p2
READ [SP] + 3     2
                    i32.ge_u
                    i32.eqz
ULT               1
                    if $I1
BRF $REDUCE$end   0
                        local.get $p0
READ [SP] + 0     1
                        local.get $p1
READ [SP] + 2     2
                        i32.add
ADD               1
                        local.get $p0
READ [SP] + 1     2
                        i32.load
READ [POP]        2
                        i32.store
WRITE [POP]       0
                        local.get $p0
READ [SP] + 0     1
                        i32.const 4
                        i32.add
ADD 4             1
                        local.set $p0
WRITE [SP] + 1    0
                        br $L0
BR $REDUCE$start
                    end
                    end)
$REDUCE$end:
READ SP
READ [SP] + 2
ADD
ADD 4
WRITE SP
WRITE PC (the same as RETURN)
---
40 bytes



WASM_EXPORT($MUL64_32)
uint64_t $MUL64_32(uint32_t a, uint32_t b) {
    uint32_t r0 = (a & 0xFFFF) * (b & 0xFFFF);
    uint32_t r16p1 = (a >> 16) * (b & 0xFFFF);
    uint32_t r16p2 = (a & 0xFFFF) * (b >> 16);
    uint32_t r32 = (a >> 16) * (b >> 16);
    uint64_t r = (uint64_t)r0;
    r += (uint64_t)r16p1 << 16;
    r += (uint64_t)r16p2 << 16;
    r += (uint64_t)r32 << 32;
    return r;
}

WASM_EXPORT($MUL64)
uint64_t $MUL64(uint32_t al, uint32_t ah, uint32_t bl, uint32_t bh) {
    uint64_t r = $MUL64_32(al, bl);
    r += $MUL64_32(al, bh) << 32;
    r += $MUL64_32(ah, bl) << 32;
    return r;
}




```
