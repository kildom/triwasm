@echo off

c:\work\wasmbzip2\wasi-sdk\bin\clang --sysroot=c:\work\wasmbzip2\wasi-sdk\share\wasi-sysroot -Wl,--no-entry -nostartfiles -Wl,--import-memory -flto -Oz -g0 -o test/test.wasm test/test.c

::/home/doki/my/wasmbzip2/binaryen/bin/wasm-opt -Oz -o test/otest.wasm test/test.wasm
