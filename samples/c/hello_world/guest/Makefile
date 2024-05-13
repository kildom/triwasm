# Copyright (C) 2023 Dominik Kilian
# SPDX-License-Identifier: GPL-3.0-or-later

CLANG:=../../../../ext/wasi-sdk/bin/clang --sysroot=../../../../ext/wasi-sdk/share/wasi-sysroot
WASM_OPT:=../../../../ext/binaryen/bin/wasm-opt
TRIWASM:=../../../../bin/triwasm

SRC:= main.c
CFLAGS:=
TRIWASM_FLAGS:=

# Let's make very small memory requirements:
#  - 60 bytes for VM registers,
#  - 64 bytes for VM stack and C stack,
#  - 64 bytes for C data.

# WASM memory block is 64K, so tell clang to reserve first 65472 bytes for stack, remaining 64 bytes for data.
# C stack grows backwards and only 64 bytes of C stack is actually used, so the first 65408 bytes are untouched.
CFLAGS+= -Wl,--stack-first -z stack-size=65472
# It is better to enable WASM extensions supported by triWASM.
CFLAGS+= -mbulk-memory -mmultivalue -mmutable-globals -mnontrapping-fptoint -mreference-types -msign-ext
# Disable WASM extensions that are not supported.
CFLAGS+= -mno-atomics -mno-exception-handling -mno-simd128 -mno-tail-call
# Maximum size optimization
CFLAGS+= -flto -Oz -g0
# The "Hello World" is a "command", not a "reactor". The "reactor" is more suitable for module that works
# more like a library.
CFLAGS+= -mexec-model=command
# Include C guest helper files
CFLAGS+= -I../../../../guest/c

# Maximum size optimization for "wasm-opt". It will optimize some things that clang is not able to handle.
OPTFLAGS:= -Oz

# Tell triWASM compiler how host VM is configured.
TRIWASM_FLAGS+= -c ../host/trivm-config.h
# The guest stack is before any other guest data, it shares space with VM stack, and it is at least
# 64 bytes long.
TRIWASM_FLAGS+= --vm-stack-size=64 --guest-stack-first --guest-stack-size=64 # TODO: VM stack "shared"
# WASM data memory starts at address 65472, where guest stack ends.
TRIWASM_FLAGS+= --global-base=65472
# The clang exports startup code as "_start" function.
TRIWASM_FLAGS+= --entry-function=_start

all: ../build/hello_world.trivm

clean:
	rm -Rf ../build

../build/hello_world.trivm: ../build/hello_world.wasm
	$(TRIWASM) $(TRIWASM_FLAGS) -o $@ $<

../build/hello_world.wasm: $(SRC) ../../../../guest/c/*.h Makefile
	mkdir -p ../build
	$(CLANG) $(CFLAGS) -o $@.no-opt $(SRC)
	$(WASM_OPT) $(OPTFLAGS) -o $@ $@.no-opt
