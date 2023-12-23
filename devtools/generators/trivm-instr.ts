
import * as fs from 'node:fs';

import { Table, parseOds } from './ods';

const odsFile = 'devtools/generators/trivm-instr.ods';

const maxBits = 8;

const indent = '    ';
const defileNewLine = '        \\\n';

const supportedExt = new Set<string>([
    'UNWIND',
    'INT64',
    'FLOAT32',
    'FLOAT64',
]);

interface RowRaw {
    code: string;
    name: string;
    numArgs: string;
    extensions: string;
    sourceCode: string[];
}

interface Leaf {
    type: 'leaf';
    codeString: string;
    codeRaw: number;
    code: number;
    name: string;
    numArgs: number;
    extensions: string;
    extensionsFunc?: (...args: boolean[]) => boolean;
    sourceCode: string[];
    invalid: boolean;
}

interface Node {
    type: 'node';
    bit: number;
    children: [Leaf | Node, Leaf | Node];
    begin: string[];
    end: string[];
}

async function main() {
    let data = await parseOds(odsFile);
    let file = data.header.rows.map(row => (row.fileHeader as string).trimEnd()).join('\n').trim();
    delete data.header;
    file += '\n\n';
    file += '#ifndef _TRIVM_OP_TREE_H_\n';
    file += '#define _TRIVM_OP_TREE_H_\n\n';
    for (let table of Object.values(data)) {
        file += processTable(table);
    }
    file += '#endif /* _TRIVM_OP_TREE_H_ */\n';
    fs.writeFileSync('vm/trivm_op_tree.h', file);
}

function processTable(table: Table):string {
    let expression = new Function('x', `return (${(table.desc as unknown as RowRaw).code});`) as ((x: number) => number);
    let leafs: Leaf[] = [];
    let leafsWithHoles: Leaf[] = [];
    let usedExtensionsSet = new Set<string>();
    let maxCodeRaw = 0;
    let firstOneArg = 100000000;
    let lastTwoArgs = 0;
    for (let raw of (table.rows as unknown as RowRaw[])) {
        [...raw.extensions.matchAll(/[a-z0-9_]+/gi)]
            .map(x => x[0])
            .filter(x => supportedExt.has(x))
            .forEach(x => usedExtensionsSet.add(x));
        let codeRaw = parseInt(raw.code.trim());
        let leaf: Leaf = {
            type: 'leaf',
            codeString: raw.code.trim(),
            codeRaw,
            code: expression(codeRaw),
            name: raw.name.trim(),
            numArgs: parseInt(raw.numArgs.trim()),
            extensions: raw.extensions,
            sourceCode: raw.sourceCode.map(x => x.trim()).filter(x => x),
            invalid: false,
        };
        if (!leaf.name.startsWith('#')) {
            leafs.push(leaf);
            leafsWithHoles[codeRaw] = leaf;
            maxCodeRaw = Math.max(maxCodeRaw, codeRaw);
            if (leaf.numArgs === 1) {
                firstOneArg = Math.min(firstOneArg, leaf.code);
            } else {
                lastTwoArgs = Math.max(lastTwoArgs, leaf.code);
            }
        }
    }
    let bits = Math.ceil(Math.log2(maxCodeRaw + 1));
    let totalCodes = 1 << bits;
    let usedExtensions = [...usedExtensionsSet];
    for (let leaf of leafs) {
        leaf.extensionsFunc = new Function(...usedExtensions,
            `return (${leaf.extensions || 'true'});`) as typeof leaf.extensionsFunc;
    }
    let tree = '';
    for (let i = 0; i < (1 << usedExtensions.length); i++) {
        let params = usedExtensions.map((_, paramIndex) => !!(i & (1 << paramIndex)));
        let cond: string[] = [];
        for (let k = 0; k < usedExtensions.length; k++) {
            cond.push((params[k] ? '' : '!') + ('TRIVM_EXT_' + usedExtensions[k]));
        }
        let filtered = leafs
            .filter(leaf => leaf.extensionsFunc?.(...params))
            .map(x => ({ ...x }));
        let filteredWithInvalid = filtered.map(x => ({ ...x }));
        addInvalid(filteredWithInvalid, totalCodes, expression);
        if (filtered.length === 0) {
            tree += `#if ${cond.join(' && ')}\n\n`;
            tree += `#define ${table.name} do { } while(0)\n`;
            tree += `\n#endif /* ${cond.join(' && ')} */\n\n`;
        } else {
            let root = createTree(filtered);
            cond.push('!TRIVM_FAULT_INSTR_INVALID');
            tree += `#if ${cond.join(' && ')}\n\n`;
            tree += `#define ${table.name}${defileNewLine}`;
            tree += dumpNode(root, indent);
            tree += `\n#endif /* ${cond.join(' && ')} */\n\n`;
            cond.pop();
            cond.push('TRIVM_FAULT_INSTR_INVALID');
            tree += `#if ${cond.join(' && ')}\n\n`;
            root = createTree(filteredWithInvalid);
            tree += `#define ${table.name}${defileNewLine}`;
            tree += dumpNode(root, indent);
            tree += `\n#endif /* ${cond.join(' && ')} */\n\n`;
        }
    }
    tree += `#define ${table.name}_LAST_TWO_ARGS ${hexLiteral(lastTwoArgs, 2)}\n`;
    tree += `#define ${table.name}_FIRST_ONE_ARG ${hexLiteral(firstOneArg, 2)}\n\n`;
    tree += `#define ${table.name}_NAME_CASES \\\n`;
    for (let leaf of leafs) {
        tree += `    case TRIVM_OP_CODE_${leaf.name}: return "${leaf.name}"; \\\n`;
    }
    tree += '\n';
    for (let leaf of leafs) {
        tree += `#define TRIVM_OP_CODE_${leaf.name} ${hexLiteral(leaf.code, 2)}\n`;
    }
    tree += '\n';
    return tree;
}

function hexLiteral(value: number, num: number): string {
    let text = value.toString(16).toUpperCase();
    text = '0'.repeat(num) + text;
    return '0x' + text.substring(text.length - num);
}

function dumpNode(node: Node | Leaf, ind: string): string {
    if (node.type == 'leaf') {
        return dumpLeaf(node, ind);
    }
    let res = '';
    for (let line of node.begin) {
        res += `${ind}${line}${defileNewLine}`;
    }
    res += `${ind}if (op & 1 << ${node.bit}) {${defileNewLine}`;
    res += dumpNode(node.children[1], ind + indent);
    res += `${ind}} else {${defileNewLine}`;
    res += dumpNode(node.children[0], ind + indent);
    res += `${ind}}${defileNewLine}`;
    for (let line of node.end) {
        res += `${ind}${line}${defileNewLine}`;
    }
    return res;
}

function dumpLeaf(leaf: Leaf, ind: string): string {
    let res = '';
    res += `${ind}/* ${leaf.name} ${leaf.codeString} */${defileNewLine}`;
    for (let line of leaf.sourceCode) {
        res += `${ind}${line}${defileNewLine}`;
    }
    if (leaf.sourceCode.length === 0) {
        res += `${ind}/* Nothing more to do. */${defileNewLine}`;
    }
    return res;
}

function createTree(list: Leaf[]): Node | Leaf {
    if (list.length === 1) {
        return list[0];
    }
    if (list.every(leaf => leaf.invalid)) {
        list[0].codeString = list.map(leaf => leaf.codeString).join(', ');
        return list[0];
    }
    let begin = extractCommon(list);
    list.forEach(leaf => leaf.sourceCode.reverse());
    let end = extractCommon(list).reverse();
    list.forEach(leaf => leaf.sourceCode.reverse());
    let bit: number;
    let sep: [Leaf[], Leaf[]] = [[], []];
    for (bit = maxBits - 1; bit >= 0; bit--) {
        sep = [
            list.filter(leaf => !(leaf.code & (1 << bit))),
            list.filter(leaf => !!(leaf.code & (1 << bit))),
        ];
        if (sep[0].length != list.length && sep[1].length != list.length) {
            break;
        }
    }
    if (bit < 0) {
        throw new Error('Repeating op-code. Fix the table.');
    }
    let node: Node = {
        type: 'node',
        bit,
        begin,
        children: [createTree(sep[0]), createTree(sep[1])],
        end,
    };
    return node;
}

function extractCommon(list: Leaf[]): string[] {
    list = list.filter(leaf => !leaf.invalid);
    if (list.length <= 1) {
        return [];
    }
    let common = list[0].sourceCode;
    for (let leaf of list) {
        if (leaf.sourceCode.length < common.length) {
            common = common.slice(0, leaf.sourceCode.length);
        }
        while (!common.every((x, i) => x === leaf.sourceCode[i])) {
            common = common.slice(0, common.length - 1);
        }
    }
    for (let leaf of list) {
        leaf.sourceCode = leaf.sourceCode.slice(common.length);
    }
    return common;
}

function addInvalid(list: Leaf[], totalCodes: number, expression: (x: number) => number) {
    let used = new Array(totalCodes).map(() => false);
    list.forEach(leaf => used[leaf.codeRaw] = true);
    for (let i = 0; i < totalCodes; i++) {
        if (used[i]) {
            continue;
        }
        list.push({
            type: 'leaf',
            codeString: '0x' + i.toString(16).toUpperCase(),
            codeRaw: i,
            code: expression(i),
            name: 'INVALID',
            numArgs: 0,
            extensions: '',
            extensionsFunc: () => true,
            sourceCode: ['goto invalid_instruction;'],
            invalid: true,
        });
    }
}

main();

