// Copyright (C) 2023 Dominik Kilian
// SPDX-License-Identifier: 0BSD

#define FILE_ID triwasmlib_f32

#include "common.h"

#include "softfloat.h"

#define EXP_BINOP32(T, name) \
TRIVM_EXPORT(trivm_##name) \
T trivm_##name( float32_t a, float32_t b ) \
{ \
    ANNOTATION(trivm_0_##name, "triasm_name:__softfloatlib_" #name); \
    ANNOTATION(trivm_1_##name, "license:Berkeley-SoftFloat"); \
    return name(a, b); \
}

#define EXP_UNOP32(T, name) \
TRIVM_EXPORT(trivm_##name) \
T trivm_##name( float32_t a ) \
{ \
    ANNOTATION(trivm_0_##name, "triasm_name:__softfloatlib_" #name); \
    ANNOTATION(trivm_1_##name, "license:Berkeley-SoftFloat"); \
    return name(a); \
}

EXP_BINOP32(float32_t, f32_add);
EXP_BINOP32(float32_t, f32_sub);
EXP_BINOP32(float32_t, f32_mul);
EXP_BINOP32(float32_t, f32_div);
EXP_BINOP32(bool, f32_eq);
EXP_BINOP32(bool, f32_le);
EXP_BINOP32(bool, f32_lt);
EXP_UNOP32(float32_t, f32_sqrt);

TRIVM_EXPORT_ASSEMBLY(
    bool, trivm_f32_ne, ( float32_t a, float32_t b ),
    "READST 8\n"
    "READST 8\n"
    "CALL __softfloatlib_f32_eq\n"
    "NOT\n"
    "WRITEST 12\n"
    "WRITEST 0\n"
    "WRITE32 PC\n");

TRIVM_EXPORT_ASSEMBLY(
    bool, trivm_f32_gt, ( float32_t a, float32_t b ),
    "READST 8\n"
    "READST 8\n"
    "WRITEST 12\n"
    "WRITEST 4\n"
    "BR __softfloatlib_f32_lt\n");

TRIVM_EXPORT_ASSEMBLY(
    bool, trivm_f32_ge, ( float32_t a, float32_t b ),
    "READST 8\n"
    "READST 8\n"
    "WRITEST 12\n"
    "WRITEST 4\n"
    "BR __softfloatlib_f32_le\n");

TRIVM_EXPORT_ASSEMBLY(
    float32_t, trivm_f32_abs, ( float32_t a ),
    "READST 4\n"
    "AND 0x7FFFFFFF\n"
    "WRITEST 4\n"
    "WRITE32 PC\n");

TRIVM_EXPORT_ASSEMBLY(
    float32_t, trivm_f32_neg, ( float32_t a ),
    "__softfloatlib_trivm_f32_neg:\n"
    "READST 4\n"
    "XOR 0x80000000\n"
    "WRITEST 4\n"
    "WRITE32 PC\n");

TRIVM_EXPORT_ASSEMBLY(
    float32_t, trivm_f32_copysign, (float32_t a, float32_t b),
    "READST 8\n"
    "READST 8\n"
    "XOR\n"
    "USHR 31\n"
    "BRF __softfloatlib_return_first32\n"
    "WRITEST 0\n"
    "BR __softfloatlib_trivm_f32_neg\n");

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

TRIVM_EXPORT(trivm_i32_trunc_f32_s)
int32_t trivm_i32_trunc_f32_s( float32_t a )
{
    ANNOTATION(trivm_i32_trunc_f32_s, "license:Berkeley-SoftFloat");
    return f32_to_i32(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i32_trunc_f32_u)
uint32_t trivm_i32_trunc_f32_u( float32_t a )
{
    ANNOTATION(trivm_i32_trunc_f32_u, "license:Berkeley-SoftFloat");
    return f32_to_ui32(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i32_trunc_sat_f32_s)
int32_t trivm_i32_trunc_sat_f32_s( float32_t a )
{
    ANNOTATION(trivm_i32_trunc_sat_f32_s, "license:Berkeley-SoftFloat");
    return f32_to_i32(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i32_trunc_sat_f32_u)
uint32_t trivm_i32_trunc_sat_f32_u( float32_t a )
{
    ANNOTATION(trivm_i32_trunc_sat_f32_u, "license:Berkeley-SoftFloat");
    return f32_to_ui32(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i64_trunc_f32_s)
int64_t trivm_i64_trunc_f32_s( float32_t a )
{
    ANNOTATION(trivm_i64_trunc_f32_s, "license:Berkeley-SoftFloat");
    return f32_to_i64(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i64_trunc_f32_u)
uint64_t trivm_i64_trunc_f32_u( float32_t a )
{
    ANNOTATION(trivm_i64_trunc_f32_u, "license:Berkeley-SoftFloat");
    return f32_to_ui64(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i64_trunc_sat_f32_s)
int64_t trivm_i64_trunc_sat_f32_s( float32_t a )
{
    ANNOTATION(trivm_i64_trunc_sat_f32_s, "license:Berkeley-SoftFloat");
    return f32_to_i64(a, softfloat_round_minMag, false);
}

TRIVM_EXPORT(trivm_i64_trunc_sat_f32_u)
uint64_t trivm_i64_trunc_sat_f32_u( float32_t a )
{
    ANNOTATION(trivm_i64_trunc_sat_f32_u, "license:Berkeley-SoftFloat");
    return f32_to_ui64(a, softfloat_round_minMag, false);
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

TRIVM_EXPORT_ASSEMBLY(
    bool, trivm_f32_min, ( float32_t a, float32_t b ),
    "READST 8\n"
    "READST 8\n"
    "CALL __softfloatlib_f32_le\n"
    "BRT __softfloatlib_return_first32\n"
    "BR __softfloatlib_return_second32\n"
    );

TRIVM_EXPORT_ASSEMBLY(
    bool, trivm_f32_max, ( float32_t a, float32_t b ),
    "READST 8\n"
    "READST 8\n"
    "CALL __softfloatlib_f32_le\n"
    "BRF __softfloatlib_return_first32\n"
    "BR __softfloatlib_return_second32\n"
    );

