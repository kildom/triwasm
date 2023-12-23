import { OP } from './opcodes';
import {
    FunctionType, NumberType, RefType, ValueType, WasmBlock, WasmBranchDir,
    WasmFunction, WasmInstr, valueTypeWords
} from './wasmModule';


export interface PopPushHandler {
    pop(...types: ValueType[]): void;
    push(...types: ValueType[]): void;
}

export interface PopPushResult {
    errors: string[];
    pushedTypes: ValueType[];
    pushedWords: number;
    poppedTypes: ValueType[];
    poppedWords: number;
    unreachable: boolean;
}

export enum StackModifyMode {
    NONE,
    PERMISSIVE,
    STRICT,
}

export function getInstrPopPush(func: WasmFunction, block: WasmBlock,
    instr: WasmInstr, stack?: ValueType[], throwErrors?: boolean,
    stackModifyMode: StackModifyMode = StackModifyMode.NONE): PopPushResult {

    let res: PopPushResult = {
        errors: [],
        pushedTypes: [],
        pushedWords: 0,
        poppedTypes: [],
        poppedWords: 0,
        unreachable: false,
    };

    switch (instr.opcode) {
    // -- Instruction pop and push - begin of source code generated with help of "gen-instr.ts" script --

    case OP.UNREACHABLE: {
        res.unreachable = true;
        break;
    }
    case OP.BLOCK:
    case OP.LOOP: {
        res.poppedTypes = [...instr.block.type.params];
        res.pushedTypes = [...instr.block.type.results];
        break;
    }
    case OP.IF: {
        res.poppedTypes = [...instr.block.type.params, NumberType.I32];
        res.pushedTypes = [...instr.block.type.results];
        break;
    }
    case OP.ELSE: {
        res.poppedTypes = [...block.type.results];
        break;
    }
    case OP.END: {
        res.poppedTypes = [...block.type.results];
        res.unreachable = true;
        break;
    }
    case OP.BR: {
        if (instr.direction === WasmBranchDir.Forward) {
            res.poppedTypes = [...instr.target.type.results];
        } else {
            res.poppedTypes = [...instr.target.type.params];
        }
        res.unreachable = true;
        break;
    }
    case OP.BR_IF: {
        if (instr.direction === WasmBranchDir.Forward) {
            res.poppedTypes = [...instr.target.type.results, NumberType.I32];
            res.pushedTypes = [...instr.target.type.results];
        } else {
            res.poppedTypes = [...instr.target.type.params, NumberType.I32];
            res.pushedTypes = [...instr.target.type.params];
        }
        break;
    }
    case OP.BR_TABLE: {
        let common: ValueType[] = [];
        for (let target of instr.targets) {
            let types = target.parentInstruction.opcode === OP.LOOP ? target.type.params : target.type.results;
            let intersectLength = Math.min(types.length, common.length);
            let a = common.slice(common.length - intersectLength);
            let b = types.slice(types.length - intersectLength);
            if (!a.every((x, i) => x === b[i])) {
                res.errors.push('Incompatible types for branch table.');
            }
            if (types.length > common.length) {
                common = types;
            }
        }
        res.poppedTypes = [...common, NumberType.I32];
        res.unreachable = true;
        break;
    }
    case OP.RETURN: {
        res.poppedTypes = [...func.type.results];
        res.unreachable = true;
        break;
    }
    case OP.CALL: {
        let type: FunctionType;
        if (instr.type) {
            type = instr.type;
        } else {
            type = instr.func.type;
        }
        res.poppedTypes = [...type.params];
        res.pushedTypes = [...type.results];
        break;
    }
    case OP.CALL_INDIRECT: {
        res.poppedTypes = [...instr.type.params, NumberType.I32];
        res.pushedTypes = [...instr.type.results];
        break;
    }
    case OP.DROP: {
        if (!stack) {
            res.errors.push('Unknown drop type.');
        } else if (!stack.length) {
            res.errors.push('Dropping empty stack.');
        } else {
            res.poppedTypes = [stack.at(-1) as ValueType];
        }
        break;
    }
    case OP.SELECT:
    case OP.SELECT_T: {
        if (!stack) {
            res.errors.push('Unknown type to select.');
        } else if (stack.length < 3) {
            res.errors.push('Stack too small to select.');
        } else {
            let type = stack.at(-2) as ValueType;
            res.poppedTypes = [type, type, NumberType.I32];
            res.pushedTypes = [type];
        }
        break;
    }
    case OP.LOCAL_GET: {
        res.pushedTypes = [func.getLocal(instr.index)];
        break;
    }
    case OP.LOCAL_SET: {
        res.poppedTypes = [func.getLocal(instr.index)];
        break;
    }
    case OP.LOCAL_TEE: {
        res.poppedTypes = [func.getLocal(instr.index)];
        res.pushedTypes = [func.getLocal(instr.index)];
        break;
    }
    case OP.GLOBAL_GET: {
        res.pushedTypes = [instr.global.type];
        break;
    }
    case OP.GLOBAL_SET: {
        res.poppedTypes = [instr.global.type];
        break;
    }
    case OP.TABLE_GET: {
        res.poppedTypes = [NumberType.I32];
        res.pushedTypes = [instr.table.type];
        break;
    }
    case OP.TABLE_SET: {
        res.poppedTypes = [NumberType.I32, instr.table.type];
        break;
    }
    case OP.REF_NULL: {
        res.pushedTypes = [instr.type];
        break;
    }
    case OP.REF_IS_NULL: {
        if (!stack) {
            res.errors.push('Unknown ref type.');
        } else if (!stack.length) {
            res.errors.push('Checking null on empty stack.');
        } else {
            res.poppedTypes = [stack.at(-1) as ValueType];
            res.pushedTypes = [NumberType.I32];
        }
        break;
    }
    case OP.TABLE_GROW: {
        res.poppedTypes = [instr.table.type, NumberType.I32];
        res.pushedTypes = [NumberType.I32];
        break;
    }
    case OP.TABLE_FILL: {
        res.poppedTypes = [NumberType.I32, instr.table.type, NumberType.I32];
        break;
    }
    case OP.TRIVM_MULTIBYTE_FIRST:
    case OP.TRIVM_FUNCTION: {
        // Abstract instruction
        break;
    }
    case OP.TRIVM_RAW: {
        res.poppedTypes = [...instr.type.params];
        res.pushedTypes = [...instr.type.results];
        res.unreachable = instr.noReturn;
        break;
    }
    case OP.NOP:
    case OP.DATA_DROP:
    case OP.ELEM_DROP: {
        break;
    }
    case OP.I32_LOAD:
    case OP.I32_LOAD8_S:
    case OP.I32_LOAD8_U:
    case OP.I32_LOAD16_S:
    case OP.I32_LOAD16_U:
    case OP.MEMORY_GROW:
    case OP.I32_EQZ:
    case OP.I32_CLZ:
    case OP.I32_CTZ:
    case OP.I32_POPCNT:
    case OP.I32_EXTEND8_S:
    case OP.I32_EXTEND16_S: {
        res.poppedTypes = [NumberType.I32];
        res.pushedTypes = [NumberType.I32];
        break;
    }
    case OP.I64_LOAD:
    case OP.I64_LOAD8_S:
    case OP.I64_LOAD8_U:
    case OP.I64_LOAD16_S:
    case OP.I64_LOAD16_U:
    case OP.I64_LOAD32_S:
    case OP.I64_LOAD32_U:
    case OP.I64_EXTEND_I32_S:
    case OP.I64_EXTEND_I32_U: {
        res.poppedTypes = [NumberType.I32];
        res.pushedTypes = [NumberType.I64];
        break;
    }
    case OP.F32_LOAD:
    case OP.F32_CONVERT_I32_S:
    case OP.F32_CONVERT_I32_U:
    case OP.F32_REINTERPRET_I32: {
        res.poppedTypes = [NumberType.I32];
        res.pushedTypes = [NumberType.F32];
        break;
    }
    case OP.F64_LOAD:
    case OP.F64_CONVERT_I32_S:
    case OP.F64_CONVERT_I32_U: {
        res.poppedTypes = [NumberType.I32];
        res.pushedTypes = [NumberType.F64];
        break;
    }
    case OP.I32_STORE:
    case OP.I32_STORE8:
    case OP.I32_STORE16:
    case OP.TRIVM_LOCAL_SET64:
    case OP.TRIVM_GLOBAL_SET64: {
        res.poppedTypes = [NumberType.I32, NumberType.I32];
        break;
    }
    case OP.I64_STORE:
    case OP.I64_STORE8:
    case OP.I64_STORE16:
    case OP.I64_STORE32: {
        res.poppedTypes = [NumberType.I32, NumberType.I64];
        break;
    }
    case OP.F32_STORE: {
        res.poppedTypes = [NumberType.I32, NumberType.F32];
        break;
    }
    case OP.F64_STORE: {
        res.poppedTypes = [NumberType.I32, NumberType.F64];
        break;
    }
    case OP.MEMORY_SIZE:
    case OP.I32_CONST:
    case OP.TABLE_SIZE:
    case OP.TRIVM_LOCAL_GET32:
    case OP.TRIVM_GLOBAL_GET32: {
        res.pushedTypes = [NumberType.I32];
        break;
    }
    case OP.I64_CONST: {
        res.pushedTypes = [NumberType.I64];
        break;
    }
    case OP.F32_CONST: {
        res.pushedTypes = [NumberType.F32];
        break;
    }
    case OP.F64_CONST: {
        res.pushedTypes = [NumberType.F64];
        break;
    }
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
    case OP.I32_ROTR: {
        res.poppedTypes = [NumberType.I32, NumberType.I32];
        res.pushedTypes = [NumberType.I32];
        break;
    }
    case OP.I64_EQZ:
    case OP.I32_WRAP_I64: {
        res.poppedTypes = [NumberType.I64];
        res.pushedTypes = [NumberType.I32];
        break;
    }
    case OP.I64_EQ:
    case OP.I64_NE:
    case OP.I64_LT_S:
    case OP.I64_LT_U:
    case OP.I64_GT_S:
    case OP.I64_GT_U:
    case OP.I64_LE_S:
    case OP.I64_LE_U:
    case OP.I64_GE_S:
    case OP.I64_GE_U: {
        res.poppedTypes = [NumberType.I64, NumberType.I64];
        res.pushedTypes = [NumberType.I32];
        break;
    }
    case OP.F32_EQ:
    case OP.F32_NE:
    case OP.F32_LT:
    case OP.F32_GT:
    case OP.F32_LE:
    case OP.F32_GE: {
        res.poppedTypes = [NumberType.F32, NumberType.F32];
        res.pushedTypes = [NumberType.I32];
        break;
    }
    case OP.F64_EQ:
    case OP.F64_NE:
    case OP.F64_LT:
    case OP.F64_GT:
    case OP.F64_LE:
    case OP.F64_GE: {
        res.poppedTypes = [NumberType.F64, NumberType.F64];
        res.pushedTypes = [NumberType.I32];
        break;
    }
    case OP.I64_CLZ:
    case OP.I64_CTZ:
    case OP.I64_POPCNT:
    case OP.I64_EXTEND8_S:
    case OP.I64_EXTEND16_S:
    case OP.I64_EXTEND32_S: {
        res.poppedTypes = [NumberType.I64];
        res.pushedTypes = [NumberType.I64];
        break;
    }
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
    case OP.I64_ROTR: {
        res.poppedTypes = [NumberType.I64, NumberType.I64];
        res.pushedTypes = [NumberType.I64];
        break;
    }
    case OP.F32_ABS:
    case OP.F32_NEG:
    case OP.F32_CEIL:
    case OP.F32_FLOOR:
    case OP.F32_TRUNC:
    case OP.F32_NEAREST:
    case OP.F32_SQRT: {
        res.poppedTypes = [NumberType.F32];
        res.pushedTypes = [NumberType.F32];
        break;
    }
    case OP.F32_ADD:
    case OP.F32_SUB:
    case OP.F32_MUL:
    case OP.F32_DIV:
    case OP.F32_MIN:
    case OP.F32_MAX:
    case OP.F32_COPYSIGN: {
        res.poppedTypes = [NumberType.F32, NumberType.F32];
        res.pushedTypes = [NumberType.F32];
        break;
    }
    case OP.F64_ABS:
    case OP.F64_NEG:
    case OP.F64_CEIL:
    case OP.F64_FLOOR:
    case OP.F64_TRUNC:
    case OP.F64_NEAREST:
    case OP.F64_SQRT: {
        res.poppedTypes = [NumberType.F64];
        res.pushedTypes = [NumberType.F64];
        break;
    }
    case OP.F64_ADD:
    case OP.F64_SUB:
    case OP.F64_MUL:
    case OP.F64_DIV:
    case OP.F64_MIN:
    case OP.F64_MAX:
    case OP.F64_COPYSIGN: {
        res.poppedTypes = [NumberType.F64, NumberType.F64];
        res.pushedTypes = [NumberType.F64];
        break;
    }
    case OP.I32_TRUNC_F32_S:
    case OP.I32_TRUNC_F32_U:
    case OP.I32_REINTERPRET_F32:
    case OP.I32_TRUNC_SAT_F32_S:
    case OP.I32_TRUNC_SAT_F32_U: {
        res.poppedTypes = [NumberType.F32];
        res.pushedTypes = [NumberType.I32];
        break;
    }
    case OP.I32_TRUNC_F64_S:
    case OP.I32_TRUNC_F64_U:
    case OP.I32_TRUNC_SAT_F64_S:
    case OP.I32_TRUNC_SAT_F64_U: {
        res.poppedTypes = [NumberType.F64];
        res.pushedTypes = [NumberType.I32];
        break;
    }
    case OP.I64_TRUNC_F32_S:
    case OP.I64_TRUNC_F32_U:
    case OP.I64_TRUNC_SAT_F32_S:
    case OP.I64_TRUNC_SAT_F32_U: {
        res.poppedTypes = [NumberType.F32];
        res.pushedTypes = [NumberType.I64];
        break;
    }
    case OP.I64_TRUNC_F64_S:
    case OP.I64_TRUNC_F64_U:
    case OP.I64_REINTERPRET_F64:
    case OP.I64_TRUNC_SAT_F64_S:
    case OP.I64_TRUNC_SAT_F64_U: {
        res.poppedTypes = [NumberType.F64];
        res.pushedTypes = [NumberType.I64];
        break;
    }
    case OP.F32_CONVERT_I64_S:
    case OP.F32_CONVERT_I64_U: {
        res.poppedTypes = [NumberType.I64];
        res.pushedTypes = [NumberType.F32];
        break;
    }
    case OP.F32_DEMOTE_F64: {
        res.poppedTypes = [NumberType.F64];
        res.pushedTypes = [NumberType.F32];
        break;
    }
    case OP.F64_CONVERT_I64_S:
    case OP.F64_CONVERT_I64_U:
    case OP.F64_REINTERPRET_I64: {
        res.poppedTypes = [NumberType.I64];
        res.pushedTypes = [NumberType.F64];
        break;
    }
    case OP.F64_PROMOTE_F32: {
        res.poppedTypes = [NumberType.F32];
        res.pushedTypes = [NumberType.F64];
        break;
    }
    case OP.REF_FUNC: {
        res.pushedTypes = [RefType.FUNCREF];
        break;
    }
    case OP.MEMORY_INIT:
    case OP.MEMORY_COPY:
    case OP.MEMORY_FILL:
    case OP.TABLE_INIT:
    case OP.TABLE_COPY: {
        res.poppedTypes = [NumberType.I32, NumberType.I32, NumberType.I32];
        break;
    }
    case OP.TRIVM_POP:
    case OP.TRIVM_LOCAL_SET32:
    case OP.TRIVM_GLOBAL_SET32: {
        res.poppedTypes = [NumberType.I32];
        break;
    }
    case OP.TRIVM_DUP32: {
        res.poppedTypes = [NumberType.I32];
        res.pushedTypes = [NumberType.I32, NumberType.I32];
        break;
    }
    case OP.TRIVM_DUP64: {
        res.poppedTypes = [NumberType.I32, NumberType.I32];
        res.pushedTypes = [NumberType.I32, NumberType.I32, NumberType.I32, NumberType.I32];
        break;
    }
    case OP.TRIVM_LOCAL_GET64:
    case OP.TRIVM_GLOBAL_GET64: {
        res.pushedTypes = [NumberType.I32, NumberType.I32];
        break;
    }

    // -- Instruction pop and push - end of source code generated with help of "gen-instr.ts" script --
    }

    res.poppedWords = valueTypeWords(res.poppedTypes);
    res.pushedWords = valueTypeWords(res.pushedTypes);

    if (stack && stackModifyMode === StackModifyMode.STRICT) {
        for (let type of [...res.poppedTypes].reverse()) {
            if (stack.length === 0) {
                res.errors.push('Missing data on stack.');
                break;
            } else {
                let stackType = stack.pop();
                if (stackType !== type) {
                    res.errors.push('Invalid data type on stack.');
                }
            }
        }
        for (let type of res.pushedTypes) {
            stack.push(type);
        }
    } else if (stack && stackModifyMode === StackModifyMode.PERMISSIVE) {
        throw new Error('Not implemented');
    }

    if (res.errors.length > 0 && throwErrors) {
        throw new Error(res.errors.join(' '));
    }

    return res;
}

