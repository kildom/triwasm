// Copyright (C) 2023 Dominik Kilian
// SPDX-License-Identifier: 0BSD

#include "common.h"

TRIVM_INLINE_ASSEMBLY(
    "// empty\n"
    )
uint64_t make64(uint32_t h, uint32_t l);


EXPORT(sub64)
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

EXPORT(add64)
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

EXPORT(udiv64)
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
