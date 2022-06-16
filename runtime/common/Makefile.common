# Copyright (C) 2023 Dominik Kilian
# SPDX-License-Identifier: GPL-3.0-or-later

CLANG=tools/wasi-sdk/bin/clang --sysroot=tools/wasi-sdk/share/wasi-sysroot
WASM_OPT=tools/binaryen/bin/wasm-opt
WASM_DIS=tools/binaryen/bin/wasm-dis

SF_SPEC=8086-SSE
SF_ROUNDING_MODE=softfloat_round_near_even
SF_DETECT_TININESS=softfloat_tininess_beforeRounding

CFLAGS=\
	-Wl,--no-entry -nostartfiles -Wl,--import-memory -msign-ext -mexec-model=reactor \
	-flto -Oz -g0 \
	-I../src \
	-I../Berkeley-SoftFloat/source/include \
	-I../Berkeley-SoftFloat/source/$(SF_SPEC) \
	-DINLINE_LEVEL=10000 \
	-DSF_ROUNDING_MODE=$(SF_ROUNDING_MODE) \
	-DSF_DETECT_TININESS=$(SF_DETECT_TININESS)

ifeq ($(OS),Windows_NT)
  WASI_SDK_URL=https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-12/wasi-sdk-12.0-mingw.tar.gz
  BINARYEN_URL=https://github.com/WebAssembly/binaryen/releases/download/version_101/binaryen-version_101-x86_64-windows.tar.gz
else
  WASI_SDK_URL=https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-12/wasi-sdk-12.0-linux.tar.gz
  BINARYEN_URL=https://github.com/WebAssembly/binaryen/releases/download/version_101/binaryen-version_101-x86_64-linux.tar.gz
endif


SRC=../src/i64.c \
	../src/f32.c \
	../src/f64.c \
	../src/stubs.c \
	\
	../Berkeley-SoftFloat/source/f32_eq.c \
	../Berkeley-SoftFloat/source/f32_lt.c \
	../Berkeley-SoftFloat/source/f32_le.c \
	../Berkeley-SoftFloat/source/f32_add.c \
	../Berkeley-SoftFloat/source/f32_sub.c \
	../Berkeley-SoftFloat/source/f32_mul.c \
	../Berkeley-SoftFloat/source/f32_div.c \
	../Berkeley-SoftFloat/source/f32_roundToInt.c \
	../Berkeley-SoftFloat/source/s_addMagsF32.c \
	../Berkeley-SoftFloat/source/s_subMagsF32.c \
	../Berkeley-SoftFloat/source/s_normSubnormalF32Sig.c \
	../Berkeley-SoftFloat/source/s_shiftRightJam32.c \
	../Berkeley-SoftFloat/source/s_shortShiftRightJam64.c \
	../Berkeley-SoftFloat/source/s_roundPackToF32.c \
	../Berkeley-SoftFloat/source/s_normRoundPackToF32.c \
	../Berkeley-SoftFloat/source/s_approxRecip32_1.c \
	../Berkeley-SoftFloat/source/s_approxRecip_1Ks.c \
	../Berkeley-SoftFloat/source/$(SF_SPEC)/s_propagateNaNF32UI.c \
	../Berkeley-SoftFloat/source/f64_eq.c \
	../Berkeley-SoftFloat/source/f64_lt.c \
	../Berkeley-SoftFloat/source/f64_le.c \
	../Berkeley-SoftFloat/source/f64_add.c \
	../Berkeley-SoftFloat/source/f64_sub.c \
	../Berkeley-SoftFloat/source/f64_mul.c \
	../Berkeley-SoftFloat/source/f64_div.c \
	../Berkeley-SoftFloat/source/f64_roundToInt.c \
	../Berkeley-SoftFloat/source/s_addMagsF64.c \
	../Berkeley-SoftFloat/source/s_subMagsF64.c \
	../Berkeley-SoftFloat/source/s_normSubnormalF64Sig.c \
	../Berkeley-SoftFloat/source/s_shiftRightJam64.c \
	../Berkeley-SoftFloat/source/s_roundPackToF64.c \
	../Berkeley-SoftFloat/source/s_normRoundPackToF64.c \
	../Berkeley-SoftFloat/source/s_mul64To128M.c \
	../Berkeley-SoftFloat/source/$(SF_SPEC)/s_propagateNaNF64UI.c \
	../Berkeley-SoftFloat/source/$(SF_SPEC)/s_f64UIToCommonNaN.c \
	../Berkeley-SoftFloat/source/$(SF_SPEC)/s_commonNaNToF32UI.c \
	../Berkeley-SoftFloat/source/$(SF_SPEC)/s_f32UIToCommonNaN.c \
	../Berkeley-SoftFloat/source/$(SF_SPEC)/s_commonNaNToF64UI.c \
	../Berkeley-SoftFloat/source/i32_to_f32.c \
	../Berkeley-SoftFloat/source/ui32_to_f32.c \
	../Berkeley-SoftFloat/source/i64_to_f32.c \
	../Berkeley-SoftFloat/source/ui64_to_f32.c \
	../Berkeley-SoftFloat/source/i32_to_f64.c \
	../Berkeley-SoftFloat/source/ui32_to_f64.c \
	../Berkeley-SoftFloat/source/i64_to_f64.c \
	../Berkeley-SoftFloat/source/ui64_to_f64.c \
	../Berkeley-SoftFloat/source/f64_to_f32.c \
	../Berkeley-SoftFloat/source/f32_to_f64.c \

all: ../../lib/triwasmlib.wasm

wat: all obj/triwasmlib.wat

obj/triwasmlib.wat: obj/triwasmlib.wasm
	$(WASM_DIS) -o $@ $<

cleanobj:
	rm -Rf obj

clean: cleanobj
	rm -R ../../lib/*

../../lib/triwasmlib.wasm: obj/triwasmlib.wasm
	cp obj/triwasmlib.wasm ../../lib/triwasmlib.wasm
	cp ../src/triasm/* ../../lib/
	mkdir -p ../../lib/licenses
	cp ../src/COPYING ../../lib/licenses/triwasmlib.txt
	cp ../Berkeley-SoftFloat/COPYING.txt ../../lib/licenses/Berkeley-SoftFloat.txt

obj/triwasmlib.wasm: $(SRC) ../src/*.h ../Berkeley-SoftFloat/source/include/*.h ../Berkeley-SoftFloat/source/$(SF_SPEC)/*.h Makefile
	mkdir -p obj
	# TODO: -mtail-call 
	$(CLANG) $(CFLAGS) -o $@-no-opt $(SRC)
	$(WASM_OPT) -Oz -o $@ $@-no-opt
	#cp $@-no-opt $@

get-tools: tools/wasi-sdk/bin/clang tools/binaryen/bin/wasm-opt

tools/wasi-sdk/bin/clang:
	mkdir -p tools/wasi-sdk
	wget -Otools/wasi-sdk.tar.gz $(WASI_SDK_URL)
	tar xzvf tools/wasi-sdk.tar.gz --strip-components=1 -C tools/wasi-sdk
	rm tools/wasi-sdk.tar.gz

tools/binaryen/bin/wasm-opt:
	mkdir -p tools/binaryen
	wget -Otools/binaryen.tar.gz $(BINARYEN_URL)
	tar xzvf tools/binaryen.tar.gz --strip-components=1 -C tools/binaryen
	rm tools/binaryen.tar.gz
