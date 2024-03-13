import { Compiler } from '../../tools/asm/compiler';
import { CompilerError } from '../../tools/asm/errors';
import { KNOWN_EXTENSIONS } from '../../tools/asm/instrInfo';
import { reMatchAll } from '../../tools/common/common';
import { platform } from '../../tools/common/platform';
import { Template } from '../utils';


let testCases: TestCase[] = [];

class TestCase {
    _group: string[] = [];
    _comments: string[] = [];
    _errors: string[] = [];
    _source: string = '';
    constructor() {
        testCases.push(this);
    }
    assert(condition: boolean, text: string) {
        if (!condition) {
            this.error(text);
        }
    }
    comment(text: string) {
        this._comments.push(text);
    }
    group(group: string[]) {
        this._group.push(...group);
    }
    source(sourceCode: string) {
        this._source += sourceCode;
    }
    error(text: any) {
        this._errors.push(text);
    }
    isSuccess() {
        return this._errors.length === 0;
    }
    addIndent(text: string, prefix?: string) {
        return text.replace(/\n/g, prefix || '\n    ');
    }
    show(short: boolean) {
        console.log(`${this._group.join(' > ')}: ${this.isSuccess() ? 'OK' : 'ERROR'}`);
        if (short)
            return;
        for (const error of this._errors) {
            console.log(`    ERROR: ${this.addIndent(error)}`);
        }
        for (const comment of this._comments) {
            console.log(`    ${this.addIndent(comment)}`);
        }
        if (this._source !== '') {
            console.log(`    +---------------------------------------------`);
            console.log(`    | ${this.addIndent(this._source, '\n    | ')}`);
            console.log(`    +---------------------------------------------`);
        }

    }
};

function bytecodeFromSource(code: string): Uint8Array | null {
    let result: number[] = [];
    let top: number = 0;
    let m: RegExpMatchArray | null;
    for (let part of code.split(/\s+/)) {
        if (part.toUpperCase() == 'ERROR') {
            return null;
        } else if (part == '|') {
            result.push(top & 0xFF);
            top = 0;
        } else if ((m = part.match(/^\*([0-9]+)$/i))) {
            let n = parseInt(m[1]) - 1;
            for (let i = 0; i < n; i++)
                result.push(top);
        } else {
            let bits: number;
            let number: number;
            if ((m = part.match(/^(-?[0-9]+)x(-?[0-9a-f]*)$/i))) {
                bits = parseInt(m[1]);
                number = parseInt(m[2] || '0', 16);
            } else if ((m = part.match(/^(-?[0-9]+)o(-?[0-7]*)$/i))) {
                bits = parseInt(m[1]);
                number = parseInt(m[2] || '0', 8);
            } else if ((m = part.match(/^(-?[0-9]+)d(-?[0-9]*)$/i))) {
                bits = parseInt(m[1]);
                number = parseInt(m[2] || '0', 10);
            } else if ((m = part.match(/^(-?[0-9]+)b(-?[01]*)$/i))) {
                bits = parseInt(m[1]);
                number = parseInt(m[2] || '0', 2);
            } else if ((m = part.match(/^(-?[01]+)$/i))) {
                bits = m[1].length;
                number = parseInt(m[1], 2);
            } else {
                throw Error(`Cannot parse bytecode input vector: "${code}" at token "${part}".`);
            }
            if (bits < 0) {
                number = -number;
                bits = -bits;
            }
            top = top << bits;
            top |= number & ((1 << bits) - 1);
        }
    }
    result.push(top & 0xFF);
    return new Uint8Array(result);
}

function toStringBytes(arr: any) {
    if (arr === null)
        return 'NULL';
    let last = -1;
    let count = 0;
    let copy = [...arr];
    for (let i = 0; i < copy.length; i++) {
        if (last == copy[i]) {
            count++;
            if (count == 5) {
                copy[i - 3] = null;
                copy[i - 2] = null;
                copy[i - 1] = null;
                copy[i] = -4;
            } else if (count > 5) {
                copy[i] = copy[i - 1] - 1;
                copy[i - 1] = null;
            }
        } else {
            last = copy[i];
            count = 0;
        }
    }
    copy = copy.filter(x => x !== null);
    return copy.map(x => x < 0 ? `... repeat ${-x} ...` : (x < 16 ? '0' : '') + x.toString(16).toUpperCase()).join(' ');
}

function runSingleTest(sourceCode: string, ext: { [k: string]: boolean }, result: string, group: string[]) {
    let expected = bytecodeFromSource(result);

    if (process.argv[2] && group.join(' > ').trim() !== process.argv[2].trim()) {
        return;
    }

    sourceCode = sourceCode
        .split('\n')
        .filter(line => line.trim().length)
        .join('\n');

    let tc = new TestCase();
    tc.group(group);
    let extList = Object.entries(ext)
        .filter(x => x[1])
        .map(x => x[0])
        .join(', ');
    if (extList != '') {
        sourceCode = `.EXT ${extList}\n${sourceCode}`;
    }
    tc.source(sourceCode);
    let expectedText = toStringBytes(expected);
    tc.comment(`Expected: ${result}`);
    tc.comment(`Expected raw: ${expectedText}`);

    let compiler = new Compiler();
    let bytecode: Uint8Array | null;
    try {
        bytecode = compiler.compile(sourceCode);
    } catch (ex: any) {
        if (ex instanceof CompilerError) {
            tc.comment(`Compilation error: ${ex.toString()}`);
            bytecode = null;
        } else {
            tc.error(ex.toString());
            return;
        }
    }
    let bytecodeText = toStringBytes(bytecode);
    tc.comment(`Output raw:   ${bytecodeText}`);
    if (expected === null) {
        tc.assert(bytecode == null, 'Expecting error, but compilation was successful.');
    } else if (bytecode === null) {
        tc.error('Unexpected compilation error!');
    } else if (expected.length != bytecode.length || !expected.every((x, i) => x == (bytecode as Uint8Array)[i])) {
        tc.error('Output different than expected!');
    }
}


function runTests(tests: string, ext: { [k: string]: boolean }) {
    let sourceCode = '';
    let group: string[] = [];
    for (let m of reMatchAll(/([\s\S]*?)## ([a-z0-9_-]+)([\s\S]*?)\n/gi, tests)) {
        sourceCode += m[1];
        switch (m[2].toUpperCase()) {
            case 'GROUP':
                group.push(m[3].trim());
                break;
            case 'GROUP_END':
                group.pop();
                break;
            case 'RESULT':
                runSingleTest(sourceCode, ext, m[3].trim(), group);
                sourceCode = '';
                break;
            default:
                throw Error('Not implemented!');
        }
    }
}


let input: string;
try {
    input = platform.readFile('vectors.triasm', false);
} catch (ex) {
    input = platform.readFile('test/asm/vectors.triasm', false);
}
let template = new Template(input);

let variants = 1 << KNOWN_EXTENSIONS.length;

for (let i = 0; i < variants; i++) {
    let ext: { [k: string]: boolean } = {};
    for (let k = 0; k < KNOWN_EXTENSIONS.length; k++) {
        ext[KNOWN_EXTENSIONS[k]] = !!(i & (1 << k));
    }
    let arg = { ext };
    let tests = template.render(arg);
    try {
        platform.writeFile(`tests-outs/variant.${i}.triasm`, tests);
    } catch {
        // TODO: why ignore?
    }
    runTests(tests, ext);
}

let stats: { [key: string]: { ok: number; err: number } } = {};

for (let testCase of testCases) {
    let name = testCase._group.join(' > ');
    if (!(name in stats)) {
        stats[name] = { ok: 0, err: 0 };
    }
    if (testCase.isSuccess()) {
        stats[name].ok++;
    } else {
        stats[name].err++;
    }
}

for (let [key, value] of Object.entries(stats)) {
    if (value.err) {
        console.log(`${key}: ${value.ok} OK, ${value.err} ERROR`);
    } else {
        console.log(`${key}: ${value.ok} OK`);
    }
}

for (let testCase of testCases.filter(x => !x.isSuccess())) {
    testCase.show(false);
}

console.log(`Total: ${testCases.length}`);
console.log(`Success: ${testCases.filter(x => x.isSuccess()).length}`);
console.log(`Errors: ${testCases.filter(x => !x.isSuccess()).length}`);

if (testCases.filter(x => !x.isSuccess()).length) {
    process.exit(1);
}
