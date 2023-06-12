import { platform } from "../utils/platform";
import { OP } from "./opcodes";
import { FunctionType, Limits, NumberType, RefType, ValueType, ValueTypeObject, VectorType, WasmBlock, WasmData, WasmElement, WasmEntity, WasmExport, WasmFunction, WasmFunctionKind, WasmGlobal, WasmImport, WasmInstr, WasmInstrBr, WasmInstrEnd, WasmInstrIndexed, WasmInstrWithBlock, WasmMemory, WasmModule, WasmTable, valueTypeWords } from "./wasmModule";

export enum ModuleStage {
    AfterParser,
    AfterResolver,
    AfterReducer,
};

interface StackEntry {
    type: ValueType;
    part: number;
    prev?: StackEntry;
}

export class ModuleDebug {

    private out: string[] = []
    private refs: Map<any, string> = new Map<any, string>();
    private usedRefs: Set<string> = new Set<string>();
    private stack: StackEntry[] = [];
    private popStack: StackEntry[] = [];
    private pushStack: StackEntry[] = [];
    private blockStack: WasmBlock[] = [];
    private func?: WasmFunction;

    constructor(
        private module: WasmModule,
        private stage: ModuleStage
    ) { }

    public examine() {

        this.out = ['<html><head><link rel="stylesheet" href="style.css" type="text/css" /><script type="text/javascript" src="debug.js"></script></head><body>'];

        for (let mem of this.module.memories) {
            this.examineMem(mem)
        }

        for (let func of this.module.functions) {
            this.examineFunc(func)
        }

        platform.writeFile('out.html', new TextEncoder().encode(this.out.join('')));
    }

    examineFunc(func: WasmFunction) {
        this.func = func;
        this.stack = [];
        this.blockStack = [];
        let ref = this.getRef(func);
        this.out.push('<div class="f">');
        this.printIndex(func.index);
        let ret = func.type.results.length == 0 ? 'void ' : func.type.results.map(x => ValueTypeObject[x]).join(', ') + ' ';
        let params = func.type.params.map(x => ValueTypeObject[x]).join(', ');
        this.out.push(`<div class="lbl" id="${ref}">${ret}${ref} (${params})</div>`);
        this.printImport(func.import);
        for (let exp of func.exports) {
            this.printExport(exp);
        }
        if (func.resolved != func) {
            throw new Error('Not implemented');
        }
        switch (func.kind) {
            case WasmFunctionKind.WASM:
                this.out.push(`<div class="kind">wasm</div>`);
                break;
            case WasmFunctionKind.WASM_TYPE_UNKNOWN:
                this.out.push(`<div class="kind">wasm (unknown return type)</div>`);
                break;
            case WasmFunctionKind.IMPORT:
                this.out.push(`<div class="kind">import</div>`);
                break;
            case WasmFunctionKind.INLINE_ASSEMBLY:
                this.out.push(`<div class="kind">inline assembly</div>`);
                this.printAssembly(func.data);
                break;
            case WasmFunctionKind.ASSEMBLY:
                this.out.push(`<div class="kind">assembly</div>`);
                this.printAssembly(func.data);
                break;
            case WasmFunctionKind.ANNOTATION:
                this.out.push(`<div class="kind">annotation</div>`);
                this.printAssembly(func.data);
                break;
            default:
                throw new Error(`Not implemented ${func.kind}`);
        }
        if (func.locals.length > 0) {
            this.out.push(`<div class="break"></div>`);
            for (let i = 0; i < func.locals.length; i++) {
                this.out.push(`<div class="loc">${func.type.params.length + i}: ${ValueTypeObject[func.locals[i]]}</div>`);
            }
        }
        switch (func.kind) {
            case WasmFunctionKind.WASM:
            case WasmFunctionKind.WASM_TYPE_UNKNOWN:
                this.printBody(func.block);
                break;
            default:
                break;
        }
        this.out.push(`</div>`);
    }

    printBody(block?: WasmBlock) {
        if (!block) {
            return;
        }
        this.out.push(`<div class="break"></div>`);
        this.out.push(`<div class="body">`);
        this.printInstruction(block.parentInstruction);
        this.out.push(`</div>`);
    }

    printInstruction(instr: WasmInstr) {

        this.popStack = [];
        this.pushStack = [];

        let outStackIndex = -1;

        switch (instr.opcode) {

            // -- Begin of source code generated with help of "gen-instr.ts" script --

            case OP.UNREACHABLE: {
                this.printInstrName(instr, 'unreachable');
                // TODO: custom pop types
                // TODO: custom push types
                break;
            }
            case OP.NOP: {
                this.printInstrName(instr, 'nop');
                break;
            }
            case OP.BLOCK: {
                this.printInstrName(instr, 'block', true);
                outStackIndex = this.out.length;
                this.dumpInstrBlock(instr);
                break;
            }
            case OP.LOOP: {
                this.printInstrName(instr, 'loop', true);
                outStackIndex = this.out.length;
                this.dumpInstrBlock(instr);
                break;
            }
            case OP.IF: {
                this.printInstrName(instr, 'if', true);
                outStackIndex = this.out.length;
                this.dumpInstrBlock(instr);
                break;
            }
            case OP.ELSE: {
                this.printInstrName(instr, 'else');
                this.dumpInstrEnd(instr);
                break;
            }
            case OP.END: {
                this.printInstrName(instr, 'end');
                this.dumpInstrEnd(instr);
                break;
            }
            case OP.BR: {
                this.printInstrName(instr, 'br');
                this.dumpInstrTarget(instr);
                break;
            }
            case OP.BR_IF: {
                this.printInstrName(instr, 'br_if');
                this.dumpInstrTarget(instr);
                break;
            }
            case OP.BR_TABLE: {
                this.printInstrName(instr, 'br_table');
                // TODO: custom pop types
                // TODO: custom push types
                break;
            }
            case OP.RETURN: {
                this.printInstrName(instr, 'return');
                // TODO: custom pop types
                // TODO: custom push types
                break;
            }
            case OP.CALL: {
                this.printInstrName(instr, 'call');
                let func = instr.func;
                let ref = this.getRef(func);
                this.out.push(` <a href="#${ref}">${ref}</a>`);
                if (func != func.resolved) {
                    func = func.resolved;
                    ref = this.getRef(func);
                    this.out.push(` -&gt; <a href="#${ref}">${ref}</a>`);
                }
                this.pop(...func.type.params);
                this.push(...func.type.results);
                break;
            }
            case OP.CALL_INDIRECT: {
                this.printInstrName(instr, 'call_indirect');
                let table = instr.table;
                let ref = this.getRef(table);
                this.out.push(` <a href="#${ref}">${ref}</a>`);
                this.pop(NumberType.I32);
                this.pop(...instr.type.params);
                this.push(...instr.type.results);
                break;
            }
            case OP.DROP: {
                this.printInstrName(instr, 'drop');
                let entry = this.stack.at(-1);
                this.pop(entry!.type);
                break;
            }
            case OP.SELECT: {
                this.printInstrName(instr, 'select');
                this.pop(NumberType.I32);
                let entry = this.stack.at(-1);
                this.pop(entry!.type);
                this.pop(entry!.type);
                this.push(entry!.type);
                break;
            }
            case OP.SELECT_T: {
                this.printInstrName(instr, 'select_t');
                this.pop(NumberType.I32);
                let entry = this.stack.at(-1);
                this.pop(entry!.type);
                this.pop(entry!.type);
                this.push(entry!.type);
                break;
            }
            case OP.LOCAL_GET: {
                this.printInstrName(instr, 'local.get');
                let type = this.printLocal(instr);
                this.push(type);
                break;
            }
            case OP.LOCAL_SET: {
                this.printInstrName(instr, 'local.set');
                let type = this.printLocal(instr);
                this.pop(type);
                break;
            }
            case OP.LOCAL_TEE: {
                this.printInstrName(instr, 'local.tee');
                let type = this.printLocal(instr);
                this.pop(type);
                this.push(type);
                break;
            }
            case OP.GLOBAL_GET: {
                this.printInstrName(instr, 'global.get');
                this.push(instr.global.type);
                break;
            }
            case OP.GLOBAL_SET: {
                this.printInstrName(instr, 'global.set');
                this.pop(instr.global.type);
                break;
            }
            case OP.TABLE_GET: {
                this.printInstrName(instr, 'table.get');
                this.pop(NumberType.I32);
                // TODO: custom push types
                break;
            }
            case OP.TABLE_SET: {
                this.printInstrName(instr, 'table.set');
                // TODO: custom pop types
                break;
            }
            case OP.I32_LOAD: {
                this.printInstrName(instr, 'i32.load');
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_LOAD: {
                this.printInstrName(instr, 'i64.load');
                this.pop(NumberType.I32);
                this.push(NumberType.I64);
                break;
            }
            case OP.F32_LOAD: {
                this.printInstrName(instr, 'f32.load');
                this.pop(NumberType.I32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F64_LOAD: {
                this.printInstrName(instr, 'f64.load');
                this.pop(NumberType.I32);
                this.push(NumberType.F64);
                break;
            }
            case OP.I32_LOAD8_S: {
                this.printInstrName(instr, 'i32.load8_s');
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_LOAD8_U: {
                this.printInstrName(instr, 'i32.load8_u');
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_LOAD16_S: {
                this.printInstrName(instr, 'i32.load16_s');
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_LOAD16_U: {
                this.printInstrName(instr, 'i32.load16_u');
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_LOAD8_S: {
                this.printInstrName(instr, 'i64.load8_s');
                this.pop(NumberType.I32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_LOAD8_U: {
                this.printInstrName(instr, 'i64.load8_u');
                this.pop(NumberType.I32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_LOAD16_S: {
                this.printInstrName(instr, 'i64.load16_s');
                this.pop(NumberType.I32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_LOAD16_U: {
                this.printInstrName(instr, 'i64.load16_u');
                this.pop(NumberType.I32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_LOAD32_S: {
                this.printInstrName(instr, 'i64.load32_s');
                this.pop(NumberType.I32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_LOAD32_U: {
                this.printInstrName(instr, 'i64.load32_u');
                this.pop(NumberType.I32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I32_STORE: {
                this.printInstrName(instr, 'i32.store');
                this.pop(NumberType.I32, NumberType.I32);
                break;
            }
            case OP.I64_STORE: {
                this.printInstrName(instr, 'i64.store');
                this.pop(NumberType.I32, NumberType.I64);
                break;
            }
            case OP.F32_STORE: {
                this.printInstrName(instr, 'f32.store');
                this.pop(NumberType.I32, NumberType.F32);
                break;
            }
            case OP.F64_STORE: {
                this.printInstrName(instr, 'f64.store');
                this.pop(NumberType.I32, NumberType.F64);
                break;
            }
            case OP.I32_STORE8: {
                this.printInstrName(instr, 'i32.store8');
                this.pop(NumberType.I32, NumberType.I32);
                break;
            }
            case OP.I32_STORE16: {
                this.printInstrName(instr, 'i32.store16');
                this.pop(NumberType.I32, NumberType.I32);
                break;
            }
            case OP.I64_STORE8: {
                this.printInstrName(instr, 'i64.store8');
                this.pop(NumberType.I32, NumberType.I64);
                break;
            }
            case OP.I64_STORE16: {
                this.printInstrName(instr, 'i64.store16');
                this.pop(NumberType.I32, NumberType.I64);
                break;
            }
            case OP.I64_STORE32: {
                this.printInstrName(instr, 'i64.store32');
                this.pop(NumberType.I32, NumberType.I64);
                break;
            }
            case OP.MEMORY_SIZE: {
                this.printInstrName(instr, 'memory.size');
                this.push(NumberType.I32);
                break;
            }
            case OP.MEMORY_GROW: {
                this.printInstrName(instr, 'memory.grow');
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_CONST: {
                this.printInstrName(instr, 'i32.const');
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_CONST: {
                this.printInstrName(instr, 'i64.const');
                this.push(NumberType.I64);
                break;
            }
            case OP.F32_CONST: {
                this.printInstrName(instr, 'f32.const');
                this.push(NumberType.F32);
                break;
            }
            case OP.F64_CONST: {
                this.printInstrName(instr, 'f64.const');
                this.push(NumberType.F64);
                break;
            }
            case OP.I32_EQZ: {
                this.printInstrName(instr, 'i32.eqz');
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_EQ: {
                this.printInstrName(instr, 'i32.eq');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_NE: {
                this.printInstrName(instr, 'i32.ne');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_LT_S: {
                this.printInstrName(instr, 'i32.lt_s');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_LT_U: {
                this.printInstrName(instr, 'i32.lt_u');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_GT_S: {
                this.printInstrName(instr, 'i32.gt_s');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_GT_U: {
                this.printInstrName(instr, 'i32.gt_u');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_LE_S: {
                this.printInstrName(instr, 'i32.le_s');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_LE_U: {
                this.printInstrName(instr, 'i32.le_u');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_GE_S: {
                this.printInstrName(instr, 'i32.ge_s');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_GE_U: {
                this.printInstrName(instr, 'i32.ge_u');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_EQZ: {
                this.printInstrName(instr, 'i64.eqz');
                this.pop(NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_EQ: {
                this.printInstrName(instr, 'i64.eq');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_NE: {
                this.printInstrName(instr, 'i64.ne');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_LT_S: {
                this.printInstrName(instr, 'i64.lt_s');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_LT_U: {
                this.printInstrName(instr, 'i64.lt_u');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_GT_S: {
                this.printInstrName(instr, 'i64.gt_s');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_GT_U: {
                this.printInstrName(instr, 'i64.gt_u');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_LE_S: {
                this.printInstrName(instr, 'i64.le_s');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_LE_U: {
                this.printInstrName(instr, 'i64.le_u');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_GE_S: {
                this.printInstrName(instr, 'i64.ge_s');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_GE_U: {
                this.printInstrName(instr, 'i64.ge_u');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.F32_EQ: {
                this.printInstrName(instr, 'f32.eq');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.F32_NE: {
                this.printInstrName(instr, 'f32.ne');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.F32_LT: {
                this.printInstrName(instr, 'f32.lt');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.F32_GT: {
                this.printInstrName(instr, 'f32.gt');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.F32_LE: {
                this.printInstrName(instr, 'f32.le');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.F32_GE: {
                this.printInstrName(instr, 'f32.ge');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.F64_EQ: {
                this.printInstrName(instr, 'f64.eq');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.I32);
                break;
            }
            case OP.F64_NE: {
                this.printInstrName(instr, 'f64.ne');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.I32);
                break;
            }
            case OP.F64_LT: {
                this.printInstrName(instr, 'f64.lt');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.I32);
                break;
            }
            case OP.F64_GT: {
                this.printInstrName(instr, 'f64.gt');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.I32);
                break;
            }
            case OP.F64_LE: {
                this.printInstrName(instr, 'f64.le');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.I32);
                break;
            }
            case OP.F64_GE: {
                this.printInstrName(instr, 'f64.ge');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_CLZ: {
                this.printInstrName(instr, 'i32.clz');
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_CTZ: {
                this.printInstrName(instr, 'i32.ctz');
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_POPCNT: {
                this.printInstrName(instr, 'i32.popcnt');
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_ADD: {
                this.printInstrName(instr, 'i32.add');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_SUB: {
                this.printInstrName(instr, 'i32.sub');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_MUL: {
                this.printInstrName(instr, 'i32.mul');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_DIV_S: {
                this.printInstrName(instr, 'i32.div_s');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_DIV_U: {
                this.printInstrName(instr, 'i32.div_u');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_REM_S: {
                this.printInstrName(instr, 'i32.rem_s');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_REM_U: {
                this.printInstrName(instr, 'i32.rem_u');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_AND: {
                this.printInstrName(instr, 'i32.and');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_OR: {
                this.printInstrName(instr, 'i32.or');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_XOR: {
                this.printInstrName(instr, 'i32.xor');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_SHL: {
                this.printInstrName(instr, 'i32.shl');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_SHR_S: {
                this.printInstrName(instr, 'i32.shr_s');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_SHR_U: {
                this.printInstrName(instr, 'i32.shr_u');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_ROTL: {
                this.printInstrName(instr, 'i32.rotl');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_ROTR: {
                this.printInstrName(instr, 'i32.rotr');
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_CLZ: {
                this.printInstrName(instr, 'i64.clz');
                this.pop(NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_CTZ: {
                this.printInstrName(instr, 'i64.ctz');
                this.pop(NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_POPCNT: {
                this.printInstrName(instr, 'i64.popcnt');
                this.pop(NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_ADD: {
                this.printInstrName(instr, 'i64.add');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_SUB: {
                this.printInstrName(instr, 'i64.sub');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_MUL: {
                this.printInstrName(instr, 'i64.mul');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_DIV_S: {
                this.printInstrName(instr, 'i64.div_s');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_DIV_U: {
                this.printInstrName(instr, 'i64.div_u');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_REM_S: {
                this.printInstrName(instr, 'i64.rem_s');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_REM_U: {
                this.printInstrName(instr, 'i64.rem_u');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_AND: {
                this.printInstrName(instr, 'i64.and');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_OR: {
                this.printInstrName(instr, 'i64.or');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_XOR: {
                this.printInstrName(instr, 'i64.xor');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_SHL: {
                this.printInstrName(instr, 'i64.shl');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_SHR_S: {
                this.printInstrName(instr, 'i64.shr_s');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_SHR_U: {
                this.printInstrName(instr, 'i64.shr_u');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_ROTL: {
                this.printInstrName(instr, 'i64.rotl');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_ROTR: {
                this.printInstrName(instr, 'i64.rotr');
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.F32_ABS: {
                this.printInstrName(instr, 'f32.abs');
                this.pop(NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_NEG: {
                this.printInstrName(instr, 'f32.neg');
                this.pop(NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_CEIL: {
                this.printInstrName(instr, 'f32.ceil');
                this.pop(NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_FLOOR: {
                this.printInstrName(instr, 'f32.floor');
                this.pop(NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_TRUNC: {
                this.printInstrName(instr, 'f32.trunc');
                this.pop(NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_NEAREST: {
                this.printInstrName(instr, 'f32.nearest');
                this.pop(NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_SQRT: {
                this.printInstrName(instr, 'f32.sqrt');
                this.pop(NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_ADD: {
                this.printInstrName(instr, 'f32.add');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_SUB: {
                this.printInstrName(instr, 'f32.sub');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_MUL: {
                this.printInstrName(instr, 'f32.mul');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_DIV: {
                this.printInstrName(instr, 'f32.div');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_MIN: {
                this.printInstrName(instr, 'f32.min');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_MAX: {
                this.printInstrName(instr, 'f32.max');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_COPYSIGN: {
                this.printInstrName(instr, 'f32.copysign');
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F64_ABS: {
                this.printInstrName(instr, 'f64.abs');
                this.pop(NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_NEG: {
                this.printInstrName(instr, 'f64.neg');
                this.pop(NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_CEIL: {
                this.printInstrName(instr, 'f64.ceil');
                this.pop(NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_FLOOR: {
                this.printInstrName(instr, 'f64.floor');
                this.pop(NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_TRUNC: {
                this.printInstrName(instr, 'f64.trunc');
                this.pop(NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_NEAREST: {
                this.printInstrName(instr, 'f64.nearest');
                this.pop(NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_SQRT: {
                this.printInstrName(instr, 'f64.sqrt');
                this.pop(NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_ADD: {
                this.printInstrName(instr, 'f64.add');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_SUB: {
                this.printInstrName(instr, 'f64.sub');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_MUL: {
                this.printInstrName(instr, 'f64.mul');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_DIV: {
                this.printInstrName(instr, 'f64.div');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_MIN: {
                this.printInstrName(instr, 'f64.min');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_MAX: {
                this.printInstrName(instr, 'f64.max');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_COPYSIGN: {
                this.printInstrName(instr, 'f64.copysign');
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.I32_WRAP_I64: {
                this.printInstrName(instr, 'i32.wrap_i64');
                this.pop(NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_TRUNC_F32_S: {
                this.printInstrName(instr, 'i32.trunc_f32_s');
                this.pop(NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_TRUNC_F32_U: {
                this.printInstrName(instr, 'i32.trunc_f32_u');
                this.pop(NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_TRUNC_F64_S: {
                this.printInstrName(instr, 'i32.trunc_f64_s');
                this.pop(NumberType.F64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_TRUNC_F64_U: {
                this.printInstrName(instr, 'i32.trunc_f64_u');
                this.pop(NumberType.F64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_EXTEND_I32_S: {
                this.printInstrName(instr, 'i64.extend_i32_s');
                this.pop(NumberType.I32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_EXTEND_I32_U: {
                this.printInstrName(instr, 'i64.extend_i32_u');
                this.pop(NumberType.I32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_TRUNC_F32_S: {
                this.printInstrName(instr, 'i64.trunc_f32_s');
                this.pop(NumberType.F32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_TRUNC_F32_U: {
                this.printInstrName(instr, 'i64.trunc_f32_u');
                this.pop(NumberType.F32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_TRUNC_F64_S: {
                this.printInstrName(instr, 'i64.trunc_f64_s');
                this.pop(NumberType.F64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_TRUNC_F64_U: {
                this.printInstrName(instr, 'i64.trunc_f64_u');
                this.pop(NumberType.F64);
                this.push(NumberType.I64);
                break;
            }
            case OP.F32_CONVERT_I32_S: {
                this.printInstrName(instr, 'f32.convert_i32_s');
                this.pop(NumberType.I32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_CONVERT_I32_U: {
                this.printInstrName(instr, 'f32.convert_i32_u');
                this.pop(NumberType.I32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_CONVERT_I64_S: {
                this.printInstrName(instr, 'f32.convert_i64_s');
                this.pop(NumberType.I64);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_CONVERT_I64_U: {
                this.printInstrName(instr, 'f32.convert_i64_u');
                this.pop(NumberType.I64);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_DEMOTE_F64: {
                this.printInstrName(instr, 'f32.demote_f64');
                this.pop(NumberType.F64);
                this.push(NumberType.F32);
                break;
            }
            case OP.F64_CONVERT_I32_S: {
                this.printInstrName(instr, 'f64.convert_i32_s');
                this.pop(NumberType.I32);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_CONVERT_I32_U: {
                this.printInstrName(instr, 'f64.convert_i32_u');
                this.pop(NumberType.I32);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_CONVERT_I64_S: {
                this.printInstrName(instr, 'f64.convert_i64_s');
                this.pop(NumberType.I64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_CONVERT_I64_U: {
                this.printInstrName(instr, 'f64.convert_i64_u');
                this.pop(NumberType.I64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_PROMOTE_F32: {
                this.printInstrName(instr, 'f64.promote_f32');
                this.pop(NumberType.F32);
                this.push(NumberType.F64);
                break;
            }
            case OP.I32_REINTERPRET_F32: {
                this.printInstrName(instr, 'i32.reinterpret_f32');
                this.pop(NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_REINTERPRET_F64: {
                this.printInstrName(instr, 'i64.reinterpret_f64');
                this.pop(NumberType.F64);
                this.push(NumberType.I64);
                break;
            }
            case OP.F32_REINTERPRET_I32: {
                this.printInstrName(instr, 'f32.reinterpret_i32');
                this.pop(NumberType.I32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F64_REINTERPRET_I64: {
                this.printInstrName(instr, 'f64.reinterpret_i64');
                this.pop(NumberType.I64);
                this.push(NumberType.F64);
                break;
            }
            case OP.I32_EXTEND8_S: {
                this.printInstrName(instr, 'i32.extend8_s');
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_EXTEND16_S: {
                this.printInstrName(instr, 'i32.extend16_s');
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_EXTEND8_S: {
                this.printInstrName(instr, 'i64.extend8_s');
                this.pop(NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_EXTEND16_S: {
                this.printInstrName(instr, 'i64.extend16_s');
                this.pop(NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_EXTEND32_S: {
                this.printInstrName(instr, 'i64.extend32_s');
                this.pop(NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.REF_NULL: {
                this.printInstrName(instr, 'ref.null');
                // TODO: custom push types
                break;
            }
            case OP.REF_IS_NULL: {
                this.printInstrName(instr, 'ref.is_null');
                // TODO: custom pop types
                this.push(NumberType.I32);
                break;
            }
            case OP.REF_FUNC: {
                this.printInstrName(instr, 'ref.func');
                this.push(RefType.FUNCREF);
                break;
            }
            case OP.I32_TRUNC_SAT_F32_S: {
                this.printInstrName(instr, 'i32.trunc_sat_f32_s');
                this.pop(NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_TRUNC_SAT_F32_U: {
                this.printInstrName(instr, 'i32.trunc_sat_f32_u');
                this.pop(NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_TRUNC_SAT_F64_S: {
                this.printInstrName(instr, 'i32.trunc_sat_f64_s');
                this.pop(NumberType.F64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_TRUNC_SAT_F64_U: {
                this.printInstrName(instr, 'i32.trunc_sat_f64_u');
                this.pop(NumberType.F64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_TRUNC_SAT_F32_S: {
                this.printInstrName(instr, 'i64.trunc_sat_f32_s');
                this.pop(NumberType.F32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_TRUNC_SAT_F32_U: {
                this.printInstrName(instr, 'i64.trunc_sat_f32_u');
                this.pop(NumberType.F32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_TRUNC_SAT_F64_S: {
                this.printInstrName(instr, 'i64.trunc_sat_f64_s');
                this.pop(NumberType.F64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_TRUNC_SAT_F64_U: {
                this.printInstrName(instr, 'i64.trunc_sat_f64_u');
                this.pop(NumberType.F64);
                this.push(NumberType.I64);
                break;
            }
            case OP.MEMORY_INIT: {
                this.printInstrName(instr, 'memory.init');
                this.pop(NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.DATA_DROP: {
                this.printInstrName(instr, 'data.drop');
                break;
            }
            case OP.MEMORY_COPY: {
                this.printInstrName(instr, 'memory.copy');
                this.pop(NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.MEMORY_FILL: {
                this.printInstrName(instr, 'memory.fill');
                this.pop(NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.TABLE_INIT: {
                this.printInstrName(instr, 'table.init');
                this.pop(NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.ELEM_DROP: {
                this.printInstrName(instr, 'elem.drop');
                break;
            }
            case OP.TABLE_COPY: {
                this.printInstrName(instr, 'table.copy');
                this.pop(NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.TABLE_GROW: {
                this.printInstrName(instr, 'table.grow');
                // TODO: custom pop types
                this.push(NumberType.I32);
                break;
            }
            case OP.TABLE_SIZE: {
                this.printInstrName(instr, 'table.size');
                this.push(NumberType.I32);
                break;
            }
            case OP.TABLE_FILL: {
                this.printInstrName(instr, 'table.fill');
                // TODO: custom pop types
                break;
            }
            case OP.V128_LOAD: {
                this.printInstrName(instr, 'v128.load');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD8X8_S: {
                this.printInstrName(instr, 'v128.load8x8_s');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD8X8_U: {
                this.printInstrName(instr, 'v128.load8x8_u');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD16X4_S: {
                this.printInstrName(instr, 'v128.load16x4_s');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD16X4_U: {
                this.printInstrName(instr, 'v128.load16x4_u');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD32X2_S: {
                this.printInstrName(instr, 'v128.load32x2_s');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD32X2_U: {
                this.printInstrName(instr, 'v128.load32x2_u');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD8_SPLAT: {
                this.printInstrName(instr, 'v128.load8_splat');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD16_SPLAT: {
                this.printInstrName(instr, 'v128.load16_splat');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD32_SPLAT: {
                this.printInstrName(instr, 'v128.load32_splat');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD64_SPLAT: {
                this.printInstrName(instr, 'v128.load64_splat');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_STORE: {
                this.printInstrName(instr, 'v128.store');
                this.pop(NumberType.I32, VectorType.V128);
                break;
            }
            case OP.V128_CONST: {
                this.printInstrName(instr, 'v128.const');
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_SHUFFLE: {
                this.printInstrName(instr, 'i8x16.shuffle');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_SWIZZLE: {
                this.printInstrName(instr, 'i8x16.swizzle');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_SPLAT: {
                this.printInstrName(instr, 'i8x16.splat');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_SPLAT: {
                this.printInstrName(instr, 'i16x8.splat');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_SPLAT: {
                this.printInstrName(instr, 'i32x4.splat');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_SPLAT: {
                this.printInstrName(instr, 'i64x2.splat');
                this.pop(NumberType.I64);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_SPLAT: {
                this.printInstrName(instr, 'f32x4.splat');
                this.pop(NumberType.F32);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_SPLAT: {
                this.printInstrName(instr, 'f64x2.splat');
                this.pop(NumberType.F64);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_EXTRACT_LANE_S: {
                this.printInstrName(instr, 'i8x16.extract_lane_s');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I8X16_EXTRACT_LANE_U: {
                this.printInstrName(instr, 'i8x16.extract_lane_u');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I8X16_REPLACE_LANE: {
                this.printInstrName(instr, 'i8x16.replace_lane');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTRACT_LANE_S: {
                this.printInstrName(instr, 'i16x8.extract_lane_s');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I16X8_EXTRACT_LANE_U: {
                this.printInstrName(instr, 'i16x8.extract_lane_u');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I16X8_REPLACE_LANE: {
                this.printInstrName(instr, 'i16x8.replace_lane');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTRACT_LANE: {
                this.printInstrName(instr, 'i32x4.extract_lane');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32X4_REPLACE_LANE: {
                this.printInstrName(instr, 'i32x4.replace_lane');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTRACT_LANE: {
                this.printInstrName(instr, 'i64x2.extract_lane');
                this.pop(VectorType.V128);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64X2_REPLACE_LANE: {
                this.printInstrName(instr, 'i64x2.replace_lane');
                this.pop(VectorType.V128, NumberType.I64);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_EXTRACT_LANE: {
                this.printInstrName(instr, 'f32x4.extract_lane');
                this.pop(VectorType.V128);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32X4_REPLACE_LANE: {
                this.printInstrName(instr, 'f32x4.replace_lane');
                this.pop(VectorType.V128, NumberType.F32);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_EXTRACT_LANE: {
                this.printInstrName(instr, 'f64x2.extract_lane');
                this.pop(VectorType.V128);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64X2_REPLACE_LANE: {
                this.printInstrName(instr, 'f64x2.replace_lane');
                this.pop(VectorType.V128, NumberType.F64);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_EQ: {
                this.printInstrName(instr, 'i8x16.eq');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_NE: {
                this.printInstrName(instr, 'i8x16.ne');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_LT_S: {
                this.printInstrName(instr, 'i8x16.lt_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_LT_U: {
                this.printInstrName(instr, 'i8x16.lt_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_GT_S: {
                this.printInstrName(instr, 'i8x16.gt_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_GT_U: {
                this.printInstrName(instr, 'i8x16.gt_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_LE_S: {
                this.printInstrName(instr, 'i8x16.le_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_LE_U: {
                this.printInstrName(instr, 'i8x16.le_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_GE_S: {
                this.printInstrName(instr, 'i8x16.ge_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_GE_U: {
                this.printInstrName(instr, 'i8x16.ge_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EQ: {
                this.printInstrName(instr, 'i16x8.eq');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_NE: {
                this.printInstrName(instr, 'i16x8.ne');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_LT_S: {
                this.printInstrName(instr, 'i16x8.lt_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_LT_U: {
                this.printInstrName(instr, 'i16x8.lt_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_GT_S: {
                this.printInstrName(instr, 'i16x8.gt_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_GT_U: {
                this.printInstrName(instr, 'i16x8.gt_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_LE_S: {
                this.printInstrName(instr, 'i16x8.le_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_LE_U: {
                this.printInstrName(instr, 'i16x8.le_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_GE_S: {
                this.printInstrName(instr, 'i16x8.ge_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_GE_U: {
                this.printInstrName(instr, 'i16x8.ge_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_EQ: {
                this.printInstrName(instr, 'i32x4.eq');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_NE: {
                this.printInstrName(instr, 'i32x4.ne');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_LT_S: {
                this.printInstrName(instr, 'i32x4.lt_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_LT_U: {
                this.printInstrName(instr, 'i32x4.lt_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_GT_S: {
                this.printInstrName(instr, 'i32x4.gt_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_GT_U: {
                this.printInstrName(instr, 'i32x4.gt_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_LE_S: {
                this.printInstrName(instr, 'i32x4.le_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_LE_U: {
                this.printInstrName(instr, 'i32x4.le_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_GE_S: {
                this.printInstrName(instr, 'i32x4.ge_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_GE_U: {
                this.printInstrName(instr, 'i32x4.ge_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_EQ: {
                this.printInstrName(instr, 'f32x4.eq');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_NE: {
                this.printInstrName(instr, 'f32x4.ne');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_LT: {
                this.printInstrName(instr, 'f32x4.lt');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_GT: {
                this.printInstrName(instr, 'f32x4.gt');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_LE: {
                this.printInstrName(instr, 'f32x4.le');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_GE: {
                this.printInstrName(instr, 'f32x4.ge');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_EQ: {
                this.printInstrName(instr, 'f64x2.eq');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_NE: {
                this.printInstrName(instr, 'f64x2.ne');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_LT: {
                this.printInstrName(instr, 'f64x2.lt');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_GT: {
                this.printInstrName(instr, 'f64x2.gt');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_LE: {
                this.printInstrName(instr, 'f64x2.le');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_GE: {
                this.printInstrName(instr, 'f64x2.ge');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_NOT: {
                this.printInstrName(instr, 'v128.not');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_AND: {
                this.printInstrName(instr, 'v128.and');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_ANDNOT: {
                this.printInstrName(instr, 'v128.andnot');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_OR: {
                this.printInstrName(instr, 'v128.or');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_XOR: {
                this.printInstrName(instr, 'v128.xor');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_BITSELECT: {
                this.printInstrName(instr, 'v128.bitselect');
                this.pop(VectorType.V128, VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_ANY_TRUE: {
                this.printInstrName(instr, 'v128.any_true');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.V128_LOAD8_LANE: {
                this.printInstrName(instr, 'v128.load8_lane');
                this.pop(NumberType.I32, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD16_LANE: {
                this.printInstrName(instr, 'v128.load16_lane');
                this.pop(NumberType.I32, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD32_LANE: {
                this.printInstrName(instr, 'v128.load32_lane');
                this.pop(NumberType.I32, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD64_LANE: {
                this.printInstrName(instr, 'v128.load64_lane');
                this.pop(NumberType.I32, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_STORE8_LANE: {
                this.printInstrName(instr, 'v128.store8_lane');
                this.pop(NumberType.I32, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_STORE16_LANE: {
                this.printInstrName(instr, 'v128.store16_lane');
                this.pop(NumberType.I32, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_STORE32_LANE: {
                this.printInstrName(instr, 'v128.store32_lane');
                this.pop(NumberType.I32, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_STORE64_LANE: {
                this.printInstrName(instr, 'v128.store64_lane');
                this.pop(NumberType.I32, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD32_ZERO: {
                this.printInstrName(instr, 'v128.load32_zero');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD64_ZERO: {
                this.printInstrName(instr, 'v128.load64_zero');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_DEMOTE_F64X2_ZERO: {
                this.printInstrName(instr, 'f32x4.demote_f64x2_zero');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_PROMOTE_LOW_F32X4: {
                this.printInstrName(instr, 'f64x2.promote_low_f32x4');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_ABS: {
                this.printInstrName(instr, 'i8x16.abs');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_NEG: {
                this.printInstrName(instr, 'i8x16.neg');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_POPCNT: {
                this.printInstrName(instr, 'i8x16.popcnt');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_ALL_TRUE: {
                this.printInstrName(instr, 'i8x16.all_true');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I8X16_BITMASK: {
                this.printInstrName(instr, 'i8x16.bitmask');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I8X16_NARROW_I16X8_S: {
                this.printInstrName(instr, 'i8x16.narrow_i16x8_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_NARROW_I16X8_U: {
                this.printInstrName(instr, 'i8x16.narrow_i16x8_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_CEIL: {
                this.printInstrName(instr, 'f32x4.ceil');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_FLOOR: {
                this.printInstrName(instr, 'f32x4.floor');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_TRUNC: {
                this.printInstrName(instr, 'f32x4.trunc');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_NEAREST: {
                this.printInstrName(instr, 'f32x4.nearest');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_SHL: {
                this.printInstrName(instr, 'i8x16.shl');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_SHR_S: {
                this.printInstrName(instr, 'i8x16.shr_s');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_SHR_U: {
                this.printInstrName(instr, 'i8x16.shr_u');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_ADD: {
                this.printInstrName(instr, 'i8x16.add');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_ADD_SAT_S: {
                this.printInstrName(instr, 'i8x16.add_sat_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_ADD_SAT_U: {
                this.printInstrName(instr, 'i8x16.add_sat_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_SUB: {
                this.printInstrName(instr, 'i8x16.sub');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_SUB_SAT_S: {
                this.printInstrName(instr, 'i8x16.sub_sat_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_SUB_SAT_U: {
                this.printInstrName(instr, 'i8x16.sub_sat_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_CEIL: {
                this.printInstrName(instr, 'f64x2.ceil');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_FLOOR: {
                this.printInstrName(instr, 'f64x2.floor');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_MIN_S: {
                this.printInstrName(instr, 'i8x16.min_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_MIN_U: {
                this.printInstrName(instr, 'i8x16.min_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_MAX_S: {
                this.printInstrName(instr, 'i8x16.max_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_MAX_U: {
                this.printInstrName(instr, 'i8x16.max_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_TRUNC: {
                this.printInstrName(instr, 'f64x2.trunc');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_AVGR_U: {
                this.printInstrName(instr, 'i8x16.avgr_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTADD_PAIRWISE_I8X16_S: {
                this.printInstrName(instr, 'i16x8.extadd_pairwise_i8x16_s');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTADD_PAIRWISE_I8X16_U: {
                this.printInstrName(instr, 'i16x8.extadd_pairwise_i8x16_u');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTADD_PAIRWISE_I16X8_S: {
                this.printInstrName(instr, 'i32x4.extadd_pairwise_i16x8_s');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTADD_PAIRWISE_I16X8_U: {
                this.printInstrName(instr, 'i32x4.extadd_pairwise_i16x8_u');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_ABS: {
                this.printInstrName(instr, 'i16x8.abs');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_NEG: {
                this.printInstrName(instr, 'i16x8.neg');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_Q15MULR_SAT_S: {
                this.printInstrName(instr, 'i16x8.q15mulr_sat_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_ALL_TRUE: {
                this.printInstrName(instr, 'i16x8.all_true');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I16X8_BITMASK: {
                this.printInstrName(instr, 'i16x8.bitmask');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I16X8_NARROW_I32X4_S: {
                this.printInstrName(instr, 'i16x8.narrow_i32x4_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_NARROW_I32X4_U: {
                this.printInstrName(instr, 'i16x8.narrow_i32x4_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTEND_LOW_I8X16_S: {
                this.printInstrName(instr, 'i16x8.extend_low_i8x16_s');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTEND_HIGH_I8X16_S: {
                this.printInstrName(instr, 'i16x8.extend_high_i8x16_s');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTEND_LOW_I8X16_U: {
                this.printInstrName(instr, 'i16x8.extend_low_i8x16_u');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTEND_HIGH_I8X16_U: {
                this.printInstrName(instr, 'i16x8.extend_high_i8x16_u');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_SHL: {
                this.printInstrName(instr, 'i16x8.shl');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_SHR_S: {
                this.printInstrName(instr, 'i16x8.shr_s');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_SHR_U: {
                this.printInstrName(instr, 'i16x8.shr_u');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_ADD: {
                this.printInstrName(instr, 'i16x8.add');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_ADD_SAT_S: {
                this.printInstrName(instr, 'i16x8.add_sat_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_ADD_SAT_U: {
                this.printInstrName(instr, 'i16x8.add_sat_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_SUB: {
                this.printInstrName(instr, 'i16x8.sub');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_SUB_SAT_S: {
                this.printInstrName(instr, 'i16x8.sub_sat_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_SUB_SAT_U: {
                this.printInstrName(instr, 'i16x8.sub_sat_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_NEAREST: {
                this.printInstrName(instr, 'f64x2.nearest');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_MUL: {
                this.printInstrName(instr, 'i16x8.mul');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_MIN_S: {
                this.printInstrName(instr, 'i16x8.min_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_MIN_U: {
                this.printInstrName(instr, 'i16x8.min_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_MAX_S: {
                this.printInstrName(instr, 'i16x8.max_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_MAX_U: {
                this.printInstrName(instr, 'i16x8.max_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_AVGR_U: {
                this.printInstrName(instr, 'i16x8.avgr_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTMUL_LOW_I8X16_S: {
                this.printInstrName(instr, 'i16x8.extmul_low_i8x16_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTMUL_HIGH_I8X16_S: {
                this.printInstrName(instr, 'i16x8.extmul_high_i8x16_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTMUL_LOW_I8X16_U: {
                this.printInstrName(instr, 'i16x8.extmul_low_i8x16_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTMUL_HIGH_I8X16_U: {
                this.printInstrName(instr, 'i16x8.extmul_high_i8x16_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_ABS: {
                this.printInstrName(instr, 'i32x4.abs');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_NEG: {
                this.printInstrName(instr, 'i32x4.neg');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_ALL_TRUE: {
                this.printInstrName(instr, 'i32x4.all_true');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32X4_BITMASK: {
                this.printInstrName(instr, 'i32x4.bitmask');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32X4_EXTEND_LOW_I16X8_S: {
                this.printInstrName(instr, 'i32x4.extend_low_i16x8_s');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTEND_HIGH_I16X8_S: {
                this.printInstrName(instr, 'i32x4.extend_high_i16x8_s');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTEND_LOW_I16X8_U: {
                this.printInstrName(instr, 'i32x4.extend_low_i16x8_u');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTEND_HIGH_I16X8_U: {
                this.printInstrName(instr, 'i32x4.extend_high_i16x8_u');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_SHL: {
                this.printInstrName(instr, 'i32x4.shl');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_SHR_S: {
                this.printInstrName(instr, 'i32x4.shr_s');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_SHR_U: {
                this.printInstrName(instr, 'i32x4.shr_u');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_ADD: {
                this.printInstrName(instr, 'i32x4.add');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_SUB: {
                this.printInstrName(instr, 'i32x4.sub');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_MUL: {
                this.printInstrName(instr, 'i32x4.mul');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_MIN_S: {
                this.printInstrName(instr, 'i32x4.min_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_MIN_U: {
                this.printInstrName(instr, 'i32x4.min_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_MAX_S: {
                this.printInstrName(instr, 'i32x4.max_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_MAX_U: {
                this.printInstrName(instr, 'i32x4.max_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_DOT_I16X8_S: {
                this.printInstrName(instr, 'i32x4.dot_i16x8_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTMUL_LOW_I16X8_S: {
                this.printInstrName(instr, 'i32x4.extmul_low_i16x8_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTMUL_HIGH_I16X8_S: {
                this.printInstrName(instr, 'i32x4.extmul_high_i16x8_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTMUL_LOW_I16X8_U: {
                this.printInstrName(instr, 'i32x4.extmul_low_i16x8_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTMUL_HIGH_I16X8_U: {
                this.printInstrName(instr, 'i32x4.extmul_high_i16x8_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_ABS: {
                this.printInstrName(instr, 'i64x2.abs');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_NEG: {
                this.printInstrName(instr, 'i64x2.neg');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_ALL_TRUE: {
                this.printInstrName(instr, 'i64x2.all_true');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64X2_BITMASK: {
                this.printInstrName(instr, 'i64x2.bitmask');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64X2_EXTEND_LOW_I32X4_S: {
                this.printInstrName(instr, 'i64x2.extend_low_i32x4_s');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTEND_HIGH_I32X4_S: {
                this.printInstrName(instr, 'i64x2.extend_high_i32x4_s');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTEND_LOW_I32X4_U: {
                this.printInstrName(instr, 'i64x2.extend_low_i32x4_u');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTEND_HIGH_I32X4_U: {
                this.printInstrName(instr, 'i64x2.extend_high_i32x4_u');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_SHL: {
                this.printInstrName(instr, 'i64x2.shl');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_SHR_S: {
                this.printInstrName(instr, 'i64x2.shr_s');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_SHR_U: {
                this.printInstrName(instr, 'i64x2.shr_u');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_ADD: {
                this.printInstrName(instr, 'i64x2.add');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_SUB: {
                this.printInstrName(instr, 'i64x2.sub');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_MUL: {
                this.printInstrName(instr, 'i64x2.mul');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_EQ: {
                this.printInstrName(instr, 'i64x2.eq');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_NE: {
                this.printInstrName(instr, 'i64x2.ne');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_LT_S: {
                this.printInstrName(instr, 'i64x2.lt_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_GT_S: {
                this.printInstrName(instr, 'i64x2.gt_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_LE_S: {
                this.printInstrName(instr, 'i64x2.le_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_GE_S: {
                this.printInstrName(instr, 'i64x2.ge_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTMUL_LOW_I32X4_S: {
                this.printInstrName(instr, 'i64x2.extmul_low_i32x4_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTMUL_HIGH_I32X4_S: {
                this.printInstrName(instr, 'i64x2.extmul_high_i32x4_s');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTMUL_LOW_I32X4_U: {
                this.printInstrName(instr, 'i64x2.extmul_low_i32x4_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTMUL_HIGH_I32X4_U: {
                this.printInstrName(instr, 'i64x2.extmul_high_i32x4_u');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_ABS: {
                this.printInstrName(instr, 'f32x4.abs');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_NEG: {
                this.printInstrName(instr, 'f32x4.neg');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_SQRT: {
                this.printInstrName(instr, 'f32x4.sqrt');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_ADD: {
                this.printInstrName(instr, 'f32x4.add');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_SUB: {
                this.printInstrName(instr, 'f32x4.sub');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_MUL: {
                this.printInstrName(instr, 'f32x4.mul');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_DIV: {
                this.printInstrName(instr, 'f32x4.div');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_MIN: {
                this.printInstrName(instr, 'f32x4.min');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_MAX: {
                this.printInstrName(instr, 'f32x4.max');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_PMIN: {
                this.printInstrName(instr, 'f32x4.pmin');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_PMAX: {
                this.printInstrName(instr, 'f32x4.pmax');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_ABS: {
                this.printInstrName(instr, 'f64x2.abs');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_NEG: {
                this.printInstrName(instr, 'f64x2.neg');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_SQRT: {
                this.printInstrName(instr, 'f64x2.sqrt');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_ADD: {
                this.printInstrName(instr, 'f64x2.add');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_SUB: {
                this.printInstrName(instr, 'f64x2.sub');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_MUL: {
                this.printInstrName(instr, 'f64x2.mul');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_DIV: {
                this.printInstrName(instr, 'f64x2.div');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_MIN: {
                this.printInstrName(instr, 'f64x2.min');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_MAX: {
                this.printInstrName(instr, 'f64x2.max');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_PMIN: {
                this.printInstrName(instr, 'f64x2.pmin');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_PMAX: {
                this.printInstrName(instr, 'f64x2.pmax');
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_TRUNC_SAT_F32X4_S: {
                this.printInstrName(instr, 'i32x4.trunc_sat_f32x4_s');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_TRUNC_SAT_F32X4_U: {
                this.printInstrName(instr, 'i32x4.trunc_sat_f32x4_u');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_CONVERT_I32X4_S: {
                this.printInstrName(instr, 'f32x4.convert_i32x4_s');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_CONVERT_I32X4_U: {
                this.printInstrName(instr, 'f32x4.convert_i32x4_u');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_TRUNC_SAT_F64X2_S_ZERO: {
                this.printInstrName(instr, 'i32x4.trunc_sat_f64x2_s_zero');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_TRUNC_SAT_F64X2_U_ZERO: {
                this.printInstrName(instr, 'i32x4.trunc_sat_f64x2_u_zero');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_CONVERT_LOW_I32X4_S: {
                this.printInstrName(instr, 'f64x2.convert_low_i32x4_s');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_CONVERT_LOW_I32X4_U: {
                this.printInstrName(instr, 'f64x2.convert_low_i32x4_u');
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.TRIVM_MULTIBYTE_FIRST: {
                this.printInstrName(instr, 'TRIVM.MULTIBYTE_FIRST');
                break;
            }
            case OP.TRIVM_FUNCTION: {
                this.printInstrName(instr, 'TRIVM.FUNCTION', true);
                outStackIndex = this.out.length;
                this.dumpInstrBlock(instr);
                break;
            }
            case OP.TRIVM_POP: {
                this.printInstrName(instr, 'TRIVM.POP');
                break;
            }
            case OP.TRIVM_DUP32: {
                this.printInstrName(instr, 'TRIVM.DUP32');
                break;
            }
            case OP.TRIVM_DUP64: {
                this.printInstrName(instr, 'TRIVM.DUP64');
                break;
            }
            case OP.TRIVM_LOCAL_GET32: {
                this.printInstrName(instr, 'TRIVM.LOCAL_GET32');
                break;
            }
            case OP.TRIVM_LOCAL_GET64: {
                this.printInstrName(instr, 'TRIVM.LOCAL_GET64');
                break;
            }
            case OP.TRIVM_LOCAL_SET32: {
                this.printInstrName(instr, 'TRIVM.LOCAL_SET32');
                break;
            }
            case OP.TRIVM_LOCAL_SET64: {
                this.printInstrName(instr, 'TRIVM.LOCAL_SET64');
                break;
            }

            // -- End of source code generated with help of "gen-instr.ts" script --
        }

        if (outStackIndex > 0) {
            this.out.splice(outStackIndex, 0, ...this.getStack());
        } else {
            this.out.push(...this.getStack());
        }
        this.out.push(`</div>`);
    }

    dumpInstrTarget(instr: WasmInstrBr) {
        if (instr.opcode == OP.BR_IF) {
            this.pop(NumberType.I32);
        }
        let target = instr.target;
        let forward = target.parentInstruction.opcode != OP.LOOP;
        let popTypes: ValueType[];
        if (forward) {
            popTypes = target.type.results;
        } else {
            popTypes = target.type.params;
        }
        let oldEntries = this.pop(...popTypes);
        this.stack.push(...oldEntries);
        this.pushStack.push(...oldEntries);
    }

    dumpInstrEnd(instr: WasmInstrEnd) {
        if (instr.unreachable) {
            this.out.push(` (unreachable)`);
        } else {
            let block = this.blockStack.at(-1);
            this.pop(...block!.type.results);
            this.popStack.unshift(...this.stack);
            this.stack = [];
            if (instr.opcode == OP.ELSE) {
                this.push(...block!.type.params);
            }
        }
        this.out.push(`<div class="else"></div>`);
    }

    printLocal(instr: WasmInstrIndexed) {
        this.assert(instr.index >= 0 && instr.index < this.func!.locals.length + this.func!.type.params.length);
        let type: ValueType;
        if (instr.index < this.func!.type.params.length) {
            type = this.func!.type.params[instr.index];
            this.out.push(` <span class="loc">param${instr.index}:${ValueTypeObject[type]}</span>`);
        } else {
            type = this.func!.locals[instr.index - this.func!.type.params.length];
            this.out.push(` <span class="loc">local${instr.index}:${ValueTypeObject[type]}</span>`);
        }
        return type;
    }

    assert(condition: boolean) {
        if (!condition) {
            throw new Error("ASSERTION FAILED");
        }
    }

    printInstrName(instr: WasmInstr, name: string, isBlock: boolean = false) {
        if (isBlock) {
            this.out.push(`<div class="instr"><span class="name clickable" onclick="collapse(this)">${name}</span>`);
        } else {
            this.out.push(`<div class="instr"><span class="name">${name}</span>`);
        }
    }

    getStack(): string[] {
        let out: string[] = [];
        if (this.stack.length > 20 || this.popStack.length + this.pushStack.length == 0) {
            return [];
        }
        out.push(' ');
        for (let i = 0; i < this.stack.length - this.pushStack.length; i++) {
            let entry = this.stack[i];
            out.push(...this.getStackEntry(entry, false));
        }
        for (let entry of this.popStack) {
            out.push(...this.getStackEntry(entry, true, ' stack-pop'));
        }
        for (let i = this.stack.length - this.pushStack.length; i < this.stack.length; i++) {
            let entry = this.stack[i];
            out.push(...this.getStackEntry(entry, false, ' stack-push'));
        }
        return out;
    }

    formatEntry(entry: StackEntry) {
        if (valueTypeWords(entry.type) > 1) {
            return `${ValueTypeObject[entry.type]}:${entry.part}`;
        } else {
            return ValueTypeObject[entry.type];
        }
    }

    getStackEntry(entry: StackEntry, showPrevious: boolean, cls: string = ''): string[] {
        let out: string[] = [];
        if (showPrevious && entry.prev && (entry.prev.type != entry.type || entry.prev.part != entry.part)) {
            out.push(`<span class="stack-entry${cls}"><span class="stack-prev">${this.formatEntry(entry.prev)}</span>${this.formatEntry(entry)}</span>`);
        } else {
            out.push(`<span class="stack-entry${cls}">${this.formatEntry(entry)}</span>`);
        }
        return out;
    }

    pop(...types: ValueType[]) {
        let out: StackEntry[] = [];
        for (let type of types.reverse()) {
            switch (type) {
                case NumberType.I32:
                case NumberType.F32:
                case RefType.EXTERNREF:
                case RefType.FUNCREF:
                    out.push(this.popItem(type, 0));
                    break;
                case NumberType.I64:
                case NumberType.F64:
                    out.push(this.popItem(type, 1));
                    out.push(this.popItem(type, 0));
                    break;
                case VectorType.V128:
                    out.push(this.popItem(type, 3));
                    out.push(this.popItem(type, 2));
                    out.push(this.popItem(type, 1));
                    out.push(this.popItem(type, 0));
                    break;
                default:
                    throw new Error('Assert');
            }
        }
        return out.reverse();
    }

    popItem(type: ValueType, part: number) {
        let prev = this.stack.pop();
        this.popStack.unshift({ type, part, prev });
        return prev || { type: NumberType.I32, part: 0 }; // TODO: fail if undefined
    }

    push(...types: ValueType[]) {
        for (let type of types) {
            switch (type) {
                case NumberType.I32:
                case NumberType.F32:
                case RefType.EXTERNREF:
                case RefType.FUNCREF:
                    this.pushItem(type, 0);
                    break;
                case NumberType.I64:
                case NumberType.F64:
                    this.pushItem(type, 0);
                    this.pushItem(type, 1);
                    break;
                case VectorType.V128:
                    this.pushItem(type, 0);
                    this.pushItem(type, 1);
                    this.pushItem(type, 2);
                    this.pushItem(type, 3);
                    break;
                default:
                    throw new Error(`Assert ${type}`);
            }
        }
    }

    pushItem(type: ValueType, part: number) {
        this.stack.push({ type, part })
        this.pushStack.push({ type, part })
    }

    getValue32(value: number) {
        let dec: bigint;
        let value2 = BigInt(value) & 0xFFFFFFFFn;
        if (value2 & 0x80000000n) {
            dec = value2 - 0x100000000n;
        } else {
            dec = value2;
        }
        let hex = '00000000' + value2.toString(16);
        hex = hex.substring(hex.length - 8);
        return `${dec} (0x${hex})`;
    }

    getValue64(value: bigint) {
        let dec: bigint;
        value &= 0xFFFFFFFFFFFFFFFFn;
        if (value & 0x8000000000000000n) {
            dec = value - 0x10000000000000000n;
        } else {
            dec = value;
        }
        let hex = '0000000000000000' + value.toString(16);
        hex = hex.substring(hex.length - 16);
        return `${dec} (0x${hex})`;
    }

    dumpInstrBlock(instr: WasmInstrWithBlock) {
        let block = instr.block;
        if (instr.opcode != OP.TRIVM_FUNCTION) {
            if (instr.opcode == OP.IF) {
                this.pop(NumberType.I32);
            }
            this.pop(...block.type.params);
            this.push(...block.type.results);
        }
        let tmp = [this.stack, this.popStack, this.pushStack];
        this.stack = [];
        this.popStack = [];
        this.pushStack = [];
        this.blockStack.push(block);
        this.out.push(' &nbsp; ' + this.getType(block.type));
        this.out.push(`<div class="block" onclick="goToBlockTop(event)">`);
        for (let instr of block.body) {
            this.printInstruction(instr);
        }
        this.out.push(`</div>`);
        this.blockStack.pop();
        [this.stack, this.popStack, this.pushStack] = tmp;
    }

    getType(type: FunctionType): string {
        let ret = type.results.length == 0 ? 'void' :
            type.results.length == 1 ? ValueTypeObject[type.results[0]] :
                '(' + type.results.map(x => ValueTypeObject[x]).join(', ') + ')';
        let params = type.params.map(x => ValueTypeObject[x]).join(', ');
        return `(${params}) -&gt; ${ret}`;
    }

    escapeHtml(text: string | undefined): string {
        return (text || '')
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    printAssembly(data: string | undefined) {
        this.out.push(`<div class="break"></div>`);
        this.out.push(`<pre class="code">${this.escapeHtml(data)}</pre>`);
    }

    getRef(obj: any): string {
        let prefix = 'obj-';
        if (obj instanceof WasmFunction) {
            prefix = 'func';
        } else if (obj instanceof WasmMemory) {
            prefix = 'memory';
        } else if (obj instanceof WasmTable) {
            prefix = 'table';
        } else if (obj instanceof WasmData) {
            prefix = 'data';
        } else if (obj instanceof WasmElement) {
            prefix = 'element';
        } else if (obj instanceof WasmGlobal) {
            prefix = 'global';
        } else {
            throw new Error(`Not implemented`);
        }
        if (!this.refs.has(obj)) {
            let name: string | undefined = undefined;
            let postfix: string | number = '';
            let ref: string;
            if (obj instanceof WasmEntity) {
                name = obj.exports.length > 0 ? obj.exports.at(-1)!.name :
                    obj.import ? obj.import.module + '.' + obj.import.name :
                        undefined;
            }
            if (!name) {
                postfix = -1;
            }
            do {
                if (name) {
                    ref = prefix + '-';
                    ref += name.replace(/[^a-z0-9_-]/gi, '_');
                    ref += postfix;
                } else {
                    ref = prefix;
                    ref += postfix;
                }
                postfix = 1 * (postfix as any) - 1;
            } while (this.usedRefs.has(ref.toLowerCase()));
            this.usedRefs.add(ref.toLowerCase());
            this.refs.set(obj, ref);
        }
        return this.refs.get(obj) as string;
    }

    private examineMem(mem: WasmMemory) {
        let ref = this.getRef(mem);
        this.out.push(mem.deleted ? `<div class="m del">` : `<div class="m">`);
        this.printIndex(mem.index);
        this.out.push(`<div class="lbl" id="${ref}">${ref}</div>`);
        this.printLimits(mem.limits, 64, 'KB');
        this.printImport(mem.import);
        for (let exp of mem.exports) {
            this.printExport(exp);
        }
        this.out.push(`</div>`);
    }

    private printExport(exp: WasmExport) {
        if (!exp.name.startsWith('__trivm_magic_function__')) {
            this.out.push(`<div class="exp"><span class="module">${exp.module}</span><span class="name">${exp.name}</span></div>`);
        }
    }

    private printImport(imp?: WasmImport) {
        if (imp && !imp.name.startsWith('__trivm_magic_function__')) {
            this.out.push(`<div class="imp"><span class="module">${imp.module}</span><span class="name">${imp.name}</span></div>`);
        }
    }

    private printLimits(limits: Limits, mul: number = 1, unit: string = '') {
        this.out.push(`<div class="lim">${limits.min * mul}${unit} ÷ ${limits.max == Infinity ? '∞' : (limits.max * mul) + unit}</div>`);
    }

    private printIndex(index: number) {
        this.out.push(`<div class="idx">${index}</div>`);
    }

};


const INSTRUCTION_NAME: { [key in OP]: string } = {
    // -- Instruction names - begin of source code generated with help of "gen-instr.ts" script --

    [OP.UNREACHABLE]: 'unreachable',
    [OP.NOP]: 'nop',
    [OP.BLOCK]: 'block',
    [OP.LOOP]: 'loop',
    [OP.IF]: 'if',
    [OP.ELSE]: 'else',
    [OP.END]: 'end',
    [OP.BR]: 'br',
    [OP.BR_IF]: 'br_if',
    [OP.BR_TABLE]: 'br_table',
    [OP.RETURN]: 'return',
    [OP.CALL]: 'call',
    [OP.CALL_INDIRECT]: 'call_indirect',
    [OP.DROP]: 'drop',
    [OP.SELECT]: 'select',
    [OP.SELECT_T]: 'select_t',
    [OP.LOCAL_GET]: 'local.get',
    [OP.LOCAL_SET]: 'local.set',
    [OP.LOCAL_TEE]: 'local.tee',
    [OP.GLOBAL_GET]: 'global.get',
    [OP.GLOBAL_SET]: 'global.set',
    [OP.TABLE_GET]: 'table.get',
    [OP.TABLE_SET]: 'table.set',
    [OP.I32_LOAD]: 'i32.load',
    [OP.I64_LOAD]: 'i64.load',
    [OP.F32_LOAD]: 'f32.load',
    [OP.F64_LOAD]: 'f64.load',
    [OP.I32_LOAD8_S]: 'i32.load8_s',
    [OP.I32_LOAD8_U]: 'i32.load8_u',
    [OP.I32_LOAD16_S]: 'i32.load16_s',
    [OP.I32_LOAD16_U]: 'i32.load16_u',
    [OP.I64_LOAD8_S]: 'i64.load8_s',
    [OP.I64_LOAD8_U]: 'i64.load8_u',
    [OP.I64_LOAD16_S]: 'i64.load16_s',
    [OP.I64_LOAD16_U]: 'i64.load16_u',
    [OP.I64_LOAD32_S]: 'i64.load32_s',
    [OP.I64_LOAD32_U]: 'i64.load32_u',
    [OP.I32_STORE]: 'i32.store',
    [OP.I64_STORE]: 'i64.store',
    [OP.F32_STORE]: 'f32.store',
    [OP.F64_STORE]: 'f64.store',
    [OP.I32_STORE8]: 'i32.store8',
    [OP.I32_STORE16]: 'i32.store16',
    [OP.I64_STORE8]: 'i64.store8',
    [OP.I64_STORE16]: 'i64.store16',
    [OP.I64_STORE32]: 'i64.store32',
    [OP.MEMORY_SIZE]: 'memory.size',
    [OP.MEMORY_GROW]: 'memory.grow',
    [OP.I32_CONST]: 'i32.const',
    [OP.I64_CONST]: 'i64.const',
    [OP.F32_CONST]: 'f32.const',
    [OP.F64_CONST]: 'f64.const',
    [OP.I32_EQZ]: 'i32.eqz',
    [OP.I32_EQ]: 'i32.eq',
    [OP.I32_NE]: 'i32.ne',
    [OP.I32_LT_S]: 'i32.lt_s',
    [OP.I32_LT_U]: 'i32.lt_u',
    [OP.I32_GT_S]: 'i32.gt_s',
    [OP.I32_GT_U]: 'i32.gt_u',
    [OP.I32_LE_S]: 'i32.le_s',
    [OP.I32_LE_U]: 'i32.le_u',
    [OP.I32_GE_S]: 'i32.ge_s',
    [OP.I32_GE_U]: 'i32.ge_u',
    [OP.I64_EQZ]: 'i64.eqz',
    [OP.I64_EQ]: 'i64.eq',
    [OP.I64_NE]: 'i64.ne',
    [OP.I64_LT_S]: 'i64.lt_s',
    [OP.I64_LT_U]: 'i64.lt_u',
    [OP.I64_GT_S]: 'i64.gt_s',
    [OP.I64_GT_U]: 'i64.gt_u',
    [OP.I64_LE_S]: 'i64.le_s',
    [OP.I64_LE_U]: 'i64.le_u',
    [OP.I64_GE_S]: 'i64.ge_s',
    [OP.I64_GE_U]: 'i64.ge_u',
    [OP.F32_EQ]: 'f32.eq',
    [OP.F32_NE]: 'f32.ne',
    [OP.F32_LT]: 'f32.lt',
    [OP.F32_GT]: 'f32.gt',
    [OP.F32_LE]: 'f32.le',
    [OP.F32_GE]: 'f32.ge',
    [OP.F64_EQ]: 'f64.eq',
    [OP.F64_NE]: 'f64.ne',
    [OP.F64_LT]: 'f64.lt',
    [OP.F64_GT]: 'f64.gt',
    [OP.F64_LE]: 'f64.le',
    [OP.F64_GE]: 'f64.ge',
    [OP.I32_CLZ]: 'i32.clz',
    [OP.I32_CTZ]: 'i32.ctz',
    [OP.I32_POPCNT]: 'i32.popcnt',
    [OP.I32_ADD]: 'i32.add',
    [OP.I32_SUB]: 'i32.sub',
    [OP.I32_MUL]: 'i32.mul',
    [OP.I32_DIV_S]: 'i32.div_s',
    [OP.I32_DIV_U]: 'i32.div_u',
    [OP.I32_REM_S]: 'i32.rem_s',
    [OP.I32_REM_U]: 'i32.rem_u',
    [OP.I32_AND]: 'i32.and',
    [OP.I32_OR]: 'i32.or',
    [OP.I32_XOR]: 'i32.xor',
    [OP.I32_SHL]: 'i32.shl',
    [OP.I32_SHR_S]: 'i32.shr_s',
    [OP.I32_SHR_U]: 'i32.shr_u',
    [OP.I32_ROTL]: 'i32.rotl',
    [OP.I32_ROTR]: 'i32.rotr',
    [OP.I64_CLZ]: 'i64.clz',
    [OP.I64_CTZ]: 'i64.ctz',
    [OP.I64_POPCNT]: 'i64.popcnt',
    [OP.I64_ADD]: 'i64.add',
    [OP.I64_SUB]: 'i64.sub',
    [OP.I64_MUL]: 'i64.mul',
    [OP.I64_DIV_S]: 'i64.div_s',
    [OP.I64_DIV_U]: 'i64.div_u',
    [OP.I64_REM_S]: 'i64.rem_s',
    [OP.I64_REM_U]: 'i64.rem_u',
    [OP.I64_AND]: 'i64.and',
    [OP.I64_OR]: 'i64.or',
    [OP.I64_XOR]: 'i64.xor',
    [OP.I64_SHL]: 'i64.shl',
    [OP.I64_SHR_S]: 'i64.shr_s',
    [OP.I64_SHR_U]: 'i64.shr_u',
    [OP.I64_ROTL]: 'i64.rotl',
    [OP.I64_ROTR]: 'i64.rotr',
    [OP.F32_ABS]: 'f32.abs',
    [OP.F32_NEG]: 'f32.neg',
    [OP.F32_CEIL]: 'f32.ceil',
    [OP.F32_FLOOR]: 'f32.floor',
    [OP.F32_TRUNC]: 'f32.trunc',
    [OP.F32_NEAREST]: 'f32.nearest',
    [OP.F32_SQRT]: 'f32.sqrt',
    [OP.F32_ADD]: 'f32.add',
    [OP.F32_SUB]: 'f32.sub',
    [OP.F32_MUL]: 'f32.mul',
    [OP.F32_DIV]: 'f32.div',
    [OP.F32_MIN]: 'f32.min',
    [OP.F32_MAX]: 'f32.max',
    [OP.F32_COPYSIGN]: 'f32.copysign',
    [OP.F64_ABS]: 'f64.abs',
    [OP.F64_NEG]: 'f64.neg',
    [OP.F64_CEIL]: 'f64.ceil',
    [OP.F64_FLOOR]: 'f64.floor',
    [OP.F64_TRUNC]: 'f64.trunc',
    [OP.F64_NEAREST]: 'f64.nearest',
    [OP.F64_SQRT]: 'f64.sqrt',
    [OP.F64_ADD]: 'f64.add',
    [OP.F64_SUB]: 'f64.sub',
    [OP.F64_MUL]: 'f64.mul',
    [OP.F64_DIV]: 'f64.div',
    [OP.F64_MIN]: 'f64.min',
    [OP.F64_MAX]: 'f64.max',
    [OP.F64_COPYSIGN]: 'f64.copysign',
    [OP.I32_WRAP_I64]: 'i32.wrap_i64',
    [OP.I32_TRUNC_F32_S]: 'i32.trunc_f32_s',
    [OP.I32_TRUNC_F32_U]: 'i32.trunc_f32_u',
    [OP.I32_TRUNC_F64_S]: 'i32.trunc_f64_s',
    [OP.I32_TRUNC_F64_U]: 'i32.trunc_f64_u',
    [OP.I64_EXTEND_I32_S]: 'i64.extend_i32_s',
    [OP.I64_EXTEND_I32_U]: 'i64.extend_i32_u',
    [OP.I64_TRUNC_F32_S]: 'i64.trunc_f32_s',
    [OP.I64_TRUNC_F32_U]: 'i64.trunc_f32_u',
    [OP.I64_TRUNC_F64_S]: 'i64.trunc_f64_s',
    [OP.I64_TRUNC_F64_U]: 'i64.trunc_f64_u',
    [OP.F32_CONVERT_I32_S]: 'f32.convert_i32_s',
    [OP.F32_CONVERT_I32_U]: 'f32.convert_i32_u',
    [OP.F32_CONVERT_I64_S]: 'f32.convert_i64_s',
    [OP.F32_CONVERT_I64_U]: 'f32.convert_i64_u',
    [OP.F32_DEMOTE_F64]: 'f32.demote_f64',
    [OP.F64_CONVERT_I32_S]: 'f64.convert_i32_s',
    [OP.F64_CONVERT_I32_U]: 'f64.convert_i32_u',
    [OP.F64_CONVERT_I64_S]: 'f64.convert_i64_s',
    [OP.F64_CONVERT_I64_U]: 'f64.convert_i64_u',
    [OP.F64_PROMOTE_F32]: 'f64.promote_f32',
    [OP.I32_REINTERPRET_F32]: 'i32.reinterpret_f32',
    [OP.I64_REINTERPRET_F64]: 'i64.reinterpret_f64',
    [OP.F32_REINTERPRET_I32]: 'f32.reinterpret_i32',
    [OP.F64_REINTERPRET_I64]: 'f64.reinterpret_i64',
    [OP.I32_EXTEND8_S]: 'i32.extend8_s',
    [OP.I32_EXTEND16_S]: 'i32.extend16_s',
    [OP.I64_EXTEND8_S]: 'i64.extend8_s',
    [OP.I64_EXTEND16_S]: 'i64.extend16_s',
    [OP.I64_EXTEND32_S]: 'i64.extend32_s',
    [OP.REF_NULL]: 'ref.null',
    [OP.REF_IS_NULL]: 'ref.is_null',
    [OP.REF_FUNC]: 'ref.func',
    [OP.I32_TRUNC_SAT_F32_S]: 'i32.trunc_sat_f32_s',
    [OP.I32_TRUNC_SAT_F32_U]: 'i32.trunc_sat_f32_u',
    [OP.I32_TRUNC_SAT_F64_S]: 'i32.trunc_sat_f64_s',
    [OP.I32_TRUNC_SAT_F64_U]: 'i32.trunc_sat_f64_u',
    [OP.I64_TRUNC_SAT_F32_S]: 'i64.trunc_sat_f32_s',
    [OP.I64_TRUNC_SAT_F32_U]: 'i64.trunc_sat_f32_u',
    [OP.I64_TRUNC_SAT_F64_S]: 'i64.trunc_sat_f64_s',
    [OP.I64_TRUNC_SAT_F64_U]: 'i64.trunc_sat_f64_u',
    [OP.MEMORY_INIT]: 'memory.init',
    [OP.DATA_DROP]: 'data.drop',
    [OP.MEMORY_COPY]: 'memory.copy',
    [OP.MEMORY_FILL]: 'memory.fill',
    [OP.TABLE_INIT]: 'table.init',
    [OP.ELEM_DROP]: 'elem.drop',
    [OP.TABLE_COPY]: 'table.copy',
    [OP.TABLE_GROW]: 'table.grow',
    [OP.TABLE_SIZE]: 'table.size',
    [OP.TABLE_FILL]: 'table.fill',
    [OP.V128_LOAD]: 'v128.load',
    [OP.V128_LOAD8X8_S]: 'v128.load8x8_s',
    [OP.V128_LOAD8X8_U]: 'v128.load8x8_u',
    [OP.V128_LOAD16X4_S]: 'v128.load16x4_s',
    [OP.V128_LOAD16X4_U]: 'v128.load16x4_u',
    [OP.V128_LOAD32X2_S]: 'v128.load32x2_s',
    [OP.V128_LOAD32X2_U]: 'v128.load32x2_u',
    [OP.V128_LOAD8_SPLAT]: 'v128.load8_splat',
    [OP.V128_LOAD16_SPLAT]: 'v128.load16_splat',
    [OP.V128_LOAD32_SPLAT]: 'v128.load32_splat',
    [OP.V128_LOAD64_SPLAT]: 'v128.load64_splat',
    [OP.V128_STORE]: 'v128.store',
    [OP.V128_CONST]: 'v128.const',
    [OP.I8X16_SHUFFLE]: 'i8x16.shuffle',
    [OP.I8X16_SWIZZLE]: 'i8x16.swizzle',
    [OP.I8X16_SPLAT]: 'i8x16.splat',
    [OP.I16X8_SPLAT]: 'i16x8.splat',
    [OP.I32X4_SPLAT]: 'i32x4.splat',
    [OP.I64X2_SPLAT]: 'i64x2.splat',
    [OP.F32X4_SPLAT]: 'f32x4.splat',
    [OP.F64X2_SPLAT]: 'f64x2.splat',
    [OP.I8X16_EXTRACT_LANE_S]: 'i8x16.extract_lane_s',
    [OP.I8X16_EXTRACT_LANE_U]: 'i8x16.extract_lane_u',
    [OP.I8X16_REPLACE_LANE]: 'i8x16.replace_lane',
    [OP.I16X8_EXTRACT_LANE_S]: 'i16x8.extract_lane_s',
    [OP.I16X8_EXTRACT_LANE_U]: 'i16x8.extract_lane_u',
    [OP.I16X8_REPLACE_LANE]: 'i16x8.replace_lane',
    [OP.I32X4_EXTRACT_LANE]: 'i32x4.extract_lane',
    [OP.I32X4_REPLACE_LANE]: 'i32x4.replace_lane',
    [OP.I64X2_EXTRACT_LANE]: 'i64x2.extract_lane',
    [OP.I64X2_REPLACE_LANE]: 'i64x2.replace_lane',
    [OP.F32X4_EXTRACT_LANE]: 'f32x4.extract_lane',
    [OP.F32X4_REPLACE_LANE]: 'f32x4.replace_lane',
    [OP.F64X2_EXTRACT_LANE]: 'f64x2.extract_lane',
    [OP.F64X2_REPLACE_LANE]: 'f64x2.replace_lane',
    [OP.I8X16_EQ]: 'i8x16.eq',
    [OP.I8X16_NE]: 'i8x16.ne',
    [OP.I8X16_LT_S]: 'i8x16.lt_s',
    [OP.I8X16_LT_U]: 'i8x16.lt_u',
    [OP.I8X16_GT_S]: 'i8x16.gt_s',
    [OP.I8X16_GT_U]: 'i8x16.gt_u',
    [OP.I8X16_LE_S]: 'i8x16.le_s',
    [OP.I8X16_LE_U]: 'i8x16.le_u',
    [OP.I8X16_GE_S]: 'i8x16.ge_s',
    [OP.I8X16_GE_U]: 'i8x16.ge_u',
    [OP.I16X8_EQ]: 'i16x8.eq',
    [OP.I16X8_NE]: 'i16x8.ne',
    [OP.I16X8_LT_S]: 'i16x8.lt_s',
    [OP.I16X8_LT_U]: 'i16x8.lt_u',
    [OP.I16X8_GT_S]: 'i16x8.gt_s',
    [OP.I16X8_GT_U]: 'i16x8.gt_u',
    [OP.I16X8_LE_S]: 'i16x8.le_s',
    [OP.I16X8_LE_U]: 'i16x8.le_u',
    [OP.I16X8_GE_S]: 'i16x8.ge_s',
    [OP.I16X8_GE_U]: 'i16x8.ge_u',
    [OP.I32X4_EQ]: 'i32x4.eq',
    [OP.I32X4_NE]: 'i32x4.ne',
    [OP.I32X4_LT_S]: 'i32x4.lt_s',
    [OP.I32X4_LT_U]: 'i32x4.lt_u',
    [OP.I32X4_GT_S]: 'i32x4.gt_s',
    [OP.I32X4_GT_U]: 'i32x4.gt_u',
    [OP.I32X4_LE_S]: 'i32x4.le_s',
    [OP.I32X4_LE_U]: 'i32x4.le_u',
    [OP.I32X4_GE_S]: 'i32x4.ge_s',
    [OP.I32X4_GE_U]: 'i32x4.ge_u',
    [OP.F32X4_EQ]: 'f32x4.eq',
    [OP.F32X4_NE]: 'f32x4.ne',
    [OP.F32X4_LT]: 'f32x4.lt',
    [OP.F32X4_GT]: 'f32x4.gt',
    [OP.F32X4_LE]: 'f32x4.le',
    [OP.F32X4_GE]: 'f32x4.ge',
    [OP.F64X2_EQ]: 'f64x2.eq',
    [OP.F64X2_NE]: 'f64x2.ne',
    [OP.F64X2_LT]: 'f64x2.lt',
    [OP.F64X2_GT]: 'f64x2.gt',
    [OP.F64X2_LE]: 'f64x2.le',
    [OP.F64X2_GE]: 'f64x2.ge',
    [OP.V128_NOT]: 'v128.not',
    [OP.V128_AND]: 'v128.and',
    [OP.V128_ANDNOT]: 'v128.andnot',
    [OP.V128_OR]: 'v128.or',
    [OP.V128_XOR]: 'v128.xor',
    [OP.V128_BITSELECT]: 'v128.bitselect',
    [OP.V128_ANY_TRUE]: 'v128.any_true',
    [OP.V128_LOAD8_LANE]: 'v128.load8_lane',
    [OP.V128_LOAD16_LANE]: 'v128.load16_lane',
    [OP.V128_LOAD32_LANE]: 'v128.load32_lane',
    [OP.V128_LOAD64_LANE]: 'v128.load64_lane',
    [OP.V128_STORE8_LANE]: 'v128.store8_lane',
    [OP.V128_STORE16_LANE]: 'v128.store16_lane',
    [OP.V128_STORE32_LANE]: 'v128.store32_lane',
    [OP.V128_STORE64_LANE]: 'v128.store64_lane',
    [OP.V128_LOAD32_ZERO]: 'v128.load32_zero',
    [OP.V128_LOAD64_ZERO]: 'v128.load64_zero',
    [OP.F32X4_DEMOTE_F64X2_ZERO]: 'f32x4.demote_f64x2_zero',
    [OP.F64X2_PROMOTE_LOW_F32X4]: 'f64x2.promote_low_f32x4',
    [OP.I8X16_ABS]: 'i8x16.abs',
    [OP.I8X16_NEG]: 'i8x16.neg',
    [OP.I8X16_POPCNT]: 'i8x16.popcnt',
    [OP.I8X16_ALL_TRUE]: 'i8x16.all_true',
    [OP.I8X16_BITMASK]: 'i8x16.bitmask',
    [OP.I8X16_NARROW_I16X8_S]: 'i8x16.narrow_i16x8_s',
    [OP.I8X16_NARROW_I16X8_U]: 'i8x16.narrow_i16x8_u',
    [OP.F32X4_CEIL]: 'f32x4.ceil',
    [OP.F32X4_FLOOR]: 'f32x4.floor',
    [OP.F32X4_TRUNC]: 'f32x4.trunc',
    [OP.F32X4_NEAREST]: 'f32x4.nearest',
    [OP.I8X16_SHL]: 'i8x16.shl',
    [OP.I8X16_SHR_S]: 'i8x16.shr_s',
    [OP.I8X16_SHR_U]: 'i8x16.shr_u',
    [OP.I8X16_ADD]: 'i8x16.add',
    [OP.I8X16_ADD_SAT_S]: 'i8x16.add_sat_s',
    [OP.I8X16_ADD_SAT_U]: 'i8x16.add_sat_u',
    [OP.I8X16_SUB]: 'i8x16.sub',
    [OP.I8X16_SUB_SAT_S]: 'i8x16.sub_sat_s',
    [OP.I8X16_SUB_SAT_U]: 'i8x16.sub_sat_u',
    [OP.F64X2_CEIL]: 'f64x2.ceil',
    [OP.F64X2_FLOOR]: 'f64x2.floor',
    [OP.I8X16_MIN_S]: 'i8x16.min_s',
    [OP.I8X16_MIN_U]: 'i8x16.min_u',
    [OP.I8X16_MAX_S]: 'i8x16.max_s',
    [OP.I8X16_MAX_U]: 'i8x16.max_u',
    [OP.F64X2_TRUNC]: 'f64x2.trunc',
    [OP.I8X16_AVGR_U]: 'i8x16.avgr_u',
    [OP.I16X8_EXTADD_PAIRWISE_I8X16_S]: 'i16x8.extadd_pairwise_i8x16_s',
    [OP.I16X8_EXTADD_PAIRWISE_I8X16_U]: 'i16x8.extadd_pairwise_i8x16_u',
    [OP.I32X4_EXTADD_PAIRWISE_I16X8_S]: 'i32x4.extadd_pairwise_i16x8_s',
    [OP.I32X4_EXTADD_PAIRWISE_I16X8_U]: 'i32x4.extadd_pairwise_i16x8_u',
    [OP.I16X8_ABS]: 'i16x8.abs',
    [OP.I16X8_NEG]: 'i16x8.neg',
    [OP.I16X8_Q15MULR_SAT_S]: 'i16x8.q15mulr_sat_s',
    [OP.I16X8_ALL_TRUE]: 'i16x8.all_true',
    [OP.I16X8_BITMASK]: 'i16x8.bitmask',
    [OP.I16X8_NARROW_I32X4_S]: 'i16x8.narrow_i32x4_s',
    [OP.I16X8_NARROW_I32X4_U]: 'i16x8.narrow_i32x4_u',
    [OP.I16X8_EXTEND_LOW_I8X16_S]: 'i16x8.extend_low_i8x16_s',
    [OP.I16X8_EXTEND_HIGH_I8X16_S]: 'i16x8.extend_high_i8x16_s',
    [OP.I16X8_EXTEND_LOW_I8X16_U]: 'i16x8.extend_low_i8x16_u',
    [OP.I16X8_EXTEND_HIGH_I8X16_U]: 'i16x8.extend_high_i8x16_u',
    [OP.I16X8_SHL]: 'i16x8.shl',
    [OP.I16X8_SHR_S]: 'i16x8.shr_s',
    [OP.I16X8_SHR_U]: 'i16x8.shr_u',
    [OP.I16X8_ADD]: 'i16x8.add',
    [OP.I16X8_ADD_SAT_S]: 'i16x8.add_sat_s',
    [OP.I16X8_ADD_SAT_U]: 'i16x8.add_sat_u',
    [OP.I16X8_SUB]: 'i16x8.sub',
    [OP.I16X8_SUB_SAT_S]: 'i16x8.sub_sat_s',
    [OP.I16X8_SUB_SAT_U]: 'i16x8.sub_sat_u',
    [OP.F64X2_NEAREST]: 'f64x2.nearest',
    [OP.I16X8_MUL]: 'i16x8.mul',
    [OP.I16X8_MIN_S]: 'i16x8.min_s',
    [OP.I16X8_MIN_U]: 'i16x8.min_u',
    [OP.I16X8_MAX_S]: 'i16x8.max_s',
    [OP.I16X8_MAX_U]: 'i16x8.max_u',
    [OP.I16X8_AVGR_U]: 'i16x8.avgr_u',
    [OP.I16X8_EXTMUL_LOW_I8X16_S]: 'i16x8.extmul_low_i8x16_s',
    [OP.I16X8_EXTMUL_HIGH_I8X16_S]: 'i16x8.extmul_high_i8x16_s',
    [OP.I16X8_EXTMUL_LOW_I8X16_U]: 'i16x8.extmul_low_i8x16_u',
    [OP.I16X8_EXTMUL_HIGH_I8X16_U]: 'i16x8.extmul_high_i8x16_u',
    [OP.I32X4_ABS]: 'i32x4.abs',
    [OP.I32X4_NEG]: 'i32x4.neg',
    [OP.I32X4_ALL_TRUE]: 'i32x4.all_true',
    [OP.I32X4_BITMASK]: 'i32x4.bitmask',
    [OP.I32X4_EXTEND_LOW_I16X8_S]: 'i32x4.extend_low_i16x8_s',
    [OP.I32X4_EXTEND_HIGH_I16X8_S]: 'i32x4.extend_high_i16x8_s',
    [OP.I32X4_EXTEND_LOW_I16X8_U]: 'i32x4.extend_low_i16x8_u',
    [OP.I32X4_EXTEND_HIGH_I16X8_U]: 'i32x4.extend_high_i16x8_u',
    [OP.I32X4_SHL]: 'i32x4.shl',
    [OP.I32X4_SHR_S]: 'i32x4.shr_s',
    [OP.I32X4_SHR_U]: 'i32x4.shr_u',
    [OP.I32X4_ADD]: 'i32x4.add',
    [OP.I32X4_SUB]: 'i32x4.sub',
    [OP.I32X4_MUL]: 'i32x4.mul',
    [OP.I32X4_MIN_S]: 'i32x4.min_s',
    [OP.I32X4_MIN_U]: 'i32x4.min_u',
    [OP.I32X4_MAX_S]: 'i32x4.max_s',
    [OP.I32X4_MAX_U]: 'i32x4.max_u',
    [OP.I32X4_DOT_I16X8_S]: 'i32x4.dot_i16x8_s',
    [OP.I32X4_EXTMUL_LOW_I16X8_S]: 'i32x4.extmul_low_i16x8_s',
    [OP.I32X4_EXTMUL_HIGH_I16X8_S]: 'i32x4.extmul_high_i16x8_s',
    [OP.I32X4_EXTMUL_LOW_I16X8_U]: 'i32x4.extmul_low_i16x8_u',
    [OP.I32X4_EXTMUL_HIGH_I16X8_U]: 'i32x4.extmul_high_i16x8_u',
    [OP.I64X2_ABS]: 'i64x2.abs',
    [OP.I64X2_NEG]: 'i64x2.neg',
    [OP.I64X2_ALL_TRUE]: 'i64x2.all_true',
    [OP.I64X2_BITMASK]: 'i64x2.bitmask',
    [OP.I64X2_EXTEND_LOW_I32X4_S]: 'i64x2.extend_low_i32x4_s',
    [OP.I64X2_EXTEND_HIGH_I32X4_S]: 'i64x2.extend_high_i32x4_s',
    [OP.I64X2_EXTEND_LOW_I32X4_U]: 'i64x2.extend_low_i32x4_u',
    [OP.I64X2_EXTEND_HIGH_I32X4_U]: 'i64x2.extend_high_i32x4_u',
    [OP.I64X2_SHL]: 'i64x2.shl',
    [OP.I64X2_SHR_S]: 'i64x2.shr_s',
    [OP.I64X2_SHR_U]: 'i64x2.shr_u',
    [OP.I64X2_ADD]: 'i64x2.add',
    [OP.I64X2_SUB]: 'i64x2.sub',
    [OP.I64X2_MUL]: 'i64x2.mul',
    [OP.I64X2_EQ]: 'i64x2.eq',
    [OP.I64X2_NE]: 'i64x2.ne',
    [OP.I64X2_LT_S]: 'i64x2.lt_s',
    [OP.I64X2_GT_S]: 'i64x2.gt_s',
    [OP.I64X2_LE_S]: 'i64x2.le_s',
    [OP.I64X2_GE_S]: 'i64x2.ge_s',
    [OP.I64X2_EXTMUL_LOW_I32X4_S]: 'i64x2.extmul_low_i32x4_s',
    [OP.I64X2_EXTMUL_HIGH_I32X4_S]: 'i64x2.extmul_high_i32x4_s',
    [OP.I64X2_EXTMUL_LOW_I32X4_U]: 'i64x2.extmul_low_i32x4_u',
    [OP.I64X2_EXTMUL_HIGH_I32X4_U]: 'i64x2.extmul_high_i32x4_u',
    [OP.F32X4_ABS]: 'f32x4.abs',
    [OP.F32X4_NEG]: 'f32x4.neg',
    [OP.F32X4_SQRT]: 'f32x4.sqrt',
    [OP.F32X4_ADD]: 'f32x4.add',
    [OP.F32X4_SUB]: 'f32x4.sub',
    [OP.F32X4_MUL]: 'f32x4.mul',
    [OP.F32X4_DIV]: 'f32x4.div',
    [OP.F32X4_MIN]: 'f32x4.min',
    [OP.F32X4_MAX]: 'f32x4.max',
    [OP.F32X4_PMIN]: 'f32x4.pmin',
    [OP.F32X4_PMAX]: 'f32x4.pmax',
    [OP.F64X2_ABS]: 'f64x2.abs',
    [OP.F64X2_NEG]: 'f64x2.neg',
    [OP.F64X2_SQRT]: 'f64x2.sqrt',
    [OP.F64X2_ADD]: 'f64x2.add',
    [OP.F64X2_SUB]: 'f64x2.sub',
    [OP.F64X2_MUL]: 'f64x2.mul',
    [OP.F64X2_DIV]: 'f64x2.div',
    [OP.F64X2_MIN]: 'f64x2.min',
    [OP.F64X2_MAX]: 'f64x2.max',
    [OP.F64X2_PMIN]: 'f64x2.pmin',
    [OP.F64X2_PMAX]: 'f64x2.pmax',
    [OP.I32X4_TRUNC_SAT_F32X4_S]: 'i32x4.trunc_sat_f32x4_s',
    [OP.I32X4_TRUNC_SAT_F32X4_U]: 'i32x4.trunc_sat_f32x4_u',
    [OP.F32X4_CONVERT_I32X4_S]: 'f32x4.convert_i32x4_s',
    [OP.F32X4_CONVERT_I32X4_U]: 'f32x4.convert_i32x4_u',
    [OP.I32X4_TRUNC_SAT_F64X2_S_ZERO]: 'i32x4.trunc_sat_f64x2_s_zero',
    [OP.I32X4_TRUNC_SAT_F64X2_U_ZERO]: 'i32x4.trunc_sat_f64x2_u_zero',
    [OP.F64X2_CONVERT_LOW_I32X4_S]: 'f64x2.convert_low_i32x4_s',
    [OP.F64X2_CONVERT_LOW_I32X4_U]: 'f64x2.convert_low_i32x4_u',
    [OP.TRIVM_MULTIBYTE_FIRST]: 'TRIVM.MULTIBYTE_FIRST',
    [OP.TRIVM_FUNCTION]: 'TRIVM.FUNCTION',
    [OP.TRIVM_POP]: 'TRIVM.POP',
    [OP.TRIVM_DUP32]: 'TRIVM.DUP32',
    [OP.TRIVM_DUP64]: 'TRIVM.DUP64',
    [OP.TRIVM_LOCAL_GET32]: 'TRIVM.LOCAL_GET32',
    [OP.TRIVM_LOCAL_GET64]: 'TRIVM.LOCAL_GET64',
    [OP.TRIVM_LOCAL_SET32]: 'TRIVM.LOCAL_SET32',
    [OP.TRIVM_LOCAL_SET64]: 'TRIVM.LOCAL_SET64',

    // -- Instruction names - end of source code generated with help of "gen-instr.ts" script --
};
