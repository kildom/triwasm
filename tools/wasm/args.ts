
import { Path } from '../common/path';
import { ArgsParser, Option, parse } from '../common/argparse';
import { Conf, ConfFaults } from '../conf/conf';
import { parseConf } from '../conf/parser';
import { platform } from '../common/platform';
import { ARGS_TXT } from './res';

export enum OptLevel {
    NONE = 0,
    BASIC = 1,
    FULL = 2,
}

export interface WasmArgsMerge {
    name: string;
    file: Path;
    globalExports: boolean;
}

export interface WasmArgs {
    input: Path;
    config: Path;
    output: Path;
    optimize: OptLevel;
    vmStackSize: number | 'shared';
    globalBase: number;
    guestStackFirst: boolean;
    guestStackGuard: boolean;
    guestStackGlobal?: string;
    guestStackSize?: number;
    entryFunction: string[];
    disableFaultAll: boolean;
    disableFaultUnreachable: boolean;
    disableFaultTableIndex: boolean;
    disableFaultNullCall: boolean;
    disableFaultInvalidExport: boolean;
    assembly: boolean;
    merge: WasmArgsMerge[];
    debugDump: boolean;
}

export interface WasmFaults extends ConfFaults {
    unreachable: boolean;
    tableIndex: boolean;
    nullCall: boolean;
    invalidExport: boolean;
    anyVmFault: boolean;
    anyWASMFault: boolean;
    anyFault: boolean;
}

export interface WasmConf {
    args: WasmArgs;
    vmConf: Conf;
    faults: WasmFaults;
    smallProgramModel: boolean;
    smallDataModel: boolean;
}

const filters = {
    Merge: (arg: any, option: Option, parser: ArgsParser<unknown>): WasmArgsMerge => {
        let [name, file] = (arg as string).split('=', 2);
        let globalExports = false;
        if (name.startsWith('!')) {
            name = name.substring(1);
            globalExports = true;
        }
        return { name, file: parser.filters.Path(file, option, parser), globalExports };
    },
    VmStackSize: (arg: any, option: Option, parser: ArgsParser<unknown>): number | 'shared' => {
        if (arg === 'shared') {
            return arg;
        } else {
            return parser.filters.size(arg, option, parser);
        }
    },
    OptLevel: (arg: any, option: Option, parser: ArgsParser<unknown>): OptLevel => {
        if (arg === 's' || arg === 'z' || arg === 'fast') {
            return OptLevel.FULL;
        } else if (arg === 'g') {
            return OptLevel.BASIC;
        } else {
            let value = parser.filters.int(arg, option, parser);
            return Math.max(0, Math.min(2, value)) as OptLevel;
        }
    }
};

function postProcess(results: WasmArgs) {
    if (results.output === undefined) {
        results.output = results.input.withExtension(results.assembly ? '.triasm' : '.trivm');
    }
}

export function getWasmConf(cmdLineArgs?: string[] | WasmArgs) {
    let args: WasmArgs;
    if (!cmdLineArgs || Array.isArray(cmdLineArgs)) {
        args = {} as WasmArgs;
        parse<WasmArgs>(ARGS_TXT, args, filters, postProcess, cmdLineArgs || platform.getArgv());
    } else {
        args = cmdLineArgs;
    }
    let vmConf = parseConf(args.config);
    let faults: WasmFaults = {
        ...vmConf.faults,
        unreachable: !args.disableFaultAll && !args.disableFaultUnreachable,
        tableIndex: !args.disableFaultAll && !args.disableFaultTableIndex,
        nullCall: !args.disableFaultAll && !args.disableFaultNullCall,
        invalidExport: !args.disableFaultAll && !args.disableFaultInvalidExport,
        anyVmFault: false,
        anyWASMFault: false,
        anyFault: false,
    };
    let conf: WasmConf = {
        args,
        vmConf,
        faults,
        smallProgramModel: vmConf.program.max <= 32 * 1024,
        smallDataModel: vmConf.memory.max <= 64 * 1024,
    };
    faults.anyVmFault = Object.values(vmConf.faults).some(x => x);
    faults.anyWASMFault = faults.unreachable || faults.tableIndex || faults.nullCall || faults.invalidExport;
    faults.anyFault = faults.anyVmFault || faults.anyWASMFault;
    return conf;
}
