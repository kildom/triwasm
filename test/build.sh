#!/bin/sh

trivmlib/build/tools/wasi-sdk/bin/clang --sysroot=trivmlib/build/tools/wasi-sdk/share/wasi-sysroot -Wl,--no-entry -nostartfiles -Wl,--import-memory -flto -Oz -g0 -o test/test-noopt.wasm test/test.c
trivmlib/build/tools/binaryen/bin/wasm-opt -Oz -o test/test.wasm test/test-noopt.wasm
rm -f test/test-noopt.wasm
trivmlib/build/tools/binaryen/bin/wasm-dis -o test/test.wat test/test.wasm
