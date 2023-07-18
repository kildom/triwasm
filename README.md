<a href="https://kildom.github.io/trivm/docs"><img src="doc/trivm/logo.svg" alt="triVM logo - box drawing with letter 't'" width="120" align="right"/></a>

# triVM

**A minimalistic, embeddable and portable virtual machine.**

<br clear="both"/>

|
[Website](https://kildom.github.io/trivm/docs)
|
[Getting started](https://kildom.github.io/trivm-docs/docs/getting_started.html)
|
[Documentation](https://kildom.github.io/trivm-docs/docs/)
|
[Demos](https://kildom.github.io/trivm-docs/demos/)
|

<img src="X" alt="Donations badge" width="150" align="right"/>
<a href="https://github.com/kildom/uvm/actions/workflows/build-cm4.yml"><img src="https://github.com/kildom/uvm/actions/workflows/build-cm4.yml/badge.svg" alt="Build for Cortex-M4" align="right"/></a>

<br clear="both"/>


## Features

 * [**Minimal footprint**](https://kildom.github.io/trivm/docs/general/size-comparition.html).
   It takes less than **1 KB** of ARM Thumb code in basic configuration, but still, it is able to run complex programs.
 * [**Sandboxed enviroment**](https://kildom.github.io/trivm/docs/sandbox.html). Guest software running on it has no access to the host except defined import/export interface.
 * [**C**, **C++**, **AssemblyScript**, **Rust**](https://kildom.github.io/trivm/docs/guest-targets.html)
   and other languages supported by the [WebAssembly](https://webassembly.org/)
   can run as a guest inside VM.
 * [**Written in C**](https://kildom.github.io/trivm/docs/porting.html). It can be ported to any platform supporting *ANSI C (C90)*  and little-endian byte order.
 * [**Configurable**](https://kildom.github.io/trivm/docs/config.html). Many features are optional and can be disabled to lower the triVM footprint, or enabled to increase performance and reduce bytecode size.
 * [**Fault handling**](https://kildom.github.io/trivm/docs/architecture/faults.html) detects invalid behavior like stack overflow, invalid memory access, undefined instruction and more.

Features that you will **NOT** see in triVM:

 * [High performance](https://kildom.github.io/trivm/docs/general/speed-comparition.html). VM core is very small, but the cost is low performance compared to other solutions.
 * [Standard host/OS interface](https://kildom.github.io/trivm/docs/interface.html). Interface between host and guest is not defined in any way. You are responsible for defining and implementing all exports and imports.
 * [JIT (Just-In-Time) compilation](https://kildom.github.io/trivm/docs/general/workflow.html). The bytecode must be compiled from the sources with the specific VM configuration before loading it to a target.
 * [Guest debugger](https://kildom.github.io/trivm/docs/general/debugging.html).

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
tricc -o guest.tvmb --trivm-config trivm_config.h guest.c
```

Pass `guest.tvmb` to your host application and run it.

# License

This software contains multiple parts and they are released using different licenses.
The list below summarizes used licenses. It provides overview, for details see `COPYING` files and comments contained in the source files.
 * **BSD Zero Clause License** - source code that is intended to be run inside a virtual machine, e.g. triWASM startup code
 * **BSD 2-Clause License** - high level documentation and source code that is intended to be embedded into host software, e.g. triVM core.
 * **BSD 3-Clause License** - [Berkeley SoftFloat](http://www.jhauser.us/arithmetic/SoftFloat.html) external library
 * **GNU General Public License v3.0** - tools and tests that are intended to be run by the developers, e.g. triWASM compiler, configuration tool, utility scripts.
