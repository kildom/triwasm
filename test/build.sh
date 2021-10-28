#!/bin/sh

triwasmlib/build/tools/wasi-sdk/bin/clang --sysroot=triwasmlib/build/tools/wasi-sdk/share/wasi-sysroot -Wl,--export-table -Wl,--no-entry -nostartfiles -Wl,--import-memory -flto -Oz -g0 -o test/test-noopt.wasm test/test.c
triwasmlib/build/tools/binaryen/bin/wasm-opt -Oz -o test/test.wasm test/test-noopt.wasm
rm -f test/test-noopt.wasm
triwasmlib/build/tools/binaryen/bin/wasm-dis -o test/test.wat test/test.wasm
