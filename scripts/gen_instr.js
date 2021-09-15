const fs = require('fs');
const path = require('fs');
const extract = require('extract-zip');
const xml2js = require('xml2js');


async function parseOds() {
    function extractText(x) {
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
            return x.toString();
        }
    }
    //fs.rmdirSync('temp', { 'recursive': true });
    //fs.mkdirSync('temp', { 'recursive': true });
    await extract('instructions.ods', { dir: path.realpathSync('temp') });
    let xml = fs.readFileSync('temp/content.xml');
    let parser = new xml2js.Parser();
    let data = await parser.parseStringPromise(xml);
    fs.writeFileSync('temp/content.json', JSON.stringify(data, null, 4));
    let table = data['office:document-content']['office:body'][0]["office:spreadsheet"][0]["table:table"][0]["table:table-row"];
    fs.writeFileSync('temp/content2.json', JSON.stringify(table, null, 4));
    let transformed = [];
    for (let row of table) {
        let cells = [];
        for (let cell of row["table:table-cell"]) {
            let length = !cell.$ ? 1 : !cell.$['table:number-columns-repeated'] ? 1 : parseInt(cell.$['table:number-columns-repeated']);
            if (1 < length && length < 30) {
                cells.splice(cells.length, 0, ...Array.from({ length }).map((x) => extractText(cell)));
            } else {
                cells.push(extractText(cell));
            }
        }
        transformed.push(cells);
    }
    let header = transformed.shift().map(x => x
        .trim()
        .replace(/ [a-z]/gi, m => m.trim().toUpperCase())
        .replace(/^./, m => m.toLowerCase()));
    while (header[header.length - 1] == '')
        header.pop();
    transformed = transformed
        .map(row => {
            let obj = {};
            let allEmpty = true;
            for (let i = 0; i < header.length; i++) {
                obj[header[i]] = row[i] || '';
                if (obj[header[i]] != '')
                    allEmpty = false;
            }
            return allEmpty ? null : obj;
        })
        .filter(row => row !== null);
    fs.writeFileSync('temp/content2.json', JSON.stringify(transformed, null, 4));
    return transformed;
}

function writeOutput(destFile, origFile, content, indent) {
    let header = indent + '/* -- Begin of source code generated with help of "gen_instr.js" script -- */';
    let footer = indent + '/* -- End of source code generated with help of "gen_instr.js" script -- */';
    let begin, end;
    try {
        orig = fs.readFileSync(origFile, 'utf-8');
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
    while (content.endsWith('\n')) content = content.substr(0, content.length - 1);
    fs.writeFileSync(destFile, begin + '\n' + content + '\n' + end);
    fs.writeFileSync(destFile + '.sh', `#!/bin/sh\nA=$(readlink -f "$0")\nA=$(dirname "$A")\nmeld "$A/../${destFile}" "$A/../${origFile}"\n`, {mode: 0o755});
}

function generateOpcodes(table) {
    let out = 'enum InstrOpcode {\n'
    for (let row of table) {
        row._identifier = `INSTR_${row.name.toUpperCase().replace(/\./g, '_')}`;
        out += `    ${row._identifier} = ${row.binaryOpcode},\n`;
    }
    out += '};\n';
    writeOutput('output/WasmInstr.hh', '../src/WasmInstr.hh', out, '');
}

function generateParser(table) {
    let out = '';
    for (let row of table)
        if (row.name.startsWith('trivm.'))
            row._trivm = true;
    for (let row of table) {
        if (row.parsing != 'custom' || row._trivm)
            continue;
        out += `\n    case ${row._identifier}: {\n        TRACE();\n        break;\n    }`;
        row._parsingDone = true;
    }
    out += '\n    // ===== Generated parsers =====';
    for (let row1 of table) {
        if (row1._parsingDone || row1._trivm)
            continue;
        let tab = row1.parsing;
        for (let row of table) {
            if (row._parsingDone || row.parsing != tab || row._trivm)
                continue;
            out += `\n    case ${row._identifier}:`;
            row._parsingDone = true;
        }
        out += ' {\n        TRACE();\n';
        tab = tab.trim().split(/\s*,\s*/);
        for (let i = 0; i < tab.length; i++) {
            let type = tab[i];
            if (type == '') {
                // nothing to parse
            } else if (type == 'funcidx') {
                out += `        u32 funcidx${i} = r->readU32();\n`;
                out += `        if (funcidx${i} >= mod->functions->length())\n            FATAL("Invalid function index");\n`;
                out += `        data->push(any$::get(mod->functions[funcidx${i}]));\n`;
            } else if (type == 'localidx') {
                out += `        u32 localidx${i} = r->readU32();\n`;
                out += `        if (localidx${i} >= function->locals->length())\n            FATAL("Invalid local variable index");\n`;
                out += `        imm->push(localidx${i});\n`;
            } else if (type == 'globalidx') {
                out += `        u32 globalidx${i} = r->readU32();\n`;
                out += `        if (globalidx${i} >= mod->globals->length())\n            FATAL("Invalid global variable index");\n`;
                out += `        data->push(any$::get(mod->globals[globalidx${i}]));\n`;
            } else if (type == 'tableidx') {
                out += `        u32 tableidx${i} = r->readU32();\n`;
                out += `        if (tableidx${i} >= mod->tables->length())\n            FATAL("Invalid table index");\n`;
                out += `        data->push(any$::get(mod->tables[tableidx${i}]));\n`;
            } else if (type == 'memidx') {
                out += `        u32 memidx${i} = r->readU32();\n`;
                out += `        if (memidx${i} != 0)\n            FATAL("Only one memory is supported");\n`;
            } else if (type == 'dataidx') {
                out += `        u32 dataidx${i} = r->readU32();\n`;
                out += `        imm->push(dataidx${i}); // dataidx${i} validation will be done later\n`;
            } else if (type == 'memarg') {
                out += `        r->readU32(); // ignore align\n`;
                out += `        u32 offset${i} = r->readU32();\n`;
                out += `        imm->push(offset${i});\n`;
            } else if (type == 'elemidx') {
                out += `        u32 elemidx${i} = r->readU32();\n`;
                out += `        if (elemidx${i} >= mod->elements->length())\n            FATAL("Invalid table element index");\n`;
                out += `        data->push(any$::get(mod->elements[elemidx${i}]));\n`;
            } else {
                console.log(JSON.stringify(row1, null, 4));
                console.log(type);
                process.exit();
            }
        }
        out += '        break;\n    }';
    }
    writeOutput('output/WasmParser.cc', '../src/WasmParser.cc', out, '    ');
}

function generateDumper(table) {
    let out = '    /* -- Begin of source code generated with help of "gen_instr.js" script -- */';
    for (let row of table) {
        out += `\n    case ${row._identifier}: return "${row.name}";`
    }
    out += '\n    /* -- End of source code generated with help of "gen_instr.js" script -- */';
    fs.writeFileSync('output/dump.cc', out);
}


function generateReducer(table) {
    function explodeParams(params) {
        params = params.trim().split(/\s+/);
        if (params.length == 1 && params[0] == '')
            return [];
        return params;
    }

    function explodeReduceTo(reduceTo) {
        let tab = reduceTo.split(/;|(?<=[\}])|(?=[\{])/);
        tab = tab.map(x => {
            x = x.trim();
            if (x.startsWith('{')) {
                x = x.replace(/(i64|f32|f64|grow|any64|unreachable)/g, 'vmConfig.ext.$1')
            }
            return x;
        });
        return tab.filter(x => x != '');
    }

    let out = '    switch(opcode) {'
    for (let row of table) {
        row._reduceUnique = `${row.params}|${row.results}|${row.reduceTo}`;
        if (!row.customReduction.toLowerCase().startsWith('y') || row._trivm)
            continue;
        out += `\n    case ${row._identifier}: {\n        TRACE();\n        break;\n    }`;
        row._reduceDone = true;
    }
    out += '\n    // ===== Generated reducers =====';
    for (let row of table) {
        // Cases
        if (row._reduceDone || row._trivm)
            continue;
        for (let row2 of table) {
            if (row2._reduceDone || row2._reduceUnique != row._reduceUnique || row2._trivm)
                continue;
            out += `\n    case ${row2._identifier}:`;
            row2._reduceDone = true;
        }
        out += ' {\n        TRACE();\n';

        // Check stack params
        let params = explodeParams(row.params);
        if (params.length > 1) {
            out += `        stack->pop(${params.length});\n`;
        } else if (params.length > 0) {
            out += `        stack->pop();\n`;
        }

        // Reduced instruction generation
        let reduceTo = explodeReduceTo(row.reduceTo);
        if (reduceTo.length == 0) {
            out += `        reduced->push(instr);\n`;
        } else {
            let ind = '';
            let inIf = false;
            for (let item of reduceTo) {
                item = item.trim();
                if (item.startsWith('{')) {
                    let cond = item.substring(1, item.length - 1);
                    if (cond == 'else') {
                        out += `        } else {\n`;
                        inIf = false;
                    } else if (cond == 'end') {
                        out += `        }\n`;
                        ind = '';
                        inIf = false;
                    } else if (cond.startsWith('elif')) {
                        out += `        } else if (${cond.substr(4).trim()}) {\n`;
                        ind = '    ';
                        inIf = true;
                    } else {
                        out += `        if (${cond}) {\n`;
                        ind = '    ';
                        inIf = true;
                    }
                    continue;
                }
                let [opcode, ...imm] = item.split(/\s+/);
                if (opcode.startsWith('@')) {
                    out += `        ${ind}reduced->push(WasmInstr{\n`;
                    out += `            ${ind}.code = INSTR_CALL,\n`;
                    out += `            ${ind}.imm = Resolver::getExport("__trivmlib"_S, "${opcode.substr(1)}"_S, true)->index,\n`;
                    out += `        ${ind}});\n`;
                } else {
                    if (imm) imm = imm.join(' ');
                    out += `        ${ind}reduced->push(WasmInstr{\n`;
                    out += `            ${ind}.code = INSTR_${opcode.trim().toUpperCase().replace(/\./g, '_')},\n`;
                    if (imm) {
                        imm = imm.trim();
                        if (imm.startsWith('"')) {
                            out += `            ${ind}.immString = "__trivmlib__.${imm.substr(1)}_S,\n`;
                        } else {
                            out += `            ${ind}.imm = { ${imm} },\n`;
                        }
                    }
                    out += `        ${ind}});\n`;
                }
            }
            if (inIf) {
                out += `        } else {\n`;
                out += `            reduced->push(instr);\n`;
            }
            if (ind != '')
                out += `        }\n`;
        }

        // Push stack result
        if (row.results != '')
            out += `        stack->push(TYPE_${row.results.toUpperCase()});\n`;
        out += '        break;\n    }';
    }
    out += '\n    default:\n        break;\n';
    out += '    };\n';
    writeOutput('output/Reducer.cc', '../src/Reducer.cc', out, '    ');
}


function generateOutputNames(table) {
    let out = '    switch(opcode) {'
    for (let row of table) {
        // Cases
        if (row._namesDone || !row.compileTo || row.compileTo == '')
            continue;
        for (let row2 of table) {
            if (row2._namesDone || row2.compileTo != row.compileTo)
                continue;
            out += `\n    case ${row2._identifier}:`;
            row2._namesDone = true;
        }
        out += `\n        return "${row.compileTo}";`;
    }
    out += '\n    };\n';
    fs.writeFileSync('output/names.cc', out);
}

async function main() {
    fs.mkdirSync('temp', { 'recursive': true });
    let table = await parseOds();
    fs.mkdirSync('output', { 'recursive': true });
    generateOpcodes(table);
    generateParser(table);
    generateReducer(table);
    generateDumper(table);
    generateOutputNames(table);
}

main();
