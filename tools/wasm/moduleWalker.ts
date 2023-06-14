import { OP } from "./opcodes";
import { WasmBlock, WasmFunction, WasmInstr, WasmModule } from "./wasmModule";

type WalkResult = boolean | undefined;

export interface EnterFunctionCtx<ModuleData> {
    module: WasmModule;
    moduleData: ModuleData;
    func: WasmFunction;
};

export interface ExitFunctionCtx<ModuleData, FunctionData> extends EnterFunctionCtx<ModuleData> {
    funcData: FunctionData;
};

export interface EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData> extends ExitFunctionCtx<ModuleData, FunctionData> {
    block: WasmBlock;
    blockStack: WasmBlock[];
    blockDataStack: BlockData[];
    instrStack: WasmInstr[];
    instrIndexStack: number[];
    instrDataStack: InstrData[];
};

export interface ExitBlockCtx<ModuleData, FunctionData, BlockData, InstrData> extends EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData> {
    blockData: BlockData;
};

export interface EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData> extends ExitBlockCtx<ModuleData, FunctionData, BlockData, InstrData> {
    instr: WasmInstr;
    instrIndex: number;
};

export interface ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData> extends EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData> {
    instrData: InstrData;
};


export interface FunctionWalkerListener<ModuleData, FunctionData, BlockData, InstrData> {
    enterFunction(ctx: EnterFunctionCtx<ModuleData>): FunctionData;
    exitFunction(ctx: ExitFunctionCtx<ModuleData, FunctionData>): WalkResult;
    enterBlock(ctx: EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): BlockData; // TODO: Why enterBlock? Listener knows when block is entered and exited in enter/exitInstr (based on instr opcode).
    exitBlock(ctx: ExitBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): void;
    enterInstr(ctx: EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData>): InstrData;
    exitInstr(ctx: ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>): WalkResult;
};

export function walkFunctions<ModuleData, FunctionData, BlockData, InstrData>(
    module: WasmModule,
    moduleData: ModuleData,
    listener: FunctionWalkerListener<ModuleData, FunctionData, BlockData, InstrData>
) {
    type EnterFunctionT = EnterFunctionCtx<ModuleData>;
    type ExitFunctionT = ExitFunctionCtx<ModuleData, FunctionData>;
    type EnterBlockT = EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData>;
    type ExitBlockT = ExitBlockCtx<ModuleData, FunctionData, BlockData, InstrData>;
    type EnterInstrT = EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData>;
    type ExitInstrT = ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>;

    let next : WalkResult;

    for (let i = 0; i < module.functions.length; i++) {
        let func = module.functions[i];
        let ctx = { module, moduleData, func } as ExitInstrT;
        ctx.funcData = listener.enterFunction(ctx);
        if (func.block) {
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
                        ctx.instrData = listener.enterInstr(ctx);
                        if (ctx.instr.opcode == OP.BLOCK || ctx.instr.opcode == OP.LOOP || ctx.instr.opcode == OP.IF) {
                            ctx.instrStack.push(ctx.instr);
                            ctx.instrDataStack.push(ctx.instrData);
                            ctx.instrIndexStack.push(ctx.instrIndex);
                            ctx.block = ctx.instr.block;
                            continue reenter_block;
                        } else {
                            next = listener.exitInstr(ctx);
                            if (next === false) {
                                break;
                            }
                        }
                    }
                    ctx.blockStack.pop();
                    ctx.blockDataStack.pop();
                    listener.exitBlock(ctx);
                    if (ctx.instrIndexStack.length == 0) {
                        break reenter_block;
                    }
                    ctx.instr = ctx.instrStack.pop() as WasmInstr;
                    ctx.instrData = ctx.instrDataStack.pop() as InstrData;
                    ctx.instrIndex = ctx.instrIndexStack.pop() as number;
                    ctx.block = ctx.blockStack.at(-1) as WasmBlock;
                    ctx.blockData = ctx.blockDataStack.at(-1) as BlockData;
                    next = listener.exitInstr(ctx);
                    if (next === false) {
                        ctx.instrIndex = ctx.block.body.length - 1;
                    }
                }
            }
        }
        next = listener.exitFunction(ctx);
        if (next === false) {
            break;
        }
    }
}
