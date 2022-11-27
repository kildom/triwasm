import { allowTemporaryNull, enumize, pick } from "../utils/common";
import { BinaryInput } from "./binaryInput";
import { OP } from "./opcodes";
import { ConstExpression, ElementKind, FunctionType, GlobalKind, Limits, NumberType, RefType, ValueType, ValueTypeObject, WasmBlock, WasmData, WasmElement, WasmFunction, WasmFunctionKind, WasmGlobal, WasmImport, WasmInstr, WasmInstrWithBlock, WasmInstrWithBlockOP, WasmMemory, WasmModule, WasmTable } from "./wasmModule";

const TRIVM_MAGIC_FUNCTION_TAG = '__trivm_magic_function__';

// modules.html#sections
enum SectionId {
    CUSTOM = 0,
    TYPE = 1,
    IMPORT = 2,
    FUNCTION = 3,
    TABLE = 4,
    MEMORY = 5,
    GLOBAL = 6,
    EXPORT = 7,
    START = 8,
    ELEMENT = 9,
    CODE = 10,
    DATA = 11,
    DATA_COUNT = 12,
};

// modules.html#import-section
enum EntityKind {
    FUNCTION = 0x00,
    TABLE = 0x01,
    MEMORY = 0x02,
    GLOBAL = 0x03,
};

enum Consts {
    // types.html#function-types
    FUNCTION_TYPE_START = 0x60,
};

// types.html#binary-limits
enum LimitKind {
    UNLIMITED = 0x00,
    LIMITED = 0x01,
};

export class WasmParser {

    private globalInput: BinaryInput;
    private module: WasmModule;
    private types: FunctionType[] = [];
    private firstNonImportFunction: number = 0;
    blockStack: WasmBlock[] = [];

    public constructor(file: string) {
        this.globalInput = new BinaryInput(file);
        this.module = new WasmModule();
    }

    public parse() {
        let input = this.globalInput;
        let magic = input.rawUint32();
        let version = input.rawUint32();
        if (magic != 0x6D736100) {
            throw new Error('Not a WebAssembly module');
        }
        if (version != 1) {
            throw new Error('Unsupported version of a module.');
        }
        let sectionsOrdered: [(input: BinaryInput) => void, BinaryInput][][] = [[], [], [], [], []];
        while (input.remaining() > 0) {
            let id = input.byte();
            let size = input.u32();
            let sub = input.slice(size);
            switch (id) {
                case SectionId.TYPE:
                    sectionsOrdered[0].push([this.parseTypeSection, sub]);
                    break;
                case SectionId.IMPORT:
                    sectionsOrdered[1].push([this.parseImportSection, sub]);
                    break;
                case SectionId.FUNCTION:
                    sectionsOrdered[1].push([this.parseFunctionSection, sub]);
                    break;
                case SectionId.TABLE:
                    sectionsOrdered[1].push([this.parseTableSection, sub]);
                    break;
                case SectionId.MEMORY:
                    sectionsOrdered[1].push([this.parseMemorySection, sub]);
                    break;
                case SectionId.GLOBAL:
                    sectionsOrdered[1].push([this.parseGlobalStubs, sub]);
                    sectionsOrdered[2].push([this.parseGlobalSection, sub.clone()]);
                    break;
                case SectionId.ELEMENT:
                    sectionsOrdered[1].push([this.parseElementStubs, sub]);
                    sectionsOrdered[2].push([this.parseElementSection, sub.clone()]);
                    break;
                case SectionId.DATA:
                    sectionsOrdered[1].push([this.parseDataStubs, sub]);
                    sectionsOrdered[2].push([this.parseDataSection, sub.clone()]);
                    break;
                case SectionId.EXPORT:
                    sectionsOrdered[3].push([this.parseExportSection, sub]);
                    break;
                case SectionId.START:
                    sectionsOrdered[3].push([this.parseStartSection, sub]);
                    break;
                case SectionId.CODE:
                    sectionsOrdered[4].push([this.parseCodeSection, sub]);
                    break;
                case SectionId.CUSTOM:
                    // Ignore
                    break;
                case SectionId.DATA_COUNT:
                    // Ignore
                    break;
                default:
                    console.log(id);
                    break;
            }
        }
        input.finalize();
    }

    parseDataStubs(input: BinaryInput) {
    }

    // modules.html#binary-datasec
    parseDataSection(input: BinaryInput) {
        let count = input.u32();
        for (let i = 0; i < count; i++) {
            let tag = input.byte();
            let index: number = 0;
            let data: WasmData;
            switch (tag) {
                case 2:
                    index = input.u32();
                // no break - fall through
                case 0: {
                    if (index >= this.module.memories.length) {
                        throw new Error('Invalid memory index');
                    }
                    let offset = this.parseConstExpression(input);
                    let size = input.u32();
                    let content = input.raw(size);
                    data = new WasmData(content, this.module.memories[index], offset);
                    break;
                }
                case 1: {
                    let size = input.u32();
                    let content = input.raw(size);
                    data = new WasmData(content);
                    break;
                }
                default:
                    throw new Error('Invalid tag');
            }
            this.module.addData(data);
        }
    }

    parseStartSection(input: BinaryInput) {
    }

    // modules.html#binary-codesec
    parseCodeSection(input: BinaryInput) {
        let count = input.u32();
        for (let i = 0; i < count; i++) {
            let funcIndex = this.firstNonImportFunction + i;
            let func = this.module.functions[funcIndex];
            let size = input.u32();
            let sub = input.slice(size);
            this.parseFuncCode(sub, func);
            sub.finalize();
        }
    }

    // modules.html#binary-codesec
    parseFuncCode(input: BinaryInput, func: WasmFunction) {
        let localsCount = input.u32();
        for (let i = 0; i < localsCount; i++) {
            let repeatCount = input.u32();
            let type: ValueType = enumize(input.byte(), ValueTypeObject);
            for (let k = 0; k < repeatCount; k++) {
                func.locals.push(type);
            }
        }
        let instr = this.createInstrWithBlock(OP.TRIVM_FUNCTION, func.type, undefined);
        func.block = instr.block;
        this.blockStack = [instr.block];
        instr.block.body = this.parseExpression(input, func);
    }

    parseElementStubs(input: BinaryInput) {
    }

    // modules.html#binary-elemsec
    parseElementSection(input: BinaryInput) {
        let count = input.u32();
        for (let i = 0; i < count; i++) {
            let tag = input.u32();
            if (tag > 7) {
                throw new Error("Unexpected kind of element.");
            }
            let element = new WasmElement();
            let elemkind = 0x00;
            switch (tag & 3) {
                case 0: { // active to table 0 of type funcref
                    element.kind = ElementKind.ACTIVE;
                    element.table = this.module.tables[0];
                    element.offset = this.parseConstExpression(input);
                    break;
                }
                case 1: { // passive
                    element.kind = ElementKind.PASSIVE;
                    elemkind = input.byte();
                    break;
                }
                case 2: { // active to table N of type X
                    element.kind = ElementKind.ACTIVE;
                    element.table = this.module.tables[input.u32()];
                    element.offset = this.parseConstExpression(input);
                    elemkind = input.byte();
                    break;
                }
                case 3: { // declarative
                    element.kind = ElementKind.DECLARATIVE;
                    elemkind = input.byte();
                    break;
                }
            }
            if (elemkind != 0x00) {
                throw new Error("Only funcref element kind is supported.");
            }
            let itemsCount = input.u32();
            for (let k = 0; k < itemsCount; k++) {
                let expr: ConstExpression;
                if (tag & 4) {
                    expr = this.parseConstExpression(input);
                } else {
                    expr = { type: RefType.FUNCREF, index: input.u32() }
                }
                element.items.push(expr);
            }
            this.module.addElement(element);
        }
    }

    // modules.html#binary-exportsec
    parseExportSection(input: BinaryInput) {
        let count = input.u32();
        for (let i = 0; i < count; i++) {
            let name = input.str();
            let kind = enumize<EntityKind>(input.byte(), EntityKind);
            let index = input.u32();
            switch (kind) {
                case EntityKind.FUNCTION:
                    this.module.functions[index].exports.push(name);
                    if (name.startsWith(TRIVM_MAGIC_FUNCTION_TAG + ':')) {
                        let func = this.module.functions[index];
                        this.parseMagicFunction(func, name.substring(TRIVM_MAGIC_FUNCTION_TAG.length + 1));
                    }
                    break;
                case EntityKind.MEMORY:
                    this.module.memories[index].exports.push(name);
                    break;
                case EntityKind.GLOBAL:
                    this.module.globals[index].exports.push(name);
                    break;
                case EntityKind.TABLE:
                    this.module.tables[index].exports.push(name);
                    break;
                default:
                    throw new Error('Unknown entity kind.');
            }
        }
    }

    parseGlobalStubs(input: BinaryInput) {
    }

    // modules.html#binary-globalsec
    parseGlobalSection(input: BinaryInput) {
        let count = input.u32();
        for (let i = 0; i < count; i++) {
            // types.html#binary-globaltype
            let type: ValueType = enumize(input.byte(), ValueTypeObject);
            let kind: GlobalKind = enumize(input.byte(), GlobalKind);
            let expr = this.parseConstExpression(input);
            if (expr.type != undefined && expr.type != type) {
                throw new Error('Global type mismatch');
            }
            let global = new WasmGlobal(kind, type, expr);
            this.module.addGlobal(global);
        }
    }

    // ../valid/instructions.html#constant-expressions
    parseConstExpression(input: BinaryInput): ConstExpression {
        let result: ConstExpression;
        this.blockStack = [];
        let expr = this.parseExpression(input, new WasmFunction(WasmFunctionKind.WASM, { params: [], results: [] }));
        if (expr.length != 2 || expr[1].opcode != OP.END) {
            return { type: undefined, expr: expr };
        }
        switch (expr[0].opcode) {
            case OP.I32_CONST:
                result = { type: NumberType.I32, value: expr[0].value };
                break;
            default:
                result = { type: undefined, expr: expr };
                break;
        }
        return result;
    }

    // instructions.html#binary-expr
    parseExpression(input: BinaryInput, func: WasmFunction, allowElse: boolean = false): WasmInstr[] {
        let result: WasmInstr[] = [];
        let last: boolean;
        let instr: WasmInstr;
        do {
            [last, instr] = this.parseInstr(input, func, allowElse);
            result.push(instr);
        } while (!last);
        return result;
    }

    // instructions.html#instructions
    parseInstr(input: BinaryInput, func: WasmFunction, allowElse: boolean): [boolean, WasmInstr] {
        let opcode: OP = input.byte();
        if (opcode > OP.TRIVM_MULTIBYTE_FIRST) {
            let extOpcode = input.u32();
            if (extOpcode > 0x7FFFFF) {
                throw new Error('Invalid extended opcode');
            }
            opcode |= extOpcode << 8;
        }

        let last = false;
        let instr: WasmInstr | null = null;

        switch (opcode) {

            // -- Begin of source code generated with help of "gen-instr.ts" script --

            // The following cases are generated automatically without body.
            // You can edit case body, but if you want to change something else use
            // the "gen-instr.ts" script and manually merge results with this file.
            case OP.BLOCK:
            case OP.LOOP:
            case OP.IF: { // block
                let type = this.parseCompressedBlockType(input);
                instr = this.createInstrWithBlock(opcode, type, this.blockStack.at(-1));
                this.blockStack.push(instr.block);
                instr.block.body = this.parseExpression(input, func, opcode == OP.IF);
                this.blockStack.pop();
                break;
            }
            case OP.ELSE: { // else
                if (!allowElse) {
                    throw new Error('"else" instruction not expected here');
                }
                allowElse = false;
                break;
            }
            case OP.END: { // end
                last = true;
                break;
            }
            case OP.BR:
            case OP.BR_IF: { // labelidx
                let index = input.u32();
                if (index >= this.blockStack.length) {
                    throw new Error('Invalid label index.');
                }
                instr = { opcode, target: index };
                break;
            }
            case OP.BR_TABLE: { // labelidx[]
                let count = input.u32();
                let targets: number[] = [];
                for (let i = 0; i < count + 1; i++) {
                    let index = input.u32();
                    if (index >= this.blockStack.length) {
                        throw new Error('Invalid label index.');
                    }
                    targets[i] = index;
                }
                instr = { opcode, targets };
                break;
            }
            case OP.CALL:
            case OP.REF_FUNC: { // funcidx
                let index = input.u32();
                let func = pick(this.module.functions, index, 'Invalid function index.');
                instr = { opcode, func };
                break;
            }
            case OP.CALL_INDIRECT: { // typeidx, tableidx
                let typeIndex = input.u32();
                let type = pick(this.types, typeIndex, 'Invalid type index');
                let tableIndex = input.u32();
                let table = pick(this.module.tables, tableIndex, 'Invalid table index');
                instr = { opcode, type, table };
                break;
            }
            case OP.SELECT_T: { // valtype[]
                throw new Error(`Un instr 0x${opcode.toString(16)}`)
                break;
            }
            case OP.LOCAL_GET:
            case OP.LOCAL_SET:
            case OP.LOCAL_TEE: { // localidx
                let index = input.u32();
                if (index >= func.type.params.length + func.locals.length) {
                    throw new Error('Invalid local variable index.');
                }
                instr = { opcode, index };
                break;
            }
            case OP.GLOBAL_GET:
            case OP.GLOBAL_SET: { // globalidx
                let index = input.u32();
                let global = pick(this.module.globals, index, 'Invalid global index.');
                instr = { opcode, global }
                break;
            }
            case OP.TABLE_GET:
            case OP.TABLE_SET:
            case OP.TABLE_GROW:
            case OP.TABLE_SIZE:
            case OP.TABLE_FILL: { // tableidx
                let index = input.u32();
                let table = pick(this.module.tables, index, 'Invalid table index.');
                instr = { opcode, table }
                break;
            }
            case OP.I32_LOAD:
            case OP.I64_LOAD:
            case OP.F32_LOAD:
            case OP.F64_LOAD:
            case OP.I32_LOAD8_S:
            case OP.I32_LOAD8_U:
            case OP.I32_LOAD16_S:
            case OP.I32_LOAD16_U:
            case OP.I64_LOAD8_S:
            case OP.I64_LOAD8_U:
            case OP.I64_LOAD16_S:
            case OP.I64_LOAD16_U:
            case OP.I64_LOAD32_S:
            case OP.I64_LOAD32_U:
            case OP.I32_STORE:
            case OP.I64_STORE:
            case OP.F32_STORE:
            case OP.F64_STORE:
            case OP.I32_STORE8:
            case OP.I32_STORE16:
            case OP.I64_STORE8:
            case OP.I64_STORE16:
            case OP.I64_STORE32:
            case OP.V128_LOAD:
            case OP.V128_LOAD8X8_S:
            case OP.V128_LOAD8X8_U:
            case OP.V128_LOAD16X4_S:
            case OP.V128_LOAD16X4_U:
            case OP.V128_LOAD32X2_S:
            case OP.V128_LOAD32X2_U:
            case OP.V128_LOAD8_SPLAT:
            case OP.V128_LOAD16_SPLAT:
            case OP.V128_LOAD32_SPLAT:
            case OP.V128_LOAD64_SPLAT:
            case OP.V128_STORE: { // memarg
                break;
            }
            case OP.MEMORY_SIZE:
            case OP.MEMORY_GROW:
            case OP.MEMORY_FILL: { // memidx
                break;
            }
            case OP.I32_CONST: { // s32
                let value = input.s32();
                instr = { opcode, value };
                break;
            }
            case OP.I64_CONST: { // s64
                let value = input.s64();
                instr = { opcode, value };
                break;
            }
            case OP.F32_CONST: { // f32
                let value = input.rawInt32();
                instr = { opcode, value };
                break;
            }
            case OP.F64_CONST: { // f64
                let value = input.rawInt64();
                instr = { opcode, value };
                break;
            }
            case OP.REF_NULL: { // reftype
                let reftype = input.byte();
                let type: RefType = enumize(reftype, RefType);
                instr = { opcode, type };
                break;
            }
            case OP.MEMORY_INIT: { // dataidx, memidx
                break;
            }
            case OP.DATA_DROP: { // dataidx
                break;
            }
            case OP.MEMORY_COPY: { // memidx, memidx
                break;
            }
            case OP.TABLE_INIT: { // elemidx, tableidx
                break;
            }
            case OP.ELEM_DROP: { // elemidx
                break;
            }
            case OP.TABLE_COPY: { // tableidx, tableidx
                break;
            }
            case OP.V128_CONST:
            case OP.I8X16_SHUFFLE: { // 16 bytes
                break;
            }
            case OP.I8X16_EXTRACT_LANE_S:
            case OP.I8X16_EXTRACT_LANE_U:
            case OP.I8X16_REPLACE_LANE:
            case OP.I16X8_EXTRACT_LANE_S:
            case OP.I16X8_EXTRACT_LANE_U:
            case OP.I16X8_REPLACE_LANE:
            case OP.I32X4_EXTRACT_LANE:
            case OP.I32X4_REPLACE_LANE:
            case OP.I64X2_EXTRACT_LANE:
            case OP.I64X2_REPLACE_LANE:
            case OP.F32X4_EXTRACT_LANE:
            case OP.F32X4_REPLACE_LANE:
            case OP.F64X2_EXTRACT_LANE:
            case OP.F64X2_REPLACE_LANE: { // laneidx
                let index = input.byte();
                instr = { opcode, index };
                break;
            }
            case OP.V128_LOAD8_LANE:
            case OP.V128_LOAD16_LANE:
            case OP.V128_LOAD32_LANE:
            case OP.V128_LOAD64_LANE:
            case OP.V128_STORE8_LANE:
            case OP.V128_STORE16_LANE:
            case OP.V128_STORE32_LANE:
            case OP.V128_STORE64_LANE:
            case OP.V128_LOAD32_ZERO:
            case OP.V128_LOAD64_ZERO: { // memarg, laneidx
                break;
            }
            case OP.UNREACHABLE:
            case OP.NOP:
            case OP.RETURN:
            case OP.DROP:
            case OP.SELECT:
            case OP.I32_EQZ:
            case OP.I32_EQ:
            case OP.I32_NE:
            case OP.I32_LT_S:
            case OP.I32_LT_U:
            case OP.I32_GT_S:
            case OP.I32_GT_U:
            case OP.I32_LE_S:
            case OP.I32_LE_U:
            case OP.I32_GE_S:
            case OP.I32_GE_U:
            case OP.I64_EQZ:
            case OP.I64_EQ:
            case OP.I64_NE:
            case OP.I64_LT_S:
            case OP.I64_LT_U:
            case OP.I64_GT_S:
            case OP.I64_GT_U:
            case OP.I64_LE_S:
            case OP.I64_LE_U:
            case OP.I64_GE_S:
            case OP.I64_GE_U:
            case OP.F32_EQ:
            case OP.F32_NE:
            case OP.F32_LT:
            case OP.F32_GT:
            case OP.F32_LE:
            case OP.F32_GE:
            case OP.F64_EQ:
            case OP.F64_NE:
            case OP.F64_LT:
            case OP.F64_GT:
            case OP.F64_LE:
            case OP.F64_GE:
            case OP.I32_CLZ:
            case OP.I32_CTZ:
            case OP.I32_POPCNT:
            case OP.I32_ADD:
            case OP.I32_SUB:
            case OP.I32_MUL:
            case OP.I32_DIV_S:
            case OP.I32_DIV_U:
            case OP.I32_REM_S:
            case OP.I32_REM_U:
            case OP.I32_AND:
            case OP.I32_OR:
            case OP.I32_XOR:
            case OP.I32_SHL:
            case OP.I32_SHR_S:
            case OP.I32_SHR_U:
            case OP.I32_ROTL:
            case OP.I32_ROTR:
            case OP.I64_CLZ:
            case OP.I64_CTZ:
            case OP.I64_POPCNT:
            case OP.I64_ADD:
            case OP.I64_SUB:
            case OP.I64_MUL:
            case OP.I64_DIV_S:
            case OP.I64_DIV_U:
            case OP.I64_REM_S:
            case OP.I64_REM_U:
            case OP.I64_AND:
            case OP.I64_OR:
            case OP.I64_XOR:
            case OP.I64_SHL:
            case OP.I64_SHR_S:
            case OP.I64_SHR_U:
            case OP.I64_ROTL:
            case OP.I64_ROTR:
            case OP.F32_ABS:
            case OP.F32_NEG:
            case OP.F32_CEIL:
            case OP.F32_FLOOR:
            case OP.F32_TRUNC:
            case OP.F32_NEAREST:
            case OP.F32_SQRT:
            case OP.F32_ADD:
            case OP.F32_SUB:
            case OP.F32_MUL:
            case OP.F32_DIV:
            case OP.F32_MIN:
            case OP.F32_MAX:
            case OP.F32_COPYSIGN:
            case OP.F64_ABS:
            case OP.F64_NEG:
            case OP.F64_CEIL:
            case OP.F64_FLOOR:
            case OP.F64_TRUNC:
            case OP.F64_NEAREST:
            case OP.F64_SQRT:
            case OP.F64_ADD:
            case OP.F64_SUB:
            case OP.F64_MUL:
            case OP.F64_DIV:
            case OP.F64_MIN:
            case OP.F64_MAX:
            case OP.F64_COPYSIGN:
            case OP.I32_WRAP_I64:
            case OP.I32_TRUNC_F32_S:
            case OP.I32_TRUNC_F32_U:
            case OP.I32_TRUNC_F64_S:
            case OP.I32_TRUNC_F64_U:
            case OP.I64_EXTEND_I32_S:
            case OP.I64_EXTEND_I32_U:
            case OP.I64_TRUNC_F32_S:
            case OP.I64_TRUNC_F32_U:
            case OP.I64_TRUNC_F64_S:
            case OP.I64_TRUNC_F64_U:
            case OP.F32_CONVERT_I32_S:
            case OP.F32_CONVERT_I32_U:
            case OP.F32_CONVERT_I64_S:
            case OP.F32_CONVERT_I64_U:
            case OP.F32_DEMOTE_F64:
            case OP.F64_CONVERT_I32_S:
            case OP.F64_CONVERT_I32_U:
            case OP.F64_CONVERT_I64_S:
            case OP.F64_CONVERT_I64_U:
            case OP.F64_PROMOTE_F32:
            case OP.I32_REINTERPRET_F32:
            case OP.I64_REINTERPRET_F64:
            case OP.F32_REINTERPRET_I32:
            case OP.F64_REINTERPRET_I64:
            case OP.I32_EXTEND8_S:
            case OP.I32_EXTEND16_S:
            case OP.I64_EXTEND8_S:
            case OP.I64_EXTEND16_S:
            case OP.I64_EXTEND32_S:
            case OP.REF_IS_NULL:
            case OP.I32_TRUNC_SAT_F32_S:
            case OP.I32_TRUNC_SAT_F32_U:
            case OP.I32_TRUNC_SAT_F64_S:
            case OP.I32_TRUNC_SAT_F64_U:
            case OP.I64_TRUNC_SAT_F32_S:
            case OP.I64_TRUNC_SAT_F32_U:
            case OP.I64_TRUNC_SAT_F64_S:
            case OP.I64_TRUNC_SAT_F64_U:
            case OP.I8X16_SWIZZLE:
            case OP.I8X16_SPLAT:
            case OP.I16X8_SPLAT:
            case OP.I32X4_SPLAT:
            case OP.I64X2_SPLAT:
            case OP.F32X4_SPLAT:
            case OP.F64X2_SPLAT:
            case OP.I8X16_EQ:
            case OP.I8X16_NE:
            case OP.I8X16_LT_S:
            case OP.I8X16_LT_U:
            case OP.I8X16_GT_S:
            case OP.I8X16_GT_U:
            case OP.I8X16_LE_S:
            case OP.I8X16_LE_U:
            case OP.I8X16_GE_S:
            case OP.I8X16_GE_U:
            case OP.I16X8_EQ:
            case OP.I16X8_NE:
            case OP.I16X8_LT_S:
            case OP.I16X8_LT_U:
            case OP.I16X8_GT_S:
            case OP.I16X8_GT_U:
            case OP.I16X8_LE_S:
            case OP.I16X8_LE_U:
            case OP.I16X8_GE_S:
            case OP.I16X8_GE_U:
            case OP.I32X4_EQ:
            case OP.I32X4_NE:
            case OP.I32X4_LT_S:
            case OP.I32X4_LT_U:
            case OP.I32X4_GT_S:
            case OP.I32X4_GT_U:
            case OP.I32X4_LE_S:
            case OP.I32X4_LE_U:
            case OP.I32X4_GE_S:
            case OP.I32X4_GE_U:
            case OP.F32X4_EQ:
            case OP.F32X4_NE:
            case OP.F32X4_LT:
            case OP.F32X4_GT:
            case OP.F32X4_LE:
            case OP.F32X4_GE:
            case OP.F64X2_EQ:
            case OP.F64X2_NE:
            case OP.F64X2_LT:
            case OP.F64X2_GT:
            case OP.F64X2_LE:
            case OP.F64X2_GE:
            case OP.V128_NOT:
            case OP.V128_AND:
            case OP.V128_ANDNOT:
            case OP.V128_OR:
            case OP.V128_XOR:
            case OP.V128_BITSELECT:
            case OP.V128_ANY_TRUE:
            case OP.F32X4_DEMOTE_F64X2_ZERO:
            case OP.F64X2_PROMOTE_LOW_F32X4:
            case OP.I8X16_ABS:
            case OP.I8X16_NEG:
            case OP.I8X16_POPCNT:
            case OP.I8X16_ALL_TRUE:
            case OP.I8X16_BITMASK:
            case OP.I8X16_NARROW_I16X8_S:
            case OP.I8X16_NARROW_I16X8_U:
            case OP.F32X4_CEIL:
            case OP.F32X4_FLOOR:
            case OP.F32X4_TRUNC:
            case OP.F32X4_NEAREST:
            case OP.I8X16_SHL:
            case OP.I8X16_SHR_S:
            case OP.I8X16_SHR_U:
            case OP.I8X16_ADD:
            case OP.I8X16_ADD_SAT_S:
            case OP.I8X16_ADD_SAT_U:
            case OP.I8X16_SUB:
            case OP.I8X16_SUB_SAT_S:
            case OP.I8X16_SUB_SAT_U:
            case OP.F64X2_CEIL:
            case OP.F64X2_FLOOR:
            case OP.I8X16_MIN_S:
            case OP.I8X16_MIN_U:
            case OP.I8X16_MAX_S:
            case OP.I8X16_MAX_U:
            case OP.F64X2_TRUNC:
            case OP.I8X16_AVGR_U:
            case OP.I16X8_EXTADD_PAIRWISE_I8X16_S:
            case OP.I16X8_EXTADD_PAIRWISE_I8X16_U:
            case OP.I32X4_EXTADD_PAIRWISE_I16X8_S:
            case OP.I32X4_EXTADD_PAIRWISE_I16X8_U:
            case OP.I16X8_ABS:
            case OP.I16X8_NEG:
            case OP.I16X8_Q15MULR_SAT_S:
            case OP.I16X8_ALL_TRUE:
            case OP.I16X8_BITMASK:
            case OP.I16X8_NARROW_I32X4_S:
            case OP.I16X8_NARROW_I32X4_U:
            case OP.I16X8_EXTEND_LOW_I8X16_S:
            case OP.I16X8_EXTEND_HIGH_I8X16_S:
            case OP.I16X8_EXTEND_LOW_I8X16_U:
            case OP.I16X8_EXTEND_HIGH_I8X16_U:
            case OP.I16X8_SHL:
            case OP.I16X8_SHR_S:
            case OP.I16X8_SHR_U:
            case OP.I16X8_ADD:
            case OP.I16X8_ADD_SAT_S:
            case OP.I16X8_ADD_SAT_U:
            case OP.I16X8_SUB:
            case OP.I16X8_SUB_SAT_S:
            case OP.I16X8_SUB_SAT_U:
            case OP.F64X2_NEAREST:
            case OP.I16X8_MUL:
            case OP.I16X8_MIN_S:
            case OP.I16X8_MIN_U:
            case OP.I16X8_MAX_S:
            case OP.I16X8_MAX_U:
            case OP.I16X8_AVGR_U:
            case OP.I16X8_EXTMUL_LOW_I8X16_S:
            case OP.I16X8_EXTMUL_HIGH_I8X16_S:
            case OP.I16X8_EXTMUL_LOW_I8X16_U:
            case OP.I16X8_EXTMUL_HIGH_I8X16_U:
            case OP.I32X4_ABS:
            case OP.I32X4_NEG:
            case OP.I32X4_ALL_TRUE:
            case OP.I32X4_BITMASK:
            case OP.I32X4_EXTEND_LOW_I16X8_S:
            case OP.I32X4_EXTEND_HIGH_I16X8_S:
            case OP.I32X4_EXTEND_LOW_I16X8_U:
            case OP.I32X4_EXTEND_HIGH_I16X8_U:
            case OP.I32X4_SHL:
            case OP.I32X4_SHR_S:
            case OP.I32X4_SHR_U:
            case OP.I32X4_ADD:
            case OP.I32X4_SUB:
            case OP.I32X4_MUL:
            case OP.I32X4_MIN_S:
            case OP.I32X4_MIN_U:
            case OP.I32X4_MAX_S:
            case OP.I32X4_MAX_U:
            case OP.I32X4_DOT_I16X8_S:
            case OP.I32X4_EXTMUL_LOW_I16X8_S:
            case OP.I32X4_EXTMUL_HIGH_I16X8_S:
            case OP.I32X4_EXTMUL_LOW_I16X8_U:
            case OP.I32X4_EXTMUL_HIGH_I16X8_U:
            case OP.I64X2_ABS:
            case OP.I64X2_NEG:
            case OP.I64X2_ALL_TRUE:
            case OP.I64X2_BITMASK:
            case OP.I64X2_EXTEND_LOW_I32X4_S:
            case OP.I64X2_EXTEND_HIGH_I32X4_S:
            case OP.I64X2_EXTEND_LOW_I32X4_U:
            case OP.I64X2_EXTEND_HIGH_I32X4_U:
            case OP.I64X2_SHL:
            case OP.I64X2_SHR_S:
            case OP.I64X2_SHR_U:
            case OP.I64X2_ADD:
            case OP.I64X2_SUB:
            case OP.I64X2_MUL:
            case OP.I64X2_EQ:
            case OP.I64X2_NE:
            case OP.I64X2_LT_S:
            case OP.I64X2_GT_S:
            case OP.I64X2_LE_S:
            case OP.I64X2_GE_S:
            case OP.I64X2_EXTMUL_LOW_I32X4_S:
            case OP.I64X2_EXTMUL_HIGH_I32X4_S:
            case OP.I64X2_EXTMUL_LOW_I32X4_U:
            case OP.I64X2_EXTMUL_HIGH_I32X4_U:
            case OP.F32X4_ABS:
            case OP.F32X4_NEG:
            case OP.F32X4_SQRT:
            case OP.F32X4_ADD:
            case OP.F32X4_SUB:
            case OP.F32X4_MUL:
            case OP.F32X4_DIV:
            case OP.F32X4_MIN:
            case OP.F32X4_MAX:
            case OP.F32X4_PMIN:
            case OP.F32X4_PMAX:
            case OP.F64X2_ABS:
            case OP.F64X2_NEG:
            case OP.F64X2_SQRT:
            case OP.F64X2_ADD:
            case OP.F64X2_SUB:
            case OP.F64X2_MUL:
            case OP.F64X2_DIV:
            case OP.F64X2_MIN:
            case OP.F64X2_MAX:
            case OP.F64X2_PMIN:
            case OP.F64X2_PMAX:
            case OP.I32X4_TRUNC_SAT_F32X4_S:
            case OP.I32X4_TRUNC_SAT_F32X4_U:
            case OP.F32X4_CONVERT_I32X4_S:
            case OP.F32X4_CONVERT_I32X4_U:
            case OP.I32X4_TRUNC_SAT_F64X2_S_ZERO:
            case OP.I32X4_TRUNC_SAT_F64X2_U_ZERO:
            case OP.F64X2_CONVERT_LOW_I32X4_S:
            case OP.F64X2_CONVERT_LOW_I32X4_U: { // no immediate
                break;
            }

            // -- End of source code generated with help of "gen-instr.ts" script --

            default:
                throw new Error(opcode.toString(16));
        }

        if (instr === null) {
            instr = { opcode } as WasmInstr;
        }

        return [last, instr];
    }

    createInstrWithBlock(opcode: WasmInstrWithBlockOP, type: FunctionType, parentBlock: WasmBlock | undefined): WasmInstrWithBlock {
        let instr: WasmInstrWithBlock = { opcode, block: allowTemporaryNull as WasmBlock };
        instr.block = new WasmBlock(type, instr, parentBlock);
        return instr;
    }

    // instructions.html#binary-blocktype
    parseCompressedBlockType(input: BinaryInput): FunctionType {
        let firstByte = input.peekByte();
        if (firstByte == 0x40) {
            input.byte();
            return { params: [], results: [] };
        } else if ((firstByte & 0xC0) == 0x40) {
            input.byte();
            return { params: [], results: [enumize(firstByte, ValueTypeObject)] };
        } else {
            let index = input.s32();
            return pick(this.types, index, 'Type index out of range.');
        }
    }

    // modules.html#binary-tablesec
    parseTableSection(input: BinaryInput) {
        let count = input.u32();
        for (let i = 0; i < count; i++) {
            // types.html#binary-tabletype
            let type = enumize<RefType>(input.byte(), RefType);
            let limits = this.parseLimits(input);
            let table = new WasmTable(type, limits);
            this.module.addTable(table);
        }
    }

    parseMemorySection(input: BinaryInput) {
    }

    // types.html#binary-limits
    parseLimits(input: BinaryInput): Limits {
        let kind = enumize<LimitKind>(input.byte(), LimitKind);
        let min = input.u32();
        let max = Infinity;
        if (kind == LimitKind.LIMITED) {
            max = input.u32();
        }
        return { min, max };
    }

    // modules.html#binary-funcsec
    parseFunctionSection(input: BinaryInput) {
        this.firstNonImportFunction = this.module.functions.length;
        let count = input.u32();
        for (let i = 0; i < count; i++) {
            let type = this.getType(input.u32());
            let func = new WasmFunction(WasmFunctionKind.WASM, type);
            this.module.addFunction(func);
        }
    }

    // modules.html#binary-importsec
    private parseImportSection(input: BinaryInput) {
        let count = input.u32();
        for (let i = 0; i < count; i++) {
            let module = input.str();
            let name = input.str();
            let imp = { module, name };
            let kind = enumize<EntityKind>(input.byte(), EntityKind);
            switch (kind) {
                case EntityKind.FUNCTION: {
                    let type = this.getType(input.u32());
                    let func = new WasmFunction(WasmFunctionKind.IMPORT, type);
                    if (module === TRIVM_MAGIC_FUNCTION_TAG) {
                        this.parseMagicFunction(func, name);
                    } else {
                        func.import = imp;
                    }
                    this.module.addFunction(func);
                    break;
                }
                case EntityKind.MEMORY: {
                    // types.html#binary-memtype
                    let limits = this.parseLimits(input);
                    let memory = new WasmMemory(limits);
                    memory.import = imp;
                    this.module.addMemory(memory);
                    break;
                }
                default:
                    throw new Error(kind.toString());
                    break;
            }
        }
    }

    private static magicFunctionElement(name: string, separator: string = ':'): [string, string] {
        let first = name.split(separator, 1)[0];
        let second = first.substring(first.length + 1);
        return [first, second];
    }

    private parseMagicFunction(func: WasmFunction, name: string): void {
        let [id, args] = WasmParser.magicFunctionElement(name);
        switch (id) {
            case 'annotation':
                func.kind = WasmFunctionKind.ANNOTATION;
                func.data = args;
                break;
            case 'unused':
                func.kind = WasmFunctionKind.UNUSED;
                break;
            case 'aux_stack_pointer_detector':
                func.kind = WasmFunctionKind.UNUSED;
                this.module.stackPointerDetector = func;
                break;
            case 'assembly': {
                let [options, content] = WasmParser.magicFunctionElement(args);
                func.kind = WasmFunctionKind.ASSEMBLY;
                func.data = content;
                for (let [key, value] of options.split(',').map(x => WasmParser.magicFunctionElement(x, '='))) {
                    if (key === 'inline' && value === '') {
                        func.kind = WasmFunctionKind.INLINE_ASSEMBLY;
                    } else if (key === 'export' && value !== '') {
                        func.exports.push(value);
                    } else {
                        throw new Error('Invalid assembly function option: ' + key);
                    }
                }
                break;
            }
            default:
                throw new Error(`Unknown triVM magic function: ${id}`);
        }
    }

    getType(index: number): FunctionType {
        if (index >= this.types.length) {
            throw new Error("Undefined function type index.");
        }
        return this.types[index];
    }

    // modules.html#type-section
    private parseTypeSection(input: BinaryInput) {
        let count = input.u32();
        for (let i = 0; i < count; i++) {
            let funcTypeStart = input.byte();
            if (funcTypeStart != Consts.FUNCTION_TYPE_START) {
                throw new Error('Invalid function type start');
            }
            let vectors: ValueType[][] = [[], []];
            for (let j = 0; j < 2; j++) {
                let paramCount = input.u32();
                for (let k = 0; k < paramCount; k++) {
                    vectors[j][k] = enumize(input.byte(), ValueTypeObject);
                }
            }
            let ft: FunctionType = {
                params: vectors[0],
                results: vectors[1]
            }
            this.types.push(ft);
        }
        console.log(this.types);
    }

}
