

import { platform } from '../common/platform';
import { Conf, ConfExtensions, ConfFaults, ConfHost, ConfMemory, ConfProgram, ConfWasm } from './conf';

const MAX_MEMORY_SIZE = 0x70000000;
const MIN_MEMORY_SIZE = 0x00000080;
const MAX_PROGRAM_SIZE = 0x70000000;
const MIN_PROGRAM_SIZE = 0x00000040;

function parseDefines(text: string) {
    text = text
        .replace(/\\\r?\n/g, ' ') // remove line breaks
        .replace(/\/\*[\s\S]*?\*\//g, ' ') // remove multi line comments
        .replace(/\/\/[\s\S]*?\r?\n/g, '\n'); // remove single line comments
    let result: { [name: string]: string | undefined } = {};
    for (let line of text.split('\n')) {
        line = line.trim();
        let m = line.match(/^#\s*define\s+([a-z0-9_$]+)(?:\s+([\s\S]+))?/i);
        if (m) {
            result[m[1]] = m[2];
        }
    }
    return result;
}

function configError(message: string) {
    console.error(message);
}

function getBool(defs: { [name: string]: string | undefined }, name: string, defaultValue?: boolean): boolean {
    if (!(name in defs)) {
        return defaultValue || false;
    }
    if (defs[name] === undefined) {
        configError(`${name} must be literal 0 or 1`);
        return defaultValue || false;
    }
    return defs[name]!.trim() == '1';
}

function getInt(defs: { [name: string]: string | undefined }, name: string, defaultValue: number, minValue?: number,
                maxValue?: number): number {
    if (!(name in defs)) {
        return defaultValue;
    }
    if (defs[name] === undefined || parseInt(defs[name] as string).toString() !== defs[name]) {
        configError(`${name} must be literal integer`);
        return defaultValue;
    }
    let value = parseInt(defs[name] as string);
    if (minValue !== undefined && value < minValue) {
        configError(`${name} cannot be less than ${minValue}`);
        return minValue;
    }
    if (maxValue !== undefined && value > maxValue) {
        configError(`${name} cannot be greaten than ${maxValue}`);
        return maxValue;
    }
    return value;
}

function getString<T>(defs: { [name: string]: string | undefined }, name: string, defaultValue: T): string|T {
    if (!(name in defs)) {
        return defaultValue;
    }
    if (defs[name] === undefined) {
        configError(`${name} must have value`);
        return defaultValue;
    }
    return defs[name]!.trim();
}

function parseInterface(text: string) {
    let comment = '';
    for (let m of text.matchAll(/\/\*[\r\n\s*]*triVM\s+interface[^a-z0-9_$]*([\s\S]*?)\*\//gi)) {
        comment += '\n' + m[1]
            .replace(/(^|\n)\s*\*/g, '$1')
            .replace(/#.*?\r?\n/g, '\n')
            .replace(/\s*\r?\n\s*/g, '\n');
    }
    comment = comment.trim();
    while (comment != '') {
        let m = comment.match(/^(export|import)\s+(table|global)\s*\[\s*(0[xX][0-9A-Fa-f]+|[0-9]+)\s*\]\s*([if]32|[if]64|v128|funcref|externref)\s*([^;]*)\s*;/);
        if (m) {
            console.log(m[2], m.slice(1));
        } else {
            m = comment.match(/^(export|import)\s+function\s*\[\s*(0[xX][0-9A-Fa-f]+|[0-9]+)\s*\]\s*(regcall\s+)?([if]32|[if]64|v128|funcref|externref|void|\(\s*(?:(?:[if]32|[if]64|v128|funcref|externref)(?:\s+[a-zA-Z_$0-9]+)?\s*(?:\,\s*|(?=\))))*\))\s*([\S\s]*?)\s*\(\s*((?:(?:[if]32|[if]64|v128|funcref|externref)(?:\s+[a-zA-Z_$0-9]+)?\s*(?:\,\s*|(?=\))))*)\)\s*;/);
            if (m) {
                console.log('FUNCTION', m.slice(1));
            } else {
                m = comment.match(/^;/);
            }
        }
        if (!m) {
            let line = comment.match(/^[\s\S]*?(?:;|$)/);
            configError(`Interface syntax error near: ${line}`);
            break;
        }
        comment = comment.substring(m[0].length).trim();
    }
    console.log(comment);
}

export function parseConf(path: string): Conf {
    let text = platform.readFile(path);
    let defs = parseDefines(text);
    parseInterface(text);return {} as Conf;

    let extensions: ConfExtensions = {
        unwind: getBool(defs, 'TRIVM_EXT_UNWIND'),
        mem64: getBool(defs, 'TRIVM_EXT_MEM64'),
        int64: getBool(defs, 'TRIVM_EXT_INT64'),
        float32: getBool(defs, 'TRIVM_EXT_FLOAT32'),
        float64: getBool(defs, 'TRIVM_EXT_FLOAT64'),
    };

    let faults: ConfFaults = {
        stackOverflow: getBool(defs, 'TRIVM_ENABLE_FAULT_STACK_OVERFLOW') || getBool(defs, 'TRIVM_ENABLE_ALL_FAULTS'),
        stackUnderflow: getBool(defs, 'TRIVM_ENABLE_FAULT_STACK_UNDERFLOW') || getBool(defs, 'TRIVM_ENABLE_ALL_FAULTS'),
        instrOutOfBounds: getBool(defs, 'TRIVM_ENABLE_FAULT_INSTR_OUT_OF_BOUNDS') || getBool(defs, 'TRIVM_ENABLE_ALL_FAULTS'),
        instrInvalid: getBool(defs, 'TRIVM_ENABLE_FAULT_INSTR_INVALID') || getBool(defs, 'TRIVM_ENABLE_ALL_FAULTS'),
        accessOutOfBounds: getBool(defs, 'TRIVM_ENABLE_FAULT_ACCESS_OUT_OF_BOUNDS') || getBool(defs, 'TRIVM_ENABLE_ALL_FAULTS'),
        readOnly: getBool(defs, 'TRIVM_ENABLE_FAULT_READ_ONLY') || getBool(defs, 'TRIVM_ENABLE_ALL_FAULTS'),
        divisionByZero: getBool(defs, 'TRIVM_ENABLE_FAULT_DIVISION_BY_ZERO') || getBool(defs, 'TRIVM_ENABLE_ALL_FAULTS'),
        auxStackOverflow: getBool(defs, 'TRIVM_ENABLE_FAULT_AUX_STACK_OVERFLOW') || getBool(defs, 'TRIVM_ENABLE_ALL_FAULTS'),
        auxStackUnderflow: getBool(defs, 'TRIVM_ENABLE_FAULT_AUX_STACK_UNDERFLOW') || getBool(defs, 'TRIVM_ENABLE_ALL_FAULTS'),

        wasmUnreachable: getBool(defs, 'TRIWASM_ENABLE_FAULT_UNREACHABLE') || getBool(defs, 'TRIWASM_ENABLE_ALL_FAULTS'),
        wasmTableIndex: getBool(defs, 'TRIWASM_ENABLE_FAULT_TABLE_INDEX') || getBool(defs, 'TRIWASM_ENABLE_ALL_FAULTS'),

        anyFault: false,
        anyVmFault: false,
        anyWasmFault: false,
    };

    faults.anyVmFault = faults.stackOverflow || faults.stackUnderflow || faults.instrOutOfBounds ||
        faults.instrInvalid || faults.accessOutOfBounds || faults.readOnly || faults.divisionByZero ||
        faults.auxStackOverflow || faults.auxStackUnderflow;
    faults.anyWasmFault = faults.wasmUnreachable || faults.wasmTableIndex;
    faults.anyFault = faults.anyVmFault || faults.anyWasmFault;

    let memory: ConfMemory = {
        growable: getBool(defs, 'TRIVM_MEM_GROWABLE'),
        min: 0,
        max: 0,
    };

    if ('TRIVM_MEM_SIZE' in defs) {
        if (defs.TRIVM_MEM_SIZE_MIN || defs.TRIVM_MEM_SIZE_MAX || memory.growable) {
            configError('TRIVM_MEM_SIZE cannot be combined with TRIVM_MEM_SIZE_MIN, TRIVM_MEM_SIZE_MAX or TRIVM_MEM_GROWABLE');
        }
        memory.min = getInt(defs, 'TRIVM_MEM_SIZE', MIN_MEMORY_SIZE, MIN_MEMORY_SIZE, MAX_MEMORY_SIZE);
        memory.max = memory.min;
    } else {
        memory.min = getInt(defs, 'TRIVM_MEM_SIZE_MIN', MIN_MEMORY_SIZE, MIN_MEMORY_SIZE, MAX_MEMORY_SIZE);
        memory.max = getInt(defs, 'TRIVM_MEM_SIZE_MAX', MAX_MEMORY_SIZE, memory.min, MAX_MEMORY_SIZE);
    }

    if (memory.min == memory.max && memory.growable) {
        configError('Memory cannot be growable if minimum and maximum sizes are the same');
        memory.growable = false;
    }

    let program: ConfProgram = {
        rom: getBool(defs, 'TRIVM_ENABLE_ROM', true),
        max: 0,
    };

    let program_max_max = program.rom ? MAX_PROGRAM_SIZE : memory.max;

    program.max = getInt(defs, 'TRIVM_PROGRAM_SIZE_MAX', program_max_max, MIN_PROGRAM_SIZE, program_max_max);

    let host: ConfHost = {
        callbacks: getBool(defs, 'TRIVM_ENABLE_CALLBACKS'),
        importTableGrow: getBool(defs, 'TRIVM_IMPORT_TABLE_GROW'),
        exportTableGrow: getBool(defs, 'TRIVM_EXPORT_TABLE_GROW'),
    };

    let wasm: ConfWasm = {
        entryFunction: getString(defs, 'TRIWASM_ENTRY_FUNCTION', undefined),
    };

    if (parseInt(wasm.entryFunction || '').toString() === wasm.entryFunction) {
        // TODO: interpret numeric values
    }

    let conf: Conf = {
        extensions,
        faults,
        memory,
        program,
        host,
        wasm,
    };

    return conf;
}

console.log(parseConf('/home/doki/my/triwasm/vm/trivm-config.h'));
