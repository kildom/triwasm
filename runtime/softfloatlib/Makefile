# Copyright (C) 2023 Dominik Kilian
# SPDX-License-Identifier: GPL-3.0-or-later

TARGET:=softfloatlib

SF_SPEC:=8086-SSE
SF_ROUNDING_MODE:=softfloat_round_near_even
SF_DETECT_TININESS:=softfloat_tininess_beforeRounding

CFLAGS:=\
	-I./Berkeley-SoftFloat/source/include \
	-I./Berkeley-SoftFloat/source/$(SF_SPEC) \
	-DINLINE_LEVEL=10000 \
	-DSF_ROUNDING_MODE=$(SF_ROUNDING_MODE) \
	-DSF_DETECT_TININESS=$(SF_DETECT_TININESS)

SRC=./f32.c \
	./f64.c \
	\
	./Berkeley-SoftFloat/source/f32_eq.c \
	./Berkeley-SoftFloat/source/f32_lt.c \
	./Berkeley-SoftFloat/source/f32_le.c \
	./Berkeley-SoftFloat/source/f32_add.c \
	./Berkeley-SoftFloat/source/f32_sub.c \
	./Berkeley-SoftFloat/source/f32_mul.c \
	./Berkeley-SoftFloat/source/f32_div.c \
	./Berkeley-SoftFloat/source/f32_roundToInt.c \
	./Berkeley-SoftFloat/source/s_addMagsF32.c \
	./Berkeley-SoftFloat/source/s_subMagsF32.c \
	./Berkeley-SoftFloat/source/s_normSubnormalF32Sig.c \
	./Berkeley-SoftFloat/source/s_shiftRightJam32.c \
	./Berkeley-SoftFloat/source/s_shortShiftRightJam64.c \
	./Berkeley-SoftFloat/source/s_roundPackToF32.c \
	./Berkeley-SoftFloat/source/s_normRoundPackToF32.c \
	./Berkeley-SoftFloat/source/s_approxRecip32_1.c \
	./Berkeley-SoftFloat/source/s_approxRecip_1Ks.c \
	./Berkeley-SoftFloat/source/$(SF_SPEC)/s_propagateNaNF32UI.c \
	./Berkeley-SoftFloat/source/f64_eq.c \
	./Berkeley-SoftFloat/source/f64_lt.c \
	./Berkeley-SoftFloat/source/f64_le.c \
	./Berkeley-SoftFloat/source/f64_add.c \
	./Berkeley-SoftFloat/source/f64_sub.c \
	./Berkeley-SoftFloat/source/f64_mul.c \
	./Berkeley-SoftFloat/source/f64_div.c \
	./Berkeley-SoftFloat/source/f64_roundToInt.c \
	./Berkeley-SoftFloat/source/s_addMagsF64.c \
	./Berkeley-SoftFloat/source/s_subMagsF64.c \
	./Berkeley-SoftFloat/source/s_normSubnormalF64Sig.c \
	./Berkeley-SoftFloat/source/s_shiftRightJam64.c \
	./Berkeley-SoftFloat/source/s_roundPackToF64.c \
	./Berkeley-SoftFloat/source/s_normRoundPackToF64.c \
	./Berkeley-SoftFloat/source/s_mul64To128M.c \
	./Berkeley-SoftFloat/source/$(SF_SPEC)/s_propagateNaNF64UI.c \
	./Berkeley-SoftFloat/source/$(SF_SPEC)/s_f64UIToCommonNaN.c \
	./Berkeley-SoftFloat/source/$(SF_SPEC)/s_commonNaNToF32UI.c \
	./Berkeley-SoftFloat/source/$(SF_SPEC)/s_f32UIToCommonNaN.c \
	./Berkeley-SoftFloat/source/$(SF_SPEC)/s_commonNaNToF64UI.c \
	./Berkeley-SoftFloat/source/i32_to_f32.c \
	./Berkeley-SoftFloat/source/ui32_to_f32.c \
	./Berkeley-SoftFloat/source/i64_to_f32.c \
	./Berkeley-SoftFloat/source/ui64_to_f32.c \
	./Berkeley-SoftFloat/source/i32_to_f64.c \
	./Berkeley-SoftFloat/source/ui32_to_f64.c \
	./Berkeley-SoftFloat/source/i64_to_f64.c \
	./Berkeley-SoftFloat/source/ui64_to_f64.c \
	./Berkeley-SoftFloat/source/f64_to_f32.c \
	./Berkeley-SoftFloat/source/f32_to_f64.c \

include ../common/Makefile.common
