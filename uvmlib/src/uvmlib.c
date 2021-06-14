
#include <stdint.h>

#define EXPORT(name) __attribute__((used)) __attribute__((export_name(#name)))
#define IMPORT(name) __attribute__((used)) __attribute__((import_name(#name)))


IMPORT(__uvm_buildin__make64)
uint64_t __uvm_buildin__make64(uint32_t h, uint32_t l);

IMPORT(__uvm_buildin__set_temp)
void __uvm_buildin__set_temp(uint32_t value);
IMPORT(__uvm_buildin__get_temp)
uint32_t __uvm_buildin__get_temp();
IMPORT(__uvm_buildin__set_temp64)
void __uvm_buildin__set_temp64(uint64_t value);
IMPORT(__uvm_buildin__get_temp64)
uint64_t __uvm_buildin__get_temp64();

#define __uvm_buildin__get_inl_param0() (*(volatile uint32_t*)0xFFFFFFF0)
#define __uvm_buildin__get_inl_param1() (*(volatile uint32_t*)0xFFFFFFF1)
#define __uvm_buildin__get_inl_param2() (*(volatile uint32_t*)0xFFFFFFF2)
#define __uvm_buildin__get_inl_param3() (*(volatile uint32_t*)0xFFFFFFF3)

EXPORT(__uvmlib__sub64)
uint64_t __uvmlib__sub64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    uint32_t carry = 0;
    if (al < bl) {
        carry = 1;
    }
    al -= bl;
    ah -= bh + carry;
    return __uvm_buildin__make64(ah, al);
}

EXPORT(__uvmlib__add64)
uint64_t __uvmlib__add64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    uint32_t carry = 0;
    if (al > ~bl) {
        carry = 1;
    }
    al += bl;
    ah += bh + carry;
    return __uvm_buildin__make64(ah, al);
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

EXPORT(__uvmlib__mul64)
uint64_t __uvmlib__mul64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al) {
    uint64_t r = mul32_64(al, bl);
    r += mul32_64(al, bh) << 32;
    r += mul32_64(ah, bl) << 32;
    return r;
}

EXPORT(__uvmlib__udiv64)
uint64_t __uvmlib__udiv64(uint64_t b, uint64_t a)
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
    __uvm_buildin__set_temp64(a);
    return result;
}

EXPORT(__uvmlib__umod64)
uint64_t __uvmlib__umod64(uint64_t b, uint64_t a)
{
    __uvmlib__udiv64(b, a);
    return __uvm_buildin__get_temp64();
}

EXPORT(__uvmlib__clz)
uint32_t __uvmlib__clz(uint32_t a)
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

EXPORT(__uvmlib__clz_ver2)
uint32_t __uvmlib__clz_ver2(uint32_t a)
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

EXPORT(__uvmlib__clz64)
uint64_t __uvmlib__clz64(uint32_t hi, uint32_t lo)
{
    return __uvm_buildin__make64(0, hi != 0 ? __builtin_clz(hi) : __builtin_clz(lo) + 32);
}

EXPORT(__uvmlib__clz64_32)
uint32_t __uvmlib__clz64_32(uint32_t hi, uint32_t lo)
{
    return hi != 0 ? __builtin_clz(hi) : __builtin_clz(lo) + 32;
}

EXPORT(__uvmlib__neg64)
uint64_t __uvmlib__neg64(uint32_t hi, uint32_t lo)
{
    uint32_t carry = 0;
    if (0 < lo) {
        carry = 1;
    }
    lo = 0 - lo;
    hi = 0 - hi - carry;
    return __uvm_buildin__make64(hi, lo);
}

EXPORT(__uvmlib__ult64)
uint32_t __uvmlib__ult64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    if (ah == bh)
        return al < bl;
    return ah < bh;
}

EXPORT(__uvmlib__ugt64)
uint32_t __uvmlib__ugt64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    if (ah == bh)
        return al > bl;
    return ah > bh;
}

EXPORT(__uvmlib__shl64_32)
uint64_t __uvmlib__shl64_32(uint32_t shift, uint32_t ah, uint32_t al)
{
    shift &= 0x3F;
    if (shift == 0) {
        return __uvm_buildin__make64(ah, al);
    } else if (shift < 32) {
        uint32_t l = al << shift;
        uint32_t h = (ah << shift) | (al >> (32 - shift));
        return __uvm_buildin__make64(h, l);
    } else {
        uint32_t h = al << (shift - 32);
        return __uvm_buildin__make64(h, 0);
    }
}

EXPORT(__uvmlib__sshr64_32)
uint64_t __uvmlib__sshr64_32(uint32_t shift, uint32_t ah, uint32_t al)
{
    shift &= 0x3F;
    if (shift == 0) {
        return __uvm_buildin__make64(ah, al);
    } else if (shift < 32) {
        uint32_t h = (int32_t)ah >> shift;
        uint32_t l = (al >> shift) | (ah << (32 - shift));
        return __uvm_buildin__make64(h, l);
    } else {
        uint32_t h = (int32_t)ah >> 31;
        uint32_t l = (int32_t)ah >> (shift - 32);
        return __uvm_buildin__make64(h, l);
    }
}

EXPORT(__uvmlib__ushr64_32)
uint64_t __uvmlib__ushr64_32(uint32_t shift, uint32_t ah, uint32_t al)
{
    shift &= 0x3F;
    if (shift == 0) {
        return __uvm_buildin__make64(ah, al);
    } else if (shift < 32) {
        uint32_t h = ah >> shift;
        uint32_t l = (al >> shift) | (ah << (32 - shift));
        return __uvm_buildin__make64(h, l);
    } else {
        uint32_t l = ah >> (shift - 32);
        return __uvm_buildin__make64(0, l);
    }
}


EXPORT(__uvmlib__shl64)
uint64_t __uvmlib__shl64(uint32_t bh, uint32_t bl, uint32_t ah, uint32_t al)
{
    return __uvmlib__shl64_32(bl, ah, al);
}
