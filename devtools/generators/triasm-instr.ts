
import * as fs from 'node:fs';

import { writeOutput } from './common';
import { Table, parseOds } from './ods';

const odsFile = 'devtools/generators/trivm-instr.ods';

const supportedExt = new Set<string>([
    'UNWIND',
    'MEM64',
    'INT64',
    'FLOAT32',
    'FLOAT64',
]);

interface ClassArgs {
    halfArg0?: boolean;
    halfArg1?: boolean;
    halfResult?: boolean;
    withBase?: boolean;
}

const variantsArray: { [key: string]: { postfix: string, args: ClassArgs, literals?: string; }[]; } = {
    '1': [
        { postfix: '', args: {}, }
    ],
    '2A': [
        { postfix: '', args: {}, },
        { postfix: 'H', args: { halfArg1: true }, literals: '0..0', },
    ],
    '2R': [
        { postfix: '', args: {}, },
        { postfix: 'H', args: { halfResult: true }, literals: '0..1', },
    ],
    '4': [
        { postfix: '', args: {}, },
        { postfix: 'LH', args: { halfArg1: true }, literals: '0..0', },
        { postfix: 'HL', args: { halfResult: true }, literals: '0..0', },
        { postfix: 'H', args: { halfResult: true }, literals: '1..1', },
    ],
    '10': [
        { postfix: '', args: {}, },
        { postfix: 'LH', args: { halfArg0: true }, literals: '1..1', },
        { postfix: 'HL', args: { halfResult: true }, literals: '1..1', },
        { postfix: 'HH', args: { halfResult: true, halfArg0: true }, literals: '1..1', },
        { postfix: 'LLH', args: { halfArg1: true }, literals: '0..0', },
        { postfix: 'LHL', args: { halfArg0: true }, literals: '0..0', },
        { postfix: 'LHH', args: { halfArg0: true, halfArg1: true }, literals: '0..0', },
        { postfix: 'HLL', args: { halfResult: true }, literals: '0..0', },
        { postfix: 'HLH', args: { halfResult: true, halfArg1: true }, literals: '0..0', },
        { postfix: 'HHL', args: { halfResult: true, halfArg0: true }, literals: '0..0', },
    ],
};

interface RowRaw {
    code: string;
    name: string;
    numArgs: string;
    literals: string;
    variants: string;
    triasmClass: string;
    extensions: string;
    classArgs?: string | string[];
}

let newId = 0;
let instrEnum = '';
let instrInfoById = '';
let instrInfoByName = '';
let instrMakerCases = '';
let instrNames: string[] = [];

async function main() {
    let data = await parseOds(odsFile);
    delete data.header;
    for (let table of Object.values(data)) {
        processTable(table);
    }
    generateGrammarPatterns();
    writeOutput('tools/asm/instrInfo.ts', false, instrEnum, '    ', 'Instructions enumerator');
    writeOutput('tools/asm/instrInfo.ts', false, instrInfoById, '    ', 'Instructions information');
    writeOutput('tools/asm/instrInfo.ts', false, instrInfoByName, '    ', 'Instructions information by name');
    writeOutput('tools/asm/instrMaker.ts', true, instrMakerCases, '        ', 'Instructions required special handling');
}

function processTable(table: Table): void {
    for (let raw of (table.rows as unknown as RowRaw[]).filter(r => !r.name.startsWith('#'))) {
        if (!(raw.variants in variantsArray)) {
            throw new Error(`Unknown variant ${raw.variants}`);
        }
        for (let variant of Object.values(variantsArray[raw.variants])) {
            processInstr(raw, variant.postfix, variant.literals, variant.args);
        }
        //instrEnum += `    ${raw.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')} = ,\n`;
    }
}

function hexLiteral(value: number, num: number): string {
    let text = value.toString(16).toUpperCase();
    text = '0'.repeat(num) + text;
    return '0x' + text.substring(text.length - num);
}

function parseExtJSON(json: string) {
    return (new Function(`return (${json});`))();
}

function stringifyExtJSONKey(key: string): string {
    if (key.match(/^[a-z_$][0-9a-z_$]*$/i)) {
        return key;
    } else {
        return JSON.stringify(key).replace(/^"|"$/g, '\'');
    }
}

function stringifyExtJSON(object: any): string {
    let type = typeof object;
    switch (type) {
    case 'string':
        return JSON.stringify(object).replace(/^"|"$/g, '\'');
    case 'boolean':
    case 'number':
        return JSON.stringify(object);
    case 'bigint':
        return object.toString() + 'n';
    case 'undefined':
        return 'undefined';
    case 'object':
        if (object instanceof Array) {
            return '[' + object.map(x => stringifyExtJSON(x)).join(', ') + ']';
        } else {
            let entries = Object.entries(object);
            if (entries.length === 0) {
                return '{}';
            }
            return '{ ' + entries
                .map(([key, value]) => `${stringifyExtJSONKey(key)}: ${stringifyExtJSON(value)}`)
                .join(', ') + ' }';
        }
    default:
        throw new Error('Not implemented');
    }
}

main();

function processInstr(raw: RowRaw, postfix: string, variantLiterals: string | undefined, variantArgs: ClassArgs) {
    let classArgsArr = typeof (raw.classArgs) === 'string' ? [raw.classArgs] : (raw.classArgs || []);
    let argsText = '{' + (classArgsArr.filter(c => c.trim()) || []).join(',') + '}';
    let classArgs = parseExtJSON(argsText) as ClassArgs;
    classArgs = { ...classArgs, ...variantArgs };
    let literals = (variantLiterals || raw.literals).trim();
    let name = raw.name + postfix;
    let id = newId++;
    let literalsText: string = 'undefined';
    if (literals !== '-') {
        let parts = literals.split(/\s*[.-]+\s*/);
        let first = parseInt(parts[0]);
        let second = parts[1] ? parseInt(parts[1]).toString() : 'Infinity';
        literalsText = `{ min: ${first}, max: ${second} }`;
    }
    let enumName = name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    let condition = '() => true';
    if (raw.extensions) {
        condition = raw.extensions;
        for (let ext of supportedExt) {
            condition = condition.replace(ext, `ext.${ext.toLowerCase()}`);
        }
        condition = '(ext: EnabledExtensions) => ' + condition;
    }
    instrEnum += `    ${enumName} = ${id},\n`;
    instrInfoById += '    {\n';
    instrInfoById += `        id: INSTR.${enumName},\n`;
    instrInfoById += `        name: '${name}',\n`;
    instrInfoById += `        literals: ${literalsText},\n`;
    instrInfoById += `        condition: ${condition},\n`;
    instrInfoById += `        instrClass: '${raw.triasmClass.trim()}',\n`;
    instrInfoById += `        instrOptions: ${stringifyExtJSON(classArgs)},\n`;
    instrInfoById += `        opcode: ${hexLiteral(parseInt(raw.code || '0'), 2)},\n`;
    instrInfoById += `        stackArgs: ${parseInt(raw.numArgs || '0')},\n`;
    instrInfoById += '    },\n';
    instrInfoByName += `    ${stringifyExtJSONKey(name.toUpperCase())}: instrInfoById[INSTR.${enumName}],\n`;
    instrNames.push(name);
    if (raw.triasmClass.trim() === '') {
        instrMakerCases += `        case INSTR.${enumName}:\n            break;\n\n`;
    }
}


const regExpCommonParts = [
    ['.', '8|16|32|64'],
    ['.', ''],
    ['U|S', '?64|64LH|64HL|64HH|64LLH|64LHL|64LHH|64HLL|64HLH|64HHL'],
    ['', '?64|64LH|64HL|64HH|64LLH|64LHL|64LHH|64HLL|64HLH|64HHL'],
    ['U|S', ''],
    ['', '?F32|F64'],
    ['', 'F32|F64'],
    ['?U', '8S|16S|8U|16U|32|64'],
    ['?U', '8|16|32|64'],
    ['', '8|16|32|64'],
    ['', '?64|64H|64LH|64HL'],
    ['', '?T|F'],
    ['', 'U64H|U64|S64|S64H'],
    ['', 'U32|S32'],
    ['', ''],
];


function generateGrammarPatterns() {
    interface Grammar {
        patterns: {
            begin: string;
            beginCaptures: { [key: string]: { name: string; }; };
        }[];
    }
    let directiveRegExp = instrRegExp(new Set<string>(instrNames.filter(x => x.startsWith('.'))));
    let instructionRegExp = instrRegExp(new Set<string>(instrNames.filter(x => !x.startsWith('.'))));
    let grammarFile = 'devtools/vscode-extension/syntaxes/language-trivm-triasm.tmGrammar.json';
    let grammar = JSON.parse(fs.readFileSync(grammarFile, 'utf-8')) as Grammar;
    let directivePattern = grammar.patterns
        .find(p => Object.values(p.beginCaptures || {}).find(c => c.name === 'keyword.other'));
    let instructionPattern = grammar.patterns
        .find(p => Object.values(p.beginCaptures || {}).find(c => c.name === 'keyword.control'));
    if (!directivePattern || !instructionPattern) {
        throw new Error('Syntax is missing "keyword.other" or "keyword.control"');
    }
    directivePattern.begin = `^(?i)\\s*(${directiveRegExp})(?=\\s|$|#)`;
    instructionPattern.begin = `^(?i)\\s*(${instructionRegExp})(?=\\s|$|#)`;
    fs.writeFileSync(grammarFile, JSON.stringify(grammar, null, '\t'));
}


function instrRegExp(namesSubset: Set<string>): string {
    let remainingNames = [...namesSubset];
    let result: string[] = [];
    for (let [prefix, suffix] of regExpCommonParts) {
        let prefixExists = prefix !== '';
        let prefixOptional = prefix.startsWith('?');
        let prefixParts = (prefixOptional ? prefix.substring(1) : prefix).split('|');
        let prefixString = getRegExp(prefixExists, prefixOptional, prefixParts);
        let suffixExists = suffix !== '';
        let suffixOptional = suffix.startsWith('?');
        let suffixParts = (suffixOptional ? suffix.substring(1) : suffix).split('|');
        let suffixString = getRegExp(suffixExists, suffixOptional, suffixParts);
        let regExp = new RegExp('^' + prefixString + '(?<stem>[A-Z0-9_.]+)' + suffixString + '$', 'i');
        let variants: string[] = [];
        for (let prefixPart of [...prefixParts, ...(prefixOptional ? [''] : [])]) {
            for (let suffixPart of [...suffixParts, ...(suffixOptional ? [''] : [])]) {
                variants.push(prefixPart + '$' + suffixPart);
            }
        }
        let stems: string[] = [];
        for (let i = 0; i < remainingNames.length; i++) {
            let name = remainingNames[i];
            let m = name.match(regExp);
            if (!m) continue;
            let stem = m.groups?.stem || '!';
            let valid = variants
                .map(x => x.replace('$', stem))
                .every(x => namesSubset.has(x));
            if (!valid) continue;
            let regExpStem = new RegExp('^' + prefixString + getRegExp(true, false, [stem]) + suffixString + '$', 'i');
            stems.push(stem);
            remainingNames = remainingNames.filter(x => !x.match(regExpStem));
            i = -1;
        }
        if (stems.length > 0) {
            if (prefixExists || suffixExists) {
                result.push(prefixString + getRegExp(true, false, stems) + suffixString);
            } else {
                result.push(...stems.map(x => getRegExp(true, false, [x])));
            }
        }
    }
    return result.join('|');
}


function getRegExp(exists: boolean, optional: boolean, parts: string[]) {
    let result = '';
    if (exists) {
        if (parts.length === 1 && parts[0].length === 1) {
            result = parts[0].replace(/\./g, '\\.');
            if (optional) {
                result += '?';
            }
        } else if (parts.length > 0 && parts.every(x => x.length === 1)) {
            result = '[' + parts.join('') + ']';
            if (optional) {
                result += '?';
            }
        } else if (parts.length === 1) {
            if (optional) {
                result = '(?:' + parts[0].replace(/\./g, '\\.') + ')?';
            } else {
                result = parts[0].replace(/\./g, '\\.');
            }
        } else {
            result = parts.join('|').replace(/\./g, '\\.');
            if (optional) {
                result += '|';
            }
            result = '(?:' + result + ')';
        }
    }
    return result;
}
