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

import { WasmConf } from './args';
import { StackModifyMode, getInstrPopPush } from './instrStack';
import { EnterBlockCtx, EnterInstrCtx, ExitBlockCtx, ExitInstrCtx, walkFunctions } from './moduleWalker';
import { OP } from './opcodes';
import {
    instrId, NumberType, ValueType, WasmBlock, WasmBranchDir, WasmFunction,
    WasmFunctionKind, WasmInstr, WasmInstrCall, WasmInstrIf, WasmModule, FunctionType
} from './wasmModule';


interface ModuleData {
    conf: WasmConf;
}

type FunctionData = undefined;

interface BlockData {
    typeStack: ValueType[];     // Type stack within current block
    newBody: WasmInstr[];       // New array of instructions in this block
    unreachable: boolean;       // Current state of reachability of instructions
    isForwardTarget: boolean;   // If this block a target for forward branches
}

interface InstrData {
    nextUnreachable: boolean;   // set to true if next instruction is unreachable
}

type Ctx = EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData>;


function enterFunction(/*ctx: EnterFunctionCtx<ModuleData>*/): FunctionData {
    return undefined;
}


function exitFunction(/*ctx: ExitFunctionCtx<ModuleData, FunctionData>*/): void {

}


function enterBlock(ctx: EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): BlockData {
    return {
        typeStack: [...ctx.block.type.params],
        newBody: [],
        unreachable: false,
        // "IF" without "ELSE" is always forward target
        isForwardTarget: ctx.instrStack.length > 0 &&
            ctx.instrStack.at(-1)!.opcode === OP.IF &&
            !(ctx.instrStack.at(-1) as WasmInstrIf).withElse,
    };
}


function exitBlock(ctx: ExitBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): void {
    // Move new body to old body array
    ctx.block.body.splice(0, Infinity);
    for (let instr of ctx.blockData.newBody) {
        ctx.block.body.push(instr);
    }
    // If this is not forward branch target then next instruction after this block is unreachable
    if (!ctx.blockData.isForwardTarget && ctx.instrDataStack.length > 0) {
        ctx.instrDataStack.at(-1)!.nextUnreachable = true;
    }
}


function enterInstr(ctx: Ctx): InstrData {
    let instrData: InstrData = {
        nextUnreachable: ctx.blockData.unreachable,
    };
    if (!ctx.blockData.unreachable || ctx.instr.opcode == OP.ELSE) {
        reduceInstr(ctx, instrData);
    } else if (ctx.instr.opcode == OP.END) {
        ctx.blockData.newBody.push(ctx.instr);
    } else {
        // skip other unreachable instructions and its blocks
        ctx.walkBlock = false;
    }
    return instrData;
}


function exitInstr(ctx: ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>): void {
    ctx.blockData.unreachable = ctx.instrData.nextUnreachable;
}


export function reduce(module: WasmModule, conf: WasmConf) {
    walkFunctions(module,
        {
            conf
        },
        {
            enterFunction,
            exitFunction,
            enterBlock,
            exitBlock,
            enterInstr,
            exitInstr,
        });
}


function createTriWasmLibCall(ctx: Ctx, name: string, type?: FunctionType): WasmInstrCall {
    let func = ctx.module.getExported('__triwasm__softfloatlib', name, false);
    if (func === undefined) {
        func = ctx.module.getExported('__triwasm__triwasmlib', name, true);
    }
    return { id: instrId(ctx.instr), opcode: OP.CALL, func, type };
}


function handleAnnotation(ctx: Ctx, func: WasmFunction) {
    if (func.kind != WasmFunctionKind.ANNOTATION) {
        return false;
    }
    let text = func.data;
    if (!text) {
        return false;
    }
    if (text.startsWith('triasm_name:')) {
        ctx.func.name = text.substring(12).trim();
        return true;
    } else {
        return false;
    }
}


function getBlockData(ctx: Ctx, target: WasmBlock): BlockData | undefined {
    for (let i = 0; i < ctx.blockStack.length; i++) {
        if (ctx.blockStack[i] === target) {
            return ctx.blockDataStack[i];
        }
    }
}

function reduceInstr(ctx: Ctx, instrData: InstrData) {
    let instr = ctx.instr;
    let newBody = ctx.blockData.newBody;
    let func = ctx.func;
    let conf = ctx.moduleData.conf;
    let ext = conf.vmConf.extensions;

    let popPush = getInstrPopPush(func, ctx.block, instr, ctx.blockData.typeStack, true, StackModifyMode.STRICT);

    instrData.nextUnreachable = instrData.nextUnreachable || popPush.unreachable;

    switch (instr.opcode) {
    // -- Begin of source code generated with help of "gen-instr.ts" script --

    case OP.UNREACHABLE: {
        if (conf.faults.unreachable) {
            newBody.push({
                id: instrId(instr),
                opcode: OP.TRIVM_RAW,
                code: 'CALL $__trigger_unreachable',
                type: {
                    params: [],
                    results: [],
                },
                noReturn: true,
            });
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.NOP });
        }
        instrData.nextUnreachable = true;
        break;
    }
    case OP.ELSE: {
        ctx.blockData.typeStack = [...ctx.blockStack.at(-1)!.type.params];
        if (!ctx.blockData.unreachable) {
            let target = ctx.blockStack.at(-1) as WasmBlock;
            newBody.push({ id: instrId(instr), opcode: OP.BR, target, direction: WasmBranchDir.Forward });
            ctx.blockDataStack.at(-1)!.isForwardTarget = true;
        }
        instrData.nextUnreachable = false;
        newBody.push(instr);
        break;
    }
    case OP.END: {
        let target = ctx.blockStack.at(-1) as WasmBlock;
        newBody.push({ id: instrId(instr), opcode: OP.BR, target, direction: WasmBranchDir.Forward });
        ctx.blockDataStack.at(-1)!.isForwardTarget = true;
        instrData.nextUnreachable = true;
        newBody.push(instr);
        break;
    }
    case OP.BR: {
        let target = instr.target;
        if (instr.direction == WasmBranchDir.Forward) {
            getBlockData(ctx, target)!.isForwardTarget = true;
        }
        instrData.nextUnreachable = true;
        newBody.push(instr);
        break;
    }
    case OP.BR_IF: {
        let target = instr.target;
        if (instr.direction == WasmBranchDir.Forward) {
            getBlockData(ctx, target)!.isForwardTarget = true;
        }
        newBody.push(instr);
        break;
    }
    case OP.BR_TABLE: {
        for (let target of instr.targets) {
            let direction = (target.parentInstruction.opcode === OP.LOOP) ? WasmBranchDir.Backward : WasmBranchDir.Forward;
            if (direction === WasmBranchDir.Forward) {
                getBlockData(ctx, target)!.isForwardTarget = true;
            }
        }
        instrData.nextUnreachable = true;
        newBody.push(instr);
        break;
    }
    case OP.RETURN: {
        let target = ctx.blockStack[0];
        newBody.push({ id: instrId(instr), opcode: OP.BR, target, direction: WasmBranchDir.Forward });
        getBlockData(ctx, target)!.isForwardTarget = true;
        instrData.nextUnreachable = true;
        break;
    }
    case OP.CALL: {
        let func = instr.func.resolved;
        if (handleAnnotation(ctx, func)) {
            break;
        }
        newBody.push(instr);
        break;
    }
    case OP.CALL_INDIRECT: {
        newBody.push({
            id: instrId(instr),
            opcode: OP.TRIVM_RAW,
            code: `CALL __call_indirect_table${instr.table.index}`,
            type: {
                params: [...instr.type.params, NumberType.I32],
                results: [...instr.type.results],
            },
            noReturn: false,
        });
        break;
    }
    case OP.DROP: {
        for (let i = 0; i < popPush.poppedWords; i++) {
            newBody.push({ id: instrId(instr), opcode: OP.TRIVM_POP });
        }
        break;
    }
    case OP.SELECT:
    case OP.SELECT_T: {
        newBody.push(createTriWasmLibCall(ctx, 'select' + (32 * popPush.pushedWords)));
        break;
    }
    case OP.LOCAL_GET: {
        let words = popPush.pushedWords;
        let offset = 0;
        while (words > 0) {
            if (ext.mem64 && words > 1) {
                newBody.push({ id: instrId(instr), opcode: OP.TRIVM_LOCAL_GET64, index: instr.index, offset });
                offset += 8;
                words -= 2;
            } else {
                newBody.push({ id: instrId(instr), opcode: OP.TRIVM_LOCAL_GET32, index: instr.index, offset });
                offset += 4;
                words -= 1;
            }
        }
        break;
    }
    case OP.LOCAL_SET: {
        let words = popPush.poppedWords;
        while (words > 0) {
            if (ext.mem64 && words > 1) {
                words -= 2;
                newBody.push({ id: instrId(instr), opcode: OP.TRIVM_LOCAL_SET64, index: instr.index, offset: 4 * words });
            } else {
                words -= 1;
                newBody.push({ id: instrId(instr), opcode: OP.TRIVM_LOCAL_SET32, index: instr.index, offset: 4 * words });
            }
        }
        break;
    }
    case OP.LOCAL_TEE: {
        let words = popPush.poppedWords;
        let offset = 0;
        while (words > 0) {
            if (ext.mem64 && words > 1) {
                words -= 2;
                newBody.push({ id: instrId(instr), opcode: OP.TRIVM_DUP64, offset });
                newBody.push({ id: instrId(instr), opcode: OP.TRIVM_LOCAL_SET64, index: instr.index, offset: 4 * words });
                offset += 8;
            } else {
                words -= 1;
                newBody.push({ id: instrId(instr), opcode: OP.TRIVM_DUP32, offset });
                newBody.push({ id: instrId(instr), opcode: OP.TRIVM_LOCAL_SET32, index: instr.index, offset: 4 * words });
                offset += 4;
            }
        }
        break;
    }
    case OP.GLOBAL_GET: {
        let global = instr.global;
        let words = popPush.pushedWords;
        let offset = 0;
        while (words > 0) {
            if (ext.mem64 && words > 1) {
                newBody.push({ id: instrId(instr), opcode: OP.TRIVM_GLOBAL_GET64, global, offset });
                offset += 8;
                words -= 2;
            } else {
                newBody.push({ id: instrId(instr), opcode: OP.TRIVM_GLOBAL_GET32, global, offset });
                offset += 4;
                words -= 1;
            }
        }
        break;
    }
    case OP.GLOBAL_SET: {
        let global = instr.global;
        let words = popPush.poppedWords;
        while (words > 0) {
            if (ext.mem64 && words > 1) {
                words -= 2;
                newBody.push({ id: instrId(instr), opcode: OP.TRIVM_GLOBAL_SET64, global, offset: 4 * words });
            } else {
                words -= 1;
                newBody.push({ id: instrId(instr), opcode: OP.TRIVM_GLOBAL_SET32, global, offset: 4 * words });
            }
        }
        break;
    }
    case OP.TABLE_GET: {
        break;
    }
    case OP.TABLE_SET: {
        break;
    }
    case OP.MEMORY_INIT: {
        break;
    }
    case OP.TABLE_INIT: {
        break;
    }
    /* eslint-disable max-len */
    case OP.I64_LOAD: { // Generated from expression: {#mem64} ## {elif ..offset == 0} @i64_load_0 {else} i32.const value:..offset ; @i64_load
        if (ext.mem64) {
            newBody.push(instr);
        } else if (instr.offset == 0) {
            newBody.push(createTriWasmLibCall(ctx, 'i64_load_0'));
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'i64_load'));
        }
        break;
    }
    case OP.F32_LOAD: { // Generated from expression: i32.load offset, memory
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD, offset: instr.offset, memory: instr.memory });
        break;
    }
    case OP.F64_LOAD: { // Generated from expression: {#mem64} i64.load memory, offset {elif ..offset == 0} @i64_load_0 {else} i32.const value:..offset ; @i64_load
        if (ext.mem64) {
            newBody.push({ id: instrId(instr), opcode: OP.I64_LOAD, memory: instr.memory, offset: instr.offset });
        } else if (instr.offset == 0) {
            newBody.push(createTriWasmLibCall(ctx, 'i64_load_0'));
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'i64_load'));
        }
        break;
    }
    case OP.I64_LOAD8_S: { // Generated from expression: i32.load8_s offset, memory {#i64} i64.extend_i32_s {else} @i64_extend_i32_s
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD8_S, offset: instr.offset, memory: instr.memory });
        if (ext.int64) {
            newBody.push({ id: instrId(instr), opcode: OP.I64_EXTEND_I32_S });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_extend_i32_s'));
        }
        break;
    }
    case OP.I64_LOAD8_U: { // Generated from expression: i32.load8_u memory, offset ; i32.const value:0
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD8_U, memory: instr.memory, offset: instr.offset });
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        break;
    }
    case OP.I64_LOAD16_S: { // Generated from expression: i32.load16_s offset, memory {#i64} i64.extend_i32_s {else} @i64_extend_i32_s
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD16_S, offset: instr.offset, memory: instr.memory });
        if (ext.int64) {
            newBody.push({ id: instrId(instr), opcode: OP.I64_EXTEND_I32_S });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_extend_i32_s'));
        }
        break;
    }
    case OP.I64_LOAD16_U: { // Generated from expression: i32.load16_u memory, offset ; i32.const value:0
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD16_U, memory: instr.memory, offset: instr.offset });
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        break;
    }
    case OP.I64_LOAD32_S: { // Generated from expression: i32.load offset, memory {#i64} i64.extend_i32_s {else} @i64_extend_i32_s
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD, offset: instr.offset, memory: instr.memory });
        if (ext.int64) {
            newBody.push({ id: instrId(instr), opcode: OP.I64_EXTEND_I32_S });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_extend_i32_s'));
        }
        break;
    }
    case OP.I64_LOAD32_U: { // Generated from expression: i32.load offset, memory ; i32.const value:0
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD, offset: instr.offset, memory: instr.memory });
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        break;
    }
    case OP.I64_STORE: { // Generated from expression: {#mem64} ## {elif ..offset == 0} @i64_store_0 {else} i32.const value:..offset ; @i64_store {end}
        if (ext.mem64) {
            newBody.push(instr);
        } else if (instr.offset == 0) {
            newBody.push(createTriWasmLibCall(ctx, 'i64_store_0'));
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'i64_store'));
        }
        break;
    }
    case OP.F32_STORE: { // Generated from expression: i32.store offset, memory
        newBody.push({ id: instrId(instr), opcode: OP.I32_STORE, offset: instr.offset, memory: instr.memory });
        break;
    }
    case OP.F64_STORE: { // Generated from expression: {#mem64} i64.store offset, memory {elif ..offset == 0} @i64_store_0 {else} i32.const value:..offset ; @i64_store {end}
        if (ext.mem64) {
            newBody.push({ id: instrId(instr), opcode: OP.I64_STORE, offset: instr.offset, memory: instr.memory });
        } else if (instr.offset == 0) {
            newBody.push(createTriWasmLibCall(ctx, 'i64_store_0'));
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'i64_store'));
        }
        break;
    }
    case OP.I64_STORE8: { // Generated from expression: trivm.pop value: 1 ; i32.store8 offset, memory
        newBody.push({ id: instrId(instr), opcode: OP.TRIVM_POP });
        newBody.push({ id: instrId(instr), opcode: OP.I32_STORE8, offset: instr.offset, memory: instr.memory });
        break;
    }
    case OP.I64_STORE16: { // Generated from expression: trivm.pop value: 1 ; i32.store16 offset, memory
        newBody.push({ id: instrId(instr), opcode: OP.TRIVM_POP });
        newBody.push({ id: instrId(instr), opcode: OP.I32_STORE16, offset: instr.offset, memory: instr.memory });
        break;
    }
    case OP.I64_STORE32: { // Generated from expression: trivm.pop value: 1 ; i32.store offset, memory
        newBody.push({ id: instrId(instr), opcode: OP.TRIVM_POP });
        newBody.push({ id: instrId(instr), opcode: OP.I32_STORE, offset: instr.offset, memory: instr.memory });
        break;
    }
    case OP.MEMORY_SIZE: { // Generated from expression: @memory_size
        newBody.push(createTriWasmLibCall(ctx, 'memory_size'));
        break;
    }
    case OP.MEMORY_GROW: { // Generated from expression: @memory_grow
        newBody.push(createTriWasmLibCall(ctx, 'memory_grow'));
        break;
    }
    case OP.I64_CONST: { // Generated from expression: {#i64} ## {else} i32.const value: Number(..value & 0xFFFFFFFFn) & 0xFFFFFFFF ; i32.const value: Number(..value >> 32n) & 0xFFFFFFFF
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: Number(instr.value & 0xFFFFFFFFn) & 0xFFFFFFFF });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: Number(instr.value >> 32n) & 0xFFFFFFFF });
        }
        break;
    }
    case OP.F32_CONST: { // Generated from expression: i32.const value
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.value });
        break;
    }
    case OP.F64_CONST: { // Generated from expression: {#i64} i64.const value {else} i32.const value: Number(..value & 0xFFFFFFFFn) & 0xFFFFFFFF ; i32.const value: Number(..value >> 32n) & 0xFFFFFFFF
        if (ext.int64) {
            newBody.push({ id: instrId(instr), opcode: OP.I64_CONST, value: instr.value });
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: Number(instr.value & 0xFFFFFFFFn) & 0xFFFFFFFF });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: Number(instr.value >> 32n) & 0xFFFFFFFF });
        }
        break;
    }
    case OP.I32_NE: { // Generated from expression: i32.eq ; i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQ });
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        break;
    }
    case OP.I32_LE_S: { // Generated from expression: i32.gt_s ; i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_GT_S });
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        break;
    }
    case OP.I32_LE_U: { // Generated from expression: i32.gt_u ; i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_GT_U });
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        break;
    }
    case OP.I32_GE_S: { // Generated from expression: i32.lt_s ; i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_LT_S });
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        break;
    }
    case OP.I32_GE_U: { // Generated from expression: i32.lt_u ; i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_LT_U });
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        break;
    }
    case OP.I64_EQZ: { // Generated from expression: i32.or ; i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_OR });
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        break;
    }
    case OP.I64_EQ: { // Generated from expression: {#i64} ## {else} @i64_eq
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_eq'));
        }
        break;
    }
    case OP.I64_NE: { // Generated from expression: {#i64} i64.eq ; i32.eqz {else} @i64_ne
        if (ext.int64) {
            newBody.push({ id: instrId(instr), opcode: OP.I64_EQ });
            newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_ne'));
        }
        break;
    }
    case OP.I64_LT_S: { // Generated from expression: {#i64} ## {else} @i64_lt_s
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_lt_s'));
        }
        break;
    }
    case OP.I64_LT_U: { // Generated from expression: {#i64} ## {else} @i64_lt_u
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_lt_u'));
        }
        break;
    }
    case OP.I64_GT_S: { // Generated from expression: {#i64} ## {else} @i64_gt_s
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_gt_s'));
        }
        break;
    }
    case OP.I64_GT_U: { // Generated from expression: {#i64} ## {else} @i64_gt_u
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_gt_u'));
        }
        break;
    }
    case OP.I64_LE_S: { // Generated from expression: {#i64} ## ; i32.eqz {else} @i64_le_s
        if (ext.int64) {
            newBody.push(instr);
            newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_le_s'));
        }
        break;
    }
    case OP.I64_LE_U: { // Generated from expression: {#i64} ## ; i32.eqz {else} @i64_le_u
        if (ext.int64) {
            newBody.push(instr);
            newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_le_u'));
        }
        break;
    }
    case OP.I64_GE_S: { // Generated from expression: {#i64} ## ; i32.eqz {else} @i64_ge_s
        if (ext.int64) {
            newBody.push(instr);
            newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_ge_s'));
        }
        break;
    }
    case OP.I64_GE_U: { // Generated from expression: {#i64} ## ; i32.eqz {else} @i64_ge_u
        if (ext.int64) {
            newBody.push(instr);
            newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_ge_u'));
        }
        break;
    }
    case OP.F32_EQ: { // Generated from expression: {#f32} ## {else} @f32_eq
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_eq'));
        }
        break;
    }
    case OP.F32_NE: { // Generated from expression: {#f32} f32.eq ; i32.eqz {else} @f32_ne
        if (ext.float32) {
            newBody.push({ id: instrId(instr), opcode: OP.F32_EQ });
            newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_ne'));
        }
        break;
    }
    case OP.F32_LT: { // Generated from expression: {#f32} ## {else} @f32_lt
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_lt'));
        }
        break;
    }
    case OP.F32_GT: { // Generated from expression: {#f32} ## {else} @f32_gt
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_gt'));
        }
        break;
    }
    case OP.F32_LE: { // Generated from expression: {#f32} ## {else} @f32_le
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_le'));
        }
        break;
    }
    case OP.F32_GE: { // Generated from expression: {#f32} ## {else} @f32_ge
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_ge'));
        }
        break;
    }
    case OP.F64_EQ: { // Generated from expression: {#f64} ## {else} @f64_eq
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_eq'));
        }
        break;
    }
    case OP.F64_NE: { // Generated from expression: {#f64} f64.eq ; i32.eqz {else} @f64_ne
        if (ext.float64) {
            newBody.push({ id: instrId(instr), opcode: OP.F64_EQ });
            newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_ne'));
        }
        break;
    }
    case OP.F64_LT: { // Generated from expression: {#f64} ## {else} @f64_lt
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_lt'));
        }
        break;
    }
    case OP.F64_GT: { // Generated from expression: {#f64} ## {else} @f64_gt
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_gt'));
        }
        break;
    }
    case OP.F64_LE: { // Generated from expression: {#f64} ## {else} @f64_le
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_le'));
        }
        break;
    }
    case OP.F64_GE: { // Generated from expression: {#f64} ## {else} @f64_ge
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_ge'));
        }
        break;
    }
    case OP.I32_CLZ: { // Generated from expression: @i32_clz
        newBody.push(createTriWasmLibCall(ctx, 'i32_clz'));
        break;
    }
    case OP.I32_CTZ: { // Generated from expression: @i32_ctz
        newBody.push(createTriWasmLibCall(ctx, 'i32_ctz'));
        break;
    }
    case OP.I32_POPCNT: { // Generated from expression: @i32_popcnt
        newBody.push(createTriWasmLibCall(ctx, 'i32_popcnt'));
        break;
    }
    case OP.I32_ROTL: { // Generated from expression: @i32_rotl
        newBody.push(createTriWasmLibCall(ctx, 'i32_rotl'));
        break;
    }
    case OP.I32_ROTR: { // Generated from expression: @i32_rotr
        newBody.push(createTriWasmLibCall(ctx, 'i32_rotr'));
        break;
    }
    case OP.I64_CLZ: { // Generated from expression: @i64_clz32; i32.const value:0
        newBody.push(createTriWasmLibCall(ctx, 'i64_clz32'));
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        break;
    }
    case OP.I64_CTZ: { // Generated from expression: @i64_ctz32; i32.const value:0
        newBody.push(createTriWasmLibCall(ctx, 'i64_ctz32'));
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        break;
    }
    case OP.I64_POPCNT: { // Generated from expression: @i64_popcnt32; i32.const value:0
        newBody.push(createTriWasmLibCall(ctx, 'i64_popcnt32'));
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        break;
    }
    case OP.I64_ADD: { // Generated from expression: {#i64} ## {else} @i64_add
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_add'));
        }
        break;
    }
    case OP.I64_SUB: { // Generated from expression: {#i64} ## {else} @i64_sub
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_sub'));
        }
        break;
    }
    case OP.I64_MUL: { // Generated from expression: {#i64} ## {else} @i64_mul
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_mul'));
        }
        break;
    }
    case OP.I64_DIV_S: { // Generated from expression: {#i64} ## {else} @i64_div_s
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_div_s'));
        }
        break;
    }
    case OP.I64_DIV_U: { // Generated from expression: {#i64} ## {else} @i64_div_u
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_div_u'));
        }
        break;
    }
    case OP.I64_REM_S: { // Generated from expression: {#i64} ## {else} @i64_rem_s
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_rem_s'));
        }
        break;
    }
    case OP.I64_REM_U: { // Generated from expression: {#i64} ## {else} @i64_rem_u
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_rem_u'));
        }
        break;
    }
    case OP.I64_AND: { // Generated from expression: {#i64} ## {else} @i64_and
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_and'));
        }
        break;
    }
    case OP.I64_OR: { // Generated from expression: {#i64} ## {else} @i64_or
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_or'));
        }
        break;
    }
    case OP.I64_XOR: { // Generated from expression: {#i64} ## {else} @i64_xor
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_xor'));
        }
        break;
    }
    case OP.I64_SHL: { // Generated from expression: {#i64} ## {else} @i64_shl
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_shl'));
        }
        break;
    }
    case OP.I64_SHR_S: { // Generated from expression: {#i64} ## {else} @i64_shr_s
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_shr_s'));
        }
        break;
    }
    case OP.I64_SHR_U: { // Generated from expression: {#i64} ## {else} @i64_shr_u
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_shr_u'));
        }
        break;
    }
    case OP.I64_ROTL: { // Generated from expression: @i64_rotl
        newBody.push(createTriWasmLibCall(ctx, 'i64_rotl'));
        break;
    }
    case OP.I64_ROTR: { // Generated from expression: @i64_rotr
        newBody.push(createTriWasmLibCall(ctx, 'i64_rotr'));
        break;
    }
    case OP.F32_ABS: { // Generated from expression: i32.const value: -1 ; trivm.ushr_const value: 1 ; i32.and
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: -1 });
        newBody.push({ id: instrId(instr), opcode: OP.TRIVM_USHR_CONST, value: 1 });
        newBody.push({ id: instrId(instr), opcode: OP.I32_AND });
        break;
    }
    case OP.F32_NEG: { // Generated from expression: i32.const value: 1 ; trivm.shl_const value: 31 ; i32.xor
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 1 });
        newBody.push({ id: instrId(instr), opcode: OP.TRIVM_SHL_CONST, value: 31 });
        newBody.push({ id: instrId(instr), opcode: OP.I32_XOR });
        break;
    }
    case OP.F32_CEIL: { // Generated from expression: {#f32} ## {else} @f32_ceil
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_ceil'));
        }
        break;
    }
    case OP.F32_FLOOR: { // Generated from expression: {#f32} ## {else} @f32_floor
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_floor'));
        }
        break;
    }
    case OP.F32_TRUNC: { // Generated from expression: {#f32} ## {else} @f32_trunc
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_trunc'));
        }
        break;
    }
    case OP.F32_NEAREST: { // Generated from expression: {#f32} ## {else} @f32_nearest
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_nearest'));
        }
        break;
    }
    case OP.F32_SQRT: { // Generated from expression: {#f32} ## {else} @f32_sqrt
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_sqrt'));
        }
        break;
    }
    case OP.F32_ADD: { // Generated from expression: {#f32} ## {else} @f32_add
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_add'));
        }
        break;
    }
    case OP.F32_SUB: { // Generated from expression: {#f32} ## {else} @f32_sub
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_sub'));
        }
        break;
    }
    case OP.F32_MUL: { // Generated from expression: {#f32} ## {else} @f32_mul
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_mul'));
        }
        break;
    }
    case OP.F32_DIV: { // Generated from expression: {#f32} ## {else} @f32_div
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_div'));
        }
        break;
    }
    case OP.F32_MIN: { // Generated from expression: @f32_min
        newBody.push(createTriWasmLibCall(ctx, 'f32_min'));
        break;
    }
    case OP.F32_MAX: { // Generated from expression: @f32_max
        newBody.push(createTriWasmLibCall(ctx, 'f32_max'));
        break;
    }
    case OP.F32_COPYSIGN: { // Generated from expression: @f32_copysign
        newBody.push(createTriWasmLibCall(ctx, 'f32_copysign'));
        break;
    }
    case OP.F64_ABS: { // Generated from expression: @f64_abs
        newBody.push(createTriWasmLibCall(ctx, 'f64_abs'));
        break;
    }
    case OP.F64_NEG: { // Generated from expression: @f64_neg
        newBody.push(createTriWasmLibCall(ctx, 'f64_neg'));
        break;
    }
    case OP.F64_CEIL: { // Generated from expression: {#f64} ## {else} @f64_ceil
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_ceil'));
        }
        break;
    }
    case OP.F64_FLOOR: { // Generated from expression: {#f64} ## {else} @f64_floor
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_floor'));
        }
        break;
    }
    case OP.F64_TRUNC: { // Generated from expression: {#f64} ## {else} @f64_trunc
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_trunc'));
        }
        break;
    }
    case OP.F64_NEAREST: { // Generated from expression: {#f64} ## {else} @f64_nearest
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_nearest'));
        }
        break;
    }
    case OP.F64_SQRT: { // Generated from expression: {#f64} ## {else} @f64_sqrt
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_sqrt'));
        }
        break;
    }
    case OP.F64_ADD: { // Generated from expression: {#f64} ## {else} @f64_add
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_add'));
        }
        break;
    }
    case OP.F64_SUB: { // Generated from expression: {#f64} ## {else} @f64_sub
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_sub'));
        }
        break;
    }
    case OP.F64_MUL: { // Generated from expression: {#f64} ## {else} @f64_mul
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_mul'));
        }
        break;
    }
    case OP.F64_DIV: { // Generated from expression: {#f64} ## {else} @f64_div
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_div'));
        }
        break;
    }
    case OP.F64_MIN: { // Generated from expression: @f64_min
        newBody.push(createTriWasmLibCall(ctx, 'f64_min'));
        break;
    }
    case OP.F64_MAX: { // Generated from expression: @f64_max
        newBody.push(createTriWasmLibCall(ctx, 'f64_max'));
        break;
    }
    case OP.F64_COPYSIGN: { // Generated from expression: @f64_copysign
        newBody.push(createTriWasmLibCall(ctx, 'f64_copysign'));
        break;
    }
    case OP.I32_WRAP_I64: { // Generated from expression: trivm.pop value: 1
        newBody.push({ id: instrId(instr), opcode: OP.TRIVM_POP });
        break;
    }
    case OP.I32_TRUNC_F32_S: { // Generated from expression: {#f32} ## {else} @i32_trunc_f32_s
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i32_trunc_f32_s'));
        }
        break;
    }
    case OP.I32_TRUNC_F32_U: { // Generated from expression: {#f32} ## {else} @i32_trunc_f32_u
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i32_trunc_f32_u'));
        }
        break;
    }
    case OP.I32_TRUNC_F64_S: { // Generated from expression: {#f64} ## {else} @i32_trunc_f64_s
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i32_trunc_f64_s'));
        }
        break;
    }
    case OP.I32_TRUNC_F64_U: { // Generated from expression: {#f64} ## {else} @i32_trunc_f64_u
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i32_trunc_f64_u'));
        }
        break;
    }
    case OP.I64_EXTEND_I32_S: { // Generated from expression: {#i64} ## {else} TRIVM.DUP32 offset:0 ; trivm.sshr_const value:31
        if (ext.int64) {
            newBody.push(instr);
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.TRIVM_DUP32, offset: 0 });
            newBody.push({ id: instrId(instr), opcode: OP.TRIVM_SSHR_CONST, value: 31 });
        }
        break;
    }
    case OP.I64_EXTEND_I32_U: { // Generated from expression: i32.const value:0
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        break;
    }
    case OP.I64_TRUNC_F32_S: { // Generated from expression: {#f32} ## {else} @i64_trunc_f32_s
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_trunc_f32_s'));
        }
        break;
    }
    case OP.I64_TRUNC_F32_U: { // Generated from expression: {#f32} ## {else} @i64_trunc_f32_u
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_trunc_f32_u'));
        }
        break;
    }
    case OP.I64_TRUNC_F64_S: { // Generated from expression: {#f64} ## {else} @i64_trunc_f64_s
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_trunc_f64_s'));
        }
        break;
    }
    case OP.I64_TRUNC_F64_U: { // Generated from expression: {#f64} ## {else} @i64_trunc_f64_u
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_trunc_f64_u'));
        }
        break;
    }
    case OP.F32_CONVERT_I32_S: { // Generated from expression: {#f32} ## {else} @f32_convert_i32_s
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_convert_i32_s'));
        }
        break;
    }
    case OP.F32_CONVERT_I32_U: { // Generated from expression: {#f32} ## {else} @f32_convert_i32_u
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_convert_i32_u'));
        }
        break;
    }
    case OP.F32_CONVERT_I64_S: { // Generated from expression: {#f32} ## {else} @f32_convert_i64_s
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_convert_i64_s'));
        }
        break;
    }
    case OP.F32_CONVERT_I64_U: { // Generated from expression: {#f32} ## {else} @f32_convert_i64_u
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_convert_i64_u'));
        }
        break;
    }
    case OP.F32_DEMOTE_F64: { // Generated from expression: {#f32} {#f64} ## {else} @f32_demote_f64 {end} {else} @f32_demote_f64 {end}
        if (ext.float32) {
            if (ext.float64) {
                newBody.push(instr);
            } else {
                newBody.push(createTriWasmLibCall(ctx, 'f32_demote_f64'));
            }
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f32_demote_f64'));
        }
        break;
    }
    case OP.F64_CONVERT_I32_S: { // Generated from expression: {#f64} ## {else} @f64_convert_i32_s
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_convert_i32_s'));
        }
        break;
    }
    case OP.F64_CONVERT_I32_U: { // Generated from expression: {#f64} ## {else} @f64_convert_i32_u
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_convert_i32_u'));
        }
        break;
    }
    case OP.F64_CONVERT_I64_S: { // Generated from expression: {#f64} ## {else} @f64_convert_i64_s
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_convert_i64_s'));
        }
        break;
    }
    case OP.F64_CONVERT_I64_U: { // Generated from expression: {#f64} ## {else} @f64_convert_i64_u
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_convert_i64_u'));
        }
        break;
    }
    case OP.F64_PROMOTE_F32: { // Generated from expression: {#f32} {#f64} ## {else} @f64_promote_f32 {end} {else} @f64_promote_f32 {end}
        if (ext.float32) {
            if (ext.float64) {
                newBody.push(instr);
            } else {
                newBody.push(createTriWasmLibCall(ctx, 'f64_promote_f32'));
            }
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'f64_promote_f32'));
        }
        break;
    }
    case OP.I32_REINTERPRET_F32:
    case OP.I64_REINTERPRET_F64:
    case OP.F32_REINTERPRET_I32:
    case OP.F64_REINTERPRET_I64:
    case OP.DATA_DROP:
    case OP.ELEM_DROP: { // Generated from expression: nop
        newBody.push({ id: instrId(instr), opcode: OP.NOP });
        break;
    }
    case OP.I32_EXTEND8_S: { // Generated from expression: trivm.exts_const value: 24
        newBody.push({ id: instrId(instr), opcode: OP.TRIVM_EXTS_CONST, value: 24 });
        break;
    }
    case OP.I32_EXTEND16_S: { // Generated from expression: trivm.exts_const value: 16
        newBody.push({ id: instrId(instr), opcode: OP.TRIVM_EXTS_CONST, value: 16 });
        break;
    }
    case OP.I64_EXTEND8_S: { // Generated from expression: {#i64} trivm.exts64_const value: 56 {else} @i64_extend8_s
        if (ext.int64) {
            newBody.push({ id: instrId(instr), opcode: OP.TRIVM_EXTS64_CONST, value: 56 });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_extend8_s'));
        }
        break;
    }
    case OP.I64_EXTEND16_S: { // Generated from expression: {#i64} trivm.exts64_const value: 48 {else} @i64_extend16_s
        if (ext.int64) {
            newBody.push({ id: instrId(instr), opcode: OP.TRIVM_EXTS64_CONST, value: 48 });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_extend16_s'));
        }
        break;
    }
    case OP.I64_EXTEND32_S: { // Generated from expression: {#i64} trivm.exts64_const value: 32 {else} @i64_extend32_s
        if (ext.int64) {
            newBody.push({ id: instrId(instr), opcode: OP.TRIVM_EXTS64_CONST, value: 32 });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_extend32_s'));
        }
        break;
    }
    case OP.REF_NULL: { // Generated from expression: i32.const value: 0
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        break;
    }
    case OP.REF_IS_NULL: { // Generated from expression: i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        break;
    }
    case OP.I32_TRUNC_SAT_F32_S: { // Generated from expression: {#f32} ## {else} @i32_trunc_sat_f32_s
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i32_trunc_sat_f32_s'));
        }
        break;
    }
    case OP.I32_TRUNC_SAT_F32_U: { // Generated from expression: {#f32} ## {else} @i32_trunc_sat_f32_u
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i32_trunc_sat_f32_u'));
        }
        break;
    }
    case OP.I32_TRUNC_SAT_F64_S: { // Generated from expression: {#f64} ## {else} @i32_trunc_sat_f64_s
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i32_trunc_sat_f64_s'));
        }
        break;
    }
    case OP.I32_TRUNC_SAT_F64_U: { // Generated from expression: {#f64} ## {else} @i32_trunc_sat_f64_u
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i32_trunc_sat_f64_u'));
        }
        break;
    }
    case OP.I64_TRUNC_SAT_F32_S: { // Generated from expression: {#f32} ## {else} @i64_trunc_sat_f32_s
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_trunc_sat_f32_s'));
        }
        break;
    }
    case OP.I64_TRUNC_SAT_F32_U: { // Generated from expression: {#f32} ## {else} @i64_trunc_sat_f32_u
        if (ext.float32) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_trunc_sat_f32_u'));
        }
        break;
    }
    case OP.I64_TRUNC_SAT_F64_S: { // Generated from expression: {#f64} ## {else} @i64_trunc_sat_f64_s
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_trunc_sat_f64_s'));
        }
        break;
    }
    case OP.I64_TRUNC_SAT_F64_U: { // Generated from expression: {#f64} ## {else} @i64_trunc_sat_f64_u
        if (ext.float64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_trunc_sat_f64_u'));
        }
        break;
    }
    case OP.MEMORY_COPY: { // Generated from expression: {if ..memories[0].index === 0 && ..memories[1].index === 0} @memory_copy_0 {else} nop
        if (instr.memories[0].index === 0 && instr.memories[1].index === 0) {
            newBody.push(createTriWasmLibCall(ctx, 'memory_copy_0'));
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.NOP });
        }
        break;
    }
    case OP.MEMORY_FILL: { // Generated from expression: {if ..memory.index === 0} @memory_fill_0 {else} nop
        if (instr.memory.index === 0) {
            newBody.push(createTriWasmLibCall(ctx, 'memory_fill_0'));
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.NOP });
        }
        break;
    }
    case OP.TABLE_COPY: { // Generated from expression: i32.const value:..tables[0].index ; i32.const value:..tables[1].index ; @table_copy
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.tables[0].index });
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.tables[1].index });
        newBody.push(createTriWasmLibCall(ctx, 'table_copy'));
        break;
    }
    case OP.TABLE_GROW: { // Generated from expression: i32.const value:..table.index ; @table_grow
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.table.index });
        newBody.push(createTriWasmLibCall(ctx, 'table_grow'));
        break;
    }
    case OP.TABLE_SIZE: { // Generated from expression: i32.const value:..table.index ; @table_size
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.table.index });
        newBody.push(createTriWasmLibCall(ctx, 'table_size'));
        break;
    }
    case OP.TABLE_FILL: { // Generated from expression: i32.const value:..table.index ; @table_fill
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.table.index });
        newBody.push(createTriWasmLibCall(ctx, 'table_fill'));
        break;
    }
    case OP.NOP:
    case OP.BLOCK:
    case OP.LOOP:
    case OP.IF:
    case OP.I32_LOAD:
    case OP.I32_LOAD8_S:
    case OP.I32_LOAD8_U:
    case OP.I32_LOAD16_S:
    case OP.I32_LOAD16_U:
    case OP.I32_STORE:
    case OP.I32_STORE8:
    case OP.I32_STORE16:
    case OP.I32_CONST:
    case OP.I32_EQZ:
    case OP.I32_EQ:
    case OP.I32_LT_S:
    case OP.I32_LT_U:
    case OP.I32_GT_S:
    case OP.I32_GT_U:
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
    case OP.REF_FUNC: {
        newBody.push(instr);
        break;
    }

    // -- End of source code generated with help of "gen-instr.ts" script --

    /* eslint-enable max-len */
    }
}
