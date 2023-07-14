// Copyright (C) 2023 Dominik Kilian
// SPDX-License-Identifier: 0BSD

#define FILE_ID triwasmlib_f32

#include "common.h"

#include "softfloat.h"

#define EXP_BINOP32(T, name) \
TRIVM_EXPORT(trivm_##name) \
T trivm_##name( float32_t a, float32_t b ) \
{ \
    ANNOTATION(trivm_##name, "license:Berkeley-SoftFloat"); \
    return name(a, b); \
} \

EXP_BINOP32(float32_t, f32_add);
EXP_BINOP32(float32_t, f32_sub);
EXP_BINOP32(float32_t, f32_mul);
EXP_BINOP32(float32_t, f32_div);

TRIVM_EXPORT(trivm_f32_le)
bool trivm_f32_le( float32_t a, float32_t b )
{
    ANNOTATION(trivm_f32_le_name, "triasm_name:__triwasmlib_f32_le");
    ANNOTATION(trivm_f32_le_lic, "license:Berkeley-SoftFloat");
    return f32_le(a, b);
}

TRIVM_EXPORT(trivm_f32_lt)
bool trivm_f32_lt( float32_t a, float32_t b )
{
    ANNOTATION(trivm_f32_lt, "triasm_name:__triwasmlib_f32_lt");
    ANNOTATION(trivm_f32_lt, "license:Berkeley-SoftFloat");
    return f32_lt(a, b);
}

TRIVM_EXPORT(trivm_f32_eq)
bool trivm_f32_eq( float32_t a, float32_t b )
{
    ANNOTATION(trivm_f32_eq, "triasm_name:__triwasmlib_f32_eq");
    ANNOTATION(trivm_f32_eq, "license:Berkeley-SoftFloat");
    return f32_eq(a, b);
}

TRIVM_EXPORT_ASSEMBLY(
    bool, trivm_f32_gt, ( float32_t a, float32_t b ),
    "READ [SP] + 2\n"
    "READ [SP] + 2\n"
    "WRITE [SP] + 3\n"
    "WRITE [SP] + 1\n"
    "BR __triwasmlib_f32_lt\n");

TRIVM_EXPORT_ASSEMBLY(
    bool, trivm_f32_ge, ( float32_t a, float32_t b ),
    "READ [SP] + 2\n"
    "READ [SP] + 2\n"
    "WRITE [SP] + 3\n"
    "WRITE [SP] + 1\n"
    "BR __triwasmlib_f32_le\n");

TRIVM_EXPORT_ASSEMBLY( // TODO: This function should not exist, code should be generated during reduce and optimized later: CALL eq, NOT, BRT --> CALL eq, BRF
    bool, trivm_f32_ne, ( float32_t a, float32_t b ),
    "CALL __triwasmlib_f32_eq\n"
    "NOT\n"
    "RET\n");

TRIVM_EXPORT(trivm_f32_ceil)
float32_t trivm_f32_ceil( float32_t a )
{
    ANNOTATION(trivm_f32_ceil, "license:Berkeley-SoftFloat");
    return f32_roundToInt(a, softfloat_round_max, false);
}

TRIVM_EXPORT(trivm_f32_floor)
float32_t trivm_f32_floor( float32_t a )
{
    ANNOTATION(trivm_f32_floor, "license:Berkeley-SoftFloat");
    return f32_roundToInt(a, softfloat_round_min, false);
}

TRIVM_EXPORT(trivm_f32_trunc)
float32_t trivm_f32_trunc( float32_t a )
{
    ANNOTATION(trivm_f32_trunc, "license:Berkeley-SoftFloat");
    return f32_roundToInt(a, softfloat_round_minMag, false);
}


TRIVM_EXPORT(trivm_f32_nearest)
float32_t trivm_f32_nearest( float32_t a )
{
    ANNOTATION(trivm_f32_nearest, "license:Berkeley-SoftFloat");
    return f32_roundToInt(a, softfloat_round_near_even, false);
}

TRIVM_EXPORT(trivm_f32_convert_i32_s)
float32_t trivm_f32_convert_i32_s(int32_t a)
{
    ANNOTATION(trivm_f32_convert_i32_s, "license:Berkeley-SoftFloat");
    return i32_to_f32(a);
}

TRIVM_EXPORT(trivm_f32_convert_i32_u)
float32_t trivm_f32_convert_i32_u(int32_t a)
{
    ANNOTATION(trivm_f32_convert_i32_u, "license:Berkeley-SoftFloat");
    return ui32_to_f32(a);
}

TRIVM_EXPORT(trivm_f32_convert_i64_s)
float32_t trivm_f32_convert_i64_s(int64_t a)
{
    ANNOTATION(trivm_f32_convert_i64_s, "license:Berkeley-SoftFloat");
    return i64_to_f32(a);
}

TRIVM_EXPORT(trivm_f32_convert_i64_u)
float32_t trivm_f32_convert_i64_u(int64_t a)
{
    ANNOTATION(trivm_f32_convert_i64_u, "license:Berkeley-SoftFloat");
    return ui64_to_f32(a);
}

TRIVM_EXPORT(trivm_f32_demote_f64)
float32_t trivm_f32_demote_f64(float64_t a)
{
    ANNOTATION(trivm_f32_demote_f64, "license:Berkeley-SoftFloat");
    return f64_to_f32(a);
}
