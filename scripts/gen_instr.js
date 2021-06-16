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
    fs.rmdirSync('temp', { 'recursive': true });
    fs.mkdirSync('temp', { 'recursive': true });
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

function generateOpcodes(table) {
    let out = 'enum InstrOpcode {\n'
    for (let row of table) {
        row._identifier = `INSTR_${row.name.toUpperCase().replace(/\./g, '_')}`;
        out += `\t${row._identifier} = ${row.binaryOpcode},\n`;
    }
    out += '};\n';
    fs.writeFileSync('output/instr.hh', out);
}

function generateParser(table) {
    let out = '\tswitch(opcode) {'
    for (let row of table)
        if (row.name.startsWith('uvm.'))
            row._uvm = true;
    for (let row of table) {
        if (row.parsing != 'custom' || row._uvm)
            continue;
        out += `\n\tcase ${row._identifier}: {\n\t\tbreak;\n\t}`;
        row._parsingDone = true;
    }
    out += '\n\t// ===== Generated parsers =====';
    for (let row1 of table) {
        if (row1._parsingDone || row1._uvm)
            continue;
        let tab = row1.parsing;
        for (let row of table) {
            if (row._parsingDone || row.parsing != tab || row._uvm)
                continue;
            out += `\n\tcase ${row._identifier}:`;
            row._parsingDone = true;
        }
        out += ' {\n';
        tab = tab.trim().split(/\s*,\s*/);
        for (let i = 0; i < tab.length; i++) {
            let type = tab[i];
            if (type == '') {
                // nothing to parse
            } else if (type == 'funcidx') {
                out += `\t\tu32 funcidx${i} = r->readU32();\n`;
                out += `\t\tif (funcidx${i} >= d->functions->length())\n\t\t\tFATAL("Invalid function index");\n`;
                out += `\t\timm->push(funcidx${i});\n`;
            } else if (type == 'localidx') {
                out += `\t\tu32 localidx${i} = r->readU32();\n`;
                out += `\t\tif (localidx${i} >= function->locals->length())\n\t\t\tFATAL("Invalid local variable index");\n`;
                out += `\t\timm->push(localidx${i});\n`;
            } else if (type == 'globalidx') {
                out += `\t\tu32 globalidx${i} = r->readU32();\n`;
                out += `\t\tif (globalidx${i} >= d->globals->length())\n\t\t\tFATAL("Invalid global variable index");\n`;
                out += `\t\timm->push(globalidx${i});\n`;
            } else if (type == 'tableidx') {
                out += `\t\tu32 tableidx${i} = r->readU32();\n`;
                out += `\t\tif (tableidx${i} >= d->tables->length())\n\t\t\tFATAL("Invalid table index");\n`;
                out += `\t\timm->push(tableidx${i});\n`;
            } else if (type == 'memidx') {
                out += `\t\tu32 memidx${i} = r->readU32();\n`;
                out += `\t\tif (memidx${i} != 0)\n\t\t\tFATAL("Only one memory is supported");\n`;
                out += `\t\timm->push(memidx${i});\n`;
            } else if (type == 'dataidx') {
                out += `\t\tu32 dataidx${i} = r->readU32();\n`;
                out += `\t\t// dataidx validation must be done later\n`;
                out += `\t\timm->push(dataidx${i});\n`;
            } else if (type == 'memarg') {
                out += `\t\tr->readU32(); // ignore align\n`;
                out += `\t\tu32 offset${i} = r->readU32();\n`;
                out += `\t\timm->push(offset${i});\n`;
            } else if (type == 'elemidx') {
                out += `\t\tu32 elemidx${i} = r->readU32();\n`;
                out += `\t\tif (elemidx${i} >= d->data->allElements->length()) // TODO: check if elemidx is for passive only or both\n\t\t\tFATAL("Invalid table element index");\n`;
                out += `\t\timm->push(elemidx${i});\n`;
            } else {
                console.log(JSON.stringify(row1, null, 4));
                console.log(type);
                process.exit();
            }
        }
        out += '\t\tbreak;\n\t}';
    }
    out += '\n\tdefault:\n\t\tFATAL("Invalid instruction opcode 0x%02X", opcode);\n\t\tbreak;\n';
    out += '\t};\n';
    fs.writeFileSync('output/parse.cc', out);
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
                x = x.replace(/(i64|f32|f64|grow)/, 'config.ext.$1')
            }
            return x;
        });
        return tab.filter(x => x != '');
    }

    let out = '\tswitch(opcode) {'
    for (let row of table) {
        row._reduceUnique = `${row.params}|${row.results}|${row.reduceTo}`;
        if (!row.customReduction.toLowerCase().startsWith('y') || row._uvm)
            continue;
        out += `\n\tcase ${row._identifier}: {\n\t\tbreak;\n\t}`;
        row._reduceDone = true;
    }
    out += '\n\t// ===== Generated reducers =====';
    for (let row of table) {
        // Cases
        if (row._reduceDone || row._uvm)
            continue;
        for (let row2 of table) {
            if (row2._reduceDone || row2._reduceUnique != row._reduceUnique || row2._uvm)
                continue;
            out += `\n\tcase ${row2._identifier}:`;
            row2._reduceDone = true;
        }
        out += ' {\n';

        // Check stack params
        let params = explodeParams(row.params);
        for (let i = params.length - 1; i >= 0; i--) {
            out += `\t\tu32 type${i} = stack->pop();\n`;
        }
        let tab = [];
        for (let i = params.length - 1; i >= 0; i--) {
            tab.push(`type${i} != TYPE_${params[i].toUpperCase()}`);
        }
        if (tab.length)
            out += `\t\tif (${tab.join(' || ')})\n\t\t\tFATAL("Invalid type on the stack");\n`;
        
        // Reduced instruction generation
        let reduceTo = explodeReduceTo(row.reduceTo);
        if (reduceTo.length == 0) {
            out += `\t\treduced->push(instr);\n`;
        } else {
            let ind = '';
            let inIf = false;
            for (let item of reduceTo) {
                item = item.trim();
                if (item.startsWith('{')) {
                    let cond = item.substring(1, item.length - 1);
                    if (cond == 'else') {
                        out += `\t\t} else {\n`;
                        inIf = false;
                    } else if (cond == 'end') {
                        out += `\t\t}\n`;
                        ind = '';
                        inIf = false;
                    } else {
                        out += `\t\tif (${cond}) {\n`;
                        ind = '\t';
                        inIf = true;
                    }
                    continue;
                }
                let [opcode, imm] = item.split(/\s+/, 2);
                out += `\t\t${ind}reduced->push(WasmInstr{\n`;
                out += `\t\t\t${ind}.code = INSTR_${opcode.trim().toUpperCase().replace(/\./g, '_')},\n`;
                if (imm) {
                    imm = imm.trim();
                    if (imm.startsWith('"')) {
                        out += `\t\t\t${ind}.immString = "__uvmlib__${imm.substr(1)},\n`;
                    } else {
                        out += `\t\t\t${ind}.imm = { ${imm} },\n`;
                    }
                }
                out += `\t\t${ind}});\n`;
            }
            if (inIf) {
                out += `\t\t} else {\n`;
                out += `\t\t\treduced->push(instr);\n`;
            }
            if (ind != '')
                out += `\t\t}\n`;
        }

        // Push stack result
        if (row.results != '')
            out += `\t\tstack->push(TYPE_${row.results.toUpperCase()})\n`;
        out += '\t\tbreak;\n\t}';
    }
    out += '\n\tdefault:\n\t\tbreak;\n';
    out += '\t};\n';
    fs.writeFileSync('output/reduce.cc', out);
}

async function main() {
    let table = await parseOds();
    fs.mkdirSync('output', { 'recursive': true });
    generateOpcodes(table);
    generateParser(table);
    generateReducer(table);
}

main();
