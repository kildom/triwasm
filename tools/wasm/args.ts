
import { Path } from '../common/path';
import { parse } from '../common/argparse';

export enum OptLevel {
    NONE = 0,
    BASIC = 1,
    FULL = 2,
}

interface WasmArgsMerge {
    name: string;
    file: Path;
    globalExports: boolean;
}

export interface WasmArgs {
    input: Path;
    confg: Path;
    output: Path;
    optimize: OptLevel;
    vmStackSize: number | 'shared';
    globalBase: number;
    guestStackFirst: boolean;
    guestStackGuard: boolean;
    guestStackSize?: number;
    assembly: boolean;
    merge: WasmArgsMerge[];
    debugDump: boolean;
}

export wasmUsage = ```
 triwasm [options] -c <trivm-config> <input>

 Compile WebAssembly module file to triVM binary file.

:Path[1] <input>
    Compile WebAssembly module from <input>.

-c
--config:Path[1] <file>
    Get triVM configuration from <file>.

-o
--output:Path <file>
    Place the output into <file>. By default, use the same file name as input,
    but with different extension.

-O
--optimize:OptLevel <level> = 2
    Optimize the output. By default, maximum optimization is enabled.
    Optimization levels: 0 - no optimization, 1 - basic optimization,
    2 and more - maximum optimization, "s", "z" and "fast" are aliases for 2,
    "g" is alias for 1. The optimization strategy is always focused on size.

--vm-stack-size:VmStackSize <size>|shared = 1024
    Set size of the virtual machine stack. Default is 1024. Special value
    "shared" puts the virtual machine stack at the guest stack.

--global-base:size <address> = 0
    Address at which module starts storing data. Everything before that is
    unused by the module and can be used by the compiler and virtual machine.
    Required for memory size smaller than 64K. By default, it is 0.

--guest-stack-first
    Gest have its stack first, before '--global-base' address.

--guest-stack-guard
    Enable gest stack guard. Module must contain special function detecting the
    stack pointer global variable and virtual machine must have guest stack
    overflow or underflow fault enabled.

--guest-stack-size:size <size>
    Size of the guest stack. It is used only if "--guest-stack-first" or
    "--guest-stack-guard" options are enabled.

-S
--assembly
    Compile to assembly text file.

--merge:Merge[0-] <name>\\=<file>
    Merge additinal WebAssembly module into the output. The module can contain
    only functions. If name is prefixed with "!", exports from module will be
    available as global (guest-host) exports. Otherwise, the module exports can
    be used only internally by other modules.

--debug-dump
    Dump various internal files alongside the output file. Use it to debug the
    compiler.

--version:!ver
    Display version information.

--help:!help
    Display this information.
```;

const filters = {
    Merge: (arg: any, option: Option, parser: ArgsParser): WasmArgsMerge => {
        let [name, file] = (arg as string).split('=', 2);
        let globalExports = false;
        if (name.startsWith('!')) {
            name = name.substring(1);
            globalExports = true;
        }
        return { name, file: argparse.stdFilters.Path(file), globalExports };
    }
    VmStackSize: (arg: any, option: Option, parser: ArgsParser): number | 'shared' => {
        if (arg === 'shared') {
            return arg;
        } else {
            return argparse.stdFilters.size(arg, option, parser);
        }
    }
    OptLevel: (arg: any, option: Option, parser: ArgsParser): OptLevel => {
        if (arg === 's' || arg === 'z' || arg === 'fast') {
            return OptLevel.FULL;
        } else if (arg === 'g') {
            return OptLevel.BASIC;
        } else {
            let value = argparse.stdFilters.int(arg, option, parser);
            return Math.max(0, Math.min(2, value)) as OptLevel;
        }
    }
};

function postProcess(results: any, name: string, parser: ArgsParser) {
    if (results.output === undefined) {
        results.output = results.input.withExt(results.assembly ? '.triasm' : '.trivm');
    }
};

export const args: WasmArgs = parse<WasmArgs>(wasmUsage, filters, postProcess);
