/*
 * Copyright (c) 2023 Dominik Kilian <kontakt@dominik.cc>
 *
 * This program is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this
 * program. If not, see <https://www.gnu.org/licenses/>.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { allowTemporaryNull } from "../common/common";
import { Path } from "../common/path";
import { template } from "../common/template";
import { EnterBlockCtx, EnterFunctionCtx, EnterInstrCtx, ExitBlockCtx, ExitFunctionCtx, ExitInstrCtx, walkFunctions } from "./moduleWalker";
import { OP } from "./opcodes";
import { instrId, NumberType, RefType, ValueType, valueTypeWords, VectorType, WasmBlock, WasmBranchDir, WasmFunction, WasmFunctionKind, WasmInstr, WasmInstrBr, WasmInstrBrTable, WasmInstrRefFunc, WasmInstrCall, WasmInstrIf, WasmInstrWithBlock, WasmModule } from "./wasmModule";

class TriVMExtensions {
    public unwind = false;
    public mem64 = false;
    public i64 = false;
    public f32 = false;
    public f64 = false;
    public faults = {
        unreachable: true,
    };
}

interface ModuleData {
    ext: TriVMExtensions;
    output: string[];
    uniqueCounter: number;
};

interface FunctionData {
    stackSize: number;
    localsOffsets: number[];
    returnAddressOffset: number;
    frameSize: number;
};

interface BlockData {
    stackBase: number;
    paramsWords: number;
    resultsWords: number;
};

interface InstrData {
};

type Ctx = EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData>;
type AnyCtx = EnterFunctionCtx<ModuleData> |
    ExitFunctionCtx<ModuleData, FunctionData> |
    EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData> |
    EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData>;

function outputAssembly(ctx: AnyCtx, code?: string) {
    let lines = code?.split('\n').map(x => x.trimEnd()).filter(x => x.trim()) || [];
    for (let line of lines) {
        output(ctx, line);
    }
}

function enterFunction(ctx: EnterFunctionCtx<ModuleData>): FunctionData {
    let localsOffsets: number[] = [];
    let frameSize = 0;

    // Function parameters
    for (let p of ctx.func.type.params) {
        localsOffsets.push(frameSize);
        frameSize += 4 * valueTypeWords(p);
    }

    let returnAddressOffset = frameSize;

    // Return address
    frameSize += 4;

    // Function locals
    for (let p of ctx.func.locals) {
        localsOffsets.push(frameSize);
        frameSize += 4 * valueTypeWords(p);
    }

    switch (ctx.func.kind) {
        case WasmFunctionKind.ANNOTATION:
        case WasmFunctionKind.LINK:
        case WasmFunctionKind.INLINE_ASSEMBLY:
        case WasmFunctionKind.UNUSED:
        case WasmFunctionKind.IMPORT:
            ctx.walkFunction = false;
            break;
        case WasmFunctionKind.WASM:
            output(ctx, '.BEGIN');
            output(ctx, ctx.func.name + ':');
            ctx.walkFunction = true;
            break;
        case WasmFunctionKind.ASSEMBLY:
            output(ctx, '.BEGIN');
            output(ctx, ctx.func.name + ':');
            outputAssembly(ctx, ctx.func.data);
            ctx.walkFunction = false;
            break;
        default:
            throw new Error(`This kind of function should not be here: ${WasmFunctionKind[ctx.func.kind]}!`);
    }

    return {
        stackSize: 0,
        localsOffsets,
        returnAddressOffset,
        frameSize,
    };
}

function exitFunction(ctx: ExitFunctionCtx<ModuleData, FunctionData>): void {
    if (ctx.func.kind === WasmFunctionKind.WASM || ctx.func.kind === WasmFunctionKind.ASSEMBLY) {
        output(ctx, '.END');
    }
}

function enterBlock(ctx: EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): BlockData {
    let paramsWords: number = 0;
    let resultsWords: number = 0;
    for (let p of ctx.block.type.params) {
        paramsWords += valueTypeWords(p);
    }
    for (let p of ctx.block.type.results) {
        resultsWords += valueTypeWords(p);
    }

    let stackBase = ctx.funcData.stackSize - paramsWords;

    output(ctx, `block_${ctx.block.parentInstruction.id}_begin:`, undefined, `base: ${stackBase}, ${paramsWords} => ${resultsWords}`);

    return {
        stackBase,
        paramsWords,
        resultsWords,
    };
}

function exitBlock(ctx: ExitBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): void {
    if (ctx.block.parentInstruction.opcode == OP.IF && !ctx.block.parentInstruction.withElse) {
        output(ctx, `block_${ctx.block.parentInstruction.id}_else:`);
    }
    output(ctx, `block_${ctx.block.parentInstruction.id}_end:`);
    ctx.funcData.stackSize = ctx.blockData.stackBase + ctx.blockData.resultsWords;
}

function output(ctx: AnyCtx, text: string, instr?: WasmInstr, comment?: string): void {
    let ind = '\t'.repeat((ctx as any).blockStack?.length || 0);
    let c: string[] = [];
    instr = instr || (ctx as any).instr;
    if (instr) {
        c.push('#' + instr.id);
    }
    if (comment) {
        c.push(comment);
    }
    ctx.moduleData.output.push(ind + text + (c.length > 0 ? ' # ' + c.join(', ') : ''));
}

function getBlockData(ctx: Ctx, target: WasmBlock): BlockData {
    for (let i = 0; i < ctx.blockStack.length; i++) {
        if (ctx.blockStack[i] === target) {
            return ctx.blockDataStack[i];
        }
    }
    throw new Error('Block is not parent block.');
}

function toIntLiteral(value: number, bits: number): number {
    let shift = 32 - bits;
    return ((value << shift) & 0xFFFFFFFF) >> shift;
}

function generateUnwind(ctx: Ctx, keepWords: number, skipWords: number, ret: boolean | number) {
    if (skipWords == 0) {
        if (ret === true) {
            output(ctx, `WRITE32 PC`);
        }
        return;
    }

    let returnFlag = (ret !== false);

    if (ctx.moduleData.ext.unwind && skipWords <= 65536 && keepWords < 32768) {
        let packed: number | undefined = undefined;
        if (skipWords <= 16 && keepWords < 8) {
            packed = toIntLiteral((skipWords - 1) | (keepWords << 5) | (returnFlag ? 0x10 : 0), 8);
        } else if (skipWords <= 256 && keepWords < 128) {
            packed = toIntLiteral((skipWords - 1) | (keepWords << 9) | (returnFlag ? 0x100 : 0), 16);
        } else {
            packed = toIntLiteral((skipWords - 1) | (keepWords << 17) | (returnFlag ? 0x10000 : 0), 32);
        }
        if (typeof (ret) == 'number') {
            output(ctx, `READ32 [SP] - ${ret}`);
        }
        output(ctx, `UNWIND ${packed}`);
    } else {
        let bits: string;
        let addStack: number;
        if (skipWords <= 65536 && keepWords < 65536) {
            let packed: number;
            if (skipWords <= 16 && keepWords < 16) {
                packed = toIntLiteral((skipWords - 1) | (keepWords << 4), 8);
                bits = '8';
            } else if (skipWords <= 256 && keepWords < 256) {
                packed = toIntLiteral((skipWords - 1) | (keepWords << 8), 16);
                bits = '16';
            } else {
                packed = toIntLiteral((skipWords - 1) | (keepWords << 16), 32);
                bits = '32';
            }
            output(ctx, `NEG -(${packed})`);
            addStack = 4;
        } else {
            output(ctx, `NEG -(${skipWords})`);
            output(ctx, `NEG -(${keepWords})`);
            addStack = 8;
            bits = '';
        }
        if (typeof (ret) == 'number') {
            output(ctx, `READ32 [SP] - ${ret + addStack}`);
        }
        if (returnFlag) {
            output(ctx, `BR __triwasmlib_unwind${bits}`);
        } else {
            output(ctx, `CALL __triwasmlib_unwind${bits}`);
        }
    }
}

enum BranchCondition {
    NONE = 'BR',
    POSITIVE = 'BRT',
    NEGATIVE = 'BRF',
};

function generateBranch(ctx: Ctx, target: WasmBlock, direction: WasmBranchDir | undefined, condition: BranchCondition, allowFallback: boolean): boolean {
    let targetData = getBlockData(ctx, target);
    let instr = target.parentInstruction;
    let conditionDone = false;

    if (direction === undefined) {
        direction = instr.opcode == OP.LOOP ? WasmBranchDir.Backward : WasmBranchDir.Forward;
    }

    let isReturn = (instr.opcode == OP.TRIVM_FUNCTION);

    let keepWords: number;
    let skipWords: number;

    if (isReturn) {
        keepWords = valueTypeWords(ctx.func.type.results);
        skipWords = (ctx.funcData.frameSize / 4) + ctx.funcData.stackSize - keepWords;
        let wordsAboveRetAddr = ctx.funcData.frameSize / 4 - ctx.funcData.returnAddressOffset / 4 - 1 + ctx.funcData.stackSize;
        if (wordsAboveRetAddr > 0) {
            generateUnwind(ctx, keepWords, skipWords, 4 * ctx.funcData.stackSize + ctx.funcData.frameSize - ctx.funcData.returnAddressOffset - 4);
        } else {
            generateUnwind(ctx, keepWords, skipWords - 1, true);
        }
    } else {
        keepWords = valueTypeWords((direction == WasmBranchDir.Forward) ? target.type.results : target.type.params);
        skipWords = ctx.funcData.stackSize - targetData.stackBase - keepWords;
        generateUnwind(ctx, keepWords, skipWords, false);
        if (direction == WasmBranchDir.Backward) {
            if (condition != BranchCondition.NONE && skipWords == 0) {
                output(ctx, `${condition} block_${target.parentInstruction.id}_begin`);
                conditionDone = true;
            } else {
                output(ctx, `BR block_${target.parentInstruction.id}_begin`);
            }
        } else {
            let lastIndex = target.body.length - 1;
            while (lastIndex > 0 && target.body[lastIndex]?.opcode === OP.END) {
                lastIndex--;
            }
            if (target == ctx.block && ctx.instrIndex == lastIndex && allowFallback) {
                // skip branch - target is just after this instruction
            } else {
                if (condition != BranchCondition.NONE && skipWords == 0) {
                    output(ctx, `${condition} block_${target.parentInstruction.id}_end`);
                    conditionDone = true;
                } else {
                    output(ctx, `BR block_${target.parentInstruction.id}_end`);
                }
            }
        }
    }

    return conditionDone;
}

function generateIf(ctx: Ctx, instr: WasmInstrBr | WasmInstrBrTable, target: WasmBlock, direction: WasmBranchDir | undefined, condition: BranchCondition, allowFallback: boolean) {
    pop(ctx, 1);
    let outStart = ctx.moduleData.output.length;
    let conditionDone = generateBranch(ctx, target, direction, condition, allowFallback);
    if (!conditionDone) {
        let tmp = ctx.moduleData.output.splice(outStart);
        let instrName = (condition == BranchCondition.POSITIVE) ? 'BRF' : 'BRT';
        let uid = ctx.moduleData.uniqueCounter++;
        output(ctx, `${instrName} brf_skip_${instr.id}_${uid}`);
        ctx.moduleData.output.push(...tmp);
        output(ctx, `brf_skip_${instr.id}_${uid}:`); // TODO: Does br_if skips block parameters if false?
    }
}

function enterInstr(ctx: Ctx): InstrData {
    let instrData: InstrData = {
    };
    let instr = ctx.instr;
    switch (instr.opcode) {
        // -- Generator cases - begin of source code generated with help of "gen-instr.ts" script --

        case OP.UNREACHABLE: {
            output(ctx, '# TODO ELSE');
            break;
        }
        case OP.BLOCK: {
            // Handled by enterBlock
            break;
        }
        case OP.LOOP: {
            // Handled by enterBlock
            break;
        }
        case OP.IF: {
            pop(ctx, 1);
            output(ctx, `BRF block_${instr.id}_else`);
            break;
        }
        case OP.ELSE: {
            output(ctx, `block_${ctx.block.parentInstruction.id}_else:`);
            ctx.funcData.stackSize = ctx.blockData.stackBase + valueTypeWords(ctx.block.type.params);
            break;
        }
        case OP.END: {
            // not generate code, handled by BR added by reducer
            break;
        }
        case OP.BR: {
            generateBranch(ctx, instr.target, instr.direction, BranchCondition.NONE, true);
            break;
        }
        case OP.BR_IF: {
            generateIf(ctx, instr, instr.target, instr.direction, BranchCondition.POSITIVE, true);
            break;
        }
        case OP.BR_TABLE: {
            if (instr.targets.length == 1) {
                generateBranch(ctx, instr.targets[0], undefined, BranchCondition.NONE, true);
                break;
            } else if (instr.targets.length == 2) {
                generateIf(ctx, instr, instr.targets[0], undefined, BranchCondition.NEGATIVE, false);
                generateBranch(ctx, instr.targets[1], undefined, BranchCondition.NONE, true);
                break;
            }
            output(ctx, 'WRITE TMP0');
            pop(ctx, 1);
            let valueOffset = 0;
            for (let i = 0; i < instr.targets.length - 1; i++) {
                let target = instr.targets[i];
                if (i - valueOffset == 128 && instr.targets.length - i > 4) {
                    valueOffset += 128;
                    output(ctx, 'READ TMP0');
                    output(ctx, 'ADD -128');
                    output(ctx, 'WRITE TMP0');
                }
                output(ctx, 'READ TMP0');
                push(ctx, 1);
                if (i - valueOffset == 0) {
                    generateIf(ctx, instr, target, undefined, BranchCondition.NEGATIVE, false);
                } else {
                    output(ctx, `EQ ${i - valueOffset}`);
                    generateIf(ctx, instr, target, undefined, BranchCondition.POSITIVE, false);
                }
            }
            generateBranch(ctx, instr.targets.at(-1) as WasmBlock, undefined, BranchCondition.NONE, true);
            break;
        }
        case OP.CALL: {
            let target = instr.func.resolved;
            let comments: string[] = [];
            for (let exp of [...target.exports, target.import]) {
                if (exp) {
                    comments.push(exp.module + '.' + exp.name);
                }
            }
            switch (target.kind) {
                case WasmFunctionKind.ANNOTATION:
                    output(ctx, `.ANNOTATION ${JSON.stringify(target.data)}`);
                    break;
                case WasmFunctionKind.ASSEMBLY:
                case WasmFunctionKind.WASM: {
                    output(ctx, `CALL ${target.name}`, undefined, comments.filter(x => x.indexOf('__trivm_magic_function__') < 0).join(', '));
                    popPush(ctx, valueTypeWords(instr.type?.params || target.type.params), valueTypeWords(instr.type?.results || target.type.results));
                    break;
                }
                case WasmFunctionKind.INLINE_ASSEMBLY:
                    outputAssembly(ctx, target.data);
                    popPush(ctx, valueTypeWords(target.type.params), valueTypeWords(target.type.results));
                    break;
                case WasmFunctionKind.HOST:
                    output(ctx, `HOST 0`, instr, 'TODO: get index');
                    break;
                default:
                    output(ctx, `# CALL TODO: ${comments}`);
                    break;
            }
            break;
        }
        case OP.CALL_INDIRECT: {
            output(ctx, '# TODO CALL_INDIRECT');
            break;
        }
        case OP.TABLE_GET: {
            output(ctx, '# TODO TABLE_GET');
            break;
        }
        case OP.TABLE_SET: {
            output(ctx, '# TODO TABLE_SET');
            break;
        }
        case OP.TRIVM_FUNCTION: {
            throw Error('This should not happen');
            break;
        }
        case OP.TRIVM_LOCAL_GET32: {
            push(ctx, 1);
            output(ctx, `READ32 [SP] - ${4 * ctx.funcData.stackSize + ctx.funcData.frameSize - ctx.funcData.localsOffsets[instr.index] - instr.offset}`, instr);
            break;
        }
        case OP.TRIVM_LOCAL_GET64: {
            break;
        }
        case OP.TRIVM_LOCAL_SET32: {
            pop(ctx, 1);
            output(ctx, `WRITE32 [SP] - ${4 * ctx.funcData.stackSize + ctx.funcData.frameSize - ctx.funcData.localsOffsets[instr.index] - instr.offset}`, instr);
            break;
        }
        case OP.TRIVM_LOCAL_SET64: {
            break;
        }
        case OP.TRIVM_GLOBAL_GET32: {
            push(ctx, 1);
            output(ctx, `READ32 global_${instr.global.index} + ${instr.offset}`, instr);
            break;
        }
        case OP.TRIVM_GLOBAL_GET64: {
            push(ctx, 2);
            output(ctx, `READ64 global_${instr.global.index} + ${instr.offset}`, instr);
            break;
        }
        case OP.TRIVM_GLOBAL_SET32: {
            pop(ctx, 1);
            output(ctx, `WRITE32 global_${instr.global.index} + ${instr.offset}`, instr);
            break;
        }
        case OP.TRIVM_GLOBAL_SET64: {
            pop(ctx, 2);
            output(ctx, `WRITE64 global_${instr.global.index} + ${instr.offset}`, instr);
            break;
        }
        case OP.TRIVM_RAW: {
            popPush(ctx, valueTypeWords(instr.type.params), valueTypeWords(instr.type.results));
            output(ctx, instr.code);
            break;
        }

        // -- Generator cases - end of source code generated with help of "gen-instr.ts" script --

        default:
            if (instr.opcode in simpleGenerators) {
                let gen = simpleGenerators[instr.opcode];
                popPush(ctx, gen[1], gen[2]);
                output(ctx, gen[0](ctx));
            } else {
                output(ctx, `# TODO: ${instr.opcode}`, instr);
            }
            break;
    }
    return instrData;
}

function exitInstr(ctx: ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>): void {
}

interface TriwasmConf {
    tableLengthSize: number;
    tableElementSize: number;
    hostCallbacks: boolean;
    faults: {
        wasmTableIndex: boolean;
    };
    ext: {
        unwind: boolean;
    };
};

function fromTemplate(path: Path, module: WasmModule, conf: TriwasmConf) {
    let data = { module, conf };
    let templateFunc = template(path.readString(), data);
    return templateFunc(data);
}

export function generate(module: WasmModule) {
    let output: string[] = [];
    let conf: TriwasmConf = {
        tableLengthSize: 2,
        tableElementSize: 2,
        hostCallbacks: false,
        faults: {
            wasmTableIndex: false,
        },
        ext: {
            unwind: true,
        }
    };
    output.push(fromTemplate(Path.runtime.join('prologue.triasm'), module, conf));
    try {
        walkFunctions(module,
            {
                ext: new TriVMExtensions(),
                output,
                uniqueCounter: 0,
            },
            {
                enterFunction,
                exitFunction,
                enterBlock,
                exitBlock,
                enterInstr,
                exitInstr,
            });
            output.push('.place __triwasm_epilogue');
    } finally {
        console.log(output.join('\n'));
    }
}

function error(obj: any, message: string) {
    let instr: WasmInstr;
    if (obj.instr) {
        instr = obj.instr;
    } else {
        instr = obj;
    }
    throw new Error(message); // TODO: handle errors properly
}

function pop(ctx: Ctx, count: number) {
    if (ctx.funcData.stackSize < count) {
        error(ctx, 'Stack underflow'); // TODO: More detailed error location
        ctx.funcData.stackSize = 0;
    }
    ctx.funcData.stackSize -= count;
}

function push(ctx: Ctx, count: number) {
    ctx.funcData.stackSize += count;
}

function popPush(ctx: Ctx, popCount: number, pushCount: number) {
    pop(ctx, popCount);
    ctx.funcData.stackSize += pushCount;
}

let simpleGenerators: { [key: number]: [((ctx: any) => string), number, number] } = {
    // -- Simple instructions - begin of source code generated with help of "gen-instr.ts" script --

    [OP.NOP]: [(ctx: any) => `# NOP`, 0, 0],
    [OP.I32_LOAD]: [(ctx: any) => `READ32 [AMB0] + [POP] + ${ctx.instr.offset}`, 1, 1],
    [OP.I64_LOAD]: [(ctx: any) => `READ64 [AMB0] + [POP] + ${ctx.instr.offset}`, 1, 2],
    [OP.I32_LOAD8_S]: [(ctx: any) => `READ8S [AMB0] + [POP] + ${ctx.instr.offset}`, 1, 1],
    [OP.I32_LOAD8_U]: [(ctx: any) => `READ8U [AMB0] + [POP] + ${ctx.instr.offset}`, 1, 1],
    [OP.I32_LOAD16_S]: [(ctx: any) => `READ16S [AMB0] + [POP] + ${ctx.instr.offset}`, 1, 1],
    [OP.I32_LOAD16_U]: [(ctx: any) => `READ16U [AMB0] + [POP] + ${ctx.instr.offset}`, 1, 1],
    [OP.I32_STORE]: [(ctx: any) => `WRITE32 [AMB0] + [POP] + ${ctx.instr.offset}`, 2, 0],
    [OP.I64_STORE]: [(ctx: any) => `WRITE64 [AMB0] + [POP] + ${ctx.instr.offset}`, 3, 0],
    [OP.I32_STORE8]: [(ctx: any) => `WRITE8 [AMB0] + [POP] + ${ctx.instr.offset}`, 2, 0],
    [OP.I32_STORE16]: [(ctx: any) => `WRITE16 [AMB0] + [POP] + ${ctx.instr.offset}`, 2, 0],
    [OP.I32_CONST]: [(ctx: any) => `NEG -(${ctx.instr.value})`, 0, 1],
    [OP.I64_CONST]: [(ctx: any) => `NEG64 -(${ctx.instr.value})`, 0, 2],
    [OP.I32_EQZ]: [(ctx: any) => `NOT`, 1, 1],
    [OP.I32_EQ]: [(ctx: any) => `EQ`, 2, 1],
    [OP.I32_LT_S]: [(ctx: any) => `SLT`, 2, 1],
    [OP.I32_LT_U]: [(ctx: any) => `ULT`, 2, 1],
    [OP.I32_GT_S]: [(ctx: any) => `SGT`, 2, 1],
    [OP.I32_GT_U]: [(ctx: any) => `UGT`, 2, 1],
    [OP.I64_EQ]: [(ctx: any) => `EQ64`, 4, 1],
    [OP.I64_LT_S]: [(ctx: any) => `SLT64`, 4, 1],
    [OP.I64_LT_U]: [(ctx: any) => `ULT64`, 4, 1],
    [OP.I64_GT_S]: [(ctx: any) => `SGT64`, 4, 1],
    [OP.I64_GT_U]: [(ctx: any) => `UGT64`, 4, 1],
    [OP.F32_EQ]: [(ctx: any) => `EQF32`, 2, 1],
    [OP.F32_LT]: [(ctx: any) => `LTF32`, 2, 1],
    [OP.F32_GT]: [(ctx: any) => `GTF32`, 2, 1],
    [OP.F32_LE]: [(ctx: any) => `LEF32`, 2, 1],
    [OP.F32_GE]: [(ctx: any) => `GEF32`, 2, 1],
    [OP.F64_EQ]: [(ctx: any) => `EQF64`, 4, 1],
    [OP.F64_LT]: [(ctx: any) => `LTF64`, 4, 1],
    [OP.F64_GT]: [(ctx: any) => `GTF64`, 4, 1],
    [OP.F64_LE]: [(ctx: any) => `LEF64`, 4, 1],
    [OP.F64_GE]: [(ctx: any) => `GEF64`, 4, 1],
    [OP.I32_ADD]: [(ctx: any) => `ADD`, 2, 1],
    [OP.I32_SUB]: [(ctx: any) => `SUB`, 2, 1],
    [OP.I32_MUL]: [(ctx: any) => `MUL`, 2, 1],
    [OP.I32_DIV_S]: [(ctx: any) => `SDIV`, 2, 1],
    [OP.I32_DIV_U]: [(ctx: any) => `UDIV`, 2, 1],
    [OP.I32_REM_S]: [(ctx: any) => `SMOD`, 2, 1],
    [OP.I32_REM_U]: [(ctx: any) => `UMOD`, 2, 1],
    [OP.I32_AND]: [(ctx: any) => `AND`, 2, 1],
    [OP.I32_OR]: [(ctx: any) => `OR`, 2, 1],
    [OP.I32_XOR]: [(ctx: any) => `XOR`, 2, 1],
    [OP.I32_SHL]: [(ctx: any) => `SHL`, 2, 1],
    [OP.I32_SHR_S]: [(ctx: any) => `SSHR`, 2, 1],
    [OP.I32_SHR_U]: [(ctx: any) => `USHR`, 2, 1],
    [OP.I64_ADD]: [(ctx: any) => `ADD64`, 4, 2],
    [OP.I64_SUB]: [(ctx: any) => `SUB64`, 4, 2],
    [OP.I64_MUL]: [(ctx: any) => `MUL64`, 4, 2],
    [OP.I64_DIV_S]: [(ctx: any) => `SDIV64`, 4, 2],
    [OP.I64_DIV_U]: [(ctx: any) => `UDIV64`, 4, 2],
    [OP.I64_REM_S]: [(ctx: any) => `SMOD64`, 4, 2],
    [OP.I64_REM_U]: [(ctx: any) => `UMOD64`, 4, 2],
    [OP.I64_AND]: [(ctx: any) => `AND64`, 4, 2],
    [OP.I64_OR]: [(ctx: any) => `OR64`, 4, 2],
    [OP.I64_XOR]: [(ctx: any) => `XOR64`, 4, 2],
    [OP.I64_SHL]: [(ctx: any) => `SHL64`, 4, 2],
    [OP.I64_SHR_S]: [(ctx: any) => `SSHR64`, 4, 2],
    [OP.I64_SHR_U]: [(ctx: any) => `USHR64`, 4, 2],
    [OP.F32_CEIL]: [(ctx: any) => `CEILF32`, 1, 1],
    [OP.F32_FLOOR]: [(ctx: any) => `FLOORF32`, 1, 1],
    [OP.F32_TRUNC]: [(ctx: any) => `TRUNCF32`, 1, 1],
    [OP.F32_NEAREST]: [(ctx: any) => `NEARESTF32`, 1, 1],
    [OP.F32_SQRT]: [(ctx: any) => `SQRTF32`, 1, 1],
    [OP.F32_ADD]: [(ctx: any) => `ADDF32`, 2, 1],
    [OP.F32_SUB]: [(ctx: any) => `SUBF32`, 2, 1],
    [OP.F32_MUL]: [(ctx: any) => `MULF32`, 2, 1],
    [OP.F32_DIV]: [(ctx: any) => `DIVF32`, 2, 1],
    [OP.F64_CEIL]: [(ctx: any) => `CEILF64`, 2, 2],
    [OP.F64_FLOOR]: [(ctx: any) => `FLOORF64`, 2, 2],
    [OP.F64_TRUNC]: [(ctx: any) => `TRUNCF64`, 2, 2],
    [OP.F64_NEAREST]: [(ctx: any) => `NEARESTF64`, 2, 2],
    [OP.F64_SQRT]: [(ctx: any) => `SQRTF64`, 2, 2],
    [OP.F64_ADD]: [(ctx: any) => `ADDF64`, 4, 2],
    [OP.F64_SUB]: [(ctx: any) => `SUBF64`, 4, 2],
    [OP.F64_MUL]: [(ctx: any) => `MULF64`, 4, 2],
    [OP.F64_DIV]: [(ctx: any) => `DIVF64`, 4, 2],
    // TODO: [OP.I32_TRUNC_F32_S]: ['i32.trunc_f32_s', ?, ?],
    // TODO: [OP.I32_TRUNC_F32_U]: ['i32.trunc_f32_u', ?, ?],
    // TODO: [OP.I32_REINTERPRET_F32]: ['i32.reinterpret_f32', ?, ?],
    // TODO: [OP.I32_TRUNC_SAT_F32_S]: ['i32.trunc_sat_f32_s', ?, ?],
    // TODO: [OP.I32_TRUNC_SAT_F32_U]: ['i32.trunc_sat_f32_u', ?, ?],
    // TODO: [OP.I32_TRUNC_F64_S]: ['i32.trunc_f64_s', ?, ?],
    // TODO: [OP.I32_TRUNC_F64_U]: ['i32.trunc_f64_u', ?, ?],
    // TODO: [OP.I32_TRUNC_SAT_F64_S]: ['i32.trunc_sat_f64_s', ?, ?],
    // TODO: [OP.I32_TRUNC_SAT_F64_U]: ['i32.trunc_sat_f64_u', ?, ?],
    // TODO: [OP.I64_EXTEND_I32_S]: ['i64.extend_i32_s', ?, ?],
    // TODO: [OP.I64_EXTEND_I32_U]: ['i64.extend_i32_u', ?, ?],
    // TODO: [OP.I64_TRUNC_F32_S]: ['i64.trunc_f32_s', ?, ?],
    // TODO: [OP.I64_TRUNC_F32_U]: ['i64.trunc_f32_u', ?, ?],
    // TODO: [OP.I64_TRUNC_SAT_F32_S]: ['i64.trunc_sat_f32_s', ?, ?],
    // TODO: [OP.I64_TRUNC_SAT_F32_U]: ['i64.trunc_sat_f32_u', ?, ?],
    // TODO: [OP.I64_TRUNC_F64_S]: ['i64.trunc_f64_s', ?, ?],
    // TODO: [OP.I64_TRUNC_F64_U]: ['i64.trunc_f64_u', ?, ?],
    // TODO: [OP.I64_REINTERPRET_F64]: ['i64.reinterpret_f64', ?, ?],
    // TODO: [OP.I64_TRUNC_SAT_F64_S]: ['i64.trunc_sat_f64_s', ?, ?],
    // TODO: [OP.I64_TRUNC_SAT_F64_U]: ['i64.trunc_sat_f64_u', ?, ?],
    // TODO: [OP.F32_CONVERT_I32_S]: ['f32.convert_i32_s', ?, ?],
    // TODO: [OP.F32_CONVERT_I32_U]: ['f32.convert_i32_u', ?, ?],
    // TODO: [OP.F32_REINTERPRET_I32]: ['f32.reinterpret_i32', ?, ?],
    // TODO: [OP.F32_CONVERT_I64_S]: ['f32.convert_i64_s', ?, ?],
    // TODO: [OP.F32_CONVERT_I64_U]: ['f32.convert_i64_u', ?, ?],
    // TODO: [OP.F32_DEMOTE_F64]: ['f32.demote_f64', ?, ?],
    // TODO: [OP.F64_CONVERT_I32_S]: ['f64.convert_i32_s', ?, ?],
    // TODO: [OP.F64_CONVERT_I32_U]: ['f64.convert_i32_u', ?, ?],
    // TODO: [OP.F64_CONVERT_I64_S]: ['f64.convert_i64_s', ?, ?],
    // TODO: [OP.F64_CONVERT_I64_U]: ['f64.convert_i64_u', ?, ?],
    // TODO: [OP.F64_REINTERPRET_I64]: ['f64.reinterpret_i64', ?, ?],
    // TODO: [OP.F64_PROMOTE_F32]: ['f64.promote_f32', ?, ?],
    // TODO: [OP.I32_EXTEND8_S]: ['i32.extend8_s', ?, ?],
    // TODO: [OP.I32_EXTEND16_S]: ['i32.extend16_s', ?, ?],
    // TODO: [OP.I64_EXTEND8_S]: ['i64.extend8_s', ?, ?],
    // TODO: [OP.I64_EXTEND16_S]: ['i64.extend16_s', ?, ?],
    // TODO: [OP.I64_EXTEND32_S]: ['i64.extend32_s', ?, ?],
    // TODO: [OP.REF_NULL]: ['ref.null', ?, ?],
    // TODO: [OP.REF_IS_NULL]: ['ref.is_null', ?, ?],
    // TODO: [OP.REF_FUNC]: ['ref.func', ?, ?],
    // TODO: [OP.MEMORY_INIT]: ['memory.init', ?, ?],
    // TODO: [OP.MEMORY_COPY]: ['memory.copy', ?, ?],
    // TODO: [OP.MEMORY_FILL]: ['memory.fill', ?, ?],
    // TODO: [OP.TABLE_INIT]: ['table.init', ?, ?],
    // TODO: [OP.TABLE_COPY]: ['table.copy', ?, ?],
    // TODO: [OP.DATA_DROP]: ['data.drop', ?, ?],
    // TODO: [OP.ELEM_DROP]: ['elem.drop', ?, ?],
    // TODO: [OP.TABLE_GROW]: ['table.grow', ?, ?],
    // TODO: [OP.TABLE_SIZE]: ['table.size', ?, ?],
    // TODO: [OP.TABLE_FILL]: ['table.fill', ?, ?],
    // TODO: [OP.V128_LOAD]: ['v128.load', ?, ?],
    // TODO: [OP.V128_LOAD8X8_S]: ['v128.load8x8_s', ?, ?],
    // TODO: [OP.V128_LOAD8X8_U]: ['v128.load8x8_u', ?, ?],
    // TODO: [OP.V128_LOAD16X4_S]: ['v128.load16x4_s', ?, ?],
    // TODO: [OP.V128_LOAD16X4_U]: ['v128.load16x4_u', ?, ?],
    // TODO: [OP.V128_LOAD32X2_S]: ['v128.load32x2_s', ?, ?],
    // TODO: [OP.V128_LOAD32X2_U]: ['v128.load32x2_u', ?, ?],
    // TODO: [OP.V128_LOAD8_SPLAT]: ['v128.load8_splat', ?, ?],
    // TODO: [OP.V128_LOAD16_SPLAT]: ['v128.load16_splat', ?, ?],
    // TODO: [OP.V128_LOAD32_SPLAT]: ['v128.load32_splat', ?, ?],
    // TODO: [OP.V128_LOAD64_SPLAT]: ['v128.load64_splat', ?, ?],
    // TODO: [OP.I8X16_SPLAT]: ['i8x16.splat', ?, ?],
    // TODO: [OP.I16X8_SPLAT]: ['i16x8.splat', ?, ?],
    // TODO: [OP.I32X4_SPLAT]: ['i32x4.splat', ?, ?],
    // TODO: [OP.V128_LOAD32_ZERO]: ['v128.load32_zero', ?, ?],
    // TODO: [OP.V128_LOAD64_ZERO]: ['v128.load64_zero', ?, ?],
    // TODO: [OP.V128_STORE]: ['v128.store', ?, ?],
    // TODO: [OP.V128_CONST]: ['v128.const', ?, ?],
    // TODO: [OP.I8X16_SHUFFLE]: ['i8x16.shuffle', ?, ?],
    // TODO: [OP.I8X16_SWIZZLE]: ['i8x16.swizzle', ?, ?],
    // TODO: [OP.I8X16_EQ]: ['i8x16.eq', ?, ?],
    // TODO: [OP.I8X16_NE]: ['i8x16.ne', ?, ?],
    // TODO: [OP.I8X16_LT_S]: ['i8x16.lt_s', ?, ?],
    // TODO: [OP.I8X16_LT_U]: ['i8x16.lt_u', ?, ?],
    // TODO: [OP.I8X16_GT_S]: ['i8x16.gt_s', ?, ?],
    // TODO: [OP.I8X16_GT_U]: ['i8x16.gt_u', ?, ?],
    // TODO: [OP.I8X16_LE_S]: ['i8x16.le_s', ?, ?],
    // TODO: [OP.I8X16_LE_U]: ['i8x16.le_u', ?, ?],
    // TODO: [OP.I8X16_GE_S]: ['i8x16.ge_s', ?, ?],
    // TODO: [OP.I8X16_GE_U]: ['i8x16.ge_u', ?, ?],
    // TODO: [OP.I16X8_EQ]: ['i16x8.eq', ?, ?],
    // TODO: [OP.I16X8_NE]: ['i16x8.ne', ?, ?],
    // TODO: [OP.I16X8_LT_S]: ['i16x8.lt_s', ?, ?],
    // TODO: [OP.I16X8_LT_U]: ['i16x8.lt_u', ?, ?],
    // TODO: [OP.I16X8_GT_S]: ['i16x8.gt_s', ?, ?],
    // TODO: [OP.I16X8_GT_U]: ['i16x8.gt_u', ?, ?],
    // TODO: [OP.I16X8_LE_S]: ['i16x8.le_s', ?, ?],
    // TODO: [OP.I16X8_LE_U]: ['i16x8.le_u', ?, ?],
    // TODO: [OP.I16X8_GE_S]: ['i16x8.ge_s', ?, ?],
    // TODO: [OP.I16X8_GE_U]: ['i16x8.ge_u', ?, ?],
    // TODO: [OP.I32X4_EQ]: ['i32x4.eq', ?, ?],
    // TODO: [OP.I32X4_NE]: ['i32x4.ne', ?, ?],
    // TODO: [OP.I32X4_LT_S]: ['i32x4.lt_s', ?, ?],
    // TODO: [OP.I32X4_LT_U]: ['i32x4.lt_u', ?, ?],
    // TODO: [OP.I32X4_GT_S]: ['i32x4.gt_s', ?, ?],
    // TODO: [OP.I32X4_GT_U]: ['i32x4.gt_u', ?, ?],
    // TODO: [OP.I32X4_LE_S]: ['i32x4.le_s', ?, ?],
    // TODO: [OP.I32X4_LE_U]: ['i32x4.le_u', ?, ?],
    // TODO: [OP.I32X4_GE_S]: ['i32x4.ge_s', ?, ?],
    // TODO: [OP.I32X4_GE_U]: ['i32x4.ge_u', ?, ?],
    // TODO: [OP.F32X4_EQ]: ['f32x4.eq', ?, ?],
    // TODO: [OP.F32X4_NE]: ['f32x4.ne', ?, ?],
    // TODO: [OP.F32X4_LT]: ['f32x4.lt', ?, ?],
    // TODO: [OP.F32X4_GT]: ['f32x4.gt', ?, ?],
    // TODO: [OP.F32X4_LE]: ['f32x4.le', ?, ?],
    // TODO: [OP.F32X4_GE]: ['f32x4.ge', ?, ?],
    // TODO: [OP.F64X2_EQ]: ['f64x2.eq', ?, ?],
    // TODO: [OP.F64X2_NE]: ['f64x2.ne', ?, ?],
    // TODO: [OP.F64X2_LT]: ['f64x2.lt', ?, ?],
    // TODO: [OP.F64X2_GT]: ['f64x2.gt', ?, ?],
    // TODO: [OP.F64X2_LE]: ['f64x2.le', ?, ?],
    // TODO: [OP.F64X2_GE]: ['f64x2.ge', ?, ?],
    // TODO: [OP.V128_AND]: ['v128.and', ?, ?],
    // TODO: [OP.V128_ANDNOT]: ['v128.andnot', ?, ?],
    // TODO: [OP.V128_OR]: ['v128.or', ?, ?],
    // TODO: [OP.V128_XOR]: ['v128.xor', ?, ?],
    // TODO: [OP.I8X16_NARROW_I16X8_S]: ['i8x16.narrow_i16x8_s', ?, ?],
    // TODO: [OP.I8X16_NARROW_I16X8_U]: ['i8x16.narrow_i16x8_u', ?, ?],
    // TODO: [OP.I8X16_ADD]: ['i8x16.add', ?, ?],
    // TODO: [OP.I8X16_ADD_SAT_S]: ['i8x16.add_sat_s', ?, ?],
    // TODO: [OP.I8X16_ADD_SAT_U]: ['i8x16.add_sat_u', ?, ?],
    // TODO: [OP.I8X16_SUB]: ['i8x16.sub', ?, ?],
    // TODO: [OP.I8X16_SUB_SAT_S]: ['i8x16.sub_sat_s', ?, ?],
    // TODO: [OP.I8X16_SUB_SAT_U]: ['i8x16.sub_sat_u', ?, ?],
    // TODO: [OP.I8X16_MIN_S]: ['i8x16.min_s', ?, ?],
    // TODO: [OP.I8X16_MIN_U]: ['i8x16.min_u', ?, ?],
    // TODO: [OP.I8X16_MAX_S]: ['i8x16.max_s', ?, ?],
    // TODO: [OP.I8X16_MAX_U]: ['i8x16.max_u', ?, ?],
    // TODO: [OP.I8X16_AVGR_U]: ['i8x16.avgr_u', ?, ?],
    // TODO: [OP.I16X8_Q15MULR_SAT_S]: ['i16x8.q15mulr_sat_s', ?, ?],
    // TODO: [OP.I16X8_NARROW_I32X4_S]: ['i16x8.narrow_i32x4_s', ?, ?],
    // TODO: [OP.I16X8_NARROW_I32X4_U]: ['i16x8.narrow_i32x4_u', ?, ?],
    // TODO: [OP.I16X8_ADD]: ['i16x8.add', ?, ?],
    // TODO: [OP.I16X8_ADD_SAT_S]: ['i16x8.add_sat_s', ?, ?],
    // TODO: [OP.I16X8_ADD_SAT_U]: ['i16x8.add_sat_u', ?, ?],
    // TODO: [OP.I16X8_SUB]: ['i16x8.sub', ?, ?],
    // TODO: [OP.I16X8_SUB_SAT_S]: ['i16x8.sub_sat_s', ?, ?],
    // TODO: [OP.I16X8_SUB_SAT_U]: ['i16x8.sub_sat_u', ?, ?],
    // TODO: [OP.I16X8_MUL]: ['i16x8.mul', ?, ?],
    // TODO: [OP.I16X8_MIN_S]: ['i16x8.min_s', ?, ?],
    // TODO: [OP.I16X8_MIN_U]: ['i16x8.min_u', ?, ?],
    // TODO: [OP.I16X8_MAX_S]: ['i16x8.max_s', ?, ?],
    // TODO: [OP.I16X8_MAX_U]: ['i16x8.max_u', ?, ?],
    // TODO: [OP.I16X8_AVGR_U]: ['i16x8.avgr_u', ?, ?],
    // TODO: [OP.I16X8_EXTMUL_LOW_I8X16_S]: ['i16x8.extmul_low_i8x16_s', ?, ?],
    // TODO: [OP.I16X8_EXTMUL_HIGH_I8X16_S]: ['i16x8.extmul_high_i8x16_s', ?, ?],
    // TODO: [OP.I16X8_EXTMUL_LOW_I8X16_U]: ['i16x8.extmul_low_i8x16_u', ?, ?],
    // TODO: [OP.I16X8_EXTMUL_HIGH_I8X16_U]: ['i16x8.extmul_high_i8x16_u', ?, ?],
    // TODO: [OP.I32X4_ADD]: ['i32x4.add', ?, ?],
    // TODO: [OP.I32X4_SUB]: ['i32x4.sub', ?, ?],
    // TODO: [OP.I32X4_MUL]: ['i32x4.mul', ?, ?],
    // TODO: [OP.I32X4_MIN_S]: ['i32x4.min_s', ?, ?],
    // TODO: [OP.I32X4_MIN_U]: ['i32x4.min_u', ?, ?],
    // TODO: [OP.I32X4_MAX_S]: ['i32x4.max_s', ?, ?],
    // TODO: [OP.I32X4_MAX_U]: ['i32x4.max_u', ?, ?],
    // TODO: [OP.I32X4_DOT_I16X8_S]: ['i32x4.dot_i16x8_s', ?, ?],
    // TODO: [OP.I32X4_EXTMUL_LOW_I16X8_S]: ['i32x4.extmul_low_i16x8_s', ?, ?],
    // TODO: [OP.I32X4_EXTMUL_HIGH_I16X8_S]: ['i32x4.extmul_high_i16x8_s', ?, ?],
    // TODO: [OP.I32X4_EXTMUL_LOW_I16X8_U]: ['i32x4.extmul_low_i16x8_u', ?, ?],
    // TODO: [OP.I32X4_EXTMUL_HIGH_I16X8_U]: ['i32x4.extmul_high_i16x8_u', ?, ?],
    // TODO: [OP.I64X2_ADD]: ['i64x2.add', ?, ?],
    // TODO: [OP.I64X2_SUB]: ['i64x2.sub', ?, ?],
    // TODO: [OP.I64X2_MUL]: ['i64x2.mul', ?, ?],
    // TODO: [OP.I64X2_EQ]: ['i64x2.eq', ?, ?],
    // TODO: [OP.I64X2_NE]: ['i64x2.ne', ?, ?],
    // TODO: [OP.I64X2_LT_S]: ['i64x2.lt_s', ?, ?],
    // TODO: [OP.I64X2_GT_S]: ['i64x2.gt_s', ?, ?],
    // TODO: [OP.I64X2_LE_S]: ['i64x2.le_s', ?, ?],
    // TODO: [OP.I64X2_GE_S]: ['i64x2.ge_s', ?, ?],
    // TODO: [OP.I64X2_EXTMUL_LOW_I32X4_S]: ['i64x2.extmul_low_i32x4_s', ?, ?],
    // TODO: [OP.I64X2_EXTMUL_HIGH_I32X4_S]: ['i64x2.extmul_high_i32x4_s', ?, ?],
    // TODO: [OP.I64X2_EXTMUL_LOW_I32X4_U]: ['i64x2.extmul_low_i32x4_u', ?, ?],
    // TODO: [OP.I64X2_EXTMUL_HIGH_I32X4_U]: ['i64x2.extmul_high_i32x4_u', ?, ?],
    // TODO: [OP.F32X4_ADD]: ['f32x4.add', ?, ?],
    // TODO: [OP.F32X4_SUB]: ['f32x4.sub', ?, ?],
    // TODO: [OP.F32X4_MUL]: ['f32x4.mul', ?, ?],
    // TODO: [OP.F32X4_DIV]: ['f32x4.div', ?, ?],
    // TODO: [OP.F32X4_MIN]: ['f32x4.min', ?, ?],
    // TODO: [OP.F32X4_MAX]: ['f32x4.max', ?, ?],
    // TODO: [OP.F32X4_PMIN]: ['f32x4.pmin', ?, ?],
    // TODO: [OP.F32X4_PMAX]: ['f32x4.pmax', ?, ?],
    // TODO: [OP.F64X2_ADD]: ['f64x2.add', ?, ?],
    // TODO: [OP.F64X2_SUB]: ['f64x2.sub', ?, ?],
    // TODO: [OP.F64X2_MUL]: ['f64x2.mul', ?, ?],
    // TODO: [OP.F64X2_DIV]: ['f64x2.div', ?, ?],
    // TODO: [OP.F64X2_MIN]: ['f64x2.min', ?, ?],
    // TODO: [OP.F64X2_MAX]: ['f64x2.max', ?, ?],
    // TODO: [OP.F64X2_PMIN]: ['f64x2.pmin', ?, ?],
    // TODO: [OP.F64X2_PMAX]: ['f64x2.pmax', ?, ?],
    // TODO: [OP.I64X2_SPLAT]: ['i64x2.splat', ?, ?],
    // TODO: [OP.F32X4_SPLAT]: ['f32x4.splat', ?, ?],
    // TODO: [OP.F64X2_SPLAT]: ['f64x2.splat', ?, ?],
    // TODO: [OP.I8X16_EXTRACT_LANE_S]: ['i8x16.extract_lane_s', ?, ?],
    // TODO: [OP.I8X16_EXTRACT_LANE_U]: ['i8x16.extract_lane_u', ?, ?],
    // TODO: [OP.I16X8_EXTRACT_LANE_S]: ['i16x8.extract_lane_s', ?, ?],
    // TODO: [OP.I16X8_EXTRACT_LANE_U]: ['i16x8.extract_lane_u', ?, ?],
    // TODO: [OP.I32X4_EXTRACT_LANE]: ['i32x4.extract_lane', ?, ?],
    // TODO: [OP.V128_ANY_TRUE]: ['v128.any_true', ?, ?],
    // TODO: [OP.I8X16_ALL_TRUE]: ['i8x16.all_true', ?, ?],
    // TODO: [OP.I8X16_BITMASK]: ['i8x16.bitmask', ?, ?],
    // TODO: [OP.I16X8_ALL_TRUE]: ['i16x8.all_true', ?, ?],
    // TODO: [OP.I16X8_BITMASK]: ['i16x8.bitmask', ?, ?],
    // TODO: [OP.I32X4_ALL_TRUE]: ['i32x4.all_true', ?, ?],
    // TODO: [OP.I32X4_BITMASK]: ['i32x4.bitmask', ?, ?],
    // TODO: [OP.I64X2_ALL_TRUE]: ['i64x2.all_true', ?, ?],
    // TODO: [OP.I64X2_BITMASK]: ['i64x2.bitmask', ?, ?],
    // TODO: [OP.I8X16_REPLACE_LANE]: ['i8x16.replace_lane', ?, ?],
    // TODO: [OP.I16X8_REPLACE_LANE]: ['i16x8.replace_lane', ?, ?],
    // TODO: [OP.I32X4_REPLACE_LANE]: ['i32x4.replace_lane', ?, ?],
    // TODO: [OP.I8X16_SHL]: ['i8x16.shl', ?, ?],
    // TODO: [OP.I8X16_SHR_S]: ['i8x16.shr_s', ?, ?],
    // TODO: [OP.I8X16_SHR_U]: ['i8x16.shr_u', ?, ?],
    // TODO: [OP.I16X8_SHL]: ['i16x8.shl', ?, ?],
    // TODO: [OP.I16X8_SHR_S]: ['i16x8.shr_s', ?, ?],
    // TODO: [OP.I16X8_SHR_U]: ['i16x8.shr_u', ?, ?],
    // TODO: [OP.I32X4_SHL]: ['i32x4.shl', ?, ?],
    // TODO: [OP.I32X4_SHR_S]: ['i32x4.shr_s', ?, ?],
    // TODO: [OP.I32X4_SHR_U]: ['i32x4.shr_u', ?, ?],
    // TODO: [OP.I64X2_SHL]: ['i64x2.shl', ?, ?],
    // TODO: [OP.I64X2_SHR_S]: ['i64x2.shr_s', ?, ?],
    // TODO: [OP.I64X2_SHR_U]: ['i64x2.shr_u', ?, ?],
    // TODO: [OP.I64X2_EXTRACT_LANE]: ['i64x2.extract_lane', ?, ?],
    // TODO: [OP.I64X2_REPLACE_LANE]: ['i64x2.replace_lane', ?, ?],
    // TODO: [OP.F32X4_EXTRACT_LANE]: ['f32x4.extract_lane', ?, ?],
    // TODO: [OP.F32X4_REPLACE_LANE]: ['f32x4.replace_lane', ?, ?],
    // TODO: [OP.F64X2_EXTRACT_LANE]: ['f64x2.extract_lane', ?, ?],
    // TODO: [OP.F64X2_REPLACE_LANE]: ['f64x2.replace_lane', ?, ?],
    // TODO: [OP.V128_NOT]: ['v128.not', ?, ?],
    // TODO: [OP.F32X4_DEMOTE_F64X2_ZERO]: ['f32x4.demote_f64x2_zero', ?, ?],
    // TODO: [OP.F64X2_PROMOTE_LOW_F32X4]: ['f64x2.promote_low_f32x4', ?, ?],
    // TODO: [OP.I8X16_ABS]: ['i8x16.abs', ?, ?],
    // TODO: [OP.I8X16_NEG]: ['i8x16.neg', ?, ?],
    // TODO: [OP.I8X16_POPCNT]: ['i8x16.popcnt', ?, ?],
    // TODO: [OP.F32X4_CEIL]: ['f32x4.ceil', ?, ?],
    // TODO: [OP.F32X4_FLOOR]: ['f32x4.floor', ?, ?],
    // TODO: [OP.F32X4_TRUNC]: ['f32x4.trunc', ?, ?],
    // TODO: [OP.F32X4_NEAREST]: ['f32x4.nearest', ?, ?],
    // TODO: [OP.F64X2_CEIL]: ['f64x2.ceil', ?, ?],
    // TODO: [OP.F64X2_FLOOR]: ['f64x2.floor', ?, ?],
    // TODO: [OP.F64X2_TRUNC]: ['f64x2.trunc', ?, ?],
    // TODO: [OP.I16X8_EXTADD_PAIRWISE_I8X16_S]: ['i16x8.extadd_pairwise_i8x16_s', ?, ?],
    // TODO: [OP.I16X8_EXTADD_PAIRWISE_I8X16_U]: ['i16x8.extadd_pairwise_i8x16_u', ?, ?],
    // TODO: [OP.I32X4_EXTADD_PAIRWISE_I16X8_S]: ['i32x4.extadd_pairwise_i16x8_s', ?, ?],
    // TODO: [OP.I32X4_EXTADD_PAIRWISE_I16X8_U]: ['i32x4.extadd_pairwise_i16x8_u', ?, ?],
    // TODO: [OP.I16X8_ABS]: ['i16x8.abs', ?, ?],
    // TODO: [OP.I16X8_NEG]: ['i16x8.neg', ?, ?],
    // TODO: [OP.I16X8_EXTEND_LOW_I8X16_S]: ['i16x8.extend_low_i8x16_s', ?, ?],
    // TODO: [OP.I16X8_EXTEND_HIGH_I8X16_S]: ['i16x8.extend_high_i8x16_s', ?, ?],
    // TODO: [OP.I16X8_EXTEND_LOW_I8X16_U]: ['i16x8.extend_low_i8x16_u', ?, ?],
    // TODO: [OP.I16X8_EXTEND_HIGH_I8X16_U]: ['i16x8.extend_high_i8x16_u', ?, ?],
    // TODO: [OP.F64X2_NEAREST]: ['f64x2.nearest', ?, ?],
    // TODO: [OP.I32X4_ABS]: ['i32x4.abs', ?, ?],
    // TODO: [OP.I32X4_NEG]: ['i32x4.neg', ?, ?],
    // TODO: [OP.I32X4_EXTEND_LOW_I16X8_S]: ['i32x4.extend_low_i16x8_s', ?, ?],
    // TODO: [OP.I32X4_EXTEND_HIGH_I16X8_S]: ['i32x4.extend_high_i16x8_s', ?, ?],
    // TODO: [OP.I32X4_EXTEND_LOW_I16X8_U]: ['i32x4.extend_low_i16x8_u', ?, ?],
    // TODO: [OP.I32X4_EXTEND_HIGH_I16X8_U]: ['i32x4.extend_high_i16x8_u', ?, ?],
    // TODO: [OP.I64X2_ABS]: ['i64x2.abs', ?, ?],
    // TODO: [OP.I64X2_NEG]: ['i64x2.neg', ?, ?],
    // TODO: [OP.I64X2_EXTEND_LOW_I32X4_S]: ['i64x2.extend_low_i32x4_s', ?, ?],
    // TODO: [OP.I64X2_EXTEND_HIGH_I32X4_S]: ['i64x2.extend_high_i32x4_s', ?, ?],
    // TODO: [OP.I64X2_EXTEND_LOW_I32X4_U]: ['i64x2.extend_low_i32x4_u', ?, ?],
    // TODO: [OP.I64X2_EXTEND_HIGH_I32X4_U]: ['i64x2.extend_high_i32x4_u', ?, ?],
    // TODO: [OP.F32X4_ABS]: ['f32x4.abs', ?, ?],
    // TODO: [OP.F32X4_NEG]: ['f32x4.neg', ?, ?],
    // TODO: [OP.F32X4_SQRT]: ['f32x4.sqrt', ?, ?],
    // TODO: [OP.F64X2_ABS]: ['f64x2.abs', ?, ?],
    // TODO: [OP.F64X2_NEG]: ['f64x2.neg', ?, ?],
    // TODO: [OP.F64X2_SQRT]: ['f64x2.sqrt', ?, ?],
    // TODO: [OP.I32X4_TRUNC_SAT_F32X4_S]: ['i32x4.trunc_sat_f32x4_s', ?, ?],
    // TODO: [OP.I32X4_TRUNC_SAT_F32X4_U]: ['i32x4.trunc_sat_f32x4_u', ?, ?],
    // TODO: [OP.F32X4_CONVERT_I32X4_S]: ['f32x4.convert_i32x4_s', ?, ?],
    // TODO: [OP.F32X4_CONVERT_I32X4_U]: ['f32x4.convert_i32x4_u', ?, ?],
    // TODO: [OP.I32X4_TRUNC_SAT_F64X2_S_ZERO]: ['i32x4.trunc_sat_f64x2_s_zero', ?, ?],
    // TODO: [OP.I32X4_TRUNC_SAT_F64X2_U_ZERO]: ['i32x4.trunc_sat_f64x2_u_zero', ?, ?],
    // TODO: [OP.F64X2_CONVERT_LOW_I32X4_S]: ['f64x2.convert_low_i32x4_s', ?, ?],
    // TODO: [OP.F64X2_CONVERT_LOW_I32X4_U]: ['f64x2.convert_low_i32x4_u', ?, ?],
    // TODO: [OP.V128_BITSELECT]: ['v128.bitselect', ?, ?],
    // TODO: [OP.V128_LOAD8_LANE]: ['v128.load8_lane', ?, ?],
    // TODO: [OP.V128_LOAD16_LANE]: ['v128.load16_lane', ?, ?],
    // TODO: [OP.V128_LOAD32_LANE]: ['v128.load32_lane', ?, ?],
    // TODO: [OP.V128_LOAD64_LANE]: ['v128.load64_lane', ?, ?],
    // TODO: [OP.V128_STORE8_LANE]: ['v128.store8_lane', ?, ?],
    // TODO: [OP.V128_STORE16_LANE]: ['v128.store16_lane', ?, ?],
    // TODO: [OP.V128_STORE32_LANE]: ['v128.store32_lane', ?, ?],
    // TODO: [OP.V128_STORE64_LANE]: ['v128.store64_lane', ?, ?],
    [OP.TRIVM_POP]: [(ctx: any) => `READ32 TMP0`, 1, 0],
    [OP.TRIVM_DUP32]: [(ctx: any) => `READ32 [SP]`, 1, 2],
    [OP.TRIVM_DUP64]: [(ctx: any) => `READ64 [SP] - 4`, 2, 4],

    // -- Simple instructions - end of source code generated with help of "gen-instr.ts" script --
};
