
CLANG=tools/wasi-sdk/bin/clang --sysroot=tools/wasi-sdk/share/wasi-sysroot
WASM_OPT=tools/binaryen/bin/wasm-opt

ifeq ($(OS),Windows_NT)
  WASI_SDK_URL=https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-12/wasi-sdk-12.0-mingw.tar.gz
  BINARYEN_URL=https://github.com/WebAssembly/binaryen/releases/download/version_101/binaryen-version_101-x86_64-windows.tar.gz
else
  WASI_SDK_URL=https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-12/wasi-sdk-12.0-linux.tar.gz
  BINARYEN_URL=https://github.com/WebAssembly/binaryen/releases/download/version_101/binaryen-version_101-x86_64-linux.tar.gz
endif


all: ../../lib/uvmlib.uvml

cleanobj:
	rm -Rf obj

clean: cleanobj
	rm ../../lib/uvmlib.uvml

../../lib/uvmlib.uvml: obj/uvmlib.wasm ../src/uvmlib.uvma
	echo TODO > $@

obj/uvmlib.wasm: ../src/uvmlib.c
	mkdir -p obj
	$(CLANG) -Wl,--no-entry -nostartfiles -Wl,--import-memory -flto -Oz -g0 -o $@-no-opt $<
	$(WASM_OPT) -Oz -o $@ $@-no-opt

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
