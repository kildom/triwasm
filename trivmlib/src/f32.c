
#include "common.h"

#include "softfloat.h"

DEFINE_ANNOTATION(license_f32, "license:Berkeley-SoftFloat");

#define EXP_BINOP32(T, name) \
EXPORT(trivm_##name) \
T trivm_##name( float32_t a, float32_t b ) \
{ \
    USE_ANNOTATION(license_f32); \
    return name(a, b); \
} \

EXP_BINOP32(float32_t, f32_add);
EXP_BINOP32(float32_t, f32_sub);
EXP_BINOP32(float32_t, f32_mul);
EXP_BINOP32(float32_t, f32_div);

DEFINE_ANNOTATION(trivm_f32_le_name, "triasm_name:__trivmlib_f32_le");

EXPORT(trivm_f32_le)
bool trivm_f32_le( float32_t a, float32_t b )
{
    USE_ANNOTATION(trivm_f32_le_name);
    USE_ANNOTATION(license_f32);
    return f32_le(a, b);
}

DEFINE_ANNOTATION(trivm_f32_lt_name, "triasm_name:__trivmlib_f32_lt");

EXPORT(trivm_f32_lt)
bool trivm_f32_lt( float32_t a, float32_t b )
{
    USE_ANNOTATION(trivm_f32_lt_name);
    USE_ANNOTATION(license_f32);
    return f32_lt(a, b);
}

DEFINE_ANNOTATION(trivm_f32_eq_name, "triasm_name:__trivmlib_f32_eq");

EXPORT(trivm_f32_eq)
bool trivm_f32_eq( float32_t a, float32_t b )
{
    USE_ANNOTATION(trivm_f32_eq_name);
    USE_ANNOTATION(license_f32);
    return f32_eq(a, b);
}

TRIVM_EXPORT_ASSEMBLY(
    trivm_f32_gt,
    "READ [SP] + 2\n"
    "READ [SP] + 2\n"
    "WRITE [SP] + 3\n"
    "WRITE [SP] + 1\n"
    "BR __trivmlib_f32_lt\n",
    bool, ( float32_t a, float32_t b ));

TRIVM_EXPORT_ASSEMBLY(
    trivm_f32_ge,
    "READ [SP] + 2\n"
    "READ [SP] + 2\n"
    "WRITE [SP] + 3\n"
    "WRITE [SP] + 1\n"
    "BR __trivmlib_f32_le\n",
    bool, ( float32_t a, float32_t b ));

TRIVM_EXPORT_ASSEMBLY(
    trivm_f32_ne,
    "CALL __trivmlib_f32_eq\n"
    "NOT\n"
    "RET\n",
    bool, ( float32_t a, float32_t b ));

EXPORT(trivm_f32_ceil)
float32_t trivm_f32_ceil( float32_t a )
{
    USE_ANNOTATION(license_f32);
    return f32_roundToInt(a, softfloat_round_max, false);
}

EXPORT(trivm_f32_floor)
float32_t trivm_f32_floor( float32_t a )
{
    USE_ANNOTATION(license_f32);
    return f32_roundToInt(a, softfloat_round_min, false);
}

EXPORT(trivm_f32_trunc)
float32_t trivm_f32_trunc( float32_t a )
{
    USE_ANNOTATION(license_f32);
    return f32_roundToInt(a, softfloat_round_minMag, false);
}


EXPORT(trivm_f32_nearest)
float32_t trivm_f32_nearest( float32_t a )
{
    USE_ANNOTATION(license_f32);
    return f32_roundToInt(a, softfloat_round_near_even, false);
}

EXPORT(trivm_f32_convert_i32_s)
float32_t trivm_f32_convert_i32_s(int32_t a)
{
    USE_ANNOTATION(license_f32);
    return i32_to_f32(a);
}

EXPORT(trivm_f32_convert_i32_u)
float32_t trivm_f32_convert_i32_u(int32_t a)
{
    USE_ANNOTATION(license_f32);
    return ui32_to_f32(a);
}

EXPORT(trivm_f32_convert_i64_s)
float32_t trivm_f32_convert_i64_s(int64_t a)
{
    USE_ANNOTATION(license_f32);
    return i64_to_f32(a);
}

EXPORT(trivm_f32_convert_i64_u)
float32_t trivm_f32_convert_i64_u(int64_t a)
{
    USE_ANNOTATION(license_f32);
    return ui64_to_f32(a);
}

EXPORT(trivm_f32_demote_f64)
float32_t trivm_f32_demote_f64(float64_t a)
{
    USE_ANNOTATION(license_f32);
    return f64_to_f32(a);
}
