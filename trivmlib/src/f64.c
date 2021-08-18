
#include "common.h"

#include "softfloat.h"

#define EXP_BINOP64(T, name) \
EXPORT(trivm_##name) \
T trivm_##name( float64_t a, float64_t b ) \
{ \
    return name(a, b); \
} \

EXP_BINOP64(bool, f64_eq);
EXP_BINOP64(bool, f64_lt);
EXP_BINOP64(bool, f64_le);
EXP_BINOP64(float64_t, f64_add);
EXP_BINOP64(float64_t, f64_sub);
EXP_BINOP64(float64_t, f64_mul);
EXP_BINOP64(float64_t, f64_div);

EXPORT(trivm_f64_ceil)
float64_t trivm_f64_ceil( float64_t a )
{
    return f64_roundToInt(a, softfloat_round_max, false);
}

EXPORT(trivm_f64_floor)
float64_t trivm_f64_floor( float64_t a )
{
    return f64_roundToInt(a, softfloat_round_min, false);
}

EXPORT(trivm_f64_trunc)
float64_t trivm_f64_trunc( float64_t a )
{
    return f64_roundToInt(a, softfloat_round_minMag, false);
}

EXPORT(trivm_f64_nearest)
float64_t trivm_f64_nearest( float64_t a )
{
    return f64_roundToInt(a, softfloat_round_near_even, false);
}

EXPORT(trivm_f64_convert_i32_s)
float64_t trivm_f64_convert_i32_s(int32_t a)
{
    return i32_to_f64(a);
}

EXPORT(trivm_f64_convert_i32_u)
float64_t trivm_f64_convert_i32_u(int32_t a)
{
    return ui32_to_f64(a);
}

EXPORT(trivm_f64_convert_i64_s)
float64_t trivm_f64_convert_i64_s(int64_t a)
{
    return i64_to_f64(a);
}

EXPORT(trivm_f64_convert_i64_u)
float64_t trivm_f64_convert_i64_u(int64_t a)
{
    return ui64_to_f64(a);
}

EXPORT(trivm_f64_promote_f32)
float64_t trivm_f64_promote_f32(float32_t a)
{
    return f32_to_f64(a);
}

