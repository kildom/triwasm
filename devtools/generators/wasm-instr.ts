
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Row, Table, asIdentifier, parseOds } from './ods';

const tempPath = 'temp';

const odsFile = 'devtools/wasm-instr-gen/list.ods';

interface RowRaw {
    instruction: string;
    immediate: string;
    binaryOpcode: string;
    parser: string;
    type: string;
    reduction: string;
    afterReduction: string;
    generate: string;
}

interface InstrInfo {
    enumValue: string;
    name: string;
    opcode: number;
    opcodeString: string;
    generate: string;
}

async function main() {
    let data = await parseOds(odsFile);
    let table = data.instr;
    let instrInfo = createInstrInfo(table.rows);
    generateInstrTypes(instrInfo);
    generateSimpleGenerators(instrInfo);
    generateManualGenerators(instrInfo);
}

function parseOpCode(opCode: string) {
    let parts = opCode.trim().split(/\s+/);
    parts.reverse();
    let res = 0;
    for (let part of parts) {
        res <<= 8;
        res |= parseInt(part);
    }
    return res;
}

function createInstrInfo(rows: Row[]): InstrInfo[] {
    let res: InstrInfo[] = [];
    for (let row of (rows as unknown as RowRaw[])) {
        let name = row.instruction.trim();
        if (!name) continue;
        let info: InstrInfo = {
            name,
            enumValue: asIdentifier(name, 'all', false),
            opcode: parseOpCode(row.binaryOpcode),
            opcodeString: row.binaryOpcode.trim(),
            generate: row.generate.trim(),
        };
        res.push(info);
    }
    return res;
}

function generateInstrTypes(instrInfo: InstrInfo[]) {
    let text = '/* eslint-disable max-len */\n';
    for (let info of instrInfo) {
        text += `function ft_${info.enumValue}(i: WasmInstr) { if (i.opcode === OP.${info.enumValue}) return i; throw null; }\n`;
        text += `export type ${info.enumValue} = ReturnType<typeof ft_${info.enumValue}>;\n`;
    }
    text += '/* eslint-enable max-len */\n';
    //fs.writeFileSync('tools/wasm/opcodeTypes.ts', text);
    writeOutput('tools/wasm/opcodeTypes.ts', false, text, '', 'Instruction types');
}

function generateManualGenerators(instrInfo: InstrInfo[]) {
    let text = '';
    for (let info of instrInfo) {
        if (!info.generate || info.generate !== '!') {
            continue;
        }
        text += `    case OP.${info.enumValue}: {\n`;
        text += '        break;\n';
        text += '    }\n';
    }
    writeOutput('tools/wasm/generator.ts', true, text, '    ', 'Generators');
}

function generateSimpleGenerators(instrInfo: InstrInfo[]) {
    let text = '    /* eslint-disable max-len */\n';
    for (let info of instrInfo) {
        if (!info.generate || info.generate === '!') {
            continue;
        }
        let genText = info.generate.replace(/\{([^}]+)\}/gi, '${instr.$1}');
        if (genText !== info.generate) {
            text += `    [OP.${info.enumValue}]: (instr: OpType.${info.enumValue}) => \`${genText}\`,\n`;
        } else {
            text += `    [OP.${info.enumValue}]: '${genText}',\n`;
        }
    }
    text += '    /* eslint-enable max-len */\n';
    writeOutput('tools/wasm/generator.ts', false, text, '    ', 'Simple generators');
}

function replaceOutput(text: string, content: string, indent: string, title: string): string {
    let header = `// ---- ${title} - begin - generated with help of "wasm-instr.ts" script ----`;
    let footer = `// ---- ${title} - end - generated with help of "wasm-instr.ts" script ----`;
    content = content.replace(/^(\s*\n)+/, '').trimEnd();
    try {
        let [a, b, c] = text.split(header);
        if (!b || c) throw null;
        let [d, e, f] = text.split(footer);
        if (!e || f) throw null;
        let begin = a + header;
        let end = footer + e;
        return begin + '\n\n' + content + '\n\n' + indent + end;
    } catch (ex) {
        console.error(`Cannot fit "${title}" to the output.`);
        console.error('Add following lines:');
        console.error(`    ${header}`);
        console.error(`    ${footer}`);
        process.exit(1);
    }
}

const filesProcessed = new Set<string>();

function writeOutput(origFile: string, manual: boolean, content: string, indent: string, title: string) {
    let manualFile = path.join(tempPath, path.basename(origFile));
    fs.mkdirSync(tempPath, { 'recursive': true });
    if (manual) {
        let text: string;
        if (filesProcessed.has(origFile)) {
            text = fs.readFileSync(manualFile, 'utf8');
        } else {
            text = fs.readFileSync(origFile, 'utf8');
            filesProcessed.add(origFile);
        }
        text = replaceOutput(text, content, indent, title);
        fs.writeFileSync(manualFile, text);
    } else {
        let text = fs.readFileSync(origFile, 'utf8');
        text = replaceOutput(text, content, indent, title);
        fs.writeFileSync(origFile, text);
        if (filesProcessed.has(origFile)) {
            text = fs.readFileSync(manualFile, 'utf8');
            text = replaceOutput(text, content, indent, title);
            fs.writeFileSync(manualFile, text);
        }
    }
}


main();
