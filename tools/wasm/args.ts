
import { Path } from '../common/path';
import { parse } from '../common/argparse';

export enum OptLevel {
    NONE = 0,
    BASIC = 1,
    FULL = 2,
}

export interface WasmArgs {
    input: Path;
    confg: Path;
    output?: Path;
    optimize: OptLevel;
    assembly: boolean;
    debugDump: boolean;
    merge: {
        name: string;
        file: Path;
        globalExports: boolean;
    }[];
}

export wasmUsage = ```
triwasm [options] -c <trivm-config> <input>

Compile WebAssembly module file to triVM binary file.

:Path <input>
    Compile WebAssembly module from <input>.

-c
--config:Path <file>
    Get triVM configuration from <file>.

-o
--output:Path <file>
    Place the output into <file>. By default, use the same file name as input,
    but with different extension.

-O
--optimize:OptLevel <level>
    Optimize the output. By default, maximum optimization is enabled.
    Optimization levels: 0 - no optimization, 1 - basic optimization, 2 and more - maximum
    optimization, s and z are aliases for 2. The optimization strategy is always
    focused on size.

-S
--assembly
    Compile to assembly text file.

--merge:merge[0-] <name=file>
    Merge additinal WebAssembly module into the output. The module can contain only functions.
    If name is prefixed with '!', exports from module will be available as global (guest-host)
    exports. Otherwise, the module exports can be used only internally by other modules.

--debug-dump
    Dump various internal files alongside the output file. Use it to debugg the compiler.

--version:!ver
    Display version information.

--help:!help
    Display this information.

```;

export const args: WasmArgs = parse<WasmArgs>(wasmUsage);
