// Copyright (C) 2023 Dominik Kilian
// SPDX-License-Identifier: 0BSD

#include "common.h"
#include <wasm_simd128.h>

TRIVM_INLINE_ASSEMBLY(
    "# nop\n"
    )
uint64_t make64(uint32_t h, uint32_t l);

TRIVM_INLINE_ASSEMBLY(
    "# nop\n"
    )
v128 make128(uint64_t h, uint64_t l);


TRIVM_EXPORT(sub64)
uint64_t sub64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    uint32_t carry = 0;
    if (al < bl) {
        carry = 1;
    }
    al -= bl;
    ah -= bh + carry;
    // TODO: when converted to triasm, add discardable block that saves second carry to GPR0
    return make64(ah, al);
}

TRIVM_EXPORT(add64)
uint64_t add64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    uint32_t carry = 0;
    if (al > ~bl) {
        carry = 1;
    }
    al += bl;
    ah += bh + carry;
    return make64(ah, al);
}

TRIVM_EXPORT(ushr64)
uint64_t ushr64(uint32_t b, uint32_t ah, uint32_t al)
{
    b &= 63;
    if (b >= 32) {
        al = ah;
        ah = 0;
        b -= 32;
    }
    if (b != 0) {
        al = (al >> b) | (ah << (32 - b));
        ah >>= b;
    }
    return make64(ah, al);
}

TRIVM_EXPORT(ushr64_1)
uint64_t ushr64_1(uint32_t ah, uint32_t al)
{
    al = (al >> 1) | (ah << 31);
    ah >>= 1;
    return make64(ah, al);
}


TRIVM_ASSEMBLY(
    "__triwasmlib__udivmod64_asm:\n"
    ".LOCAL loop_start"
    ".LOCAL skip_res"
    ".LOCAL add_res"
    // al, ah, bl, bh, ret, ret_latest
    "WRITE32 GPR1\n"
    // al, ah, bl, bh, ret
    "READST 8\n"
    "READST 8\n"
    "CALL __triwasmlib__clz64\n"
    // al, ah, bl, bh, ret, zeros
    "READST 12\n"
    "READST 12\n"
    "READST 8\n"
    "CALL __triwasmlib__shl64\n"
    // al, ah, bl, bh, ret, zeros, bl, bh
    "WRITEST 12\n"
    "WRITEST 12\n"
    // al, ah, bl, bh, ret, zeros
    "WRITE32 GPR0\n"
    "NEG -1\n"
    "READ32 MAB0\n"
    "READST 0\n"
    "READST 0\n"
    "READ32 GPR0\n"
    "CALL __triwasmlib__shl64\n"
    // al, ah, bl, bh, ret, shift:lo, shift:hi, res:lo, res:hi
    "loop_start:\n"
    "READST 32\n"
    "READST 32\n"
    "READST 32\n"
    "READST 32\n"
    ".REF __triwasmlib__sub64_save_carry"  //TODO: Referencing this label will enable discardable block in sub64 that saves carry to GPR0
    "CALL __triwasmlib__sub64\n"
    "READ32 GRP0\n"
    "BRF add_res\n"
    "WRITE32 GRP0\n"
    "WRITE32 GRP0\n"
    "BR skip_res\n"
    "add_res:"
    // al, ah, bl, bh, ret, shift:lo, shift:hi, res:lo, res:hi, al, ah
    "WRITEST 32\n"
    "WRITEST 32\n"
    // al, ah, bl, bh, ret, shift:lo, shift:hi, res:lo, res:hi
    "READST 12\n"
    "READST 12\n"
    // al, ah, bl, bh, ret, shift:lo, shift:hi, res:lo, res:hi, shift:lo, shift:hi
    "CALL __triwasmlib__or64\n"
    "skip_res:\n"
    // al, ah, bl, bh, ret, shift:lo, shift:hi, res:lo, res:hi
    "READST 24\n"
    "READST 24\n"
    "CALL __triwasmlib__ushr64_1\n"
    "WRITEST 24\n"
    "WRITEST 24\n"
    "READST 12\n"
    "READST 12\n"
    "CALL __triwasmlib__ushr64_1\n"
    "READST 4\n"
    "READST 4\n"
    // al, ah, bl, bh, ret, shift:lo, shift:hi, res:lo, res:hi, shift:lo, shift:hi, shift:lo, shift:hi
    "WRITEST 20\n"
    "WRITEST 20\n"
    // al, ah, bl, bh, ret, shift:lo, shift:hi, res:lo, res:hi, shift:lo, shift:hi
    "OR\n"
    "BRT loop_start\n"
    // al, ah, bl, bh, ret, shift:lo, shift:hi, res:lo, res:hi
    "READST 16\n"
    // al, ah, bl, bh, ret, shift:lo, shift:hi, res:lo, res:hi, ret
    "READ32 GPR1\n"
    "WRITE32 PC\n"
    )
uint64_t udivmod64_asm(uint64_t a, uint64_t b);
/*
    zeros = count_leading_zeros(b)
    b <<= zeros
    shift = 1 << zeros
    result = 0
    loop_start:
        x = a - b
        if (!carry_from_last_subtraction) {
            a = x
            result |= shift
        }
        b >>= 1
        shift >>= 1
        if (shift) goto loop_start
    return everything from stack:
        al, ah, bl, bh, ret, shift:lo, shift:hi, res:lo, res:hi, ret
*/

TRIVM_ASSEMBLY(
    // al, ah, bl, bh, ret
    "CALL __triwasmlib__udivmod64_asm\n"
    // rem:lo, rem:hi, x, x, x, x, x, res:lo, res:hi, ret
    ".if TRIVM_EXT_UNWIND\n"
    "RUNWIND 2, 7\n"
    ".else\n"
    "NEG -0x26\n"
    "BR __trivm__unwind8_ret\n"
    ".end\n"
    )
uint64_t udiv64_asm(uint64_t a, uint64_t b);

TRIVM_ASSEMBLY(
    // al, ah, bl, bh, ret
    "CALL __triwasmlib__udivmod64_asm\n"
    // rem:lo, rem:hi, x, x, x, x, x, res:lo, res:hi, ret
    ".if TRIVM_EXT_UNWIND\n"
    "RUNWIND 0, 7\n"
    ".else\n"
    "NEG -0x06\n"
    "BR __trivm__unwind8_ret\n"
    ".end\n"
    )
uint64_t umod64_asm(uint64_t a, uint64_t b);


TRIVM_EXPORT(udiv64)
v128 udivmod64(uint32_t is_mod, uint64_t b, uint64_t a)
{
    uint32_t zeros = __builtin_clzll(b);
    b <<= zeros;
    uint64_t shift = (uint64_t)1 << zeros;
    uint64_t result = 0;
    while (shift) {
        if (a >= b) {
            result |= shift;
            a -= b;
        }
        shift >>= 1;
        b >>= 1;
    }
    return make128(a, result);
}

TRIVM_EXPORT(i32_clz)
uint32_t i32_clz(uint32_t a)
{
    uint32_t res = 0;
    while (res < 32 && (int32_t)a > 0) {
        a <<= 1;
        res++;
    }
    return res;
}

TRIVM_EXPORT(i64_clz32)
uint32_t i64_clz32(uint32_t ah, uint32_t al)
{
    uint32_t res = 0;
    if (ah == 0) {
        return 32 + i32_clz(al);
    } else {
        return i32_clz(ah);
    }
}

TRIVM_EXPORT(i64_ne)
uint32_t i64_ne(uint32_t ah, uint32_t al, uint32_t bh, uint32_t bl)
{
    return al != bl || ah != bh ? 1 : 0;
}

TRIVM_EXPORT(i64_le_s)
uint32_t i64_le_s(uint32_t ah, uint32_t al, uint32_t bh, uint32_t bl)
{
    return 0; // TODO: call i64_sub and compare only high word.
}

TRIVM_ASSEMBLY(
    "READST 0\n"
    "READ32 MAB0\n"
    "WRITEST 1\n"
    "JUMP udivmod64"
    )
uint64_t udiv64(uint64_t b, uint64_t a);

TRIVM_ASSEMBLY(
    "READST 0\n"
    "NEG -1\n"
    "WRITEST 1\n"
    "JUMP udivmod64"
    )
uint64_t umod64(uint64_t b, uint64_t a);

TRIVM_EXPORT_INLINE_ASSEMBLY(
    uint64_t, i64_extend_i32_s, (uint32_t a),
    "READST 0\n"
    "SSHR 31\n"
);
