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

import { EnterBlockCtx, EnterInstrCtx, ExitBlockCtx, ExitInstrCtx, walkFunctions } from './moduleWalker';
import { OP } from './opcodes';
import {
    instrId, NumberType, RefType, ValueType, valueTypeWords, WasmBlock, WasmBranchDir, WasmFunction,
    WasmFunctionKind, WasmInstr, WasmInstrCall, WasmInstrIf, WasmModule, FunctionType
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
    for (let instr of ctx.blockData.newBody) { // TODO: is there a better way? but remember to don't use "..." in parameters
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



export function reduce(module: WasmModule) {
    walkFunctions(module,
        {
            ext: new TriVMExtensions(),
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

function pushTypes(ctx: Ctx, ...args: ValueType[]) {
    ctx.blockData.typeStack.push(...args);
}


function error(obj: WasmInstr | { instr: WasmInstr }, message: string) {
    /*let instr: WasmInstr;
    if (obj.instr) {
        instr = obj.instr;
    } else {
        instr = obj;
    }*/
    throw new Error(message); // TODO: handle errors properly
}

function popTypes(ctx: Ctx, ...args: ValueType[]) {
    if (args.length > ctx.blockData.typeStack.length) {
        error(ctx, 'Stack underflow.');
        ctx.blockData.typeStack.splice(0, Infinity);
    } else {
        for (let i = args.length - 1; i >= 0; i--) {
            if (ctx.blockData.typeStack.pop() !== args[i]) {
                error(ctx, 'Invalid stack types.');
            }
        }
    }
}

function checkTypes(ctx: Ctx, ...args: ValueType[]) {
    if (args.length > ctx.blockData.typeStack.length) {
        error(ctx, 'Stack underflow.');
        ctx.blockData.typeStack.splice(0, Infinity);
    } else {
        for (let i = args.length - 1; i >= 0; i--) {
            if (ctx.blockData.typeStack.at(-1 - i) !== args[i]) {
                error(ctx, 'Invalid stack types.');
            }
        }
    }
}

function peekType(ctx: Ctx): ValueType {
    if (ctx.blockData.typeStack.length == 0) {
        error(ctx, 'Stack underflow.');
        ctx.blockData.typeStack.splice(0, Infinity);
        return NumberType.I32;
    } else {
        return ctx.blockData.typeStack.at(-1) as ValueType;
    }
}

function getBlockData(ctx: Ctx, target: WasmBlock): BlockData | undefined {
    for (let i = 0; i < ctx.blockStack.length; i++) {
        if (ctx.blockStack[i] === target) {
            return ctx.blockDataStack[i];
        }
    }
}

function handleBranch(ctx: Ctx, target: WasmBlock, direction: WasmBranchDir) {
    if (direction === WasmBranchDir.Backward) {
        checkTypes(ctx, ...target.type.params);
    } else {
        checkTypes(ctx, ...target.type.results);
    }
}


function reduceInstr(ctx: Ctx, instrData: InstrData) {
    let instr = ctx.instr;
    let newBody = ctx.blockData.newBody;
    let func = ctx.func;
    let ext = ctx.moduleData.ext;

    switch (instr.opcode) {
    // -- Begin of source code generated with help of "gen-instr.ts" script --

    case OP.UNREACHABLE: {
        newBody.push(createTriWasmLibCall(ctx, 'unreachable'));
        instrData.nextUnreachable = true;
        break;
    }
    case OP.BLOCK: {
        popTypes(ctx, ...instr.block.type.params);
        pushTypes(ctx, ...instr.block.type.results);
        newBody.push(instr);
        break;
    }
    case OP.LOOP: {
        popTypes(ctx, ...instr.block.type.params);
        pushTypes(ctx, ...instr.block.type.results);
        newBody.push(instr);
        break;
    }
    case OP.IF: {
        popTypes(ctx, NumberType.I32);
        popTypes(ctx, ...instr.block.type.params);
        pushTypes(ctx, ...instr.block.type.results);
        newBody.push(instr);
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
        handleBranch(ctx, target, WasmBranchDir.Forward);
        newBody.push({ id: instrId(instr), opcode: OP.BR, target, direction: WasmBranchDir.Forward });
        ctx.blockDataStack.at(-1)!.isForwardTarget = true;
        instrData.nextUnreachable = true;
        newBody.push(instr);
        break;
    }
    case OP.BR: {
        let target = instr.target;
        handleBranch(ctx, target, instr.direction);
        if (instr.direction == WasmBranchDir.Forward) {
            getBlockData(ctx, target)!.isForwardTarget = true;
        }
        instrData.nextUnreachable = true;
        newBody.push(instr);
        break;
    }
    case OP.BR_IF: {
        let target = instr.target;
        popTypes(ctx, NumberType.I32);
        handleBranch(ctx, target, instr.direction);
        if (instr.direction == WasmBranchDir.Forward) {
            getBlockData(ctx, target)!.isForwardTarget = true;
        }
        newBody.push(instr);
        break;
    }
    case OP.BR_TABLE: {
        popTypes(ctx, NumberType.I32);
        for (let target of instr.targets) {
            let direction = (target.parentInstruction.opcode === OP.LOOP) ? WasmBranchDir.Backward : WasmBranchDir.Forward;
            handleBranch(ctx, target, direction);
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
        handleBranch(ctx, target, WasmBranchDir.Forward);
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
        popTypes(ctx, ...func.type.params);
        pushTypes(ctx, ...func.type.results);
        newBody.push(instr);
        break;
    }
    case OP.CALL_INDIRECT: {
        popTypes(ctx, NumberType.I32);
        popTypes(ctx, ...instr.type.params);
        pushTypes(ctx, ...instr.type.results);
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
        let type = peekType(ctx);
        popTypes(ctx, type);
        let words = valueTypeWords(type);
        newBody.push({ id: instrId(instr), opcode: OP.TRIVM_POP, value: words });
        break;
    }
    case OP.SELECT:
    case OP.SELECT_T: {
        popTypes(ctx, NumberType.I32);
        let type = peekType(ctx);
        popTypes(ctx, type, type);
        pushTypes(ctx, type);
        newBody.push(createTriWasmLibCall(ctx, 'select' + (32 * valueTypeWords(type))));
        break;
    }
    case OP.LOCAL_GET: {
        let type: ValueType;
        if (instr.index < func.type.params.length) {
            type = func.type.params[instr.index];
        } else {
            type = func.locals[instr.index - func.type.params.length];
        }
        pushTypes(ctx, type);
        let words = valueTypeWords(type);
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
        let type: ValueType;
        if (instr.index < func.type.params.length) {
            type = func.type.params[instr.index];
        } else {
            type = func.locals[instr.index - func.type.params.length];
        }
        popTypes(ctx, type);
        let words = valueTypeWords(type);
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
        let type: ValueType;
        if (instr.index < func.type.params.length) {
            type = func.type.params[instr.index];
        } else {
            type = func.locals[instr.index - func.type.params.length];
        }
        checkTypes(ctx, type);
        let words = valueTypeWords(type);
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
        let type = global.type;
        pushTypes(ctx, type);
        let words = valueTypeWords(type);
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
        let type = global.type;
        popTypes(ctx, type);
        let words = valueTypeWords(type);
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
    case OP.REF_NULL: {
        break;
    }
    case OP.REF_IS_NULL: {
        break;
    }
    case OP.TABLE_GROW: {
        break;
    }
    case OP.TABLE_FILL: {
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
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.F32_LOAD: { // Generated from expression: i32.load offset, memory
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD, offset: instr.offset, memory: instr.memory });
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.F32);
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
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.F64);
        break;
    }
    case OP.I64_LOAD8_S: { // Generated from expression: i32.load8_s offset, memory {#i64} i64.extend_i32_s {else} @i64_extend_i32_s
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD8_S, offset: instr.offset, memory: instr.memory });
        if (ext.i64) {
            newBody.push({ id: instrId(instr), opcode: OP.I64_EXTEND_I32_S });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_extend_i32_s'));
        }
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_LOAD8_U: { // Generated from expression: i32.load8_u memory, offset ; i32.const value:0
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD8_U, memory: instr.memory, offset: instr.offset });
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_LOAD16_S: { // Generated from expression: i32.load16_s offset, memory {#i64} i64.extend_i32_s {else} @i64_extend_i32_s
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD16_S, offset: instr.offset, memory: instr.memory });
        if (ext.i64) {
            newBody.push({ id: instrId(instr), opcode: OP.I64_EXTEND_I32_S });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_extend_i32_s'));
        }
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_LOAD16_U: { // Generated from expression: i32.load16_u memory, offset ; i32.const value:0
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD16_U, memory: instr.memory, offset: instr.offset });
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_LOAD32_S: { // Generated from expression: i32.load offset, memory {#i64} i64.extend_i32_s {else} @i64_extend_i32_s
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD, offset: instr.offset, memory: instr.memory });
        if (ext.i64) {
            newBody.push({ id: instrId(instr), opcode: OP.I64_EXTEND_I32_S });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_extend_i32_s'));
        }
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_LOAD32_U: { // Generated from expression: i32.load offset, memory ; i32.const value:0
        newBody.push({ id: instrId(instr), opcode: OP.I32_LOAD, offset: instr.offset, memory: instr.memory });
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I64);
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
        popTypes(ctx, NumberType.I32, NumberType.I64);
        break;
    }
    case OP.F32_STORE: { // Generated from expression: i32.store offset, memory
        newBody.push({ id: instrId(instr), opcode: OP.I32_STORE, offset: instr.offset, memory: instr.memory });
        popTypes(ctx, NumberType.I32, NumberType.F32);
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
        popTypes(ctx, NumberType.I32, NumberType.F64);
        break;
    }
    case OP.I64_STORE8: { // Generated from expression: trivm.pop value: 1 ; i32.store8 offset, memory
        newBody.push({ id: instrId(instr), opcode: OP.TRIVM_POP, value: 1 });
        newBody.push({ id: instrId(instr), opcode: OP.I32_STORE8, offset: instr.offset, memory: instr.memory });
        popTypes(ctx, NumberType.I32, NumberType.I64);
        break;
    }
    case OP.I64_STORE16: { // Generated from expression: trivm.pop value: 1 ; i32.store16 offset, memory
        newBody.push({ id: instrId(instr), opcode: OP.TRIVM_POP, value: 1 });
        newBody.push({ id: instrId(instr), opcode: OP.I32_STORE16, offset: instr.offset, memory: instr.memory });
        popTypes(ctx, NumberType.I32, NumberType.I64);
        break;
    }
    case OP.I64_STORE32: { // Generated from expression: trivm.pop value: 1 ; i32.store offset, memory
        newBody.push({ id: instrId(instr), opcode: OP.TRIVM_POP, value: 1 });
        newBody.push({ id: instrId(instr), opcode: OP.I32_STORE, offset: instr.offset, memory: instr.memory });
        popTypes(ctx, NumberType.I32, NumberType.I64);
        break;
    }
    case OP.MEMORY_SIZE: { // Generated from expression: @memory_size
        newBody.push(createTriWasmLibCall(ctx, 'memory_size'));
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.MEMORY_GROW: { // Generated from expression: @memory_grow
        newBody.push(createTriWasmLibCall(ctx, 'memory_grow'));
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I64_CONST: { // Generated from expression: {#i64} ## {else} i32.const value: Number(..value & 0xFFFFFFFFn) & 0xFFFFFFFF ; i32.const value: Number(..value >> 32n) & 0xFFFFFFFF
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: Number(instr.value & 0xFFFFFFFFn) & 0xFFFFFFFF });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: Number(instr.value >> 32n) & 0xFFFFFFFF });
        }
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.F32_CONST: { // Generated from expression: i32.const value
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.value });
        pushTypes(ctx, NumberType.F32);
        break;
    }
    case OP.F64_CONST: { // Generated from expression: {#i64} i64.const value {else} i32.const value: Number(..value & 0xFFFFFFFFn) & 0xFFFFFFFF ; i32.const value: Number(..value >> 32n) & 0xFFFFFFFF
        if (ext.i64) {
            newBody.push({ id: instrId(instr), opcode: OP.I64_CONST, value: instr.value });
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: Number(instr.value & 0xFFFFFFFFn) & 0xFFFFFFFF });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: Number(instr.value >> 32n) & 0xFFFFFFFF });
        }
        pushTypes(ctx, NumberType.F64);
        break;
    }
    case OP.I32_NE: { // Generated from expression: i32.eq ; i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQ });
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        popTypes(ctx, NumberType.I32, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I32_LE_S: { // Generated from expression: i32.gt_s ; i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_GT_S });
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        popTypes(ctx, NumberType.I32, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I32_LE_U: { // Generated from expression: i32.gt_u ; i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_GT_U });
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        popTypes(ctx, NumberType.I32, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I32_GE_S: { // Generated from expression: i32.lt_s ; i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_LT_S });
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        popTypes(ctx, NumberType.I32, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I32_GE_U: { // Generated from expression: i32.lt_u ; i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_LT_U });
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        popTypes(ctx, NumberType.I32, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I64_EQZ: { // Generated from expression: i32.or ; i32.eqz
        newBody.push({ id: instrId(instr), opcode: OP.I32_OR });
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        popTypes(ctx, NumberType.I64);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I64_EQ: { // Generated from expression: {#i64} ## {else} @i64_eq
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_eq'));
        }
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I64_NE: { // Generated from expression: {#i64} i64.eq {else} @i64_eq {end} i32.eqz
        if (ext.i64) {
            newBody.push({ id: instrId(instr), opcode: OP.I64_EQ });
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_eq'));
        }
        newBody.push({ id: instrId(instr), opcode: OP.I32_EQZ });
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I64_LT_S:
    case OP.I64_LT_U:
    case OP.I64_GT_S:
    case OP.I64_GT_U:
    case OP.I64_LE_S:
    case OP.I64_LE_U:
    case OP.I64_GE_S:
    case OP.I64_GE_U: { // TODO
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.F32_EQ:
    case OP.F32_NE:
    case OP.F32_LT:
    case OP.F32_GT:
    case OP.F32_LE:
    case OP.F32_GE: { // TODO
        popTypes(ctx, NumberType.F32, NumberType.F32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.F64_EQ:
    case OP.F64_NE:
    case OP.F64_LT:
    case OP.F64_GT:
    case OP.F64_LE:
    case OP.F64_GE: { // TODO
        popTypes(ctx, NumberType.F64, NumberType.F64);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I32_CLZ: { // Generated from expression: @i32_clz
        newBody.push(createTriWasmLibCall(ctx, 'i32_clz'));
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I32_CTZ: { // Generated from expression: @i32_ctz
        newBody.push(createTriWasmLibCall(ctx, 'i32_ctz'));
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I32_POPCNT: { // Generated from expression: @i32_popcnt
        newBody.push(createTriWasmLibCall(ctx, 'i32_popcnt'));
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I32_ROTL: { // Generated from expression: @i32_rotl
        newBody.push(createTriWasmLibCall(ctx, 'i32_rotl'));
        popTypes(ctx, NumberType.I32, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I32_ROTR: { // Generated from expression: @i32_rotr
        newBody.push(createTriWasmLibCall(ctx, 'i32_rotr'));
        popTypes(ctx, NumberType.I32, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I64_CLZ: { // Generated from expression: @i64_clz32; i32.const value:0
        newBody.push(createTriWasmLibCall(ctx, 'i64_clz32'));
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        popTypes(ctx, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_CTZ: { // Generated from expression: @i64_ctz32; i32.const value:0
        newBody.push(createTriWasmLibCall(ctx, 'i64_ctz32'));
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        popTypes(ctx, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_POPCNT: { // Generated from expression: @i64_popcnt32; i32.const value:0
        newBody.push(createTriWasmLibCall(ctx, 'i64_popcnt32'));
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        popTypes(ctx, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_ADD: { // Generated from expression: {#i64} ## {else} @i64_add
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_add'));
        }
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_SUB: { // Generated from expression: {#i64} ## {else} @i64_sub
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_sub'));
        }
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_MUL: { // Generated from expression: {#i64} ## {else} @i64_mul
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_mul'));
        }
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_DIV_S: { // Generated from expression: {#i64} ## {else} @i64_div_s
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_div_s'));
        }
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_DIV_U: { // Generated from expression: {#i64} ## {else} @i64_div_u
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_div_u'));
        }
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_REM_S: { // Generated from expression: {#i64} ## {else} @i64_rem_s
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_rem_s'));
        }
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_REM_U: { // Generated from expression: {#i64} ## {else} @i64_rem_u
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_rem_u'));
        }
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_AND: { // Generated from expression: {#i64} ## {else} @i64_and
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_and'));
        }
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_OR: { // Generated from expression: {#i64} ## {else} @i64_or
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_or'));
        }
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_XOR: { // Generated from expression: {#i64} ## {else} @i64_xor
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_xor'));
        }
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_SHL: { // Generated from expression: {#i64} ## {else} @i64_shl
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push(createTriWasmLibCall(ctx, 'i64_shl'));
        }
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_SHR_S:
    case OP.I64_SHR_U:
    case OP.I64_ROTL:
    case OP.I64_ROTR: { // TODO
        popTypes(ctx, NumberType.I64, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.F32_ABS:
    case OP.F32_NEG:
    case OP.F32_CEIL:
    case OP.F32_FLOOR:
    case OP.F32_TRUNC:
    case OP.F32_NEAREST:
    case OP.F32_SQRT: { // TODO
        popTypes(ctx, NumberType.F32);
        pushTypes(ctx, NumberType.F32);
        break;
    }
    case OP.F32_ADD:
    case OP.F32_SUB:
    case OP.F32_MUL:
    case OP.F32_DIV:
    case OP.F32_MIN:
    case OP.F32_MAX:
    case OP.F32_COPYSIGN: { // TODO
        popTypes(ctx, NumberType.F32, NumberType.F32);
        pushTypes(ctx, NumberType.F32);
        break;
    }
    case OP.F64_ABS:
    case OP.F64_NEG:
    case OP.F64_CEIL:
    case OP.F64_FLOOR:
    case OP.F64_TRUNC:
    case OP.F64_NEAREST:
    case OP.F64_SQRT: { // TODO
        popTypes(ctx, NumberType.F64);
        pushTypes(ctx, NumberType.F64);
        break;
    }
    case OP.F64_ADD:
    case OP.F64_SUB:
    case OP.F64_MUL:
    case OP.F64_DIV:
    case OP.F64_MIN:
    case OP.F64_MAX:
    case OP.F64_COPYSIGN: { // TODO
        popTypes(ctx, NumberType.F64, NumberType.F64);
        pushTypes(ctx, NumberType.F64);
        break;
    }
    case OP.I32_WRAP_I64: { // TODO
        popTypes(ctx, NumberType.I64);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I32_TRUNC_F32_S:
    case OP.I32_TRUNC_F32_U:
    case OP.I32_TRUNC_SAT_F32_S:
    case OP.I32_TRUNC_SAT_F32_U: { // TODO
        popTypes(ctx, NumberType.F32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I32_TRUNC_F64_S:
    case OP.I32_TRUNC_F64_U:
    case OP.I32_TRUNC_SAT_F64_S:
    case OP.I32_TRUNC_SAT_F64_U: { // TODO
        popTypes(ctx, NumberType.F64);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I64_EXTEND_I32_S: { // Generated from expression: {#i64} ## {else} TRIVM.DUP32 offset:0 ; i32.const value:31 ; i32.shr_s
        if (ext.i64) {
            newBody.push(instr);
        } else {
            newBody.push({ id: instrId(instr), opcode: OP.TRIVM_DUP32, offset: 0 });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 31 });
            newBody.push({ id: instrId(instr), opcode: OP.I32_SHR_S });
        }
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_EXTEND_I32_U: { // Generated from expression: i32.const value:0
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: 0 });
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_TRUNC_F32_S:
    case OP.I64_TRUNC_F32_U:
    case OP.I64_TRUNC_SAT_F32_S:
    case OP.I64_TRUNC_SAT_F32_U: { // TODO
        popTypes(ctx, NumberType.F32);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.I64_TRUNC_F64_S:
    case OP.I64_TRUNC_F64_U:
    case OP.I64_TRUNC_SAT_F64_S:
    case OP.I64_TRUNC_SAT_F64_U: { // TODO
        popTypes(ctx, NumberType.F64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.F32_CONVERT_I32_S:
    case OP.F32_CONVERT_I32_U: { // TODO
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.F32);
        break;
    }
    case OP.F32_CONVERT_I64_S:
    case OP.F32_CONVERT_I64_U: { // TODO
        popTypes(ctx, NumberType.I64);
        pushTypes(ctx, NumberType.F32);
        break;
    }
    case OP.F32_DEMOTE_F64: { // TODO
        popTypes(ctx, NumberType.F64);
        pushTypes(ctx, NumberType.F32);
        break;
    }
    case OP.F64_CONVERT_I32_S:
    case OP.F64_CONVERT_I32_U: { // TODO
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.F64);
        break;
    }
    case OP.F64_CONVERT_I64_S:
    case OP.F64_CONVERT_I64_U: { // TODO
        popTypes(ctx, NumberType.I64);
        pushTypes(ctx, NumberType.F64);
        break;
    }
    case OP.F64_PROMOTE_F32: { // TODO
        popTypes(ctx, NumberType.F32);
        pushTypes(ctx, NumberType.F64);
        break;
    }
    case OP.I32_REINTERPRET_F32: { // Generated from expression: nop
        newBody.push({ id: instrId(instr), opcode: OP.NOP });
        popTypes(ctx, NumberType.F32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I64_REINTERPRET_F64: { // Generated from expression: nop
        newBody.push({ id: instrId(instr), opcode: OP.NOP });
        popTypes(ctx, NumberType.F64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.F32_REINTERPRET_I32: { // Generated from expression: nop
        newBody.push({ id: instrId(instr), opcode: OP.NOP });
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.F32);
        break;
    }
    case OP.F64_REINTERPRET_I64: { // Generated from expression: nop
        newBody.push({ id: instrId(instr), opcode: OP.NOP });
        popTypes(ctx, NumberType.I64);
        pushTypes(ctx, NumberType.F64);
        break;
    }
    case OP.I32_EXTEND8_S:
    case OP.I32_EXTEND16_S: { // TODO
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I64_EXTEND8_S:
    case OP.I64_EXTEND16_S:
    case OP.I64_EXTEND32_S: { // TODO
        popTypes(ctx, NumberType.I64);
        pushTypes(ctx, NumberType.I64);
        break;
    }
    case OP.REF_FUNC: { // TODO
        pushTypes(ctx, RefType.FUNCREF);
        break;
    }
    case OP.MEMORY_INIT:
    case OP.MEMORY_COPY:
    case OP.MEMORY_FILL:
    case OP.TABLE_INIT: { // TODO
        popTypes(ctx, NumberType.I32, NumberType.I32, NumberType.I32);
        break;
    }
    case OP.DATA_DROP:
    case OP.ELEM_DROP: { // Generated from expression: nop
        newBody.push({ id: instrId(instr), opcode: OP.NOP });
        break;
    }
    case OP.TABLE_COPY: { // Generated from expression: i32.const value:..tables[0].index ; i32.const value:..tables[1].index ; @table_copy
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.tables[0].index });
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.tables[1].index });
        newBody.push(createTriWasmLibCall(ctx, 'table_copy'));
        popTypes(ctx, NumberType.I32, NumberType.I32, NumberType.I32);
        break;
    }
    case OP.TABLE_SIZE: { // Generated from expression: i32.const value:..table.index ; @table_size
        newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.table.index });
        newBody.push(createTriWasmLibCall(ctx, 'table_size'));
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.NOP: {
        newBody.push(instr);
        break;
    }
    case OP.I32_LOAD:
    case OP.I32_LOAD8_S:
    case OP.I32_LOAD8_U:
    case OP.I32_LOAD16_S:
    case OP.I32_LOAD16_U:
    case OP.I32_EQZ: {
        newBody.push(instr);
        popTypes(ctx, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    case OP.I32_STORE:
    case OP.I32_STORE8:
    case OP.I32_STORE16: {
        newBody.push(instr);
        popTypes(ctx, NumberType.I32, NumberType.I32);
        break;
    }
    case OP.I32_CONST: {
        newBody.push(instr);
        pushTypes(ctx, NumberType.I32);
        break;
    }
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
    case OP.I32_SHR_U: {
        newBody.push(instr);
        popTypes(ctx, NumberType.I32, NumberType.I32);
        pushTypes(ctx, NumberType.I32);
        break;
    }
    /* eslint-enable max-len */

    // -- End of source code generated with help of "gen-instr.ts" script --
    }
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

