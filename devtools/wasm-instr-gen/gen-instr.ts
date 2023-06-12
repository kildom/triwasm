import * as fs from 'fs';
import * as xml2js from 'xml2js';
import extract from 'extract-zip';

interface Row {
    instruction: string;
    immediate: string;
    binaryOpcode: string;
    parser: string;
    type: string;
    reduction: string;
    afterReduction: string;
    dump: string;
    decOpcode: number;
    hexOpcode: string;
    trivmOnly: boolean;
    id: string;
};

const TYPES: { [key: string]: string } = {
    i32: 'NumberType.I32',
    i64: 'NumberType.I64',
    f32: 'NumberType.F32',
    f64: 'NumberType.F64',
    funcref: 'RefType.FUNCREF',
    externref: 'RefType.EXTERNREF',
    v128: 'VectorType.V128',
};

async function parseOds() {
    function extractText(x: any): string {
        if (typeof (x) == 'object') {
            if (x instanceof Array) {
                return x.map(x => extractText(x)).join('');
            } else {
                let str = '';
                for (let n in x)
                    if (!n.startsWith('$'))
                        str += extractText(x[n]);
                return str;
            }
        } else {
            return x.toString().replace('\u00A0', ' ');
        }
    }
    await extract('list.ods', { dir: fs.realpathSync('temp') });
    let xml = fs.readFileSync('temp/content.xml');
    let parser = new xml2js.Parser();
    let data = await parser.parseStringPromise(xml);
    fs.writeFileSync('temp/content.json', JSON.stringify(data, null, 4));
    let table = data['office:document-content']['office:body'][0]["office:spreadsheet"][0]["table:table"][0]["table:table-row"];
    fs.writeFileSync('temp/content2.json', JSON.stringify(table, null, 4));
    let transformedRows: string[][] = [];
    for (let row of table) {
        let cells: string[] = [];
        for (let cell of row["table:table-cell"]) {
            let length = !cell.$ ? 1 : !cell.$['table:number-columns-repeated'] ? 1 : parseInt(cell.$['table:number-columns-repeated']);
            let value = extractText(cell);
            if (1 < length && length < 30) {
                cells.splice(cells.length, 0, ...Array.from({ length }).map((x) => value));
            } else {
                cells.push(value);
            }
        }
        transformedRows.push(cells);
    }
    fs.writeFileSync('temp/content3.json', JSON.stringify(transformedRows, null, 4));
    let header = (transformedRows.shift() as string[]).map(x => x
        .trim()
        .replace(/ [a-z]/gi, m => m.trim().toUpperCase())
        .replace(/^./, m => m.toLowerCase()));
    while (header[header.length - 1] == '')
        header.pop();
    let transformed = transformedRows
        .map(row => {
            let obj: { [key: string]: string } = {};
            let allEmpty = true;
            for (let i = 0; i < header.length; i++) {
                obj[header[i]] = row[i] || '';
                if (obj[header[i]] != '')
                    allEmpty = false;
            }
            return allEmpty ? null : obj;
        })
        .filter(row => row !== null) as unknown as Row[];
    fs.writeFileSync('temp/content4.json', JSON.stringify(transformed, null, 4));
    return transformed;
}

function postProcess(table: Row[]) {
    for (let row of table) {
        if (row.binaryOpcode.startsWith('0x')) {
            let bytes = row.binaryOpcode.split(/\s+/).map(x => parseInt(x));
            let mul = 1;
            let b: number;
            let result = 0;
            let pos = 1;
            do {
                b = bytes[pos++];
                result += (b & 0x7F) * mul;
                mul = mul << 7;
            } while (b & 0x80);
            result = bytes[0] | result << 8;
            row.decOpcode = result;
            let hex = result.toString(16).toUpperCase();
            if (hex.length & 1) {
                hex = '0' + hex;
            }
            row.hexOpcode = '0x' + hex;
        } else {
            row.decOpcode = parseInt(row.binaryOpcode);
            row.hexOpcode = row.decOpcode.toString();
        }
        row.trivmOnly = row.instruction.toLowerCase().startsWith('trivm');
        row.id = row.instruction.toUpperCase().replace(/\./g, '_');
    }
}

function generateEnum(table: Row[]) {
    let out = '\nexport enum OP {\n';
    for (let row of table) {
        out += `    ${row.id} = ${row.hexOpcode}, // ${row.instruction}`;
        if (row.immediate.length) {
            out += ` ${row.immediate}`;
        }
        if (row.decOpcode >= 0) {
            out += `    [ ${row.binaryOpcode} ]`;
        }
        out += '\n';
    }
    out += '};\n';
    writeOutput('output/opcodes.ts', '../../tools/wasm/opcodes.ts', out, '');
}

function generateParser(table: Row[]) {
    let out = '';

    let groups: { [params: string]: Row[] } = {};
    for (let row of table) {
        if (!row.trivmOnly) {
            groups[row.parser] = groups[row.parser] || [];
            groups[row.parser].push(row);
        }
    }
    let temp = groups[''];
    delete groups[''];
    groups[''] = temp;

    out += `\n            // The following cases are generated automatically without body.`;
    out += `\n            // You can edit case body, but if you want to change something else use`;
    out += `\n            // the "gen-instr.ts" script and manually merge results with this file.`;

    for (let [params, group] of Object.entries(groups)) {
        for (let row of group) {
            out += `\n            case OP.${row.id}:`;
        }
        out += ` {`;
        if (params) {
            out += ` // ${params}`;
        } else {
            out += ` // no immediate`;
        }
        out += `\n                break;\n            }`;
    }
    writeOutput('output/wasmParser.ts', '../../tools/wasm/wasmParser.ts', out, '            ');
}

function splitTypes(type: string): [(string | undefined)[], (string | undefined)[]] {
    type = type.replace(/[^a-z0-9_→]/gi, ' ');
    return type.trim().length == 0 ? [[], []] : type
        .split('→')
        .map(x => x
            .trim()
            .split(/\s+/)
            .filter(x => x.length)
            .map(x => TYPES[x.toLowerCase()])
        ) as [(string | undefined)[], (string | undefined)[]];
}

function generateDumperNames(table: Row[]) {
    let out = '';

    for (let row of table) {
        out += `    [OP.${row.id}]: '${row.instruction}',\n`;
    }

    writeOutput('output/moduleDebug.ts', '../../tools/wasm/moduleDebug.ts', out, '    ', 'Instruction names');
}

function generateDumperCases(table: Row[]) {

    function sortKey(value: string): number {
        if (value.trim().startsWith('!')) {
            return 0;
        } else if (value.trim().startsWith('```')) {
            return 2;
        } else {
            return 1;
        }
    }

    let out = '';

    let groups: { [key: string]: Row[] } = {};

    for (let row of table) {
        let key: string;
        if (row.dump) {
            key = '!' + row.dump;
        } else {
            key = row.parser + '```' + row.type;
        }
        groups[key] = groups[key] || [];
        groups[key].push(row);
    }

    let sorted = Object.keys(groups).sort((a, b) => sortKey(a) - sortKey(b));

    for (let key of sorted) {
        for (let row of groups[key]) {
            out += `\n            case OP.${row.id}:`;
        }
        out += ` {\n`;
        if (key.startsWith('!')) {

        } else {
            let type = key.split('```')[1];
            let [popTypes, pushTypes] = splitTypes(type);
            if (popTypes.indexOf(undefined) >= 0 || pushTypes.indexOf(undefined) >= 0) {
                console.error(`Need custom dumping method for ${key}: ${groups[key].map(row => row.instruction + ':' + row.hexOpcode).join(', ')}`);
            }
            if (popTypes.length > 0) {
                out += `                this.pop(${popTypes.join(', ')});\n`;
            }
            if (pushTypes.length > 0) {
                out += `                this.push(${pushTypes.join(', ')});\n`;
            }
        }
        out += `                break;\n`;
        out += `            }`;
    }
    out += `\n`;

    writeOutput('output/moduleDebug.ts', '../../tools/wasm/moduleDebug.ts', out, '            ', 'Instruction print and verify');
}

function generateDumper(table: Row[]) {

    generateDumperNames(table);
    generateDumperCases(table);
    return;

    let out = '';

    for (let row of table) {
        let [popTypes, pushTypes] = splitTypes(row.type);
        out += `            case OP.${row.id}: {\n`;
        out += `                this.printInstrName(instr, '${row.instruction}'${row.dump == 'block' ? ', true' : ''});\n`;
        let dumpList = row.dump.split(/\s*,\s*/).filter(x => x);
        if (dumpList.length > 0) {
            for (let dump of dumpList) {
                if (dump == 'block') {
                    out += `                outStackIndex = this.out.length;\n`;
                }
                out += `                this.dumpInstr${dump[0].toUpperCase()}${dump.substring(1)}(instr);\n`;
            }
        } else {
            if (popTypes.indexOf(undefined) >= 0) {
                out += `                // TODO: custom pop types\n`;
            } else if (popTypes.length > 0) {
                out += `                this.pop(${popTypes.join(', ')});\n`;
            }
            if (pushTypes.indexOf(undefined) >= 0) {
                out += `                // TODO: custom push types\n`;
            } else if (pushTypes.length > 0) {
                out += `                this.push(${pushTypes.join(', ')});\n`;
            }
        }
        out += `                break;\n`;
        out += `            }\n`;
    }

    writeOutput('output/moduleDebug.ts', '../../tools/wasm/moduleDebug.ts', out, '            ');
}

function generateReducer(table: Row[]) {

    function replaceExpr(expr: string): string {
        return expr
            .trim()
            .replace(/#([a-z0-9_]+)/gi, 'this.ext.$1')
            .replace(/\.\./gi, 'instr.')
            .replace(/\\\,/gi, ',')
    }

    function sortKey(value: string): number {
        if (value.trim().startsWith('##')) {
            return 2;
        } else if (value.trim().startsWith('!')) {
            return 0;
        } else {
            return 1;
        }
    }

    let out = '';

    for (let row of table) {
        if (row.reduction === '!') {
            row.reduction += row.instruction;
        }
    }

    let groups: { [reduction: string]: Row[] } = {};
    for (let row of table) {
        let key = row.reduction + '```' + row.type;
        if (!row.trivmOnly) {
            groups[key] = groups[key] || [];
            groups[key].push(row);
        }
    }

    let sorted = Object.keys(groups).sort((a, b) => sortKey(a) - sortKey(b));

    for (let key of sorted) {
        let group = groups[key];
        let [reduction, type] = key.split('```');

        for (let row of group) {
            out += `\n            case OP.${row.id}:`;
        }
        out += ` {`;
        if (reduction.startsWith('!')) {
            out += `\n                break;\n            }`;
            continue;
        } else if (reduction.trim().startsWith('##')) {
            // nothing to print
        } else if (reduction) {
            out += ` // Generated from expression: ${reduction}`;
        } else {
            out += ` // TODO`;
        }
        let tokens: string[] = [];
        let ind = '';
        while (reduction.trim().length > 0) {
            let m: RegExpMatchArray | null;
            if ((m = reduction.match(/^\s*{\s*else\s*}\s*/i))) { // {else}
                tokens.push(`${ind}} else {`);
                reduction = reduction.substring(m[0].length);
            } else if ((m = reduction.match(/^\s*{\s*end\s*}\s*/i))) { // {end}
                tokens.push(`${ind}}`);
                reduction = reduction.substring(m[0].length);
                ind = ind.substring(0, ind.length - 4);
            } else if ((m = reduction.match(/^\s*{\s*elif\s+(.*?)\s*}\s*/i))) { // {elif cond}
                tokens.push(`${ind}} else if (${replaceExpr(m[1])}) {`);
                reduction = reduction.substring(m[0].length);
            } else if ((m = reduction.match(/^\s*{\s*(?:if\s+)?(.*?)\s*}\s*/i))) { // {if cond}
                ind += '    ';
                tokens.push(`${ind}if (${replaceExpr(m[1])}) {`);
                reduction = reduction.substring(m[0].length);
            } else if ((m = reduction.match(/^\s*##\s*/i))) { // ##
                tokens.push(`${ind}    newBody.push(instr);`)
                reduction = reduction.substring(m[0].length);
            } else if ((m = reduction.match(/^\s*;\s*/i))) { // ;
                reduction = reduction.substring(m[0].length);
            } else if ((m = reduction.match(/^\s*@\s*([a-z0-9_]+)\s*/i))) { // @triwasmlib_func
                tokens.push(`${ind}    newBody.push(this.createTriWasmLibCall('${m[1]}'));`)
                reduction = reduction.substring(m[0].length);
            } else if ((m = reduction.match(/^\s*([a-z0-9_\.]+)(\s+[^;{]+)?/i))) { // other.instr param: value, param2 ...
                let name = m[1].toUpperCase().replace(/\./g, '_');
                let params = [`opcode: OP.${name}`];
                if (m[2]) {
                    for (let expr of m[2].split(/\s*(?<!\\),\s*/)) {
                        let mm: RegExpMatchArray | null;
                        if ((mm = expr.match(/^\s*([a-z0-9_]+)\s*$/))) {
                            params.push(`${mm[1]}: instr.${mm[1]}`);
                        } else if ((mm = expr.match(/^\s*([a-z0-9_]+)\s*[:=](.*)$/))) {
                            params.push(`${mm[1]}: ${replaceExpr(mm[2])}`);
                        } else {
                            throw Error(`Unknown parameter in reduction: ${expr}`);
                        }
                    }
                }
                tokens.push(`${ind}    newBody.push({ ${params.join(', ')} });`);
                reduction = reduction.substring(m[0].length);
            } else {
                throw Error(`Unknown expression in reduction: ${reduction}`);
            }
        }
        while (ind.length > 0) {
            tokens.push(`${ind}}`);
            ind = ind.substring(0, ind.length - 4);
        }
        let [popTypes, pushTypes] = splitTypes(type);
        if (popTypes.length) {
            tokens.push(`    this.popTypes(${popTypes.join(', ')});`);
        }
        if (pushTypes.length) {
            tokens.push(`    this.pushTypes(${pushTypes.join(', ')});`);
        }
        out += `\n            ${tokens.join('\n            ')}`;
        out += `\n                break;\n            }`;
    }

    writeOutput('output/reducer.ts', '../../tools/wasm/reducer.ts', out, '            ');
}

function writeOutput(destFile: string, origFile: string, content: string, indent: string, title: string = '') {
    let header = indent + '// -- Begin of source code generated with help of "gen-instr.ts" script --';
    let footer = indent + '// -- End of source code generated with help of "gen-instr.ts" script --';
    if (title) {
        header = `${indent}// -- ${title} - begin of source code generated with help of "gen-instr.ts" script --`;
        footer = `${indent}// -- ${title} - end of source code generated with help of "gen-instr.ts" script --`;
    }
    let begin: string;
    let end: string;
    try {
        let orig = fs.readFileSync(origFile, 'utf-8');
        let [a, b, c] = orig.split(header);
        if (!b || c) throw null;
        let [d, e, f] = orig.split(footer);
        if (!e || f) throw null;
        begin = a + header;
        end = footer + e;
    } catch (ex) {
        begin = header;
        end = footer;
    }
    content = content
        .replace(/^(\s*\n)+/, '')
        .replace(/(\s*\n)+$/, '');
    fs.writeFileSync(destFile, begin + '\n\n' + content + '\n\n' + end);
    fs.writeFileSync(destFile + '.sh', `#!/bin/sh\nA=$(readlink -f "$0")\nA=$(dirname "$A")\nmeld "$A/../${destFile}" "$A/../${origFile}"\n`, { mode: 0o755 });
}

async function main() {
    fs.rmdirSync('temp', { 'recursive': true });
    fs.mkdirSync('temp', { 'recursive': true });
    fs.mkdirSync('output', { 'recursive': true });
    let table = await parseOds();
    postProcess(table);
    fs.writeFileSync('temp/content5.json', JSON.stringify(table, null, 4));
    generateEnum(table);
    generateParser(table);
    generateReducer(table);
    generateDumper(table);
    // generateOutputNames(table);
    // generateDataDump(table);
    // generateGenerator(table);
}

main();
