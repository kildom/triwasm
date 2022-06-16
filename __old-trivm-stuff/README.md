<a href="https://kildom.github.io/uvm-docs"><img src="doc/logo.svg" alt="triVM logo - box drawing with letter 't'" width="120" align="right"/></a>

# triVM

**A minimalistic, embeddable and portable virtual machine.**

<br clear="both"/>

|
[Website](https://kildom.github.io/uvm-docs)
|
[Getting started](https://kildom.github.io/trivm-docs/docs/getting_started.html)
|
[Documentation](https://kildom.github.io/trivm-docs/docs/)
|
[Demos](https://kildom.github.io/trivm-docs/demos/)
|

<!-- TODO: create kildom.github.io repo for github-pages that redirects to specific project -->

<img src="X" alt="Donations badge" width="150" align="right"/>
<a href="https://github.com/kildom/uvm/actions/workflows/build-cm4.yml"><img src="https://github.com/kildom/uvm/actions/workflows/build-cm4.yml/badge.svg" alt="Build for Cortex-M4" align="right"/></a>

<br clear="both"/>


## Features

 * **Minimal footprint**. It takes less than **1 KB** of code in basic configuration on ARM Cortex-M4,
   but still, it is able to run complex programs.
 * **C**, **C++**, **AssemblyScript**, **Rust** and other languages that are supported by the [WebAssembly](https://webassembly.org/)
   can be compiled into triVM bytecode using [triWASM](https://github.com/kildom/uvmwasm) compiler.
 * **Written in C**. It can be ported to any platform supporting *ANSI C (C90)*  and little-endian byte order.
 * **Sandboxed enviroment**. Software running on it has no access to the host except defined import/export interface.
 * **Configurable**. Many features are optional and can be disabled to lower the triVM footprint, or enabled to increase performance and reduce bytecode size.
 * **Exception handling** detects invalid behavior like stack overflow, access to invalid memory, execution of undefined instruction.

What this project does not support?

 * High performance. triVM is very small, but the cost is low performance compared to other solutions that provides nearly native speed.
 * Standard host/OS interface. All communication between host and guest must be defined by the emmbedder.
 * JIT (Just-In-Time) compilation. Only AOT (Ahead-Of-Time) compilation is possible. triVM bytecode must be compiled from the source file before loading it to a target.
 * Debugger, but plan is to support it eventually.

## Related projects

 * [triWasm](https://github.com/kildom/uvmwasm) - Web Assembly to triVM bytecode compiler, also includes C/C++ to triVM bytecode compiler with help of Clang.
 * [triAsm](https://github.com/kildom/triasm) - triVM assebly text to bytecode compiler
 * [triConf](https://github.com/kildom/triconf) - GUI/CLI/on-line helper tool for configuring triVM virtual machine, host an guest.
 * [triVM-SDK](https://github.com/kildom/trivm-sdk) - Project combining all above projects in a single release package.

> TODO: or megre all repositories into one.

## The name

**triVM** is short for **tri**vial **V**irtual **M**achine, because it is a virtual machine that has mostly insignificant impact to your code footprint.

## Quick sample

> #### `Note`
> This is only an overview of the procedure. Detailed tutorial can be found in the [documentation](https://kildom.github.io/uvm-docs/docs/getting-started-c/).

Configure triVM in on-line [configurator](https://kildom.github.io/uvm-docs/tools/configure.html) and download generated files.

Embbed triVM into your host application.
```c
#include <stdio.h>
#include "trivm.h"
#include "trivm_host.h"

uint8_t trivm_buffer[HLP_TRIVM_BUFFER_SIZE];

void message(char* str)
{
   puts(params->text);
}

void run_code_in_trivm(const uint8_t* code, size_t code_size)
{
   // "code" argument contains your bytecode that you want to run.
   trivm_instance *trivm;
   trivm = trivm_init(trivm_buffer, sizeof(trivm_buffer), code, code_size, hlp_imports, NULL, NULL);
   trivm_run(TRIVM_INDEFINITLY);
}

```

Create your `guest.c` guest code.

```c
#include "trivm_guest.h"

int main() {
   message("Hello World!");
   return 0;
}
```

Compile your source code to triVM binary.
```bash
tricc --sysroot ... TODO  -o guest.tvmb --trivm-config trivm_config.h guest.c
```

Pass `guest.tvmb` to your host application and run it.
