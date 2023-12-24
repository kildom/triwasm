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
    GlobalKind,
    valueTypeWords, WasmBlock, WasmBranchDir, WasmFunctionKind, WasmInstr, WasmInstrBr, WasmInstrBrTable, WasmModule
} from './wasmModule';
import { WasmConf } from './args';
import { getInstrPopPush } from './instrStack';

interface ModuleData {
    conf: WasmConf;
    output: string[];
    uniqueCounter: number;
}

interface FunctionData {
    stackSize: number; /// Current stack size (number of bytes above function frame)
    localsOffsets: number[]; /// Offset of each local variable (in function frame)
    returnAddressOffset: number; /// Return address offset (in function frame)
    frameSize: number; /// Size of the function frame: parameters, return addresses, locals
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

function enterFunction(ctx: EnterFunctionCtx<ModuleData>): FunctionData {
    let localsOffsets: number[] = [];
    let frameSize = 0;

    console.log(ctx.func.name);

    // Function parameters
    for (let p of ctx.func.type.params) {
        localsOffsets.push(frameSize);
        frameSize += 4 * valueTypeWords(p);
    }

    let returnAddressOffset = frameSize;

    // Return address
    frameSize += 4;

    let localsOffset = frameSize;

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
        if (ctx.func.locals.length > 0) {
            let localsSize = frameSize - localsOffset;
            if (localsSize >= 16) {
                ctx.moduleData.output.push('READSP');
                ctx.moduleData.output.push(`SUB -${localsSize}`);
                ctx.moduleData.output.push('WRITESP');
            } else {
                for (let i = 0; i < localsSize; i += 4) {
                    ctx.moduleData.output.push('READSP');
                }
            }
        }
        ctx.walkFunction = true;
        break;
    case WasmFunctionKind.ASSEMBLY:
        ctx.walkFunction = false;
        break;
    default:
        break;
    }

    return {
        stackSize: 0,
        localsOffsets,
        returnAddressOffset,
        frameSize,
    };
}

function exitFunction(ctx: ExitFunctionCtx<ModuleData, FunctionData>) {
    return ctx.func.kind !== WasmFunctionKind.WASM;
}

function enterBlock(ctx: EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): BlockData {
    let paramsWords = valueTypeWords(ctx.block.type.params);
    return {
        stackBase: ctx.funcData.stackSize - paramsWords,
        paramsWords,
        resultsWords: valueTypeWords(ctx.block.type.results),
    };
}

function exitBlock(ctx: ExitBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): void {
}

function enterInstr(ctx: Ctx): InstrData {
    let instrData: InstrData = {
    };
    let instr = ctx.instr;
    let output = ctx.moduleData.output;

    let popPush = getInstrPopPush(ctx.func, ctx.block, instr, undefined, true);


    switch (instr.opcode) {
    // ---- Generators - begin - generated with help of "wasm-instr.ts" script ----

    case OP.BLOCK: {
        // Handled by enterBlock
        break;
    }
    case OP.LOOP: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.IF: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.ELSE: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.END: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.BR: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.BR_IF: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.BR_TABLE: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.CALL: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.TABLE_GET: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.TABLE_SET: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.REF_FUNC: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.TRIVM_LOCAL_GET32: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.TRIVM_LOCAL_GET64: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.TRIVM_LOCAL_SET32: {
        ctx.moduleData.output.push(`WRITE32 [SP] - ${4 * (ctx.funcData.stackSize - popPush.poppedWords)
            + ctx.funcData.frameSize - ctx.funcData.localsOffsets[instr.index] - instr.offset}`);
        break;
    }
    case OP.TRIVM_LOCAL_SET64: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }
    case OP.TRIVM_RAW: {
        throw new Error(`Unimplemented ${instr.id}`);
        break;
    }

    // ---- Generators - end - generated with help of "wasm-instr.ts" script ----

    default: {
        let simpleGen = simpleGenerators[instr.opcode];
        if (simpleGen) {
            if (typeof (simpleGen) !== 'string') {
                simpleGen = simpleGen(instr);
            }
            ctx.moduleData.output.push(simpleGen);
        } else {
            throw new Error(`Unimplemented ${instr.id}`);
        }
        break;
    }
    }

    ctx.funcData.stackSize -= popPush.poppedWords;
    ctx.funcData.stackSize += popPush.pushedWords;

    return instrData;
}

function exitInstr(/*ctx: ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>*/): void {
}

export function generate(module: WasmModule, conf: WasmConf) {
    let output: string[] = [];
    try {
        walkFunctions(module,
            {
                conf,
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
    } finally {
        console.log(output.join('\n'));
    }
}


let simpleGenerators: { [key: number]: string | ((instr: any) => string); } = {
    // ---- Simple generators - begin - generated with help of "wasm-instr.ts" script ----

    /* eslint-disable max-len */
    [OP.NOP]: '# NOP',
    [OP.I32_LOAD]: (instr: OpType.I32_LOAD) => `UREAD32 [AMB0] + [POP] + ${instr.offset}`,
    [OP.I64_LOAD]: (instr: OpType.I64_LOAD) => `UREAD64 [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_LOAD8_S]: (instr: OpType.I32_LOAD8_S) => `UREAD8S [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_LOAD8_U]: (instr: OpType.I32_LOAD8_U) => `UREAD8U [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_LOAD16_S]: (instr: OpType.I32_LOAD16_S) => `UREAD16S [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_LOAD16_U]: (instr: OpType.I32_LOAD16_U) => `UREAD16U [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_STORE]: (instr: OpType.I32_STORE) => `UWRITE32 [AMB0] + [POP] + ${instr.offset}`,
    [OP.I64_STORE]: (instr: OpType.I64_STORE) => `UWRITE64 [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_STORE8]: (instr: OpType.I32_STORE8) => `UWRITE8 [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_STORE16]: (instr: OpType.I32_STORE16) => `UWRITE16 [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_CONST]: (instr: OpType.I32_CONST) => `NEG -(${instr.value})`,
    [OP.I64_CONST]: (instr: OpType.I64_CONST) => `NEG64 -(${instr.value})`,
    [OP.I32_EQZ]: 'NOT',
    [OP.I32_EQ]: 'EQ',
    [OP.I32_LT_S]: 'SLT',
    [OP.I32_LT_U]: 'ULT',
    [OP.I32_GT_S]: 'SGT',
    [OP.I32_GT_U]: 'UGT',
    [OP.I64_EQ]: 'EQ64',
    [OP.I64_LT_S]: 'SLT64',
    [OP.I64_LT_U]: 'ULT64',
    [OP.I64_GT_S]: 'SGT64',
    [OP.I64_GT_U]: 'UGT64',
    [OP.F32_EQ]: 'EQF32',
    [OP.F32_LT]: 'LTF32',
    [OP.F32_GT]: 'GTF32',
    [OP.F32_LE]: 'LEF32',
    [OP.F32_GE]: 'GEF32',
    [OP.F64_EQ]: 'EQF64',
    [OP.F64_LT]: 'LTF64',
    [OP.F64_GT]: 'GTF64',
    [OP.F64_LE]: 'LEF64',
    [OP.F64_GE]: 'GEF64',
    [OP.I32_ADD]: 'ADD',
    [OP.I32_SUB]: 'SUB',
    [OP.I32_MUL]: 'MUL',
    [OP.I32_DIV_S]: 'SDIV',
    [OP.I32_DIV_U]: 'UDIV',
    [OP.I32_REM_S]: 'SMOD',
    [OP.I32_REM_U]: 'UMOD',
    [OP.I32_AND]: 'AND',
    [OP.I32_OR]: 'OR',
    [OP.I32_XOR]: 'XOR',
    [OP.I32_SHL]: 'SHL',
    [OP.I32_SHR_S]: 'SSHR',
    [OP.I32_SHR_U]: 'USHR',
    [OP.I64_ADD]: 'ADD64',
    [OP.I64_SUB]: 'SUB64',
    [OP.I64_MUL]: 'MUL64',
    [OP.I64_DIV_S]: 'SDIV64',
    [OP.I64_DIV_U]: 'UDIV64',
    [OP.I64_REM_S]: 'SMOD64',
    [OP.I64_REM_U]: 'UMOD64',
    [OP.I64_AND]: 'AND64',
    [OP.I64_OR]: 'OR64',
    [OP.I64_XOR]: 'XOR64',
    [OP.I64_SHL]: 'SHL64',
    [OP.I64_SHR_S]: 'SSHR64',
    [OP.I64_SHR_U]: 'USHR64',
    [OP.F32_CEIL]: 'CEILF32',
    [OP.F32_FLOOR]: 'FLOORF32',
    [OP.F32_TRUNC]: 'TRUNCF32',
    [OP.F32_NEAREST]: 'NEARESTF32',
    [OP.F32_SQRT]: 'SQRTF32',
    [OP.F32_ADD]: 'ADDF32',
    [OP.F32_SUB]: 'SUBF32',
    [OP.F32_MUL]: 'MULF32',
    [OP.F32_DIV]: 'DIVF32',
    [OP.F64_CEIL]: 'CEILF64',
    [OP.F64_FLOOR]: 'FLOORF64',
    [OP.F64_TRUNC]: 'TRUNCF64',
    [OP.F64_NEAREST]: 'NEARESTF64',
    [OP.F64_SQRT]: 'SQRTF64',
    [OP.F64_ADD]: 'ADDF64',
    [OP.F64_SUB]: 'SUBF64',
    [OP.F64_MUL]: 'MULF64',
    [OP.F64_DIV]: 'DIVF64',
    [OP.I32_TRUNC_F32_S]: 'TRUNCF32S32',
    [OP.I32_TRUNC_F32_U]: 'TRUNCF32U32',
    [OP.I32_TRUNC_F64_S]: 'TRUNCF64S32',
    [OP.I32_TRUNC_F64_U]: 'TRUNCF64U32',
    [OP.I64_EXTEND_I32_S]: 'EXTS64HL 32',
    [OP.I64_TRUNC_F32_S]: 'TRUNCF32S64',
    [OP.I64_TRUNC_F32_U]: 'TRUNCF32U64',
    [OP.I64_TRUNC_F64_S]: 'TRUNCF64S64',
    [OP.I64_TRUNC_F64_U]: 'TRUNCF64U64',
    [OP.F32_CONVERT_I32_S]: 'CONVF32S32',
    [OP.F32_CONVERT_I32_U]: 'CONVF32U32',
    [OP.F32_CONVERT_I64_S]: 'CONVF32S64',
    [OP.F32_CONVERT_I64_U]: 'CONVF32U64',
    [OP.F32_DEMOTE_F64]: 'DEMOTE',
    [OP.F64_CONVERT_I32_S]: 'CONVF64S32',
    [OP.F64_CONVERT_I32_U]: 'CONVF64U32',
    [OP.F64_CONVERT_I64_S]: 'CONVF64S64',
    [OP.F64_CONVERT_I64_U]: 'CONVF64U64',
    [OP.F64_PROMOTE_F32]: 'PROMOTE',
    [OP.TRIVM_POP]: 'WRITE32 GPR0',
    [OP.TRIVM_DUP32]: 'READ32 [SP]',
    [OP.TRIVM_DUP64]: 'READ64 [SP] - 4',
    [OP.TRIVM_GLOBAL_GET32]: (instr: OpType.TRIVM_GLOBAL_GET32) => `READ32 $_global_${instr.global.index} + ${instr.offset}`,
    [OP.TRIVM_GLOBAL_GET64]: (instr: OpType.TRIVM_GLOBAL_GET64) => `READ64 $_global_${instr.global.index} + ${instr.offset}`,
    [OP.TRIVM_GLOBAL_SET32]: (instr: OpType.TRIVM_GLOBAL_SET32) => `WRITE32 $_global_${instr.global.index} + ${instr.offset}`,
    [OP.TRIVM_GLOBAL_SET64]: (instr: OpType.TRIVM_GLOBAL_SET64) => `WRITE64 $_global_${instr.global.index} + ${instr.offset}`,
    [OP.TRIVM_SHL_CONST]: (instr: OpType.TRIVM_SHL_CONST) => `SHL ${instr.value}`,
    [OP.TRIVM_USHR_CONST]: (instr: OpType.TRIVM_USHR_CONST) => `USHR ${instr.value}`,
    [OP.TRIVM_SSHR_CONST]: (instr: OpType.TRIVM_SSHR_CONST) => `SSHR ${instr.value}`,
    [OP.TRIVM_EXTS_CONST]: (instr: OpType.TRIVM_EXTS_CONST) => `EXTS ${instr.value}`,
    [OP.TRIVM_EXTS64_CONST]: (instr: OpType.TRIVM_EXTS64_CONST) => `EXTS64 ${instr.value}`,
    /* eslint-enable max-len */

    // ---- Simple generators - end - generated with help of "wasm-instr.ts" script ----
};
