import * as fs from 'fs';
import * as xml2js from 'xml2js';
import extract from 'extract-zip';

interface Row {
    instruction: string;
    immediate: string;
    binaryOpcode: string;
    parser: string;
    type: string;
    decOpcode: number;
    hexOpcode: string;
    trivmOnly: boolean;
    id: string;
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
            if (1 < length && length < 30) {
                cells.splice(cells.length, 0, ...Array.from({ length }).map((x) => extractText(cell)));
            } else {
                cells.push(extractText(cell));
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

const IMMEDIATE_PARSERS: { [key: string]: string } = {
    '': `
        // Nothing more to parse here`,
    memarg: `
        let align = input.u32();
        let memIndex = 0;
        if (align & 0x40) {
            memIndex = input.u32();
        }
        if (memIndex >= this.module.memories.length) {
            throw new Error('Invalid memory index.');
        }
        let offset = BigInt(input.u32()) & 0xFFFFFFFFn;
        instr = { opcode, offset, memIndex };`,
    memidx: `
        let index# = input.u32();
        if (index# >= this.module.memories.length) {
            throw new Error('Invalid memories index.');
        }
        imm.push(this.module.memories[index#]);`,
    dataidx: `
        let index# = input.u32();
        if (index# >= this.module.data.length) {
            throw new Error('Invalid data index.');
        }
        imm.push(this.module.data[index#]);`,
    elemidx: `
        let index# = input.u32();
        if (index# >= this.module.elements.length) {
            throw new Error('Invalid element index.');
        }
        imm.push(this.module.elements[index#]);`,
}

function generateParser(table: Row[]) {
    let out = '';

    let groups: { [params: string]: Row[] } = { };
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


function writeOutput(destFile: string, origFile: string, content: string, indent: string) {
    let header = indent + '// -- Begin of source code generated with help of "gen-instr.ts" script --';
    let footer = indent + '// -- End of source code generated with help of "gen-instr.ts" script --';
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
    // generateReducer(table);
    // generateDumper(table);
    // generateOutputNames(table);
    // generateDataDump(table);
    // generateGenerator(table);
}

main();
