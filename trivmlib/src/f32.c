
#include "common.h"

#include "softfloat.h"

#define EXP_BINOP32(T, name) \
EXPORT(trivm_##name) \
T trivm_##name( float32_t a, float32_t b ) \
{ \
    return name(a, b); \
} \

EXP_BINOP32(bool, f32_eq);
EXP_BINOP32(bool, f32_lt);
EXP_BINOP32(bool, f32_le);
EXP_BINOP32(float32_t, f32_add);
EXP_BINOP32(float32_t, f32_sub);
EXP_BINOP32(float32_t, f32_mul);
EXP_BINOP32(float32_t, f32_div);

EXPORT(trivm_f32_gt)
bool trivm_f32_gt( float32_t a, float32_t b )
{
    return trivm_f32_lt(b, a);
}

EXPORT(trivm_f32_ge)
bool trivm_f32_ge( float32_t a, float32_t b )
{
    return trivm_f32_le(b, a);
}

EXPORT(trivm_f32_ne)
bool trivm_f32_ne( float32_t a, float32_t b )
{
    return !trivm_f32_eq(b, a);
}

EXPORT(trivm_f32_ceil)
float32_t trivm_f32_ceil( float32_t a )
{
    return f32_roundToInt(a, softfloat_round_max, false);
}

EXPORT(trivm_f32_floor)
float32_t trivm_f32_floor( float32_t a )
{
    return f32_roundToInt(a, softfloat_round_min, false);
}

EXPORT(trivm_f32_trunc)
float32_t trivm_f32_trunc( float32_t a )
{
    return f32_roundToInt(a, softfloat_round_minMag, false);
}


EXPORT(trivm_f32_nearest)
float32_t trivm_f32_nearest( float32_t a )
{
    return f32_roundToInt(a, softfloat_round_near_even, false);
}

EXPORT(trivm_f32_convert_i32_s)
float32_t trivm_f32_convert_i32_s(int32_t a)
{
    return i32_to_f32(a);
}

EXPORT(trivm_f32_convert_i32_u)
float32_t trivm_f32_convert_i32_u(int32_t a)
{
    return ui32_to_f32(a);
}

EXPORT(trivm_f32_convert_i64_s)
float32_t trivm_f32_convert_i64_s(int64_t a)
{
    return i64_to_f32(a);
}

EXPORT(trivm_f32_convert_i64_u)
float32_t trivm_f32_convert_i64_u(int64_t a)
{
    return ui64_to_f32(a);
}

EXPORT(trivm_f32_demote_f64)
float32_t trivm_f32_demote_f64(float64_t a)
{
    return f64_to_f32(a);
}
