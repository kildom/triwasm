const { time, timeStamp } = require('console');
const fs = require('fs');
const { WasmParser, WasmParsingError } = require('./WasmParser');

//file = new Uint8Array(fs.readFileSync('test/libbzip2-dec.wasm'));
file = new Uint8Array(fs.readFileSync('test/test.wasm'));

const sectionNames = [
    'custom',
    'type',
    'import',
    'function',
    'table',
    'memory',
    'global',
    'export',
    'start',
    'element',
    'code',
    'data',
    'data count',
];

const SECTION_ID_CUSTOM = 0;
const SECTION_ID_TYPE = 1;
const SECTION_ID_IMPORT = 2;
const SECTION_ID_FUNCTION = 3;
const SECTION_ID_TABLE = 4;
const SECTION_ID_MEMORY = 5;
const SECTION_ID_GLOBAL = 6;
const SECTION_ID_EXPORT = 7;
const SECTION_ID_START = 8;
const SECTION_ID_ELEMENT = 9;
const SECTION_ID_CODE = 10;
const SECTION_ID_DATA = 11;
const SECTION_ID_DATA_COUNT = 12;

class DataStream {
    constructor(uint8Array, dataView, offset) {
        this.a = uint8Array;
        this.v = dataView;
        this.p = offset;
        this.dec = new TextDecoder();
    }

    uleb128() {
        let mul = 1;
        let b;
        let result = 0;
        do {
            b = this.a[this.p++];
            result += (b & 0x7F) * mul;
            mul *= 128;
        } while (b & 0x80);
        return result;
    }

    sleb128() {
        let mul = 1;
        let b;
        let result = 0;
        do {
            b = this.a[this.p++];
            result += (b & 0x7F) * mul;
            mul *= 128;
        } while (b & 0x80);
        if (result >= mul/2) {
            result--;
            result ^= mul-1;
            return -result;
        } else {
            return result;
        }
    }

    u32() {
        let r = this.uleb128();
        if (r > 0xFFFFFFFF)
            throw Error('Integer out of expected range');
        return r;
    }

    s64() {
        return this.sleb128();
    }

    str() {
        let len = this.uleb128();
        let result = this.dec.decode(this.a.subarray(this.p, this.p + len));
        this.p += len;
        return result;
    }

    bytes() {
        let len = this.uleb128();
        let result = this.a.slice(this.p, this.p + len);
        this.p += len;
        return result;
    }

    limits() {
        let isMax = this.byte();
        let min = this.u32();
        if (isMax) {
            let max = this.u32();
            return { min, max };
        }
        return { min };
    }

    byte() {
        return this.a[this.p++];
    }

    skip(n) {
        this.p += n;
    }

    sub(n) {
        let ret = new DataStream(this.a.subarray(this.p, this.p + n), new DataView(this.a.buffer, this.a.byteOffset, n), 0);
        this.p += n;
        return ret;
    }

    get remaining() {
        return this.v.byteLength - this.p;
    }
}

function parseProducersSection(s) {
    let count = s.u32();
    for (let i = 0; i < count; i++) {
        let fieldName = s.str();
        console.log(`  ${fieldName}:`);
        let valueCount = s.u32();
        for (let j = 0; j < valueCount; j++) {
            let name = s.str();
            let version = s.str();
            console.log(`    ${name} ${version}`);
        }
    }
}

function parseCustomSection(s) {
    let name = s.str();
    console.log(`Custom section "${name}"`);
    if (name == 'producers') {
        parseProducersSection(s);
    }
}

function parseImportSection(s) {
    const count = s.u32();
    for (let i = 0; i < count; i++) {
        let moduleName = s.str();
        let memberName = s.str();
        let kind = s.byte();
        switch (kind) {
            case 0x00:
                let typeIndex = s.u32();
                console.log(`  import function ${moduleName}::${memberName} of type ${typeIndex}`);
                break;
            case 0x01:
                throw Error(`TODO`);
                break;
            case 0x02:
                let { min, max } = s.limits();
                console.log(`  import memory ${moduleName}::${memberName} of size from ${min} to ${max}`);
                break;
            case 0x03:
                throw Error(`TODO`);
                break;
            default:
                throw Error(`Unknown kind of import '${kind}'`);
        }
    }
}

function parseExportSection(s) {
    const count = s.u32();
    for (let i = 0; i < count; i++) {
        let memberName = s.str();
        let kind = s.byte();
        let index = s.u32();
        switch (kind) {
            case 0x00:
                console.log(`  export function ${index} as ${memberName}`);
                break;
            case 0x01:
                console.log(`  export table ${index} as ${memberName}`);
                break;
            case 0x02:
                console.log(`  export memory ${index} as ${memberName}`);
                break;
            case 0x03:
                console.log(`  export function ${index} as ${memberName}`);
                break;
            default:
                throw Error(`Unknown kind of import '${kind}'`);
        }
    }
}

function parseFunctionSection(s) {
    let count = s.u32();
    for (let funcIndex = 1; funcIndex <= count; funcIndex++) {
        let typeIndex = s.u32();
        console.log(`  function ${funcIndex} type is ${typeIndex}`);
    }
}
const typeTab = {
    0x7F: 'i32',
    0x7E: 'i64',
    0x7D: 'f32',
    0x7C: 'f64',
    0x70: 'funcref',
    0x6F: 'externref',
}

function parseTypeSection(s) {
    let count = s.u32();
    for (let i = 0; i < count; i++) {
        let startByte = s.byte();
        let vects = [[], []];
        for (let j = 0; j < 2; j++) {
            let paramCount = s.u32();
            for (let k = 0; k < paramCount; k++) {
                vects[j][k] = typeTab[s.byte()];
            }
        }
        console.log(`  type ${i} is ${vects[1].join(', ')}(${vects[0].join(', ')})`);
    }
}

function parseTableSection(s) {
    const count = s.u32();
    for (let i = 0; i < count; i++) {
        let type = typeTab[s.byte()];
        let limits = s.limits();
        console.log(`  table ${i} of type ${type} of size from ${limits.min} to ${limits.max}`);
    }
}

function parseExpr(s) {
    while (true) {
        let code = s.byte();
        switch (code) {
            case 0x0B:
                return;
            case 0x23:
                console.log(`      global.get ${s.u32()}`);
                break;
            case 0x41:
                console.log(`      i32.const ${s.u32()}`);
                break;
            case 0x6B:
                console.log(`      i32.sub`);
                break;
            default:
                console.log(`      unknown code 0x${code.toString(16)}`);
                return;
        }
    }
}

function parseFuncCode(s) {
    let count = s.u32();
    for (let i = 0; i < count; i++) {
        let localsCount = s.u32();
        let type = typeTab[s.u32()];
        console.log(`    ${localsCount} local(s) of type ${type}`);
    }
    parseExpr(s);
}

function parseCodeSection(s) {
    let count = s.u32();
    for (let funcIndex = 1; funcIndex <= count; funcIndex++) {
        let funcSize = s.u32();
        console.log(`  function ${funcIndex} of size ${funcSize}`);
        parseFuncCode(s.sub(funcSize));
    }
}

function parseGlobalSection(s) {
    let count = s.u32();
    for (let i = 0; i < count; i++) {
        let type = typeTab[s.u32()];
        let mut = s.byte();
        console.log(` global ${mut ? 'var' : 'const'} ${i} of type ${type}`);
        parseExpr(s);
    }
}

function parseWasmSection(s) {
    const id = s.byte();
    const size = s.u32();
    console.log(`Section ${sectionNames[id]} (${id}) of size ${size}`);
    switch (id) {
        case SECTION_ID_CUSTOM:
            return parseCustomSection(s.sub(size));
        case SECTION_ID_IMPORT:
            return parseImportSection(s.sub(size));
        case SECTION_ID_EXPORT:
            return parseExportSection(s.sub(size));
        case SECTION_ID_FUNCTION:
            return parseFunctionSection(s.sub(size));
        case SECTION_ID_TYPE:
            return parseTypeSection(s.sub(size));
        case SECTION_ID_TABLE:
            return parseTableSection(s.sub(size));
        case SECTION_ID_CODE:
            return parseCodeSection(s.sub(size));
        case SECTION_ID_GLOBAL:
            return parseGlobalSection(s.sub(size));
        default:
            s.skip(size);
            break;
    }
}

function parseWasmFile(file) {
    const view = new DataView(file.buffer);
    const s = new DataStream(file, view, 0);
    let parser = new WasmParser(s);
    parser.parse();
    /*if (view.getUint32(0) != 0x0061736D)
        throw Error('Invalid wasm binary file');
    if (view.getUint32(4, true) != 1)
        throw Error('Unsupported wasm binary file version');
    while (s.remaining > 0) {
        parseWasmSection(s);
    }*/
}

parseWasmFile(file);

//console.log(file);
console.log('ok');
