* General
  * Add option to ignore some or all unresolved imports. Calling ignored import function will cause triVM exception.
  * Allow compilation of triVM assembly file.
  * Abiliti to watch C stack (only for clang):
    * triVM need to have optional feature that adds a register that contains linked list of structures that describes watched memory:
      * structure: address, min_value, max_value, exception_code, next_entry
      * all stuctures are in triVM memory
    * Second option (better): Add three registers: WPTR, WMIN, WMAX
    * A way to determinate which global is a C stack pointer:
      * dummy exported function that must be linked during wasm generation and will be deleted during the compilation.
      * it creates some volatile buffer on the stack and passes it to some dummy imported function.
      * If there is no dummy function and there is only one global, this global is used.
    * A way to determinate its limits:
      * maximum is in global initialization
      * minimum is maximum minus stack size, which is known at the clang compilation stage.
  * Add memory tips at the end of compilation, e.g.
    * triVM stack size is 62K, minimum is 8K, you can increase `global-base` by 54K to provide more space for your heap size.
  * Add special virtual memory area (e.g. 0x80000000) that will be compiled to globals, e.g. `((uint32_t*)0x80000014) = 123`.
    Globals have smaller instruction size, so this is only optimization solution.
  * Use [LEMON](https://en.wikipedia.org/wiki/Lemon_(parser_generator)) parser generator to parse assembly file.
  * Add option to compile into one memory.
    * Program will be loaded by host to the beginning of the data memory.
    * PMB register will be 0 (or program memory will be disabled in triVM).
    * Startup code should move initialized data into right place, making room for e.g. VM stack
  * Move WasmData content to WasmModule and collect all modules into Program structure (preparation for module linking)
  * Add special type of module for `trivmlib` module
    * It is identified by special export function name e.g. `__trivm__simple_module_linkage_marker()`
    * Functions are not allowed to use memory and tables
    * Memory data may contain special string e.g. `__triVM_inline_asm_begin_378dkjaJhDk278B28:function_name:code:__triVM_inline_asm_end_378dkjaJhDk278B28`.
      Function body and locals of function `function_name` will be removed and replaced by the `code` which is triVM assembly code.
    * Other modules can also use this feature.
  * Security issue to solve: attacker may create very long instructions using variable length address of read/write instructions.
    Host will allow limited number of instructions, but still it will take a long time to process very long instructions.
  * CoreMark test for wasm:
    https://github.com/wasm3/wasm-coremark
  * List of other engines:
    https://github.com/wasm3/wasm3/blob/main/docs/Performance.md
  * Soft float library:
    http://www.jhauser.us/arithmetic/SoftFloat.html

* Add triVM extensions:
  * Memory mappings:
    * VM can be configured to use N MSB bits as memory identifier, e.g 2 bits gives 4 memories 1GB each.
    * Each memory can grow indepenently
    * By default stack can be allocated only on memory 0, but it can be configured to use any, but it cannot span on multiple memories.
  * External memory:
    * User can provide list of buffers (pointer and size) that virtual machine can access
    * List is valid only during specific function call
    * The list is mapped to one specific memory identifier
    * it is less safer than copying data to linear memory, so it should not be recommended
    * it it useful for passing large buffers that will take too much space in the linear memory
    * only READ/WRITE instructions can access external memory, stack cannot be there
    * it is compiler independent, so this option is not needed to generate the bytecode.
  * int64-partial: (is it really needed?)
    * int32 instructions uses additional register as a carry to perform faster int64 operations
  * int64-full:
    * full int64 instruction set
  * float
  * double

* Optimization tips:
  * Put second const operant into destination instruction: `PUSH X ... SUB  ->  SUB X`
  * Put first const operant into destination instruction if they can be inverted (add, mul, and, or, xor, lt/gt): `PUSH X ... ADD  ->  ADD X` or `PUSH X ... ULT  ->  UGT X`
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
  * 64-bit shift instructions ignores higher word of shift count, so they can be removed `SHL64LLL -> SHL64LWL`, also for emulation: `CALL __trivmlib.i64_shl -> CALL __trivmlib.i64_shl_32`.

TODOs:
  * Check which floating point comparison operators can be replaced by `inverted_OP ; NOT` to allow further conditional branch optimization.

Compilation flow:
1. Parse wasm file and check basic integrity *WasmParser* and *WasmReader*
2. Do data association (e.g. convert index into actual data) and do full validation *WasmParser*
3. Generate abstract triVM instructions (as objects), keep the blocks as in wasm *IRGenerator*
4. Execute code optimization passes: *IROptimizer*
   1. inline operand *InlineOperandOpt*
   2. reduced negation *ReduceNegationOpt*
   3. common immediate to globals *CommonImmediateOpt*
   4. integer constant calculated *CalculateConstOpt*
5. Generate triVM code for each function *UVMAsmGenerator*
6. Add used buildins and startup code, data, immutable globals, bindings, e.t.c. *UVMAsmLinker*
7. Compile triVM code to final representation *UVMAsmBinGenerator* or *UVMAsmTextGenerator*


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

On-line demo
------------

May use web browser PC emulator: https://github.com/s-macke/jor1k/wiki/Benchmark-with-other-emulators

`time head -c 5000000 /dev/urandom | gzip -c -9 - > /dev/null`

native |	0,2
-----|-----
v86 chrome	|10,7
v86 firefox	|5,3
jsLinux firefox |	23,2
jsLinux chrome	| 20,4

Best case is 26x slower than native - it is acceptable? **not for C++**, because:

Clang compiled on Ubuntu with `-Os -m32` running on `Tiny Core`. Copiling C/C++ hello world: `clang++ a.cpp -O? -g0`:
```
C++:
 chrome -Oz:  4m 41s
 firefox -Oz: 3m 55s
 firefox -O0: 2m 14s
 firefox -O1: 2m 6s
C:
 chrome -Oz:  10s
 firefox -Oz: 4s
```

Clang (from wasi-sdk) must be compiled with i386 target support to be able to compile host program.
Alternative is to include gcc into linux image, but it will take ~60MB more space.
`libcxx` and `libcxxabi` are not reqiured, because they are not needed for C.

Only solution supporting C++ is to compile clang for wasi-sdk and create virtual enviroment in a browser, e.g.:
```
Build All and Run.cmds
config/
    trivm.conf
    Build Conf.cmds
    output
        trivm_host.h
        trivm_host.c
        trivm_guest.h
        trivm_guest.c
host/
    host_main.c
    Build Host.cmds
    Run Host.cmds
    output
        host
guest/
    guest_main.c
    Build Guest.cmds
    output/
        guest.wasm
        guest.trivm
tools/
    wasi-sdk/
        ...
    binaryen/
        ...
    triwasm/
        ...
    cmds/
        ...
    trivm/
        ...
```
