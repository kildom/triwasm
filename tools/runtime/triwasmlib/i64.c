// Copyright (C) 2023 Dominik Kilian
// SPDX-License-Identifier: 0BSD

#include "common.h"

TRIVM_INLINE_ASSEMBLY(
    "// empty\n"
    )
uint64_t make64(uint32_t h, uint32_t l);


TRIVM_EXPORT(sub64)
uint64_t sub64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    uint32_t carry = 0;
    if (al < bl) {
        carry = 1;
    }
    al -= bl;
    ah -= bh + carry;
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

TRIVM_EXPORT(udiv64)
uint64_t udivmod64(uint32_t is_mod, uint64_t b, uint64_t a)
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
    return is_mod ? a : result;
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

TRIVM_ASSEMBLY(
    "READ [SP]\n"
    "PUSH 0\n"
    "WRITE [SP] + 1\n"
    "JUMP udivmod64"
    )
uint64_t udiv64(uint64_t b, uint64_t a);

TRIVM_ASSEMBLY(
    "READ [SP]\n"
    "PUSH 1\n"
    "WRITE [SP] + 1\n"
    "JUMP udivmod64"
    )
uint64_t umod64(uint64_t b, uint64_t a);
