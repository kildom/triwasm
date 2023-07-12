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

import { allowTemporaryNull } from "../utils/common";
import { EnterBlockCtx, EnterFunctionCtx, EnterInstrCtx, ExitBlockCtx, ExitFunctionCtx, ExitInstrCtx, walkFunctions } from "./moduleWalker";
import { OP } from "./opcodes";
import { instrId, NumberType, RefType, ValueType, valueTypeWords, VectorType, WasmBlock, WasmBranchDir, WasmFunction, WasmFunctionKind, WasmInstr, WasmInstrCall, WasmInstrRefFunc, WasmInstrIf, WasmInstrWithBlock, WasmModule, FunctionType } from "./wasmModule";

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
};

type FunctionData = undefined;

interface BlockData {
    typeStack: ValueType[];     // Type stack within current block
    newBody: WasmInstr[];       // New array of instructions in this block
    unreachable: boolean;       // Current state of reachability of instructions
    isForwardTarget: boolean;   // If this block a target for forward branches
};

interface InstrData {
    nextUnreachable: boolean;   // set to true if next instruction is unreachable
};

type Ctx = EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData>;

function enterFunction(ctx: EnterFunctionCtx<ModuleData>): FunctionData {
    return undefined;
}

function exitFunction(ctx: ExitFunctionCtx<ModuleData, FunctionData>): void {

}

function enterBlock(ctx: EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): BlockData {
    return {
        typeStack: [...ctx.block.type.params],
        newBody: [],
        unreachable: false,
        // "IF" without "ELSE" is always forward target
        isForwardTarget: ctx.instrStack.length > 0 && ctx.instrStack.at(-1)!.opcode === OP.IF && !(ctx.instrStack.at(-1) as WasmInstrIf).withElse,
    }
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
    }
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


function error(obj: any, message: string) {
    let instr: WasmInstr;
    if (obj.instr) {
        instr = obj.instr;
    } else {
        instr = obj;
    }
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
    if (ctx.func.kind == WasmFunctionKind.WASM_TYPE_UNKNOWN && target.parentInstruction.opcode === OP.TRIVM_FUNCTION) {
        if (ctx.blockData.typeStack.length === 0) {
            error(ctx, 'Function should return a value.');
            ctx.func.type = { params: [], results: [NumberType.I32] };
        } else {
            ctx.func.type = { params: [], results: [ctx.blockData.typeStack.at(-1) as ValueType] };
        }
        target.type = ctx.func.type;
        ctx.func.kind = WasmFunctionKind.WASM;
    }
}


function bytesToI32(buffer: Uint8Array, offset: number): number {
    return ((buffer[offset + 3] << 24) | (buffer[offset + 2] << 16) | (buffer[offset + 1] << 8) | buffer[offset]) & 0xFFFFFFFF;
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
            /*
            TODO: more cases:
                if table is table0: call_indirect_table0(...params, index)
                if table is at constant position: call_indirect_table_ptr(...params, index, table_ptr)
                if table is movable (placed after growable table): call_indirect_table_ptr_ptr(...params, index, table_ptr_ptr)
            */
            if (ctx.module.tables.length > 1) {
                // TODO: new instruction to push arbitrary expressions into stack
                // or even entire assembly text with pop and push types and indication if it returns (next instruction is unreachable)
                //newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.table.index });
                newBody.push(createTriWasmLibCall(ctx, 'call_indirect_table_ptr', {
                    params:[...instr.type.params, NumberType.I32, NumberType.I32],
                    results:[...instr.type.results]
                }));
            } else {
                newBody.push(createTriWasmLibCall(ctx, 'call_indirect_table0', {
                    params:[...instr.type.params, NumberType.I32],
                    results:[...instr.type.results]
                }));
            }
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
        case OP.V128_LOAD: { // Generated from expression: i32.const value:..offset ; @v128_load
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD8X8_S: { // Generated from expression: i32.const value:..offset ; @v128_load8x8_s
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load8x8_s'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD8X8_U: { // Generated from expression: i32.const value:..offset ; @v128_load8x8_u
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load8x8_u'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD16X4_S: { // Generated from expression: i32.const value:..offset ; @v128_load16x4_s
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load16x4_s'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD16X4_U: { // Generated from expression: i32.const value:..offset ; @v128_load16x4_u
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load16x4_u'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD32X2_S: { // Generated from expression: i32.const value:..offset ; @v128_load32x2_s
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load32x2_s'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD32X2_U: { // Generated from expression: i32.const value:..offset ; @v128_load32x2_u
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load32x2_u'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD8_SPLAT: { // Generated from expression: i32.const value:..offset ; @v128_load8_splat
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load8_splat'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD16_SPLAT: { // Generated from expression: i32.const value:..offset ; @v128_load16_splat
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load16_splat'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD32_SPLAT: { // Generated from expression: i32.const value:..offset ; @v128_load32_splat
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load32_splat'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD64_SPLAT: { // Generated from expression: i32.const value:..offset ; @v128_load64_splat
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load64_splat'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_STORE: { // Generated from expression: i32.const value:..offset ; @v128_store
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push(createTriWasmLibCall(ctx, 'v128_store'));
            popTypes(ctx, NumberType.I32, VectorType.V128);
            break;
        }
        case OP.V128_CONST: { // Generated from expression: i32.const value:bytesToI32(..value\, 0) ; i32.const value:bytesToI32(..value\, 4) ; i32.const value:bytesToI32(..value\, 8) ; i32.const value:bytesToI32(..value\, 12)
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: bytesToI32(instr.value, 0) });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: bytesToI32(instr.value, 4) });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: bytesToI32(instr.value, 8) });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: bytesToI32(instr.value, 12) });
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_SHUFFLE: { // Generated from expression: i32.const value:bytesToI32(..value\, 0) ; i32.const value:bytesToI32(..value\, 4) ; i32.const value:bytesToI32(..value\, 8) ; i32.const value:bytesToI32(..value\, 12) ; @i8x16_shuffle
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: bytesToI32(instr.value, 0) });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: bytesToI32(instr.value, 4) });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: bytesToI32(instr.value, 8) });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: bytesToI32(instr.value, 12) });
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_shuffle'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_SWIZZLE: { // Generated from expression: @i8x16_swizzle
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_swizzle'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_SPLAT: { // Generated from expression: @i8x16_splat
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_splat'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_SPLAT: { // Generated from expression: @i16x8_splat
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_splat'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_SPLAT: { // Generated from expression: @i32x4_splat
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_splat'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_SPLAT: { // Generated from expression: @i64x2_splat
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_splat'));
            popTypes(ctx, NumberType.I64);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_SPLAT: { // Generated from expression: @f32x4_splat
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_splat'));
            popTypes(ctx, NumberType.F32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_SPLAT: { // Generated from expression: @f64x2_splat
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_splat'));
            popTypes(ctx, NumberType.F64);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_EXTRACT_LANE_S: { // Generated from expression: i32.const value:..index ; @i8x16_extract_lane_s
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_extract_lane_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I8X16_EXTRACT_LANE_U: { // Generated from expression: i32.const value:..index ; @i8x16_extract_lane_u
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_extract_lane_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I8X16_REPLACE_LANE: { // Generated from expression: i32.const value:..index ; @i8x16_replace_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_replace_lane'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_EXTRACT_LANE_S: { // Generated from expression: i32.const value:..index ; @i16x8_extract_lane_s
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_extract_lane_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I16X8_EXTRACT_LANE_U: { // Generated from expression: i32.const value:..index ; @i16x8_extract_lane_u
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_extract_lane_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I16X8_REPLACE_LANE: { // Generated from expression: i32.const value:..index ; @i16x8_replace_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_replace_lane'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_EXTRACT_LANE: { // Generated from expression: i32.const value:..index ; @i32x4_extract_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_extract_lane'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I32X4_REPLACE_LANE: { // Generated from expression: i32.const value:..index ; @i32x4_replace_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_replace_lane'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_EXTRACT_LANE: { // Generated from expression: i32.const value:..index ; @i64x2_extract_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_extract_lane'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I64);
            break;
        }
        case OP.I64X2_REPLACE_LANE: { // Generated from expression: i32.const value:..index ; @i64x2_replace_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_replace_lane'));
            popTypes(ctx, VectorType.V128, NumberType.I64);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_EXTRACT_LANE: { // Generated from expression: i32.const value:..index ; @f32x4_extract_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_extract_lane'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.F32);
            break;
        }
        case OP.F32X4_REPLACE_LANE: { // Generated from expression: i32.const value:..index ; @f32x4_replace_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_replace_lane'));
            popTypes(ctx, VectorType.V128, NumberType.F32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_EXTRACT_LANE: { // Generated from expression: i32.const value:..index ; @f64x2_extract_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_extract_lane'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.F64);
            break;
        }
        case OP.F64X2_REPLACE_LANE: { // Generated from expression: i32.const value:..index ; @f64x2_replace_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_replace_lane'));
            popTypes(ctx, VectorType.V128, NumberType.F64);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_EQ: { // Generated from expression: @i8x16_eq
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_eq'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_NE: { // Generated from expression: @i8x16_ne
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_ne'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_LT_S: { // Generated from expression: @i8x16_lt_s
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_lt_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_LT_U: { // Generated from expression: @i8x16_lt_u
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_lt_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_GT_S: { // Generated from expression: @i8x16_gt_s
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_gt_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_GT_U: { // Generated from expression: @i8x16_gt_u
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_gt_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_LE_S: { // Generated from expression: @i8x16_le_s
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_le_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_LE_U: { // Generated from expression: @i8x16_le_u
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_le_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_GE_S: { // Generated from expression: @i8x16_ge_s
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_ge_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_GE_U: { // Generated from expression: @i8x16_ge_u
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_ge_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_EQ: { // Generated from expression: @i16x8_eq
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_eq'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_NE: { // Generated from expression: @i16x8_ne
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_ne'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_LT_S: { // Generated from expression: @i16x8_lt_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_lt_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_LT_U: { // Generated from expression: @i16x8_lt_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_lt_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_GT_S: { // Generated from expression: @i16x8_gt_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_gt_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_GT_U: { // Generated from expression: @i16x8_gt_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_gt_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_LE_S: { // Generated from expression: @i16x8_le_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_le_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_LE_U: { // Generated from expression: @i16x8_le_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_le_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_GE_S: { // Generated from expression: @i16x8_ge_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_ge_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_GE_U: { // Generated from expression: @i16x8_ge_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_ge_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_EQ: { // Generated from expression: @i32x4_eq
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_eq'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_NE: { // Generated from expression: @i32x4_ne
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_ne'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_LT_S: { // Generated from expression: @i32x4_lt_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_lt_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_LT_U: { // Generated from expression: @i32x4_lt_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_lt_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_GT_S: { // Generated from expression: @i32x4_gt_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_gt_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_GT_U: { // Generated from expression: @i32x4_gt_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_gt_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_LE_S: { // Generated from expression: @i32x4_le_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_le_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_LE_U: { // Generated from expression: @i32x4_le_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_le_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_GE_S: { // Generated from expression: @i32x4_ge_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_ge_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_GE_U: { // Generated from expression: @i32x4_ge_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_ge_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_EQ: { // Generated from expression: @f32x4_eq
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_eq'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_NE: { // Generated from expression: @f32x4_ne
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_ne'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_LT: { // Generated from expression: @f32x4_lt
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_lt'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_GT: { // Generated from expression: @f32x4_gt
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_gt'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_LE: { // Generated from expression: @f32x4_le
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_le'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_GE: { // Generated from expression: @f32x4_ge
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_ge'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_EQ: { // Generated from expression: @f64x2_eq
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_eq'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_NE: { // Generated from expression: @f64x2_ne
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_ne'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_LT: { // Generated from expression: @f64x2_lt
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_lt'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_GT: { // Generated from expression: @f64x2_gt
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_gt'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_LE: { // Generated from expression: @f64x2_le
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_le'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_GE: { // Generated from expression: @f64x2_ge
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_ge'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_NOT: { // Generated from expression: @v128_not
            newBody.push(createTriWasmLibCall(ctx, 'v128_not'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_AND: { // Generated from expression: @v128_and
            newBody.push(createTriWasmLibCall(ctx, 'v128_and'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_ANDNOT: { // Generated from expression: @v128_andnot
            newBody.push(createTriWasmLibCall(ctx, 'v128_andnot'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_OR: { // Generated from expression: @v128_or
            newBody.push(createTriWasmLibCall(ctx, 'v128_or'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_XOR: { // Generated from expression: @v128_xor
            newBody.push(createTriWasmLibCall(ctx, 'v128_xor'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_BITSELECT: { // Generated from expression: @v128_bitselect
            newBody.push(createTriWasmLibCall(ctx, 'v128_bitselect'));
            popTypes(ctx, VectorType.V128, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_ANY_TRUE: { // Generated from expression: @v128_any_true
            newBody.push(createTriWasmLibCall(ctx, 'v128_any_true'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.V128_LOAD8_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_load8_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load8_lane'));
            popTypes(ctx, NumberType.I32, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD16_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_load16_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load16_lane'));
            popTypes(ctx, NumberType.I32, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD32_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_load32_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load32_lane'));
            popTypes(ctx, NumberType.I32, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD64_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_load64_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load64_lane'));
            popTypes(ctx, NumberType.I32, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_STORE8_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_store8_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'v128_store8_lane'));
            popTypes(ctx, NumberType.I32, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_STORE16_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_store16_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'v128_store16_lane'));
            popTypes(ctx, NumberType.I32, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_STORE32_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_store32_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'v128_store32_lane'));
            popTypes(ctx, NumberType.I32, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_STORE64_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_store64_lane
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'v128_store64_lane'));
            popTypes(ctx, NumberType.I32, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD32_ZERO: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_load32_zero
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load32_zero'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.V128_LOAD64_ZERO: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_load64_zero
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.offset });
            newBody.push({ id: instrId(instr), opcode: OP.I32_CONST, value: instr.index });
            newBody.push(createTriWasmLibCall(ctx, 'v128_load64_zero'));
            popTypes(ctx, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_DEMOTE_F64X2_ZERO: { // Generated from expression: @f32x4_demote_f64x2_zero
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_demote_f64x2_zero'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_PROMOTE_LOW_F32X4: { // Generated from expression: @f64x2_promote_low_f32x4
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_promote_low_f32x4'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_ABS: { // Generated from expression: @i8x16_abs
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_abs'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_NEG: { // Generated from expression: @i8x16_neg
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_neg'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_POPCNT: { // Generated from expression: @i8x16_popcnt
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_popcnt'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_ALL_TRUE: { // Generated from expression: @i8x16_all_true
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_all_true'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I8X16_BITMASK: { // Generated from expression: @i8x16_bitmask
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_bitmask'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I8X16_NARROW_I16X8_S: { // Generated from expression: @i8x16_narrow_i16x8_s
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_narrow_i16x8_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_NARROW_I16X8_U: { // Generated from expression: @i8x16_narrow_i16x8_u
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_narrow_i16x8_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_CEIL: { // Generated from expression: @f32x4_ceil
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_ceil'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_FLOOR: { // Generated from expression: @f32x4_floor
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_floor'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_TRUNC: { // Generated from expression: @f32x4_trunc
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_trunc'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_NEAREST: { // Generated from expression: @f32x4_nearest
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_nearest'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_SHL: { // Generated from expression: @i8x16_shl
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_shl'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_SHR_S: { // Generated from expression: @i8x16_shr_s
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_shr_s'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_SHR_U: { // Generated from expression: @i8x16_shr_u
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_shr_u'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_ADD: { // Generated from expression: @i8x16_add
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_add'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_ADD_SAT_S: { // Generated from expression: @i8x16_add_sat_s
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_add_sat_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_ADD_SAT_U: { // Generated from expression: @i8x16_add_sat_u
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_add_sat_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_SUB: { // Generated from expression: @i8x16_sub
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_sub'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_SUB_SAT_S: { // Generated from expression: @i8x16_sub_sat_s
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_sub_sat_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_SUB_SAT_U: { // Generated from expression: @i8x16_sub_sat_u
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_sub_sat_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_CEIL: { // Generated from expression: @f64x2_ceil
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_ceil'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_FLOOR: { // Generated from expression: @f64x2_floor
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_floor'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_MIN_S: { // Generated from expression: @i8x16_min_s
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_min_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_MIN_U: { // Generated from expression: @i8x16_min_u
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_min_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_MAX_S: { // Generated from expression: @i8x16_max_s
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_max_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_MAX_U: { // Generated from expression: @i8x16_max_u
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_max_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_TRUNC: { // Generated from expression: @f64x2_trunc
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_trunc'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I8X16_AVGR_U: { // Generated from expression: @i8x16_avgr_u
            newBody.push(createTriWasmLibCall(ctx, 'i8x16_avgr_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_EXTADD_PAIRWISE_I8X16_S: { // Generated from expression: @i16x8_extadd_pairwise_i8x16_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_extadd_pairwise_i8x16_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_EXTADD_PAIRWISE_I8X16_U: { // Generated from expression: @i16x8_extadd_pairwise_i8x16_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_extadd_pairwise_i8x16_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_EXTADD_PAIRWISE_I16X8_S: { // Generated from expression: @i32x4_extadd_pairwise_i16x8_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_extadd_pairwise_i16x8_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_EXTADD_PAIRWISE_I16X8_U: { // Generated from expression: @i32x4_extadd_pairwise_i16x8_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_extadd_pairwise_i16x8_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_ABS: { // Generated from expression: @i16x8_abs
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_abs'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_NEG: { // Generated from expression: @i16x8_neg
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_neg'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_Q15MULR_SAT_S: { // Generated from expression: @i16x8_q15mulr_sat_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_q15mulr_sat_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_ALL_TRUE: { // Generated from expression: @i16x8_all_true
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_all_true'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I16X8_BITMASK: { // Generated from expression: @i16x8_bitmask
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_bitmask'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I16X8_NARROW_I32X4_S: { // Generated from expression: @i16x8_narrow_i32x4_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_narrow_i32x4_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_NARROW_I32X4_U: { // Generated from expression: @i16x8_narrow_i32x4_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_narrow_i32x4_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_EXTEND_LOW_I8X16_S: { // Generated from expression: @i16x8_extend_low_i8x16_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_extend_low_i8x16_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_EXTEND_HIGH_I8X16_S: { // Generated from expression: @i16x8_extend_high_i8x16_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_extend_high_i8x16_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_EXTEND_LOW_I8X16_U: { // Generated from expression: @i16x8_extend_low_i8x16_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_extend_low_i8x16_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_EXTEND_HIGH_I8X16_U: { // Generated from expression: @i16x8_extend_high_i8x16_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_extend_high_i8x16_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_SHL: { // Generated from expression: @i16x8_shl
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_shl'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_SHR_S: { // Generated from expression: @i16x8_shr_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_shr_s'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_SHR_U: { // Generated from expression: @i16x8_shr_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_shr_u'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_ADD: { // Generated from expression: @i16x8_add
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_add'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_ADD_SAT_S: { // Generated from expression: @i16x8_add_sat_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_add_sat_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_ADD_SAT_U: { // Generated from expression: @i16x8_add_sat_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_add_sat_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_SUB: { // Generated from expression: @i16x8_sub
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_sub'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_SUB_SAT_S: { // Generated from expression: @i16x8_sub_sat_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_sub_sat_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_SUB_SAT_U: { // Generated from expression: @i16x8_sub_sat_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_sub_sat_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_NEAREST: { // Generated from expression: @f64x2_nearest
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_nearest'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_MUL: { // Generated from expression: @i16x8_mul
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_mul'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_MIN_S: { // Generated from expression: @i16x8_min_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_min_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_MIN_U: { // Generated from expression: @i16x8_min_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_min_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_MAX_S: { // Generated from expression: @i16x8_max_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_max_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_MAX_U: { // Generated from expression: @i16x8_max_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_max_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_AVGR_U: { // Generated from expression: @i16x8_avgr_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_avgr_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_EXTMUL_LOW_I8X16_S: { // Generated from expression: @i16x8_extmul_low_i8x16_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_extmul_low_i8x16_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_EXTMUL_HIGH_I8X16_S: { // Generated from expression: @i16x8_extmul_high_i8x16_s
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_extmul_high_i8x16_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_EXTMUL_LOW_I8X16_U: { // Generated from expression: @i16x8_extmul_low_i8x16_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_extmul_low_i8x16_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I16X8_EXTMUL_HIGH_I8X16_U: { // Generated from expression: @i16x8_extmul_high_i8x16_u
            newBody.push(createTriWasmLibCall(ctx, 'i16x8_extmul_high_i8x16_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_ABS: { // Generated from expression: @i32x4_abs
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_abs'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_NEG: { // Generated from expression: @i32x4_neg
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_neg'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_ALL_TRUE: { // Generated from expression: @i32x4_all_true
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_all_true'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I32X4_BITMASK: { // Generated from expression: @i32x4_bitmask
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_bitmask'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I32X4_EXTEND_LOW_I16X8_S: { // Generated from expression: @i32x4_extend_low_i16x8_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_extend_low_i16x8_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_EXTEND_HIGH_I16X8_S: { // Generated from expression: @i32x4_extend_high_i16x8_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_extend_high_i16x8_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_EXTEND_LOW_I16X8_U: { // Generated from expression: @i32x4_extend_low_i16x8_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_extend_low_i16x8_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_EXTEND_HIGH_I16X8_U: { // Generated from expression: @i32x4_extend_high_i16x8_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_extend_high_i16x8_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_SHL: { // Generated from expression: @i32x4_shl
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_shl'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_SHR_S: { // Generated from expression: @i32x4_shr_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_shr_s'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_SHR_U: { // Generated from expression: @i32x4_shr_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_shr_u'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_ADD: { // Generated from expression: @i32x4_add
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_add'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_SUB: { // Generated from expression: @i32x4_sub
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_sub'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_MUL: { // Generated from expression: @i32x4_mul
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_mul'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_MIN_S: { // Generated from expression: @i32x4_min_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_min_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_MIN_U: { // Generated from expression: @i32x4_min_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_min_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_MAX_S: { // Generated from expression: @i32x4_max_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_max_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_MAX_U: { // Generated from expression: @i32x4_max_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_max_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_DOT_I16X8_S: { // Generated from expression: @i32x4_dot_i16x8_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_dot_i16x8_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_EXTMUL_LOW_I16X8_S: { // Generated from expression: @i32x4_extmul_low_i16x8_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_extmul_low_i16x8_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_EXTMUL_HIGH_I16X8_S: { // Generated from expression: @i32x4_extmul_high_i16x8_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_extmul_high_i16x8_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_EXTMUL_LOW_I16X8_U: { // Generated from expression: @i32x4_extmul_low_i16x8_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_extmul_low_i16x8_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_EXTMUL_HIGH_I16X8_U: { // Generated from expression: @i32x4_extmul_high_i16x8_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_extmul_high_i16x8_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_ABS: { // Generated from expression: @i64x2_abs
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_abs'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_NEG: { // Generated from expression: @i64x2_neg
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_neg'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_ALL_TRUE: { // Generated from expression: @i64x2_all_true
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_all_true'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I64X2_BITMASK: { // Generated from expression: @i64x2_bitmask
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_bitmask'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, NumberType.I32);
            break;
        }
        case OP.I64X2_EXTEND_LOW_I32X4_S: { // Generated from expression: @i64x2_extend_low_i32x4_s
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_extend_low_i32x4_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_EXTEND_HIGH_I32X4_S: { // Generated from expression: @i64x2_extend_high_i32x4_s
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_extend_high_i32x4_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_EXTEND_LOW_I32X4_U: { // Generated from expression: @i64x2_extend_low_i32x4_u
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_extend_low_i32x4_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_EXTEND_HIGH_I32X4_U: { // Generated from expression: @i64x2_extend_high_i32x4_u
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_extend_high_i32x4_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_SHL: { // Generated from expression: @i64x2_shl
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_shl'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_SHR_S: { // Generated from expression: @i64x2_shr_s
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_shr_s'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_SHR_U: { // Generated from expression: @i64x2_shr_u
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_shr_u'));
            popTypes(ctx, VectorType.V128, NumberType.I32);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_ADD: { // Generated from expression: @i64x2_add
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_add'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_SUB: { // Generated from expression: @i64x2_sub
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_sub'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_MUL: { // Generated from expression: @i64x2_mul
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_mul'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_EQ: { // Generated from expression: @i64x2_eq
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_eq'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_NE: { // Generated from expression: @i64x2_ne
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_ne'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_LT_S: { // Generated from expression: @i64x2_lt_s
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_lt_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_GT_S: { // Generated from expression: @i64x2_gt_s
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_gt_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_LE_S: { // Generated from expression: @i64x2_le_s
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_le_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_GE_S: { // Generated from expression: @i64x2_ge_s
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_ge_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_EXTMUL_LOW_I32X4_S: { // Generated from expression: @i64x2_extmul_low_i32x4_s
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_extmul_low_i32x4_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_EXTMUL_HIGH_I32X4_S: { // Generated from expression: @i64x2_extmul_high_i32x4_s
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_extmul_high_i32x4_s'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_EXTMUL_LOW_I32X4_U: { // Generated from expression: @i64x2_extmul_low_i32x4_u
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_extmul_low_i32x4_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I64X2_EXTMUL_HIGH_I32X4_U: { // Generated from expression: @i64x2_extmul_high_i32x4_u
            newBody.push(createTriWasmLibCall(ctx, 'i64x2_extmul_high_i32x4_u'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_ABS: { // Generated from expression: @f32x4_abs
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_abs'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_NEG: { // Generated from expression: @f32x4_neg
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_neg'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_SQRT: { // Generated from expression: @f32x4_sqrt
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_sqrt'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_ADD: { // Generated from expression: @f32x4_add
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_add'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_SUB: { // Generated from expression: @f32x4_sub
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_sub'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_MUL: { // Generated from expression: @f32x4_mul
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_mul'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_DIV: { // Generated from expression: @f32x4_div
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_div'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_MIN: { // Generated from expression: @f32x4_min
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_min'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_MAX: { // Generated from expression: @f32x4_max
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_max'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_PMIN: { // Generated from expression: @f32x4_pmin
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_pmin'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_PMAX: { // Generated from expression: @f32x4_pmax
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_pmax'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_ABS: { // Generated from expression: @f64x2_abs
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_abs'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_NEG: { // Generated from expression: @f64x2_neg
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_neg'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_SQRT: { // Generated from expression: @f64x2_sqrt
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_sqrt'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_ADD: { // Generated from expression: @f64x2_add
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_add'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_SUB: { // Generated from expression: @f64x2_sub
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_sub'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_MUL: { // Generated from expression: @f64x2_mul
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_mul'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_DIV: { // Generated from expression: @f64x2_div
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_div'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_MIN: { // Generated from expression: @f64x2_min
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_min'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_MAX: { // Generated from expression: @f64x2_max
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_max'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_PMIN: { // Generated from expression: @f64x2_pmin
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_pmin'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_PMAX: { // Generated from expression: @f64x2_pmax
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_pmax'));
            popTypes(ctx, VectorType.V128, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_TRUNC_SAT_F32X4_S: { // Generated from expression: @i32x4_trunc_sat_f32x4_s
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_trunc_sat_f32x4_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_TRUNC_SAT_F32X4_U: { // Generated from expression: @i32x4_trunc_sat_f32x4_u
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_trunc_sat_f32x4_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_CONVERT_I32X4_S: { // Generated from expression: @f32x4_convert_i32x4_s
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_convert_i32x4_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F32X4_CONVERT_I32X4_U: { // Generated from expression: @f32x4_convert_i32x4_u
            newBody.push(createTriWasmLibCall(ctx, 'f32x4_convert_i32x4_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_TRUNC_SAT_F64X2_S_ZERO: { // Generated from expression: @i32x4_trunc_sat_f64x2_s_zero
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_trunc_sat_f64x2_s_zero'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.I32X4_TRUNC_SAT_F64X2_U_ZERO: { // Generated from expression: @i32x4_trunc_sat_f64x2_u_zero
            newBody.push(createTriWasmLibCall(ctx, 'i32x4_trunc_sat_f64x2_u_zero'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_CONVERT_LOW_I32X4_S: { // Generated from expression: @f64x2_convert_low_i32x4_s
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_convert_low_i32x4_s'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
            break;
        }
        case OP.F64X2_CONVERT_LOW_I32X4_U: { // Generated from expression: @f64x2_convert_low_i32x4_u
            newBody.push(createTriWasmLibCall(ctx, 'f64x2_convert_low_i32x4_u'));
            popTypes(ctx, VectorType.V128);
            pushTypes(ctx, VectorType.V128);
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

