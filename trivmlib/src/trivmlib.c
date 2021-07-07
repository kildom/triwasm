
#include <stdint.h>

#define EXPORT(name) __attribute__((used)) __attribute__((export_name(#name)))
#define IMPORT_BUILDIN(name) __attribute__((used)) __attribute__((import_module("__trivm_buildin__"))) __attribute__((import_name(#name)))

IMPORT_BUILDIN(make64)
uint64_t __trivm_buildin__make64(uint32_t h, uint32_t l);

EXPORT(sub64)
uint64_t sub64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    uint32_t carry = 0;
    if (al < bl) {
        carry = 1;
    }
    al -= bl;
    ah -= bh + carry;
    return __trivm_buildin__make64(ah, al);
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
    return __trivm_buildin__make64(ah, al);
}

#if 0

IMPORT(__trivm_buildin__make64)
uint64_t __trivm_buildin__make64(uint32_t h, uint32_t l);

IMPORT(__trivm_buildin__set_temp)
void __trivm_buildin__set_temp(uint32_t value);
IMPORT(__trivm_buildin__get_temp)
uint32_t __trivm_buildin__get_temp();
IMPORT(__trivm_buildin__set_temp64)
void __trivm_buildin__set_temp64(uint64_t value);
IMPORT(__trivm_buildin__get_temp64)
uint64_t __trivm_buildin__get_temp64();

#define __trivm_buildin__get_inl_param0() (*(volatile uint32_t*)0xFFFFFFF0)
#define __trivm_buildin__get_inl_param1() (*(volatile uint32_t*)0xFFFFFFF1)
#define __trivm_buildin__get_inl_param2() (*(volatile uint32_t*)0xFFFFFFF2)
#define __trivm_buildin__get_inl_param3() (*(volatile uint32_t*)0xFFFFFFF3)

EXPORT(__trivmlib__sub64)
uint64_t __trivmlib__sub64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    uint32_t carry = 0;
    if (al < bl) {
        carry = 1;
    }
    al -= bl;
    ah -= bh + carry;
    return __trivm_buildin__make64(ah, al);
}

EXPORT(__trivmlib__add64)
uint64_t __trivmlib__add64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    uint32_t carry = 0;
    if (al > ~bl) {
        carry = 1;
    }
    al += bl;
    ah += bh + carry;
    return __trivm_buildin__make64(ah, al);
}

EXPORT(__trivmlib__f32_min)
float __trivmlib__f32_min(float a, float b)
{
    if (__trivm_buildin__ext_f32()) {
        // Call of __trivm_buildin__ext_f32 function should be replaced by const,
        // and const will remove part of the if block (in reduction stage).
        // In optimization stage, `const` instruction will be removed and
        // `if` block will be replaced by ordinary `block`.
        // To avoid clang optimizations `__trivm_buildin__ext_xxx` should be
        // used with the bit operators: && -> &, || -> |, ! -> 1^
        return a < b ? a : b;
    } else {
        // TODO: different implementation
    }
    return 0;
}

static
uint64_t mul32_64(uint32_t a, uint32_t b) {
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

EXPORT(__trivmlib__mul64)
uint64_t __trivmlib__mul64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al) {
    uint64_t r = mul32_64(al, bl);
    r += mul32_64(al, bh) << 32;
    r += mul32_64(ah, bl) << 32;
    return r;
}

EXPORT(__trivmlib__udiv64)
uint64_t __trivmlib__udiv64(uint64_t b, uint64_t a)
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
    __trivm_buildin__set_temp64(a);
    return result;
}

EXPORT(__trivmlib__umod64)
uint64_t __trivmlib__umod64(uint64_t b, uint64_t a)
{
    __trivmlib__udiv64(b, a);
    return __trivm_buildin__get_temp64();
}

EXPORT(__trivmlib__clz)
uint32_t __trivmlib__clz(uint32_t a)
{
    uint32_t result = 0;
    if (a == 0)
        return 32;
    while (!(a & 0x80000000)) {
        a <<= 1;
        result++;
    }
    return result;
}

EXPORT(__trivmlib__clz_ver2)
uint32_t __trivmlib__clz_ver2(uint32_t a)
{
    uint32_t mask = 0xFFFF0000;
    uint32_t len = 16;
    uint32_t pos = 0;
    if (a == 0)
        return 32;
    while (len > 0) {
        if (!(a & mask)) {
            mask >>= len;
            pos += len;
        }
        len >>= 1;
        mask &= mask << len;
    }
    return pos;
}

EXPORT(__trivmlib__clz64)
uint64_t __trivmlib__clz64(uint32_t hi, uint32_t lo)
{
    return __trivm_buildin__make64(0, hi != 0 ? __builtin_clz(hi) : __builtin_clz(lo) + 32);
}

EXPORT(__trivmlib__clz64_32)
uint32_t __trivmlib__clz64_32(uint32_t hi, uint32_t lo)
{
    return hi != 0 ? __builtin_clz(hi) : __builtin_clz(lo) + 32;
}

EXPORT(__trivmlib__neg64)
uint64_t __trivmlib__neg64(uint32_t hi, uint32_t lo)
{
    uint32_t carry = 0;
    if (0 < lo) {
        carry = 1;
    }
    lo = 0 - lo;
    hi = 0 - hi - carry;
    return __trivm_buildin__make64(hi, lo);
}

EXPORT(__trivmlib__ult64)
uint32_t __trivmlib__ult64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    if (ah == bh)
        return al < bl;
    return ah < bh;
}

EXPORT(__trivmlib__ugt64)
uint32_t __trivmlib__ugt64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    if (ah == bh)
        return al > bl;
    return ah > bh;
}

EXPORT(__trivmlib__shl64_32)
uint64_t __trivmlib__shl64_32(uint32_t shift, uint32_t ah, uint32_t al)
{
    shift &= 0x3F;
    if (shift == 0) {
        return __trivm_buildin__make64(ah, al);
    } else if (shift < 32) {
        uint32_t l = al << shift;
        uint32_t h = (ah << shift) | (al >> (32 - shift));
        return __trivm_buildin__make64(h, l);
    } else {
        uint32_t h = al << (shift - 32);
        return __trivm_buildin__make64(h, 0);
    }
}

EXPORT(__trivmlib__sshr64_32)
uint64_t __trivmlib__sshr64_32(uint32_t shift, uint32_t ah, uint32_t al)
{
    shift &= 0x3F;
    if (shift == 0) {
        return __trivm_buildin__make64(ah, al);
    } else if (shift < 32) {
        uint32_t h = (int32_t)ah >> shift;
        uint32_t l = (al >> shift) | (ah << (32 - shift));
        return __trivm_buildin__make64(h, l);
    } else {
        uint32_t h = (int32_t)ah >> 31;
        uint32_t l = (int32_t)ah >> (shift - 32);
        return __trivm_buildin__make64(h, l);
    }
}

EXPORT(__trivmlib__ushr64_32)
uint64_t __trivmlib__ushr64_32(uint32_t shift, uint32_t ah, uint32_t al)
{
    shift &= 0x3F;
    if (shift == 0) {
        return __trivm_buildin__make64(ah, al);
    } else if (shift < 32) {
        uint32_t h = ah >> shift;
        uint32_t l = (al >> shift) | (ah << (32 - shift));
        return __trivm_buildin__make64(h, l);
    } else {
        uint32_t l = ah >> (shift - 32);
        return __trivm_buildin__make64(0, l);
    }
}


EXPORT(__trivmlib__shl64)
uint64_t __trivmlib__shl64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    return __trivmlib__shl64_32(bl, ah, al);
}


    ".function REDUCE8\n"
    "REDUCE8:\n"
    ".locals ret, arg\n"
    "WRITE TMP0\n"
    "WRITE TMP1\n"
    "READ TMP0\n"
    "READ TMP1\n"
    "AND 0x1F\n"
    "READ TMP1\n"
    "SHR 5\n"
    "AND 0x07\n"
    "BR REDUCE_INNER\n"
    ".endfunc\n"


    ".function REDUCE8_RET\n"
    "REDUCE8_RET:\n"
    ".locals arg, ret\n"
    "WRITE TMP0\n"
    "READ TMP0\n"
    "AND 0x1F\n"
    "READ TMP0\n"
    "SHR 5\n"
    "AND 0x07\n"
    "BR REDUCE_INNER\n"
    ".endfunc\n"

    ".function REDUCE16\n"
    "REDUCE16:\n"
    ".locals ret, arg\n"
    "WRITE TMP0\n"
    "WRITE TMP1\n"
    "READ TMP0\n"
    "READ TMP1\n"
    "AND 0x3FF\n"
    "READ TMP1\n"
    "SHR 10\n"
    "AND 0x3F\n"
    "BR REDUCE_INNER\n"
    ".endfunc\n"

    ".function REDUCE\n"
    "REDUCE:\n"
    ".locals ret, keep, skip,\n"
    "WRITE TMP0\n"
    "WRITE TMP1\n"
    "WRITE TMP2\n"
    "READ TMP0\n"
    "READ TMP2\n"
    "READ TMP1\n"
    "BR REDUCE_INNER\n"
    ".endfunc\n"

    ".function REDUCE_INNER\n"
    "REDUCE_INNER:\n"
    "READ SP\n"
    ".locals initial_sp, keep, skip, ret,\n"
    ".endfunc\n"

    ".func __uvmlib__and64\n"
    ".locals ret, bh, bl, ah, al\n"
    "WRITE __uvmlib__temp_addr\n"
    "WRITE TMP0\n"
    "WRITE TMP1\n"
    "WRITE TMP2\n"
    "READ TMP1\n"
    "AND\n"
    "READ TMP0\n"
    "READ TMP2\n"
    "AND\n"
    "READ __uvmlib__temp_addr\n"
    "RETURN\n"
    ".endfunc\n"

#endif
