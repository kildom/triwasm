import { EnterFunctionCtx, ExitInstrCtx, walkFunctions } from './moduleWalker';
import { OP } from './opcodes';
import { NumberType, RefType, WasmModule } from './wasmModule';


type StackEntry = string | number | bigint;

interface FunctionData {
    stack: StackEntry[];
    result?: StackEntry;
}


function enterFunction (ctx: EnterFunctionCtx<undefined>) {
    if (ctx.func.type.results.length !== 1) {
        ctx.walkFunction = false;
    }
    return { stack: [] };
}

function exitInstr(ctx: ExitInstrCtx<undefined, FunctionData, undefined, undefined>) {
    let stack = ctx.funcData.stack;
    let instr = ctx.instr;

    switch (instr.opcode) {
    case OP.I32_CONST:
        stack.push(instr.value);
        return true;
    case OP.I64_CONST:
        stack.push(instr.value);
        return true;
    case OP.F32_CONST:
        stack.push(instr.value);
        return true;
    case OP.F64_CONST:
        stack.push(instr.value);
        return true;
    case OP.REF_NULL:
        stack.push(0);
        return true;
    case OP.REF_FUNC:
        stack.push(instr.func.name);
        return true;
    case OP.I32_MUL:
    case OP.I32_SUB:
    case OP.I32_ADD: {
        let a = stack.pop();
        let b = stack.pop();
        if (a === undefined || b === undefined || typeof (a) !== 'number' || typeof (b) !== 'number') {
            return false;
        } else if (instr.opcode === OP.I32_MUL) {
            stack.push((a * b) & 0xFFFFFFFF);
        } else if (instr.opcode === OP.I32_SUB) {
            stack.push((a - b) & 0xFFFFFFFF);
        } else {
            stack.push((a + b) & 0xFFFFFFFF);
        }
        return true;
    }
    case OP.I64_MUL:
    case OP.I64_SUB:
    case OP.I64_ADD: {
        let a = stack.pop();
        let b = stack.pop();
        if (a === undefined || b === undefined || typeof (a) !== 'bigint' || typeof (b) !== 'bigint') {
            return false;
        } else if (instr.opcode === OP.I64_MUL) {
            stack.push((a * b) & 0xFFFFFFFFFFFFFFFFn);
        } else if (instr.opcode === OP.I64_SUB) {
            stack.push((a - b) & 0xFFFFFFFFFFFFFFFFn);
        } else {
            stack.push((a + b) & 0xFFFFFFFFFFFFFFFFn);
        }
        return true;
    }
    case OP.END: {
        let constValue = stack.pop();
        let ok;
        switch (ctx.func.type.results[0]) {
        case NumberType.I32:
        case NumberType.F32:
            ok = (typeof(constValue) === 'number');
            break;
        case NumberType.I64:
        case NumberType.F64:
            ok = (typeof(constValue) === 'bigint');
            break;
        case RefType.FUNCREF:
            ok = (typeof(constValue) === 'string');
            break;
        default:
            ok = false;
            break;
        }
        if (ok) {
            ctx.func.constValue = constValue;
        } else {
            delete ctx.func.constValue;
        }
        return false;
    }
    default:
        delete ctx.func.constValue;
        return false;
    }
}


export function evaluateConstExpressions(module: WasmModule) {
    walkFunctions(module, undefined, {
        enterFunction,
        enterBlock: () => undefined,
        enterInstr: () => undefined,
        exitInstr,
    });
}

