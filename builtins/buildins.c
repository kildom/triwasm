
#include <stdint.h>

#define EXPORT(name) \
    __attribute__((used)) \
    __attribute__((export_name(#name)))

#define IMPORT(name) \
    __attribute__((used)) \
    __attribute__((import_name(#name)))

EXPORT($__buildin__$MUL32_64)
uint64_t $MUL32_64(uint32_t a, uint32_t b) {
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

__attribute__((used)) const char reducestr =
"buildinstr:"
"$__buildin__$REDUCE:\n"
"READ SP\n"
".buildin_inline($inlinedREDUCE)\n"
;



EXPORT($MUL64)
uint64_t $MUL_64(uint32_t al, uint32_t ah, uint32_t bl, uint32_t bh) {
    uint64_t r = $MUL32_64(al, bl);
    r += $MUL32_64(al, bh) << 32;
    r += $MUL32_64(ah, bl) << 32;
    return r;
}

IMPORT(set_register_TMP0_64)
void set_register_TMP0_64(uint64_t);
IMPORT(get_register_TMP0_64)
uint64_t get_register_TMP0_64();

EXPORT($UDIV64)
uint64_t $UDIV64(uint64_t a, uint64_t b)
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
    set_register_TMP0_64(a);
    return result;
}

EXPORT($UMOD64)
uint64_t $UMOD64(uint64_t a, uint64_t b)
{
    $UDIV64(a, b);
    return get_register_TMP0_64();
}

EXPORT($CLZ32)
uint32_t $CLZ32(uint32_t a)
{
    uint32_t result = 0;
    while (!(a & 0x80000000)) {
        a <<= 1;
        result++;
    }
}

EXPORT($CLZ64)
uint32_t $CLZ64(uint32_t hi, uint32_t lo)
{
    if (hi != 0)
        return __builtin_clz(hi);
    else
        return __builtin_clz(lo) + 32;
}

IMPORT("$make64")
uint64_t $make64(uint32_t h, uint32_t l);

EXPORT($SUB64)
uint64_t $SUB64(uint32_t ah, uint32_t al, uint32_t bh, uint32_t bl)
{
    uint32_t carry = 0;
    if (al < bl) {
        carry = 1;
    }
    al -= bl;
    ah -= bh + carry;
    return $make64(ah, al);
}


WASM_EXPORT($CMP)
uint32_t $CMP(uint32_t r, uint32_t a, uint32_t b) {
    return r < a || r < b;
}

WASM_IMPORT($mulHi)
void $mulHi(uint32_t);

WASM_EXPORT($MUL32_64)
uint64_t $MUL32_64(uint32_t a, uint32_t b) {
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
uint64_t $MUL_64(uint32_t al, uint32_t ah, uint32_t bl, uint32_t bh) {
    uint64_t r = $MUL32_64(al, bl);
    r += $MUL32_64(al, bh) << 32;
    r += $MUL32_64(ah, bl) << 32;
    return r;
}

WASM_IMPORT(set_register_TMP0_64)
void set_register_TMP0_64(uint64_t);
WASM_IMPORT(get_register_TMP0_64)
uint64_t get_register_TMP0_64();

WASM_EXPORT($UDIV64)
uint64_t $UDIV64(uint64_t a, uint64_t b)
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
    set_register_TMP0_64(a);
    return result;
}

WASM_EXPORT($UMOD64)
uint64_t $UMOD64(uint64_t a, uint64_t b)
{
    $UDIV64(a, b);
    return get_register_TMP0_64();
}

WASM_EXPORT($CLZ32)
uint32_t $CLZ32(uint32_t a)
{
    uint32_t result = 0;
    while (!(a & 0x80000000)) {
        a <<= 1;
        result++;
    }
    return result;
}


WASM_IMPORT($make64)
uint64_t $make64(uint32_t h, uint32_t l);

WASM_EXPORT($SUB64)
uint64_t $SUB64(uint32_t ah, uint32_t al, uint32_t bh, uint32_t bl)
{
    uint32_t carry = 0;
    if (al < bl) {
        carry = 1;
    }
    al -= bl;
    ah -= bh + carry;
    return $make64(ah, al);
}

WASM_EXPORT($ADD64)
uint64_t $ADD64(uint32_t ah, uint32_t al, uint32_t bh, uint32_t bl)
{
    uint32_t carry = 0;
    if (al > ~bl) {
        carry = 1;
    }
    al += bl;
    ah += bh + carry;
    return $make64(ah, al);
}

