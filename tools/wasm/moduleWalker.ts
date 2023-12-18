import { OP } from './opcodes';
import { WasmBlock, WasmFunction, WasmInstr, WasmModule } from './wasmModule';

type WalkResult = boolean | undefined | void;

export interface EnterFunctionCtx<ModuleData> {
    module: WasmModule;     // Current module
    moduleData: ModuleData; // Current module data (provided in the walk function invocation)
    func: WasmFunction;     // Current function
    walkFunction: boolean;  // Set to false to prevent from walking the function
}

export interface ExitFunctionCtx<ModuleData, FunctionData> extends EnterFunctionCtx<ModuleData> {
    funcData: FunctionData; // Current function data (returned from enterFunction)
}

export interface EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData> extends ExitFunctionCtx<ModuleData, FunctionData> {
    block: WasmBlock;               // Current block or a block that we are entering
    blockStack: WasmBlock[];        // Stack of parent blocks, not including entering or exiting block,
                                    // empty when entering function body
    blockDataStack: BlockData[];    // Stack of parent block's data
    instrStack: WasmInstr[];        // Stack of parent block instructions (not including function body)
    instrIndexStack: number[];      // Stack of parent block instructions indexes within theirs parent blocks
    instrDataStack: InstrData[];    // Stack of data associated with with elements of instrStack
}

export interface ExitBlockCtx<ModuleData, FunctionData, BlockData, InstrData>
        extends EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData> {
    blockData: BlockData;           // Current block data
}

export interface EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData>
        extends ExitBlockCtx<ModuleData, FunctionData, BlockData, InstrData> {
    walkBlock: boolean;             // Set to false to prevent from walking the block
    instr: WasmInstr;               // Current instruction
    instrIndex: number;             // Current instruction index within containing block
}

export interface ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>
        extends EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData> {
    instrData: InstrData;           // Current instruction data
}


export interface FunctionWalkerListener<ModuleData, FunctionData, BlockData, InstrData> {
    enterFunction: (ctx: EnterFunctionCtx<ModuleData>) => FunctionData;
    exitFunction?: (ctx: ExitFunctionCtx<ModuleData, FunctionData>) => WalkResult;
    enterBlock: (ctx: EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData>) => BlockData;
    exitBlock?: (ctx: ExitBlockCtx<ModuleData, FunctionData, BlockData, InstrData>) => void;
    enterInstr: (ctx: EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData>) => InstrData;
    exitInstr?: (ctx: ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>) => WalkResult;
}

export function walkFunctions<ModuleData, FunctionData, BlockData, InstrData>(
    module: WasmModule,
    moduleData: ModuleData,
    listener: FunctionWalkerListener<ModuleData, FunctionData, BlockData, InstrData>
) {
    let next : WalkResult;

    for (let i = 0; i < module.functions.length; i++) {
        let func = module.functions[i];
        let ctx = { module, moduleData, func, walkFunction: true} as ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>;
        ctx.funcData = listener.enterFunction(ctx);
        if (func.block && ctx.walkFunction) {
            ctx.block = func.block;
            ctx.blockStack = [];
            ctx.blockDataStack = [];
            ctx.instrStack = [];
            ctx.instrIndexStack = [];
            ctx.instrDataStack = [];
            reenter_block:
            while (true) {
                ctx.blockData = listener.enterBlock(ctx);
                ctx.blockStack.push(ctx.block);
                ctx.blockDataStack.push(ctx.blockData);
                ctx.instrIndex = -1;
                while (true) {
                    while (ctx.instrIndex + 1 < ctx.block.body.length) {
                        ctx.instrIndex++;
                        ctx.instr = ctx.block.body[ctx.instrIndex];
                        ctx.walkBlock = true;
                        ctx.instrData = listener.enterInstr(ctx);
                        if (ctx.walkBlock && (ctx.instr.opcode == OP.BLOCK || ctx.instr.opcode == OP.LOOP ||
                                ctx.instr.opcode == OP.IF)) {
                            ctx.instrStack.push(ctx.instr);
                            ctx.instrDataStack.push(ctx.instrData);
                            ctx.instrIndexStack.push(ctx.instrIndex);
                            ctx.block = ctx.instr.block;
                            continue reenter_block;
                        } else {
                            next = listener.exitInstr?.call(listener, ctx);
                            if (next === false) {
                                break;
                            }
                        }
                    }
                    ctx.blockStack.pop();
                    ctx.blockDataStack.pop();
                    listener.exitBlock?.call(listener, ctx);
                    if (ctx.instrIndexStack.length == 0) {
                        break reenter_block;
                    }
                    ctx.instr = ctx.instrStack.pop() as WasmInstr;
                    ctx.instrData = ctx.instrDataStack.pop() as InstrData;
                    ctx.instrIndex = ctx.instrIndexStack.pop() as number;
                    ctx.block = ctx.blockStack.at(-1) as WasmBlock;
                    ctx.blockData = ctx.blockDataStack.at(-1) as BlockData;
                    next = listener.exitInstr?.call(listener, ctx);
                    if (next === false) {
                        ctx.instrIndex = ctx.block.body.length - 1;
                    }
                }
            }
        }
        next = listener.exitFunction?.call(listener, ctx);
        if (next === false) {
            break;
        }
    }
}
