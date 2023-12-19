
const inputFile = 'ops-table.txt';
const outputFile = '../src/trivm_op_tree.h';

const fs = require('fs');
const path = require('path');

let lines = fs.readFileSync(path.join(__dirname, inputFile), 'utf-8');

let m = lines.match(/\/\*[\s\S]*?\*\//);
let comment = null;
if (m) {
    comment = m[0];
    lines = lines.substr(0, m.index) + lines.substr(m.index + m[0].length);
}

let trees = {};
let currentTree = null;
let currentExpr = null;

for (let line of lines.split(/\s*\r?\n\s*/)) {
    line = line.replace(/\s*\/\/.*$/, '');
    if (line.trim() == '') {
        // skip empty line
    } else if ((m = line.match(/^([A-Z_0-9]+)\s*:\s*(.*)$/i))) {
        currentTree = [];
        trees[m[1]] = currentTree;
        eval(`currentExpr = x => { return ${m[2]}; };`);
    } else if ((m = line.match(/^([0-9A-Fx]*)\s*([^\s]*)\s*([^\s]*)\s*\{(.*)\}\s*(.*)?/i))) {
        currentTree.push({
            code: parseInt(m[1]),
            id: currentExpr(parseInt(m[1])),
            name: m[2],
            args: m[3] == 'TWO_ARGS' ? 2 : m[3] == 'ONE_ARG' ? 1 : (() => { console.log(`Invalid args count: ${line}`) })(),
            body: m[4].split(/\s*\/\*\*\/\s*/).map(x => x.trim()),
            cond: m[5],
        });
    } else {
        console.log(`Syntax error: ${line}`);
    }
}

function generateEntry(item, ind, output) {
    output.push(`${ind}/* ${item.name} 0x${item.code.toString(16).toUpperCase()} */ ${item.body.join(' ')}`);
}

function joinConditions(cond) {
    if (cond.length == 0) {
        return '1';
    }
    let always = cond.reduce((a, x) => a || (x == '1'), false);
    if (always) {
        return '1';
    }
    cond = cond.map(x => x.indexOf(' ') < 0 ? x : `(${x})`);
    if (cond.length == 1) {
        return cond[0];
    }
    return '(' + cond.join(' || ') + ')';
}

function extractCommon(items) {
    if (items.length <= 1) {
        return [];
    }
    let prefix = items[0].body[0];
    for (let item of items) {
        if (item.body[0] != prefix) {
            return [];
        }
    }
    for (let item of items) {
        item.body.splice(0, 1);
    }
    return [prefix, ...extractCommon(items)];
}

function generateIf(items, ind, output, msb, lsb) {
    let optimized = (msb === undefined);
    if (items.length == 0) {
        output.push(`${ind}goto invalid_instruction;`);
        return;
    }
    if (items.length == 1 && (optimized || msb < lsb)) {
        generateEntry(items[0], `${ind}  `, output);
        return;
    }
    let prefix = extractCommon(items);
    items.forEach(x => x.body = x.body.reverse());
    let postfix = extractCommon(items);
    items.forEach(x => x.body = x.body.reverse());
    let msbNext = msb - 1;
    if (optimized) {
        let lastId = items[0].id;
        let changes = 0;
        for (let item of items) {
            changes |= item.id ^ lastId;
            lastId = item.id;
        }
        if (changes == 0) {
            throw `Repeating id 0x${lastId.toString(16)}`;
        }
        msb = 15;
        while ((changes & (1 << msb)) == 0) {
            msb--;
        }
        msbNext = undefined;
    }
    let part1 = [];
    let part1Cond = {};
    let part0 = [];
    let part0Cond = {};
    for (let item of items) {
        if (item.id & (1 << msb)) {
            part1.push(item);
            if (item.cond) {
                part1Cond[item.cond] = true;
            } else {
                part1Cond['1'] = true;
            }
        } else {
            part0.push(item);
            if (item.cond) {
                part0Cond[item.cond] = true;
            } else {
                part0Cond['1'] = true;
            }
        }
    }
    part1Cond = joinConditions(Object.keys(part1Cond));
    part0Cond = joinConditions(Object.keys(part0Cond));
    if (part1Cond == part0Cond) {
        // Conditions are the same, so this was handled by the parent scope
        part1Cond = '1';
        part0Cond = '1';
    }
    if (prefix.length) {
        output.push(`${ind}${prefix.join(' ')}`);
    }
    if (!optimized) {
        output.push(`${ind}if (op & 1 << ${msb}) {`);
        if (part1Cond != '1') {
            output.push(`${ind}  if (${part1Cond}) {`);
            generateIf(part1, `${ind}    `, output, msbNext, lsb);
            output.push(`${ind}  } else {`);
            output.push(`${ind}    goto invalid_instruction;`);
            output.push(`${ind}  }`);
        } else {
            generateIf(part1, `${ind}  `, output, msbNext, lsb);
        }
        output.push(`${ind}} else {`);
        if (part0Cond != '1') {
            output.push(`${ind}  if (${part0Cond}) {`);
            generateIf(part0, `${ind}    `, output, msbNext, lsb);
            output.push(`${ind}  } else {`);
            output.push(`${ind}    goto invalid_instruction;`);
            output.push(`${ind}  }`);
        } else {
            generateIf(part0, `${ind}  `, output, msbNext, lsb);
        }
        output.push(`${ind}}`);
    } else {
        if (part1Cond != '1') {
            if (part0Cond != '1') {
                // `if` and `else` are conditional
                output.push(`${ind}if ((op & 1 << ${msb} && ${part1Cond}) || !${part0Cond}) {`);
            } else {
                // `if` is conditional
                output.push(`${ind}if (op & 1 << ${msb} && ${part1Cond}) {`);
            }
        } else {
            if (part0Cond != '1') {
                // `else` is conditional
                output.push(`${ind}if (op & 1 << ${msb} || !${part0Cond}) {`);
            } else {
                // no conditions
                output.push(`${ind}if (op & 1 << ${msb}) {`);
            }
        }
        generateIf(part1, `${ind}  `, output, msbNext, lsb);
        output.push(`${ind}} else {`);
        generateIf(part0, `${ind}  `, output, msbNext, lsb);
        output.push(`${ind}}`);
    }
    if (postfix.length) {
        output.push(`${ind}${postfix.join(' ')}`);
    }
}

function generateTree(treeName, tree) {
    let output = [];
    generateIf(JSON.parse(JSON.stringify(tree)), '  ', output);
    let lineLength = output.reduce((m, x) => Math.max(x.length, m), 0) + 2;
    output = output
        .map(x => (x + ' '.repeat(lineLength)).substr(0, lineLength) + '\\')
        .join('\n');
    let firstOneArg = 0x10000;
    let lastTwoArgs = 0;
    let lastId = tree[0].id;
    let changes = 0;
    for (let item of tree) {
        if (item.args == 1) {
            firstOneArg = Math.min(firstOneArg, item.id);
        }
        if (item.args == 2) {
            lastTwoArgs = Math.max(lastTwoArgs, item.id);
        }
        changes |= item.id ^ lastId;
        lastId = item.id;
    }
    let lsb = 0;
    let msb = -1;
    while (!(changes & 1)) {
        lsb++;
        msb++;
        changes >>= 1;
    }
    while (changes) {
        msb++;
        changes >>= 1;
    }
    let outputSimple = [];
    generateIf(JSON.parse(JSON.stringify(tree)), '  ', outputSimple, msb, lsb);
    lineLength = outputSimple.reduce((m, x) => Math.max(x.length, m), 0) + 2;
    outputSimple = outputSimple
        .map(x => (x + ' '.repeat(lineLength)).substr(0, lineLength) + '\\')
        .join('\n');
    let code = `#if !TRIVM_FAULT_INSTR_INVALID\n\n`;
    code += `#define ${treeName} \\\n${output}\n\n`;
    code += `#else\n\n`;
    code += `#define ${treeName} \\\n${outputSimple}\n\n`;
    code += `#endif /* !TRIVM_FAULT_INSTR_INVALID */\n\n`;
    code += `#define ${treeName}_FIRST_ONE_ARG 0x${firstOneArg.toString(16).toUpperCase()}\n`;
    code += `#define ${treeName}_LAST_TWO_ARGS 0x${lastTwoArgs.toString(16).toUpperCase()}\n\n`;
    code += `#define ${treeName}_NAME_CASES \\\n`;
    for (let item of tree) {
        code += `  case TRIVM_OP_CODE_${item.name}: return "${item.name}"; \\\n`;
    }
    code += '\n';
    return code;
}

let defName = '_' + path.basename(outputFile).replace(/[^A-Z0-9]/gi, '_').toUpperCase() + '_';

let code = '';
if (comment) {
    code += `${comment}\n\n`;
}
code += `#ifndef ${defName}\n#define ${defName}\n\n`;
code += `/* File generated by the "${path.basename(__filename)}" script from the "${path.basename(inputFile)}" file. */\n\n`;

let codes = '';

for (treeName in trees) {
    code += generateTree(treeName, trees[treeName]);
    for (let item of trees[treeName]) {
        codes += `#define TRIVM_OP_CODE_${item.name} 0x${item.id.toString(16).toUpperCase()}\n`;
    }
}

code += `${codes}\n`;

code += `#endif /* ${defName} */\n`;

if (lines.indexOf('\r') >= 0) {
    code = code.replace(/\r?\n/g, '\r\n');
}

fs.writeFileSync(path.join(__dirname, '../../vm/trivm_op_tree.h'), code);
