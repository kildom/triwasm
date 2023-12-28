// Copyright (C) 2023 Dominik Kilian
// SPDX-License-Identifier: 0BSD

#define FILE_ID triwasmlib_f64

#include "common.h"

#include "softfloat.h"

#define EXP_BINOP64(T, name) \
TRIVM_EXPORT(trivm_##name) \
T trivm_##name( float64_t a, float64_t b ) \
{ \
    ANNOTATION(trivm_0_##name, "triasm_name:__softfloatlib_" #name); \
    ANNOTATION(trivm_1_##name, "license:Berkeley-SoftFloat"); \
    return name(a, b); \
}

#define EXP_UNOP64(T, name) \
TRIVM_EXPORT(trivm_##name) \
T trivm_##name( float64_t a ) \
{ \
    ANNOTATION(trivm_0_##name, "triasm_name:__softfloatlib_" #name); \
    ANNOTATION(trivm_1_##name, "license:Berkeley-SoftFloat"); \
    return name(a); \
}

EXP_BINOP64(float64_t, f64_add);
EXP_BINOP64(float64_t, f64_sub);
EXP_BINOP64(float64_t, f64_mul);
EXP_BINOP64(float64_t, f64_div);
EXP_BINOP64(bool, f64_eq);
EXP_BINOP64(bool, f64_le);
EXP_BINOP64(bool, f64_lt);
EXP_UNOP64(float64_t, f64_sqrt);

TRIVM_EXPORT_ASSEMBLY(
    bool, trivm_f64_ne, ( float64_t a, float64_t b ),
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "CALL __softfloatlib_f64_eq\n"
    "NOT\n"
    "WRITE32 [SP] - 20\n"
    "WRITE32 [SP]\n"
    "WRITE32 [SP]\n"
    "WRITE32 [SP]\n"
    "WRITE32 PC\n");

TRIVM_EXPORT_ASSEMBLY(
    bool, trivm_f64_gt, ( float64_t a, float64_t b ),
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "WRITE32 [SP] - 24\n"
    "WRITE32 [SP] - 24\n"
    "WRITE32 [SP] - 8\n"
    "WRITE32 [SP] - 8\n"
    "BR __softfloatlib_f64_lt\n");

TRIVM_EXPORT_ASSEMBLY(
    bool, trivm_f64_ge, ( float64_t a, float64_t b ),
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "WRITE32 [SP] - 24\n"
    "WRITE32 [SP] - 24\n"
    "WRITE32 [SP] - 8\n"
    "WRITE32 [SP] - 8\n"
    "BR __softfloatlib_f64_le\n");

TRIVM_EXPORT_ASSEMBLY(
    float64_t, trivm_f64_abs, ( float64_t a ),
    "READ32 [SP] - 4\n"
    "AND 0x7FFFFFFF\n"
    "WRITE32 [SP] - 4\n"
    "WRITE32 PC\n");

TRIVM_EXPORT_ASSEMBLY(
    float64_t, trivm_f64_neg, ( float64_t a ),
    "__softfloatlib_trivm_f64_neg:\n"
    "READ32 [SP] - 4\n"
    "XOR 0x80000000\n"
    "WRITE32 [SP] - 4\n"
    "WRITE32 PC\n");

TRIVM_EXPORT_ASSEMBLY(
    float64_t, trivm_f64_copysign, (float64_t a, float64_t b),
    "READ32 [SP] - 12\n"
    "READ32 [SP] - 8\n"
    "XOR\n"
    "USHR 31\n"
    "BRF __softfloatlib_return_first64\n"
    "WRITE64 [SP]\n"
    "WRITE64 [SP]\n"
    "BR __softfloatlib_trivm_f64_neg\n");

TRIVM_EXPORT(trivm_f64_ceil)
float64_t trivm_f64_ceil( float64_t a )
{
    ANNOTATION(trivm_f64_ceil, "license:Berkeley-SoftFloat");
    return f64_roundToInt(a, softfloat_round_max, false);
}

TRIVM_EXPORT(trivm_f64_floor)
float64_t trivm_f64_floor( float64_t a )
{
    ANNOTATION(trivm_f64_floor, "license:Berkeley-SoftFloat");
    return f64_roundToInt(a, softfloat_round_min, false);
}

TRIVM_EXPORT(trivm_f64_trunc)
float64_t trivm_f64_trunc( float64_t a )
{
    ANNOTATION(trivm_f64_trunc, "license:Berkeley-SoftFloat");
    return f64_roundToInt(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_f64_nearest)
float64_t trivm_f64_nearest( float64_t a )
{
    ANNOTATION(trivm_f64_nearest, "license:Berkeley-SoftFloat");
    return f64_roundToInt(a, softfloat_round_near_even, false);
}

TRIVM_EXPORT(trivm_i32_trunc_f64_s)
int32_t trivm_i32_trunc_f64_s( float64_t a )
{
    ANNOTATION(trivm_i32_trunc_f64_s, "license:Berkeley-SoftFloat");
    return f64_to_i32(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i32_trunc_f64_u)
uint32_t trivm_i32_trunc_f64_u( float64_t a )
{
    ANNOTATION(trivm_i32_trunc_f64_u, "license:Berkeley-SoftFloat");
    return f64_to_ui32(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i32_trunc_sat_f64_s)
int32_t trivm_i32_trunc_sat_f64_s( float64_t a )
{
    ANNOTATION(trivm_i32_trunc_sat_f64_s, "license:Berkeley-SoftFloat");
    return f64_to_i32(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i32_trunc_sat_f64_u)
uint32_t trivm_i32_trunc_sat_f64_u( float64_t a )
{
    ANNOTATION(trivm_i32_trunc_sat_f64_u, "license:Berkeley-SoftFloat");
    return f64_to_ui32(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i64_trunc_f64_s)
int64_t trivm_i64_trunc_f64_s( float64_t a )
{
    ANNOTATION(trivm_i64_trunc_f64_s, "license:Berkeley-SoftFloat");
    return f64_to_i64(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i64_trunc_f64_u)
uint64_t trivm_i64_trunc_f64_u( float64_t a )
{
    ANNOTATION(trivm_i64_trunc_f64_u, "license:Berkeley-SoftFloat");
    return f64_to_ui64(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i64_trunc_sat_f64_s)
int64_t trivm_i64_trunc_sat_f64_s( float64_t a )
{
    ANNOTATION(trivm_i64_trunc_sat_f64_s, "license:Berkeley-SoftFloat");
    return f64_to_i64(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i64_trunc_sat_f64_u)
uint64_t trivm_i64_trunc_sat_f64_u( float64_t a )
{
    ANNOTATION(trivm_i64_trunc_sat_f64_u, "license:Berkeley-SoftFloat");
    return f64_to_ui64(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_f64_convert_i32_s)
float64_t trivm_f64_convert_i32_s(int32_t a)
{
    ANNOTATION(trivm_f64_convert_i32_s, "license:Berkeley-SoftFloat");
    return i32_to_f64(a);
}

TRIVM_EXPORT(trivm_f64_convert_i32_u)
float64_t trivm_f64_convert_i32_u(int32_t a)
{
    ANNOTATION(trivm_f64_convert_i32_u, "license:Berkeley-SoftFloat");
    return ui32_to_f64(a);
}

TRIVM_EXPORT(trivm_f64_convert_i64_s)
float64_t trivm_f64_convert_i64_s(int64_t a)
{
    ANNOTATION(trivm_f64_convert_i64_s, "license:Berkeley-SoftFloat");
    return i64_to_f64(a);
}

TRIVM_EXPORT(trivm_f64_convert_i64_u)
float64_t trivm_f64_convert_i64_u(int64_t a)
{
    ANNOTATION(trivm_f64_convert_i64_u, "license:Berkeley-SoftFloat");
    return ui64_to_f64(a);
}

TRIVM_EXPORT_ASSEMBLY(
    bool, trivm_f64_min, ( float64_t a, float64_t b ),
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "CALL __softfloatlib_f64_le\n"
    "BRT __softfloatlib_return_first64\n"
    "BR __softfloatlib_return_second64\n"
    );

TRIVM_EXPORT_ASSEMBLY(
    bool, trivm_f64_max, ( float64_t a, float64_t b ),
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "READ32 [SP] - 16\n"
    "CALL __softfloatlib_f64_le\n"
    "BRF __softfloatlib_return_first64\n"
    "BR __softfloatlib_return_second64\n"
    );

