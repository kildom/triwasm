
General:
* tricc should know all options that is passing to clang or linker over `-Wl,<option>`.
* tricc will pass just known limited number of arguments.
* If user wants more:
  * can use `--tricc-x <option>` to pass any option to clang front-end
  * call clang directly, optionally with help of `--tricc-dry` that shows invoked commands instead of actual compilation
  * send an issue/PR on github to add new option
* docs should contains autonatically generated list of supported options.
* all tricc specific options will start with `--tricc-...`:
  * `--tricc-config <file>` - triVM config file.
  * `--tricc-x <clang-option>` - pass to clang.
  * `--tricc-stack-size <size>` - set combined VM and C stack sizes.
  * `...`
* options can be specified in `TRICC_FLAGS, TRICC_CFLAGS, TRICC_LDFLAGS, ...` environment variables,
  e.g. to avoid passing custom options inside existing build system.

llvm/clang options:

* https://lld.llvm.org/WebAssembly.html
* https://clang.llvm.org/docs/ClangCommandLineReference.html#webassembly
* https://clang.llvm.org/docs/ClangCommandLineReference.html#webassembly-driver
* linker `-z` option:
  * `-z stack-size=1024`
  * https://github.com/llvm/llvm-project/blob/51f91e104559a4a59adf09eb54f756c8f7b66a28/lld/wasm/Driver.cpp#L1074
