import { OP } from './opcodes';
import { WasmBlock, WasmFunction, WasmInstr, WasmInstrWithBlock, WasmModule } from './wasmModule';

export enum WalkResult {
    CONTINUE = 0,
    SKIP_CHILDREN = 1,
    SKIP_SIBLINGS = 2,
}

export interface WalkFunctionListener<FunctionData, BlockData, InstrData> {

    module: WasmModule;           // Input module
    func: WasmFunction;           // Current function
    funcData?: FunctionData;      // Current function data
    block?: WasmBlock;            // Current block or a block that we are entering
    blockData?: BlockData;        // Current block data
    blockStack: WasmBlock[];      // Stack of parent blocks, not including entering or exiting block,
    blockDataStack: BlockData[];  // Stack of parent block's data
    instr?: WasmInstr;            // Current instruction
    instrData?: InstrData;        // Current instruction data
    instrIndex?: number;          // Current instruction index within containing block
    instrStack: WasmInstr[];      // Stack of parent block instructions (not including function body)
    instrDataStack: InstrData[];  // Stack of data associated with with elements of instrStack
    instrIndexStack: number[];    // Stack of parent block instructions indexes within theirs parent blocks

    enterFunction?: (ctx: this) => WalkResult | undefined | void;
    exitFunction?: (ctx: this) => WalkResult.CONTINUE | WalkResult.SKIP_SIBLINGS | undefined | void;
    enterBlock?: (ctx: this) => WalkResult.CONTINUE | WalkResult.SKIP_CHILDREN | undefined | void;
    exitBlock?: (ctx: this) => void;
    enterInstr?: (ctx: this) => WalkResult | undefined | void;
    exitInstr?: (ctx: this) => WalkResult.CONTINUE | WalkResult.SKIP_SIBLINGS | undefined | void;
}

function callCallback(ctx: any, func: any): WalkResult {
    let res = func?.call?.(ctx, ctx);
    if (typeof(res) === 'number') {
        return res as WalkResult;
    } else {
        return WalkResult.CONTINUE;
    }
}

export function walkFunctions<FunctionData, BlockData, InstrData>(
    ctx: WalkFunctionListener<FunctionData, BlockData, InstrData>
) {

    let next: WalkResult | undefined | void;

    for (let i = 0; i < ctx.module.functions.length; i++) {
        let func = ctx.module.functions[i];
        ctx.func = func;
        ctx.funcData = undefined;
        ctx.block = undefined;
        ctx.blockData = undefined;
        ctx.blockStack = [];
        ctx.blockDataStack = [];
        ctx.instr = func.block?.parentInstruction;
        ctx.instrData = undefined;
        ctx.instrIndex = 0;
        ctx.instrStack = [];
        ctx.instrDataStack = [];
        ctx.instrIndexStack = [];
        next = callCallback(ctx, ctx.enterFunction);
        if (next === WalkResult.SKIP_SIBLINGS) {
            break;
        }
        if (func.block && next === WalkResult.CONTINUE) {
            ctx.instr = func.block.parentInstruction; // To avoid TypeScript complaining that ctx.instr may be undefined.
            enter_block:
            do {
                ctx.block = (ctx.instr as WasmInstrWithBlock).block;
                ctx.blockData = undefined; // will be set by enterBlock
                next = callCallback(ctx, ctx.enterBlock);
                ctx.blockStack.push(ctx.block);
                ctx.blockDataStack.push(ctx.blockData as BlockData);
                ctx.instrStack.push(ctx.instr);
                ctx.instrDataStack.push(ctx.instrData as InstrData);
                ctx.instrIndexStack.push(ctx.instrIndex);
                ctx.instrIndex = (next === WalkResult.CONTINUE) ? 0 : ctx.block.body.length;
                next_instr:
                do {
                    if (ctx.instrIndex >= ctx.block.body.length) {
                        ctx.block = ctx.blockStack.pop();
                        ctx.blockData = ctx.blockDataStack.pop();
                        ctx.instr = ctx.instrStack.pop() as WasmInstr;
                        ctx.instrData = ctx.instrDataStack.pop();
                        ctx.instrIndex = ctx.instrIndexStack.pop() as number;
                        callCallback(ctx, ctx.exitBlock);
                        ctx.block = ctx.blockStack.at(-1);
                        ctx.blockData = ctx.blockDataStack.at(-1);
                        if (!ctx.block) {
                            break enter_block;
                        }
                    } else {
                        ctx.instr = ctx.block.body[ctx.instrIndex];
                        ctx.instrData = undefined; // will be set by enterInstr
                        next = callCallback(ctx, ctx.enterInstr);
                        if (next === WalkResult.SKIP_SIBLINGS) {
                            ctx.instrIndex = ctx.block.body.length;
                            continue next_instr;
                        } else if (next !== WalkResult.SKIP_CHILDREN &&
                            (ctx.instr.opcode === OP.BLOCK || ctx.instr.opcode === OP.LOOP || ctx.instr.opcode === OP.IF)) {
                            continue enter_block;
                        }
                    }
                    next = callCallback(ctx, ctx.exitInstr);
                    ctx.instrIndex = (next !== WalkResult.SKIP_SIBLINGS) ? ctx.instrIndex + 1 : ctx.block.body.length;
                } while (true);
            } while (true);
        }
        next = callCallback(ctx, ctx.exitFunction);
        if (next === WalkResult.SKIP_SIBLINGS) {
            break;
        }
    }
}
