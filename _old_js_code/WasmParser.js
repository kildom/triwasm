
const consts = require('./WasmConsts');

class WasmParsingError extends Error {
    constructor(message) {
        super(message);
    }
}

function error(message) {
    return new WasmParsingError(message);
}

class WasmParser {

    constructor(reader) {
        this.r = reader;
        this.functionTypes = [/*
            param[]
            result[]
            */];
        this.importFunctions = [/*
            module
            name
            typeIndex
            type:
                param[]
                result[]
            */];
        this.importTables = [];
        this.importMemories = [];
        this.importGlobals = [];
        this.exportFunctions = [];
        this.exportTables = [];
        this.exportMemories = [];
        this.exportGlobals = [];
        this.functions = [/*
            index,
            imported,
            typeIndex,
            type:
                param[]
                result[]
            locals    if not imported
            body      if not imported
            module    if imported
            name
            */];
        this.tables = [];
        this.memories = [];
        this.globals = [];
        this.activeElements = [];
        this.passiveElements = [];
        this.declarativeElements = [];
        this.activeData = [];
        this.passiveData = [];
        this.dataCount = null;
        this.startFunction = null;
        this.producers = '';
    }

    valueType(r) {
        let type = r.byte();
        switch (type) {
            case consts.TYPE_I32:
            case consts.TYPE_I64:
            case consts.TYPE_F32:
            case consts.TYPE_F64:
            case consts.TYPE_FUNCREF:
            case consts.TYPE_EXTERNREF:
                return type;
            default:
                throw error(`Unknown value type ${type}`);
        }
    }

    parseTypeSection(r) {
        // modules.html#binary-typesec
        this.functionTypes = [];
        let count = r.u32();
        for (let i = 0; i < count; i++) {
            // types.html#binary-functype
            let startByte = r.byte();
            if (startByte != 0x60)
                throw error(`Invalid function type start byte`);
            let paramTypes = [];
            let resultTypes = [];
            let paramCount = r.u32();
            for (let k = 0; k < paramCount; k++) {
                paramTypes.push(this.valueType(r));
            }
            paramCount = r.u32();
            for (let k = 0; k < paramCount; k++) {
                resultTypes.push(this.valueType(r));
            }
            this.functionTypes.push({
                param: paramTypes,
                result: resultTypes,
            });
            console.log(`  function type ${i} is ${resultTypes.map(x => consts.typeNames[x]).join(', ')}(${paramTypes.map(x => consts.typeNames[x]).join(', ')})`);
        }
    }

    parseLimits(r) {
        // types.html#binary-limits
        let isMax = r.byte();
        let min = r.u32();
        if (isMax) {
            let max = r.u32();
            return { min, max };
        }
        return { min };
    }

    parseImportSection(r) {
        // modules.html#binary-importsec
        this.importFunctions = [];
        this.importTables = [];
        this.importMemories = [];
        this.importGlobals = [];
        const count = r.u32();
        for (let i = 0; i < count; i++) {
            let moduleName = r.str();
            let memberName = r.str();
            let select = r.byte();
            switch (select) {
                case 0x00: {
                    let typeIndex = r.u32();
                    this.importFunctions.push({
                        module: moduleName,
                        name: memberName,
                        typeIndex: typeIndex,
                    });
                    console.log(`  import function ${moduleName}::${memberName} of type ${typeIndex}`);
                    break;
                }
                case 0x01: {
                    // types.html#binary-tabletype
                    let type = r.byte();
                    let { min, max } = this.parseLimits(r);
                    this.importTables.push({
                        module: moduleName,
                        name: memberName,
                        type: type,
                        min: min,
                        max: max,
                    });
                    console.log(`  import table ${moduleName}::${memberName} of type ${consts.typeNames[type]} and size from ${min} to ${max}`);
                    break;
                }
                case 0x02: {
                    // types.html#binary-memtype
                    let { min, max } = this.parseLimits(r);
                    this.importMemories.push({
                        module: moduleName,
                        name: memberName,
                        min: min,
                        max: max,
                    });
                    console.log(`  import memory ${moduleName}.${memberName} of size from ${min} to ${max}`);
                    break;
                }
                case 0x03: {
                    // types.html#binary-globaltype
                    let type = r.byte();
                    let mut = r.byte();
                    this.importGlobals.push({
                        module: moduleName,
                        name: memberName,
                        type: type,
                        mutable: !!mut,
                    });
                    console.log(`  import ${mut ? 'var' : 'const'} global ${moduleName}.${memberName} of type ${consts.typeNames[type]}`);
                    break;
                }
                default:
                    throw Error(`Unknown select of import '${select}'`);
            }
        }
    }

    parseFunctionSection(r) {
        // modules.html#binary-funcsec
        let count = r.u32();
        for (let funcIndex = 0; funcIndex < count; funcIndex++) {
            let typeIndex = r.u32();
            if (!this.functions[funcIndex]) {
                this.functions[funcIndex] = {};
            }
            this.functions[funcIndex].typeIndex = typeIndex;
            console.log(`  function ${funcIndex} type is ${typeIndex}`);
        }
    }

    parseTableSection(r) {
        // modules.html#binary-tablesec
        this.tables = [];
        const count = r.u32();
        for (let i = 0; i < count; i++) {
            let type = r.byte();
            let { min, max } = this.parseLimits(r);
            this.tables.push({
                type: type,
                min: min,
                max: max,
            });
            console.log(`  table of type ${consts.typeNames[type]} and size from ${min} to ${max}`);
        }
    }

    parseMemorySection(r) {
        // modules.html#binary-memsec
        this.memories = [];
        const count = r.u32();
        for (let i = 0; i < count; i++) {
            // types.html#binary-memtype
            let { min, max } = this.parseLimits(r);
            this.memories.push({
                min: min,
                max: max,
            });
            console.log(`  memory of size from ${min} to ${max}`);
        }
    }

    parseCompressedBlockType(r) {
        let val = r.sleb128();
        switch (val) {
            case consts.TYPE_BT_CMP_I32:
                return { kind: consts.BLOCK_TYPE_KIND_VALTYPE, type: consts.TYPE_I32 };
            case consts.TYPE_BT_CMP_I64:
                return { kind: consts.BLOCK_TYPE_KIND_VALTYPE, type: consts.TYPE_I64 };
            case consts.TYPE_BT_CMP_F32:
                return { kind: consts.BLOCK_TYPE_KIND_VALTYPE, type: consts.TYPE_F32 };
            case consts.TYPE_BT_CMP_F64:
                return { kind: consts.BLOCK_TYPE_KIND_VALTYPE, type: consts.TYPE_F64 };
            case consts.TYPE_BT_CMP_VOID:
                return { kind: consts.BLOCK_TYPE_KIND_VOID };
            default:
                return { kind: consts.BLOCK_TYPE_KIND_INDEX, type: val };
        }
    }

    parseExpr(r, allowElse) {
        let instructions = [];
        while (true) {
            let code = r.byte();
            let desc = consts.instructions[code];
            let params = [];
            if (desc.name == '')
                throw error(`Unknown instruction 0x${code.toString(16)}`);
            if ('params' in desc) {
                if (desc.params == null) {
                    switch (code) {
                        case 0x02:
                            params.push(this.parseCompressedBlockType(r));
                            params.push(this.parseExpr(r));
                            break;
                        case 0x03:
                            params.push(this.parseCompressedBlockType(r));
                            params.push(this.parseExpr(r));
                            break;
                        case 0x04: {
                            params.push(this.parseCompressedBlockType(r));
                            let [subInstr, endedWithElse] = this.parseExpr(r, true);
                            params.push(subInstr);
                            if (endedWithElse) {
                                params.push(this.parseExpr(r));
                            } else {
                                params.push([]);
                            }
                            break;
                        }
                        case 0x05:
                            if (!allowElse)
                                throw error(`'else' instruction not expected here`);
                            return [instructions, true];
                        case 0x0B:
                            return allowElse ? [instructions, false] : instructions;
                        case 0x0E: {
                            let count = r.u32();
                            params[0] = [];
                            for (let i = 0; i < count; i++) {
                                params[0][i] = r.u32();
                            }
                            params[1] = r.u32();
                            break;
                        }
                        case 0x1C: {
                            let count = r.u32();
                            params[0] = [];
                            for (let i = 0; i < count; i++) {
                                params[0][i] = r.byte();
                            }
                            break;
                        }
                        default:
                            throw error(`internal, code: 0x${code.toString(16)}`);
                    }
                } else {
                    for (let i = 0; i < desc.params.length; i++) {
                        switch (desc.params[i]) {
                            case 'i':
                            case 'l':
                                params.push(r.sleb128());
                                break;
                            case 'u':
                                params.push(r.uleb128());
                                break;
                            case 'b':
                                params.push(r.byte());
                                break;
                            default:
                                throw error(`internal, param: ${desc.params[i]}, ${desc.name}`);
                        }
                    }
                }
            }
            instructions.push({ code, desc, params });
        }
    }

    parseGlobalSection(r) {
        // modules.html#binary-globalsec
        this.globals = [];
        let count = r.u32();
        for (let i = 0; i < count; i++) {
            // types.html#binary-globaltype
            let type = r.byte();
            let mut = r.byte();
            let expr = this.parseExpr(r);
            this.globals.push({
                type: type,
                mutable: !!mut,
                initializer: expr,
            });
            console.log(` global ${mut ? 'var' : 'const'} ${i} of type ${consts.typeNames[type]}`);
        }
    }

    parseExportSection(r) {
        // modules.html#binary-exportsec
        this.exportFunctions = [];
        this.exportTables = [];
        this.exportMemories = [];
        this.exportGlobals = [];
        const count = r.u32();
        for (let i = 0; i < count; i++) {
            let name = r.str();
            let select = r.byte();
            let index = r.u32();
            switch (select) {
                case 0x00:
                    this.exportFunctions.push({ name, index });
                    console.log(`  export function ${index} as ${name}`);
                    break;
                case 0x01:
                    this.exportTables.push({ name, index });
                    console.log(`  export table ${index} as ${name}`);
                    break;
                case 0x02:
                    this.exportMemories.push({ name, index });
                    console.log(`  export memory ${index} as ${name}`);
                    break;
                case 0x03:
                    this.exportGlobals.push({ name, index });
                    console.log(`  export global ${index} as ${name}`);
                    break;
                default:
                    throw error(`Unknown select of import '${select}'`);
            }
        }
    }

    parseStartSection(r) {
        // modules.html#binary-startsec
        this.startFunction = r.u32();
        console.log(`  startup function is ${this.startFunction}`)
    }

    parseElementSection(r) {
        // modules.html#binary-elemsec
        this.activeElements = [];
        this.passiveElements = [];
        this.declarativeElements = [];
        let count = r.u32();
        for (let i = 0; i < count; i++) {
            let select = r.u32();
            let obj = {};
            let arr;
            switch (select & 0x03) {
                case 0x00:
                    obj.tableidx = 0;
                    obj.expr = this.parseExpr(r);
                    obj.elemkind = 0x00;
                    arr = this.activeElements;
                    break;
                case 0x01:
                    obj.elemkind = r.byte();
                    arr = this.passiveElements;
                    break;
                case 0x02:
                    obj.tableidx = r.u32();
                    obj.expr = this.parseExpr(r);
                    obj.elemkind = r.byte();
                    arr = this.activeElements;
                    break;
                case 0x03:
                    obj.elemkind = r.byte();
                    arr = this.declarativeElements;
                    break;
            }
            obj.items = [];
            let itemsCount = r.u32();
            for (let j = 0; j < itemsCount; j++) {
                if (select & 0x04) {
                    obj.items.push(this.parseExpr(r));
                } else {
                    obj.items.push(r.u32());
                }
            }
            arr.push(obj);
            console.log(`  element of table ${obj.tableidx} kind ${obj.elemkind}: ${obj.items.join(', ')}`);
        }
    }

    parseFuncCode(r, funcIndex) {
        // modules.html#binary-codesec
        if (!this.functions[funcIndex]) {
            this.functions[funcIndex] = {};
        }
        let locals = [];
        let count = r.u32();
        for (let i = 0; i < count; i++) {
            let localsCount = r.u32();
            let type = this.valueType(r);
            locals = locals.concat((new Array(localsCount)).fill(type));
        }
        this.functions[funcIndex].locals = locals;
        console.log(`    locals: ${locals.map(x => consts.typeNames[x]).join(', ')}`);
        this.functions[funcIndex].body = this.parseExpr(r);
    }

    parseCodeSection(r) {
        // modules.html#binary-codesec
        let count = r.u32();
        for (let funcIndex = 0; funcIndex < count; funcIndex++) {
            let funcSize = r.u32();
            console.log(`  function ${funcIndex} of size ${funcSize}`);
            this.parseFuncCode(r.sub(funcSize), funcIndex);
        }
    }

    parseDataSection(r) {
        // modules.html#binary-datasec
        this.activeData = [];
        this.passiveData = [];
        let count = r.u32();
        for (let funcIndex = 1; funcIndex <= count; funcIndex++) {
            let select = r.byte();
            switch (select) {
                case 0x00: {
                    let offset = this.parseExpr(r);
                    let bytes = r.bytes();
                    this.activeData.push({ memory: 0, offset: offset, data: bytes });
                    console.log(`  data active mode for memory 0 of size ${bytes.length}`);
                    break;
                }
                case 0x01: {
                    let bytes = r.bytes();
                    this.passiveData.push(bytes);
                    console.log(`  data passive mode of size ${bytes.length}`);
                    break;
                }
                case 0x02: {
                    let memory = r.u32;
                    let offset = this.parseExpr(r);
                    let bytes = r.bytes();
                    this.activeData.push({ memory: memory, offset: offset, data: bytes });
                    console.log(`  data active mode for memory ${memory} of size ${bytes.length}`);
                    break;
                }
                default:
                    throw error(`Unknown kind of data ${select}`);
            }
        }
    }

    parseDataCountSection(r) {
        // modules.html#binary-datacountsec
        this.dataCount = r.u32();
    }


    parseProducersSection(r) {
        let producers = [];
        let count = r.u32();
        for (let i = 0; i < count; i++) {
            let fieldName = r.str() + ':';
            let valueCount = r.u32();
            for (let j = 0; j < valueCount; j++) {
                let name = r.str();
                let version = r.str();
                producers.push(`${fieldName} ${name} ${version}`);
                fieldName = ' '.repeat(fieldName.length);
            }
        }
        this.producers = producers.join('\n');
        console.log(this.producers);
    }

    parseCustomSection(r) {
        let name = r.str();
        console.log(`Custom section "${name}"`);
        if (name == 'producers') {
            this.parseProducersSection(r);
        }
    }

    parseSection(r) {
        const id = r.byte();
        const size = r.u32();
        console.log(`Section ${id} "${consts.sectionNames[id]}" of size ${size}`);
        switch (id) {
            case consts.SECTION_ID_TYPE:
                this.parseTypeSection(r.sub(size));
                break;
            case consts.SECTION_ID_IMPORT:
                this.parseImportSection(r.sub(size));
                break;
            case consts.SECTION_ID_FUNCTION:
                this.parseFunctionSection(r.sub(size));
                break;
            case consts.SECTION_ID_TABLE:
                this.parseTableSection(r.sub(size));
                break;
            case consts.SECTION_ID_MEMORY:
                this.parseMemorySection(r.sub(size));
                break;
            case consts.SECTION_ID_GLOBAL:
                this.parseGlobalSection(r.sub(size));
                break;
            case consts.SECTION_ID_EXPORT:
                this.parseExportSection(r.sub(size));
                break;
            case consts.SECTION_ID_START:
                this.parseStartSection(r.sub(size));
                break;
            case consts.SECTION_ID_ELEMENT:
                this.parseElementSection(r.sub(size));
                break;
            case consts.SECTION_ID_CODE:
                this.parseCodeSection(r.sub(size));
                break;
            case consts.SECTION_ID_DATA:
                this.parseDataSection(r.sub(size));
                break;
            case consts.SECTION_ID_DATA_COUNT:
                this.parseDataCountSection(r.sub(size));
                break;
            case consts.SECTION_ID_CUSTOM:
                this.parseCustomSection(r.sub(size));
                break;
            default:
                throw error(`Unsupported section id ${id}`);
        }
    }

    parse() {
        // modules.html#binary-magic
        let magicOk = this.r.byte() == 0x00
            && this.r.byte() == 0x61
            && this.r.byte() == 0x73
            && this.r.byte() == 0x6D;
        if (!magicOk) {
            throw error(`Invalid wasm binary file`);
        }

        // modules.html#binary-version
        let versionOk = this.r.byte() == 0x01
            && this.r.byte() == 0x00
            && this.r.byte() == 0x00
            && this.r.byte() == 0x00;
        if (!versionOk) {
            throw error(`Unsupported wasm binary file version`);
        }

        // modules.html#binary-module
        while (this.r.remaining > 0) {
            this.parseSection(this.r);
        }

        this.postProcess();
    }

    getTypeFromIndex(typeIndex) {
        if (typeIndex < 0 || typeIndex >= this.functionTypes.length)
            throw error(`Function type index ${typeIndex} of range from 0 to ${this.functionTypes.length - 1}`);
        return this.functionTypes[typeIndex];
    }

    postCombineFunctions() {
        let all = [];
        for (let f of this.importFunctions) {
            let type = this.getTypeFromIndex(f.typeIndex);
            all.push({
                index: all.length,
                imported: true,
                type: type,
                module: f.module,
                name: f.name,
            });
        }
        for (let f of this.functions) {
            let type = this.getTypeFromIndex(f.typeIndex);
            all.push({
                index: all.length,
                imported: false,
                type: type,
                locals: f.locals,
                body: f.body,
                name: `$func${all.length}`,
            });
        }
        this.functions = all;
    }

    postProcess() {
        this.postCombineFunctions();
        this.test(this.functions[4]);
    }

    updateState(f, state, instr) {
        if ('i' in instr.desc) {
            for (let type of instr.desc.i) {
                if (state.wasmStack.length == 0 || state.wasmStack[state.wasmStack.length - 1].type != type)
                    throw error(`Stack types validation error`);
                state.wasmStack.pop();
            }
            for (let type of instr.desc.o) {
                state.wasmStack.push({ type: type });
            }
        } else if (instr.code == 0x24) {
            let g = this.globals[instr.params[0]];
            if (state.wasmStack.length == 0 || state.wasmStack[state.wasmStack.length - 1].type != g.type)
                throw error(`Stack types validation error`);
            state.wasmStack.pop();
        } else if (instr.code == 0x23) {
            let g = this.globals[instr.params[0]];
            state.wasmStack.push({ type: g.type });
        } else if (instr.code == 0x22) {
            let l = f.locals[instr.params[0]];
            state.wasmStack.push({ type: l });
        } else {
            throw 'Not implemented';
        }
    }

    test(f) {
        f.localsAllocation = [];
        let offsetWords = 0;
        for (let i = 0; i < f.locals.length; i++) {
            let words = consts.typeWords[f.locals[i]];
            f.localsAllocation[i] = offsetWords;
            offsetWords += words;
        }
        let state = {
            controlStack: [{
                loop: false,
                type: f.type,
            }],
            wasmStack: [],
            uvmStack: [],
        };
        for (let instr of f.body) {
            this.updateState(f, state, instr);
            console.log(instr.desc.name);
            console.log('        ' + state.wasmStack.map(x => consts.typeNames[x.type]).join(' '));
        }
    }

}


exports.WasmParser = WasmParser;
exports.WasmParsingError = WasmParsingError;
