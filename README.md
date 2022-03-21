<img src="doc/logo.svg" alt="" align="right" width="100" />

# triWasm

[![Tests](https://github.com/kildom/triwasm/actions/workflows/main.yml/badge.svg)](https://github.com/kildom/triwasm/actions/workflows/main.yml)

<br clear="both" />

WebAssembly compiler for [triVM](https://github.com/kildom/uvm) - an embeddable, portable and minimalistic virtual machine.

The compiler compiles WebAssembly binary file into triVM binary or assembly file.

This is AOT (Ahead Of Time) compiler, which is opposite to JIT (Just In Time) compilers that are normally used for WebAssembly execution.

# License

This software contains multiple parts and they are released using different licenses.
The list below summarizes used licenses. It provides overview, for details see `COPYING*` files and comments contained in the source files.
 * **BSD Zero Clause License**
    * source code that is intended to be run inside a virtual machine, e.g. triWASM startup code
 * **BSD 2-Clause License**
    * source code that is intended to be embedded into host software, e.g. triVM core
    * high level documentation
 * **BSD 3-Clause License**
    * [Berkeley SoftFloat](http://www.jhauser.us/arithmetic/SoftFloat.html) external library
 * **GNU General Public License v3.0**
    * tools that are intended to be run by the developers during devoloping process, e.g. triWASM compiler, configuration tool.
    * utility scripts, e.g. used during building
    * tests (except tests from external projects), e.g. cppUtils unit tests
