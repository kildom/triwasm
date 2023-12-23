import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as xmlJs from 'xml-js';
import extract from 'extract-zip';

export type Row = { [key: string]: string | string[]; };
export interface Table {
    name: string;
    headers: Row;
    desc: Row;
    rows: Row[];
}
export type Spreadsheet = { [key: string]: Table; };

interface Element {
    type: 'element';
    name: string;
    attributes?: { [key: string]: string; };
    elements?: Node[];
}

interface Text {
    type: 'text';
    text: string;
}

interface CData {
    type: 'cdata';
    cdata: string;
}

interface Instruction {
    type: 'instruction';
    name: string;
    instruction: string;
}

type Node = Element | Text | CData | Instruction;

interface Document {
    type?: 'document';
    elements: Node[];
}

let debug = false;

function getElementsByTagName(root: Node | Node[], tagName: string): Element[] {
    let res: Element[] = [];
    let arr: Node[];
    if (root instanceof Array) {
        arr = root;
    } else {
        if (root.type !== 'element') {
            return [];
        }
        if (root.name === tagName) {
            res.push(root);
        }
        arr = root.elements || [];
    }
    for (let n of arr) {
        if (n.type === 'element') {
            let sub = getElementsByTagName(n, tagName);
            if (sub.length > 0) {
                res = res.concat(sub);
            }
        }
    }
    return res;
}

/**
 * Convert string to an identifier name.
 */
function asIdentifier(name: string, firstUpperCase: boolean = false): string {
    return name.trim()
        .replace(/[^a-z0-9]/gi, ' ')
        .replace(/([0-9]+)/g, ' $1 ')
        .replace(/(?<![A-Z])([A-Z])/g, ' $1')
        .replace(/(?<=[A-Z][A-Z])([a-z])/g, ' $1')
        .replace(/ +/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/ [a-z0-9]/gi, m => m.trim().toUpperCase())
        .replace(/^./gi, m => firstUpperCase ? m.toUpperCase() : m.toLowerCase());
}

/**
 * Extract plain text from the cell.
 */
function extractCellText(cell: Element): string {
    let res = '';
    for (let node of cell.elements || []) {
        if (node.type === 'text') {
            res += node.text;
        } else if (node.type === 'cdata') {
            res += node.cdata;
        } else if (node.type === 'element') {
            if (node.name === 'text:s') {
                let count = parseInt(node.attributes?.['text:c'] || '1');
                res += ' '.repeat(count);
            } else {
                res += extractCellText(node);
            }
        }
    }
    return res;
}

/**
 * Extract plain text from the cell.
 */
function parseRows(rows: Element[], skipEmpty: boolean): Table {
    let res: Table = {name: '', headers: {}, desc: {}, rows: []};
    let colNames: string[] = [];
    let headerRow = rows.shift();
    if (!headerRow) return res;
    let headerCells = getElementsByTagName(headerRow, 'table:table-cell');
    let restStart = 2000000000;
    for (let cell of headerCells) {
        let text = extractCellText(cell).replace(/\u00A0/g, ' ');
        let name = text.split('(', 1)[0].trim();
        let desc = text.substring(name.length).replace(/^\s*\(\s*|\s*\)\s*$/g, '');
        let id = asIdentifier(name);
        if (name.endsWith('...') || name.endsWith('…')) {
            restStart = colNames.length;
            name = name.replace(/\.\.\.$|…$/, '');
        }
        colNames.push(id);
        if (id !== '') {
            res.desc[id] = desc;
            res.headers[id] = name;
        }
        if (restStart < 2000000000) break;
    }
    for (let row of rows) {
        let resRow: Row = {};
        let cells = getElementsByTagName(row, 'table:table-cell');
        for (let i = 0; i < Math.max(colNames.length, cells.length); i++) {
            let cellText = i < cells.length ? extractCellText(cells[i]).replace(/\u00A0/g, ' ') : '';
            if (i < restStart) {
                if (colNames[i] !== '') {
                    resRow[colNames[i]] = cellText;
                }
            } else {
                if (colNames[restStart] !== '') {
                    resRow[colNames[restStart]] = resRow[colNames[restStart]] || [];
                    (resRow[colNames[restStart]] as string[]).push(cellText);
                }
            }
        }
        if (colNames[restStart]) {
            let restArr = resRow[colNames[restStart]] as string[];
            while (restArr.length > 0 && restArr.at(-1)?.trim() === '') {
                restArr.pop();
            }
        }
        if (!skipEmpty || Object.values(resRow).some(x => x instanceof Array ? x.some(x => x) : x)) {
            res.rows.push(resRow);
        }
    }
    return res;
}

export async function parseOds(input: string, skipEmpty: boolean = true): Promise<Spreadsheet> {
    // Extract to temporary location.
    let tempDir: string;
    if (debug) {
        tempDir = '/tmp/ods-debug-output-dir';
        console.log(`Temporary directory: ${tempDir}`);
    } else {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ods-'));
    }
    await extract(input, { dir: tempDir });
    // Parse content XML
    let xmlText = fs.readFileSync(tempDir + '/content.xml', 'utf-8');
    let xml = xmlJs.xml2js(xmlText, {
        ignoreComment: true,
        captureSpacesBetweenElements: true,
    }) as Document;
    fs.writeFileSync(tempDir + '/content.json', JSON.stringify(xml, null, 4));
    // Get row by row for each table
    let spreadsheets = getElementsByTagName(xml.elements, 'office:spreadsheet');
    let res: Spreadsheet = {};
    for (let spreadsheet of spreadsheets) {
        let tables = getElementsByTagName(spreadsheet, 'table:table');
        for (let table of tables) {
            let name = (table.attributes?.['table:name'] || 'unnamed').trim();
            if (name.startsWith('#')) {
                continue;
            }
            let id = asIdentifier(name);
            let rows = getElementsByTagName(table, 'table:table-row');
            res[id] = parseRows(rows, skipEmpty);
            res[id].name = name;
        }
    }
    // Save output (for debug purpose) or delete temporary directory.
    if (debug) {
        fs.writeFileSync(tempDir + '/output.json', JSON.stringify(res, null, 4));
    } else {
        fs.rmSync(tempDir, { recursive: true });
    }
    writeToText(input, res);
    return res;
}

function joinRow(row: Row): string {
    return Object.values(row)
        .map(x => x instanceof Array ? x.join(' | ') : x)
        .join(' | ');
}

function writeToText(odsFile: string, data: Spreadsheet) {
    let text = `This is a preview of the content extracted from the "${path.basename(odsFile)}" file.\n`;
    text += 'Do not edit it manually. You can use it to track changes in the source file.\n';
    text += 'Always generate and commit it when you change anything in the source file.\n\n';
    for (let tableId in data) {
        let table = data[tableId];
        text += `------------------------------------------- ${tableId} -------------------------------------------\n`;
        text += `Name: ${table.name}\n`;
        text += `Columns: ${Object.keys(table.headers).join(' | ')}\n`;
        text += `Headers: ${joinRow(table.headers)}\n`;
        text += `Description: ${joinRow(table.desc)}\n`;
        for (let row of table.rows) {
            text += joinRow(row) + '\n';
        }
        text += '\n\n';
    }
    fs.writeFileSync(odsFile.replace(/\.ods$/, '.txt'), text);
}

/*(async function() {
    debug = true;
    //let list = await parseOds('trivm-instr.ods');
    let list = await parseOds('../wasm-instr-gen/list.ods');
    console.log(list);
})();*/
