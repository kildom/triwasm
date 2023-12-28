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

import { OP } from './opcodes';
import * as OpType from './opcodeTypes';
import {
    EnterBlockCtx, EnterFunctionCtx, EnterInstrCtx, ExitBlockCtx, ExitFunctionCtx, walkFunctions
} from './moduleWalker';
import {
    valueTypeWords, WasmBlock, WasmBranchDir, WasmFunctionKind, WasmInstr, WasmInstrBr, WasmInstrBrTable, WasmModule
} from './wasmModule';

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
}

interface FunctionData {
    stackSize: number;
    localsOffsets: number[];
    returnAddressOffset: number;
    frameSize: number;
}

interface BlockData {
    stackBase: number;
    paramsWords: number;
    resultsWords: number;
}

interface InstrData {
}

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

    output(ctx, `block_${ctx.block.parentInstruction.id}_begin:`, undefined,
        `base: ${stackBase}, ${paramsWords} => ${resultsWords}`);

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
            output(ctx, 'WRITE32 PC');
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
}

function generateBranch(ctx: Ctx, target: WasmBlock, direction: WasmBranchDir | undefined, condition: BranchCondition,
    allowFallback: boolean): boolean {

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
            generateUnwind(ctx, keepWords, skipWords,
                4 * ctx.funcData.stackSize + ctx.funcData.frameSize - ctx.funcData.returnAddressOffset - 4);
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

function generateIf(ctx: Ctx, instr: WasmInstrBr | WasmInstrBrTable, target: WasmBlock,
    direction: WasmBranchDir | undefined, condition: BranchCondition, allowFallback: boolean) {

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
            output(ctx, `CALL ${target.name}`, undefined,
                comments.filter(x => x.indexOf('__trivm_magic_function__') < 0).join(', '));
            pop(ctx, valueTypeWords(instr.type?.params || target.type.params));
            push(ctx, valueTypeWords(instr.type?.results || target.type.results));
            break;
        }
        case WasmFunctionKind.INLINE_ASSEMBLY:
            outputAssembly(ctx, target.data);
            popPush(ctx, valueTypeWords(target.type.params), valueTypeWords(target.type.results));
            break;
        case WasmFunctionKind.HOST:
            output(ctx, 'HOST 0', instr, 'TODO: get index');
            break;
        default:
            output(ctx, `# CALL TODO: ${comments}`);
            break;
        }
        break;
    }
    /* eslint-disable max-len */
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

    /* eslint-enable max-len */

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

function exitInstr(/*ctx: ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>*/): void {
}

export interface TriwasmConf {
    tableLengthSize: number;
    tableElementSize: number;
    hostCallbacks: boolean;
    separateMemory: boolean;
    faults: {
        wasmTableIndex: boolean;
    };
    ext: {
        unwind: boolean;
    };
}


function generatePrologue(output: string[], module: WasmModule, conf: TriwasmConf) {
    if (conf.separateMemory) {
        output.push('.base 0x80000000');
    } else {
        output.push('.base 0');
        output.push('.vma ');
    }
    output.push('BR main_entry');
    output.push('.pma 5');
    output.push('BR fault_handler');
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
        },
        separateMemory: true,
    };
    generatePrologue(output, module, conf);
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
    /*let instr: WasmInstr;
    if (obj.instr) {
        instr = obj.instr;
    } else {
        instr = obj;
    }*/
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

let simpleGenerators: { [key: number]: [((ctx: any) => string), number, number]; } = {
    // -- Simple instructions - begin of source code generated with help of "gen-instr.ts" script --

    /* eslint-disable @typescript-eslint/no-unused-vars */

    [OP.NOP]: [(ctx: any) => '# NOP', 0, 0],
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
    [OP.I32_EQZ]: [(ctx: any) => 'NOT', 1, 1],
    [OP.I32_EQ]: [(ctx: any) => 'EQ', 2, 1],
    [OP.I32_LT_S]: [(ctx: any) => 'SLT', 2, 1],
    [OP.I32_LT_U]: [(ctx: any) => 'ULT', 2, 1],
    [OP.I32_GT_S]: [(ctx: any) => 'SGT', 2, 1],
    [OP.I32_GT_U]: [(ctx: any) => 'UGT', 2, 1],
    [OP.I64_EQ]: [(ctx: any) => 'EQ64', 4, 1],
    [OP.I64_LT_S]: [(ctx: any) => 'SLT64', 4, 1],
    [OP.I64_LT_U]: [(ctx: any) => 'ULT64', 4, 1],
    [OP.I64_GT_S]: [(ctx: any) => 'SGT64', 4, 1],
    [OP.I64_GT_U]: [(ctx: any) => 'UGT64', 4, 1],
    [OP.F32_EQ]: [(ctx: any) => 'EQF32', 2, 1],
    [OP.F32_LT]: [(ctx: any) => 'LTF32', 2, 1],
    [OP.F32_GT]: [(ctx: any) => 'GTF32', 2, 1],
    [OP.F32_LE]: [(ctx: any) => 'LEF32', 2, 1],
    [OP.F32_GE]: [(ctx: any) => 'GEF32', 2, 1],
    [OP.F64_EQ]: [(ctx: any) => 'EQF64', 4, 1],
    [OP.F64_LT]: [(ctx: any) => 'LTF64', 4, 1],
    [OP.F64_GT]: [(ctx: any) => 'GTF64', 4, 1],
    [OP.F64_LE]: [(ctx: any) => 'LEF64', 4, 1],
    [OP.F64_GE]: [(ctx: any) => 'GEF64', 4, 1],
    [OP.I32_ADD]: [(ctx: any) => 'ADD', 2, 1],
    [OP.I32_SUB]: [(ctx: any) => 'SUB', 2, 1],
    [OP.I32_MUL]: [(ctx: any) => 'MUL', 2, 1],
    [OP.I32_DIV_S]: [(ctx: any) => 'SDIV', 2, 1],
    [OP.I32_DIV_U]: [(ctx: any) => 'UDIV', 2, 1],
    [OP.I32_REM_S]: [(ctx: any) => 'SMOD', 2, 1],
    [OP.I32_REM_U]: [(ctx: any) => 'UMOD', 2, 1],
    [OP.I32_AND]: [(ctx: any) => 'AND', 2, 1],
    [OP.I32_OR]: [(ctx: any) => 'OR', 2, 1],
    [OP.I32_XOR]: [(ctx: any) => 'XOR', 2, 1],
    [OP.I32_SHL]: [(ctx: any) => 'SHL', 2, 1],
    [OP.I32_SHR_S]: [(ctx: any) => 'SSHR', 2, 1],
    [OP.I32_SHR_U]: [(ctx: any) => 'USHR', 2, 1],
    [OP.I64_ADD]: [(ctx: any) => 'ADD64', 4, 2],
    [OP.I64_SUB]: [(ctx: any) => 'SUB64', 4, 2],
    [OP.I64_MUL]: [(ctx: any) => 'MUL64', 4, 2],
    [OP.I64_DIV_S]: [(ctx: any) => 'SDIV64', 4, 2],
    [OP.I64_DIV_U]: [(ctx: any) => 'UDIV64', 4, 2],
    [OP.I64_REM_S]: [(ctx: any) => 'SMOD64', 4, 2],
    [OP.I64_REM_U]: [(ctx: any) => 'UMOD64', 4, 2],
    [OP.I64_AND]: [(ctx: any) => 'AND64', 4, 2],
    [OP.I64_OR]: [(ctx: any) => 'OR64', 4, 2],
    [OP.I64_XOR]: [(ctx: any) => 'XOR64', 4, 2],
    [OP.I64_SHL]: [(ctx: any) => 'SHL64', 4, 2],
    [OP.I64_SHR_S]: [(ctx: any) => 'SSHR64', 4, 2],
    [OP.I64_SHR_U]: [(ctx: any) => 'USHR64', 4, 2],
    [OP.F32_CEIL]: [(ctx: any) => 'CEILF32', 1, 1],
    [OP.F32_FLOOR]: [(ctx: any) => 'FLOORF32', 1, 1],
    [OP.F32_TRUNC]: [(ctx: any) => 'TRUNCF32', 1, 1],
    [OP.F32_NEAREST]: [(ctx: any) => 'NEARESTF32', 1, 1],
    [OP.F32_SQRT]: [(ctx: any) => 'SQRTF32', 1, 1],
    [OP.F32_ADD]: [(ctx: any) => 'ADDF32', 2, 1],
    [OP.F32_SUB]: [(ctx: any) => 'SUBF32', 2, 1],
    [OP.F32_MUL]: [(ctx: any) => 'MULF32', 2, 1],
    [OP.F32_DIV]: [(ctx: any) => 'DIVF32', 2, 1],
    [OP.F64_CEIL]: [(ctx: any) => 'CEILF64', 2, 2],
    [OP.F64_FLOOR]: [(ctx: any) => 'FLOORF64', 2, 2],
    [OP.F64_TRUNC]: [(ctx: any) => 'TRUNCF64', 2, 2],
    [OP.F64_NEAREST]: [(ctx: any) => 'NEARESTF64', 2, 2],
    [OP.F64_SQRT]: [(ctx: any) => 'SQRTF64', 2, 2],
    [OP.F64_ADD]: [(ctx: any) => 'ADDF64', 4, 2],
    [OP.F64_SUB]: [(ctx: any) => 'SUBF64', 4, 2],
    [OP.F64_MUL]: [(ctx: any) => 'MULF64', 4, 2],
    [OP.F64_DIV]: [(ctx: any) => 'DIVF64', 4, 2],
    [OP.TRIVM_POP]: [(ctx: any) => 'READ32 TMP0', 1, 0],
    [OP.TRIVM_DUP32]: [(ctx: any) => 'READ32 [SP]', 1, 2],
    [OP.TRIVM_DUP64]: [(ctx: any) => 'READ64 [SP] - 4', 2, 4],

    /* eslint-enable @typescript-eslint/no-unused-vars */

    // -- Simple instructions - end of source code generated with help of "gen-instr.ts" script --
};

