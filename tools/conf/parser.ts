

import { Path } from '../common/path';
import { RefType, valueTypeFromString, valueTypeWords } from '../wasm/wasmModule';
import {
    Conf, ConfExtensions, ConfFaults, ConfFunction, ConfFunctionAttributes, ConfGlobal, ConfHost,
    ConfInterfaceDirection, ConfInterfaceEntry, ConfMemory, ConfParameter, ConfProgram, ConfTable,
    ConfTableAttributes
} from './conf';

const MAX_MEMORY_SIZE = 0x70000000;
const MIN_MEMORY_SIZE = 0x00000080;
const MAX_PROGRAM_SIZE = 0x70000000;
const MIN_PROGRAM_SIZE = 0x00000040;

function parseDefines(text: string) {
    text = text
        .replace(/\\\r?\n/g, ' ') // remove line breaks
        .replace(/\/\*[\s\S]*?\*\//g, ' ') // remove multi line comments
        .replace(/\/\/[\s\S]*?\r?\n/g, '\n'); // remove single line comments
    let result: { [name: string]: string | undefined; } = {};
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

function getBool(defs: { [name: string]: string | undefined; }, name: string, defaultValue?: boolean): boolean {
    if (!(name in defs)) {
        return defaultValue || false;
    }
    if (defs[name] === undefined) {
        configError(`${name} must be literal 0 or 1`);
        return defaultValue || false;
    }
    return defs[name]!.trim() == '1';
}

function getInt(defs: { [name: string]: string | undefined; }, name: string, defaultValue: number, minValue?: number,
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

function splitFullName(fullName: string): [string | undefined, string] {
    let index = fullName.indexOf('.');
    if (index < 0) {
        return [undefined, fullName];
    } else {
        return [fullName.substring(0, index), fullName.substring(index + 1)];
    }
}

function parseIndex(index: string, configText: string): number {
    let norm = index
        .replace(/(^0x|\s)/gi, '')
        .replace(/0/g, ' ')
        .trimStart()
        .replace(/(^$| )/g, '0');
    let result = parseInt(index);
    if ((result.toString() != norm && result.toString(16) != norm) || result < 0) {
        configError(`Invalid index at: ${configText}`);
        if (!Number.isInteger(result) || result < 0 || result > 65536) {
            result = 0;
        }
    }
    return result;
}

function addTable(tables: ConfTable[], functionsUsage: Map<number, string>, entry: ConfInterfaceEntry, type: string) {
    let result: ConfTable = {
        ...entry,
        type: valueTypeFromString(type),
        attributes: ConfTableAttributes.NONE, // TODOv3: Growable attribute
    };
    if (result.type != RefType.FUNCREF && result.type != RefType.EXTERNREF) {
        configError(`Only funcref and externref tables are allowed: ${result.configText}`);
        result.type = RefType.FUNCREF;
    }
    if (functionsUsage.has(result.index)) {
        configError(`Index ${result.index} already taken: ${result.configText}`);
        configError(`Previous entry: ${functionsUsage.get(result.index)}`);
    } else {
        functionsUsage.set(result.index, result.configText);
    }
    if (result.direction == ConfInterfaceDirection.EXPORT && result.module) {
        configError(`Exported table cannot have module name: ${result.configText}`);
        result.module = undefined;
    }
    if (result.direction == ConfInterfaceDirection.IMPORT && !result.module) {
        configError(`Imported table must have module name: ${result.configText}`);
        result.module = 'env';
    }
    configError(`Table import/export not implemented: ${result.configText}`);
    //tables.push(result); // TODOv2: Implement table import/export
}

function addGlobal(globals: ConfGlobal[], globalsUsage: Map<number, string>, entry: ConfInterfaceEntry, type: string) {
    let result: ConfGlobal = {
        ...entry,
        type: valueTypeFromString(type),
    };
    if (result.direction == ConfInterfaceDirection.IMPORT) {
        configError(`Imported globals not implemented: ${result.configText}`);
    }
    let words = valueTypeWords(result.type);
    for (let i = 0; i < words; i++) {
        let index = result.index + i;
        if (globalsUsage.has(index)) {
            configError(`Index ${index} already taken: ${result.configText}`);
            configError(`Previous entry: ${globalsUsage.get(result.index)}`);
        } else {
            globalsUsage.set(result.index, result.configText);
        }
    }
    configError(`Global import/export not implemented: ${result.configText}`);
    //globals.push(result); // TODOv2: Implement global import/export
}

function parseParameters(params: string, configText: string): ConfParameter[] {
    let result: ConfParameter[] = [];
    let items = params
        .trim()
        .replace(/(^\(\s*|\s*\)$)/g, '')
        .split(',')
        .map(x => x.match(/^\s*(.+?)(\s+.*?)?$/));
    if (items.length == 1 && items[0] === null) {
        return result;
    }
    for (let item of items) {
        if (!item) {
            configError(`Invalid parameter: ${configText}`);
            continue;
        }
        if (item[1]?.trim() != 'void') {
            result.push({
                type: valueTypeFromString(item[1]),
                name: item[2] && item[2].trim() != '' ? item[2].trim() : undefined,
            });
        }
    }
    return result;
}

function addFunction(functions: ConfFunction[], functionsUsage: Map<number, string>, entry: ConfInterfaceEntry,
    attrs: string = '', results: string, params: string) {

    // TODOv1: Allow imported functions with negative indexes to allow exit from VM with code.

    if (entry.index < 1) {
        configError(`Function index must be greater than zero at: ${entry.configText}`);
    }

    attrs = attrs.trim().toUpperCase();
    let result: ConfFunction = {
        ...entry,
        attributes: attrs == 'REGCALL' ? ConfFunctionAttributes.REGCALL : ConfFunctionAttributes.NONE,
        results: parseParameters(results, entry.configText),
        params: parseParameters(params, entry.configText),
    };
    if (functionsUsage.has(result.index)) {
        configError(`Index ${result.index} already taken: ${result.configText}`);
        configError(`Previous entry: ${functionsUsage.get(result.index)}`);
    } else {
        functionsUsage.set(result.index, result.configText);
    }
    if (result.direction == ConfInterfaceDirection.EXPORT && result.module) {
        configError(`Exported function cannot have module name: ${result.configText}`);
        result.module = undefined;
    }
    if (result.direction == ConfInterfaceDirection.IMPORT && !result.module) {
        configError(`Imported function must have module name: ${result.configText}`);
        result.module = 'env';
    }
    if (result.attributes & ConfFunctionAttributes.REGCALL) {
        configError(`Non-default calling conventions not implemented: ${result.configText}`);
        result.attributes ^= ConfFunctionAttributes.REGCALL; // TODOv2: REGCALL calling convention
    }
    functions.push(result);
}

function parseInterface(conf: Conf, text: string) {
    let importsUsage = new Map<number, string>();
    let exportsUsage = new Map<number, string>();
    let globalsUsage = new Map<number, string>();
    let comment = '';
    for (let m of text.matchAll(/\/\*[\r\n\s*]*triVM\s+interface[^a-z0-9_$]*([\s\S]*?)\*\//gi)) {
        comment += '\n' + m[1]
            .replace(/(^|\n)\s*\*/g, '$1')
            .replace(/#.*?\r?\n/g, '\n')
            .replace(/\s*\r?\n\s*/g, '\n');
    }
    comment = comment.trim();
    while (comment != '') {
        // TODOv3: Table attribute: growable
        // export: informs that host wants to control table growth. Gest is independent, it can grow the table even
        //         when the attribute is not specified.
        // import: informs compiler that host is able to grow table.
        let m = comment.match(/^(export|import)\s+(table|global)\s*\[\s*(0[xX][0-9A-Fa-f]+|[0-9]+)\s*\]\s*([if]32|[if]64|v128|funcref|externref)\s*([^;]*)\s*;/);
        let entry: ConfInterfaceEntry;
        if (m) {
            let [configText, direction, entryKind, index, type, fullName] = m;
            let [module, name] = splitFullName(fullName);
            entry = {
                configText,
                direction: direction == 'export' ? ConfInterfaceDirection.EXPORT : ConfInterfaceDirection.IMPORT,
                fullName,
                index: parseIndex(index, configText),
                name,
                module,
            };
            if (entryKind == 'table') {
                addTable(conf.tables, direction == 'export' ? exportsUsage : importsUsage, entry, type);
            } else {
                addGlobal(conf.globals, globalsUsage, entry, type);
            }
        } else {
            m = comment.match(/^(export|import)\s+function\s*\[\s*(0[xX][0-9A-Fa-f]+|[0-9]+)\s*\]\s*(regcall\s+)?([if]32|[if]64|v128|funcref|externref|void|\(\s*(?:(?:[if]32|[if]64|v128|funcref|externref)(?:\s+[a-zA-Z_$0-9]+)?\s*(?:,\s*|(?=\))))*\))\s*([\S\s]*?)\s*\(\s*((?:(?:[if]32|[if]64|v128|funcref|externref)(?:\s+[a-zA-Z_$0-9]+)?\s*(?:,\s*|(?=\))))*)\)\s*;/);
            if (m) {
                let [configText, direction, index, attrs, results, fullName, params] = m;
                let [module, name] = splitFullName(fullName);
                entry = {
                    configText,
                    direction: direction == 'export' ? ConfInterfaceDirection.EXPORT : ConfInterfaceDirection.IMPORT,
                    fullName,
                    index: parseIndex(index, configText),
                    name,
                    module,
                };
                addFunction(conf.functions, direction == 'export' ? exportsUsage : importsUsage, entry, attrs, results, params);
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
}

export function parseConf(path: Path): Conf {
    let text = path.readString();
    let defs = parseDefines(text);

    let extensions: ConfExtensions = {
        unwind: getBool(defs, 'TRIVM_EXT_UNWIND'),
        mem64: getBool(defs, 'TRIVM_EXT_MEM64'),
        int64: getBool(defs, 'TRIVM_EXT_INT64'),
        float32: getBool(defs, 'TRIVM_EXT_FLOAT32'),
        float64: getBool(defs, 'TRIVM_EXT_FLOAT64'),
    };

    let faults: ConfFaults = {
        stackOverflow: getBool(defs, 'TRIVM_FAULT_STACK_OVERFLOW') || getBool(defs, 'TRIVM_ALL_FAULTS'),
        stackUnderflow: getBool(defs, 'TRIVM_FAULT_STACK_UNDERFLOW') || getBool(defs, 'TRIVM_ALL_FAULTS'),
        instrOutOfBounds: getBool(defs, 'TRIVM_FAULT_INSTR_OUT_OF_BOUNDS') || getBool(defs, 'TRIVM_ALL_FAULTS'),
        instrInvalid: getBool(defs, 'TRIVM_FAULT_INSTR_INVALID') || getBool(defs, 'TRIVM_ALL_FAULTS'),
        accessOutOfBounds: getBool(defs, 'TRIVM_FAULT_ACCESS_OUT_OF_BOUNDS') || getBool(defs, 'TRIVM_ALL_FAULTS'),
        readOnly: getBool(defs, 'TRIVM_FAULT_READ_ONLY') || getBool(defs, 'TRIVM_ALL_FAULTS'),
        divisionByZero: getBool(defs, 'TRIVM_FAULT_DIVISION_BY_ZERO') || getBool(defs, 'TRIVM_ALL_FAULTS'),
        divisionOverflow: getBool(defs, 'TRIVM_FAULT_DIVISION_OVERFLOW') || getBool(defs, 'TRIVM_ALL_FAULTS'),
        guestStackOverflow: getBool(defs, 'TRIVM_FAULT_AUX_STACK_OVERFLOW') || getBool(defs, 'TRIVM_ALL_FAULTS'),
        guestStackUnderflow: getBool(defs, 'TRIVM_FAULT_AUX_STACK_UNDERFLOW') || getBool(defs, 'TRIVM_ALL_FAULTS'),
        truncInvalid: getBool(defs, 'TRIVM_FAULT_TRUNC_INVALID') || getBool(defs, 'TRIVM_ALL_FAULTS'),
    };

    let memory: ConfMemory = {
        growable: getBool(defs, 'TRIVM_MEM_GROWABLE'),
        min: 0,
        max: 0,
    };

    if (defs.TRIVM_MEM_SIZE) {
        if (defs.TRIVM_MEM_SIZE_MIN || defs.TRIVM_MEM_SIZE_MAX || memory.growable) {
            configError('TRIVM_MEM_SIZE cannot be combined with TRIVM_MEM_SIZE_MIN, TRIVM_MEM_SIZE_MAX or TRIVM_MEM_GROWABLE');
        }
        memory.min = getInt(defs, 'TRIVM_MEM_SIZE', MIN_MEMORY_SIZE, MIN_MEMORY_SIZE, MAX_MEMORY_SIZE);
        memory.max = memory.min;
    } else {
        memory.min = getInt(defs, 'TRIVM_MEM_SIZE_MIN', MIN_MEMORY_SIZE, MIN_MEMORY_SIZE, MAX_MEMORY_SIZE);
        memory.max = getInt(defs, 'TRIVM_MEM_SIZE_MAX', MAX_MEMORY_SIZE, memory.min, MAX_MEMORY_SIZE);
    }

    if ((memory.min & 3) || (memory.max & 3)) {
        configError('Memory size must be multiple of 4 bytes (32 bits)');
    }

    if (memory.min == memory.max && memory.growable) {
        configError('Memory cannot be growable if minimum and maximum sizes are the same');
        memory.growable = false;
    }

    if (memory.growable || memory.min != memory.max) {
        configError('Growable memory not implemented.');
        memory.growable = false; // TODOv2: Implement growable memory
        memory.max = memory.min;
    }

    let program: ConfProgram = {
        rom: getBool(defs, 'TRIVM_ENABLE_ROM', true),
        max: 0,
    };

    let program_max_max = program.rom ? MAX_PROGRAM_SIZE : memory.max;

    program.max = getInt(defs, 'TRIVM_PROGRAM_SIZE_MAX', program_max_max, MIN_PROGRAM_SIZE, program_max_max);

    let host: ConfHost = {
        callbacks: getBool(defs, 'TRIVM_CALLBACKS'),
        importTableGrow: getBool(defs, 'TRIVM_IMPORT_TABLE_GROWABLE'),
        exportTableGrow: getBool(defs, 'TRIVM_EXPORT_TABLE_GROWABLE'),
    };

    let conf: Conf = {
        extensions,
        faults,
        memory,
        program,
        host,
        functions: [],
        globals: [],
        tables: [],
    };

    parseInterface(conf, text);

    return conf;
}
