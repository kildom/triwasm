/*!
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
import { OP } from "./opcodes";
import { NumberType, RefType, ValueType, valueTypeWords, VectorType, WasmBlock, WasmFunction, WasmFunctionKind, WasmInstr, WasmInstrFunc, WasmModule } from "./wasmModule";

class TriVMExtensions {
    public unwind = true;
    public mem64 = true;
    public i64 = true;
    public f32 = true;
    public f64 = true;
    public faults = {
        unreachable: true,
    };
}

export class Reducer {

    private typeStack: ValueType[] = [];
    private blockStack: WasmBlock[] = [];
    private ext: TriVMExtensions = new TriVMExtensions();
    private module: WasmModule = allowTemporaryNull as WasmModule;

    public reduce(module: WasmModule) {
        this.module = module;
        for (let func of module.functions) {
            this.reduceFunction(func);
        }
    }

    private reduceFunction(func: WasmFunction) {
        if (func.block && (func.kind === WasmFunctionKind.WASM || func.kind === WasmFunctionKind.WASM_TYPE_UNKNOWN)) {
            this.typeStack = [];
            this.blockStack = [func.block];
            this.reduceBlockBody(func, func.block.body);
            if (func.kind === WasmFunctionKind.WASM_TYPE_UNKNOWN) {
                throw new Error('Unknown return type of function.');
            }
        }
    }

    private reduceBlockBody(func: WasmFunction, body: WasmInstr[]): boolean {
        let newBody: WasmInstr[] = [];
        let unreachable = false;
        for (let instr of body) {
            if (unreachable && instr.opcode !== OP.ELSE) {
                if (instr.opcode == OP.END) {
                    newBody.push({ opcode: OP.TRIVM_END_UNREACHABLE });
                }
                // skip unreachable instructions
            } else {
                unreachable = this.reduceInstr(func, newBody, instr);
            }
        }
        body.splice(0, Infinity, ...newBody);
        return unreachable;
    }

    private createTriWasmLibCall(name: string): WasmInstrFunc {
        let func = this.module.getExported('__triwasm__softfloatlib', name, false);
        if (func === undefined) {
            func = this.module.getExported('__triwasm__triwasmlib', name, true);
        }
        return { opcode: OP.CALL, func };
    }

    private detectReturnType(func: WasmFunction, block: WasmBlock | undefined) {
        if (block && func.kind == WasmFunctionKind.WASM_TYPE_UNKNOWN && block.parentInstruction.opcode === OP.TRIVM_FUNCTION && this.typeStack.length > 0) {
            func.type = { params: [], results: [this.typeStack.at(-1) as ValueType] };
            block.type = func.type;
            func.kind = WasmFunctionKind.WASM;
        }
    }

    private reduceBlock(func: WasmFunction, block: WasmBlock) {
        this.popTypes(...block.type.params);
        this.pushTypes(...block.type.results);
        let exitStack = this.typeStack;

        this.typeStack = [...block.type.params];
        this.blockStack.push(block);
        let endUnreachable = this.reduceBlockBody(func, block.body);
        this.blockStack.pop();
        if (!endUnreachable) {
            this.popTypes(...block.type.results);
        }
        this.typeStack = exitStack;
    }

    private pushTypes(...args: ValueType[]) {
        this.typeStack.push(...args);
    }

    private popTypes(...args: ValueType[]) {
        if (args.length > this.typeStack.length) {
            throw new Error('Validation detected stack underflow.');
        }
        for (let i = args.length - 1; i >= 0; i--) {
            if (this.typeStack.pop() !== args[i]) {
                throw new Error('Validation detected invalid stack types.');
            }
        }
    }

    private checkTypes(...args: ValueType[]) {
        if (args.length > this.typeStack.length) {
            throw new Error('Validation detected stack underflow.');
        }
        for (let i = args.length - 1; i >= 0; i--) {
            if (this.typeStack.at(-1 - i) !== args[i]) {
                throw new Error('Validation detected invalid stack types.');
            }
        }
    }

    private checkStackMatchesTarget(target: WasmBlock) {
        if (target.parentInstruction.opcode === OP.LOOP) {
            this.checkTypes(...target.type.params); // TODO: Check if loop branch clears top of stack or keep top parameters and clears below them.
        } else {
            this.checkTypes(...target.type.results);
        }
    }

    private bytesToI32(buffer: Uint8Array, offset: number): number {
        return ((buffer[offset + 3] << 24) | (buffer[offset + 2] << 16) | (buffer[offset + 1] << 8) | buffer[offset]) & 0xFFFFFFFF;
    }

    checkDeletedEntity(entity: any) {
        if (entity.deleted) {
            throw new Error("Using tables from linked modules is forbidden.");
        }
    }

    private reduceInstr(func: WasmFunction, newBody: WasmInstr[], instr: WasmInstr): boolean {

        let unreachable = false;

        switch (instr.opcode) {
            // -- Begin of source code generated with help of "gen-instr.ts" script --

            case OP.UNREACHABLE: {
                if (this.ext.faults.unreachable) {
                    newBody.push(this.createTriWasmLibCall('unreachable'));
                }
                unreachable = true;
                break;
            }
            case OP.BLOCK: {
                this.reduceBlock(func, instr.block);
                newBody.push(instr);
                break;
            }
            case OP.LOOP: {
                this.reduceBlock(func, instr.block);
                newBody.push(instr);
                break;
            }
            case OP.IF: {
                this.popTypes(NumberType.I32);
                this.reduceBlock(func, instr.block);
                newBody.push(instr);
                break;
            }
            case OP.ELSE: {
                this.typeStack = [...(this.blockStack.at(-1)!.type.params || [])];
                newBody.push(instr);
                break;
            }
            case OP.END: {
                this.detectReturnType(func, this.blockStack.at(-1));
                newBody.push(instr);
                break;
            }
            case OP.BR: {
                this.detectReturnType(func, instr.target);
                this.checkStackMatchesTarget(instr.target);
                unreachable = true;
                newBody.push(instr);
                break;
            }
            case OP.BR_IF: {
                this.popTypes(NumberType.I32);
                this.detectReturnType(func, instr.target);
                this.checkStackMatchesTarget(instr.target);
                newBody.push(instr);
                break;
            }
            case OP.BR_TABLE: {
                this.popTypes(NumberType.I32);
                for (let target of instr.targets) {
                    this.detectReturnType(func, target);
                    this.checkStackMatchesTarget(target);
                }
                unreachable = true;
                newBody.push(instr);
                break;
            }
            case OP.RETURN: {
                this.detectReturnType(func, this.blockStack[0]);
                this.checkStackMatchesTarget(this.blockStack[0]);
                unreachable = true;
                newBody.push({ opcode: OP.BR, target: this.blockStack[0] });
                break;
            }
            case OP.CALL: {
                let func = instr.func.resolved;
                this.popTypes(...func.type.params);
                this.pushTypes(...func.type.results);
                newBody.push(instr);
                break;
            }
            case OP.CALL_INDIRECT: {
                this.popTypes(NumberType.I32);
                this.popTypes(...instr.type.params);
                this.pushTypes(...instr.type.results);
                if (this.module.tables.length > 1) {
                    newBody.push({ opcode: OP.I32_CONST, value: instr.table.index });
                }
                this.checkDeletedEntity(instr.table); // TODO: Deleted entity references should be checked in the merger
                newBody.push(this.createTriWasmLibCall('call_indirect'));
                break;
            }
            case OP.DROP: {
                let type = this.typeStack.at(-1) || -1;
                this.popTypes(type);
                let words = valueTypeWords(type);
                newBody.push({ opcode: OP.TRIVM_POP, value: words });
                break;
            }
            case OP.SELECT:
            case OP.SELECT_T: {
                this.popTypes(NumberType.I32);
                let type = this.typeStack.at(-1) as ValueType;
                this.popTypes(type, type);
                this.pushTypes(type);
                newBody.push(this.createTriWasmLibCall('select' + (32 * valueTypeWords(type))));
                break;
            }
            case OP.LOCAL_GET: {
                let type = func.locals[instr.index];
                this.pushTypes(type);
                let words = valueTypeWords(type);
                let offset = 0;
                while (words > 0) {
                    if (this.ext.mem64 && words > 1) {
                        newBody.push({ opcode: OP.TRIVM_LOCAL_GET64, index: instr.index, offset });
                        offset += 8;
                        words -= 2;
                    } else {
                        newBody.push({ opcode: OP.TRIVM_LOCAL_GET32, index: instr.index, offset });
                        offset += 4;
                        words -= 1;
                    }
                }
                break;
            }
            case OP.LOCAL_SET: {
                let type = func.locals[instr.index];
                this.popTypes(type);
                let words = valueTypeWords(type);
                while (words > 0) {
                    if (this.ext.mem64 && words > 1) {
                        words -= 2;
                        newBody.push({ opcode: OP.TRIVM_LOCAL_SET64, index: instr.index, offset: 4 * words });
                    } else {
                        words -= 1;
                        newBody.push({ opcode: OP.TRIVM_LOCAL_SET32, index: instr.index, offset: 4 * words });
                    }
                }
                break;
            }
            case OP.LOCAL_TEE: {
                let type = func.locals[instr.index];
                this.checkTypes(type);
                let words = valueTypeWords(type);
                let offset = 0;
                while (words > 0) {
                    if (this.ext.mem64 && words > 1) {
                        words -= 2;
                        newBody.push({ opcode: OP.TRIVM_DUP64, offset });
                        newBody.push({ opcode: OP.TRIVM_LOCAL_SET64, index: instr.index, 4 * words });
                        offset += 8;
                    } else {
                        words -= 1;
                        newBody.push({ opcode: OP.TRIVM_DUP32, offset });
                        newBody.push({ opcode: OP.TRIVM_LOCAL_SET32, index: instr.index, 4 * words });
                        offset += 4;
                    }
                }
                break;
            }
            case OP.GLOBAL_GET: {
                this.pushTypes(instr.global.type);
                break;
            }
            case OP.GLOBAL_SET: {
                this.popTypes(instr.global.type);
                break;
            }
            case OP.TABLE_GET: {
                break;
            }
            case OP.TABLE_SET: {
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
                if (this.ext.mem64) {
                    newBody.push(instr);
                } else if (instr.offset == 0) {
                    newBody.push(this.createTriWasmLibCall('i64_load_0'));
                } else {
                    newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                    newBody.push(this.createTriWasmLibCall('i64_load'));
                }
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.F32_LOAD: { // Generated from expression: i32.load offset, memory
                newBody.push({ opcode: OP.I32_LOAD, offset: instr.offset, memory: instr.memory });
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.F32);
                break;
            }
            case OP.F64_LOAD: { // Generated from expression: {#mem64} i64.load memory, offset {elif ..offset == 0} @i64_load_0 {else} i32.const value:..offset ; @i64_load
                if (this.ext.mem64) {
                    newBody.push({ opcode: OP.I64_LOAD, memory: instr.memory, offset: instr.offset });
                } else if (instr.offset == 0) {
                    newBody.push(this.createTriWasmLibCall('i64_load_0'));
                } else {
                    newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                    newBody.push(this.createTriWasmLibCall('i64_load'));
                }
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.F64);
                break;
            }
            case OP.I64_LOAD8_S: { // Generated from expression: i32.load8_s offset, memory {#i64} i64.extend_i32_s {else} @i64_extend_i32_s
                newBody.push({ opcode: OP.I32_LOAD8_S, offset: instr.offset, memory: instr.memory });
                if (this.ext.i64) {
                    newBody.push({ opcode: OP.I64_EXTEND_I32_S });
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_extend_i32_s'));
                }
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_LOAD8_U: { // Generated from expression: i32.load8_u memory, offset ; i32.const value:0
                newBody.push({ opcode: OP.I32_LOAD8_U, memory: instr.memory, offset: instr.offset });
                newBody.push({ opcode: OP.I32_CONST, value: 0 });
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_LOAD16_S: { // Generated from expression: i32.load16_s offset, memory {#i64} i64.extend_i32_s {else} @i64_extend_i32_s
                newBody.push({ opcode: OP.I32_LOAD16_S, offset: instr.offset, memory: instr.memory });
                if (this.ext.i64) {
                    newBody.push({ opcode: OP.I64_EXTEND_I32_S });
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_extend_i32_s'));
                }
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_LOAD16_U: { // Generated from expression: i32.load16_u memory, offset ; i32.const value:0
                newBody.push({ opcode: OP.I32_LOAD16_U, memory: instr.memory, offset: instr.offset });
                newBody.push({ opcode: OP.I32_CONST, value: 0 });
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_LOAD32_S: { // Generated from expression: i32.load offset, memory {#i64} i64.extend_i32_s {else} @i64_extend_i32_s
                newBody.push({ opcode: OP.I32_LOAD, offset: instr.offset, memory: instr.memory });
                if (this.ext.i64) {
                    newBody.push({ opcode: OP.I64_EXTEND_I32_S });
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_extend_i32_s'));
                }
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_LOAD32_U: { // Generated from expression: i32.load offset, memory ; i32.const value:0
                newBody.push({ opcode: OP.I32_LOAD, offset: instr.offset, memory: instr.memory });
                newBody.push({ opcode: OP.I32_CONST, value: 0 });
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_STORE: { // Generated from expression: {#mem64} ## {elif ..offset == 0} @i64_store_0 {else} i32.const value:..offset ; @i64_store {end}
                if (this.ext.mem64) {
                    newBody.push(instr);
                } else if (instr.offset == 0) {
                    newBody.push(this.createTriWasmLibCall('i64_store_0'));
                } else {
                    newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                    newBody.push(this.createTriWasmLibCall('i64_store'));
                }
                this.popTypes(NumberType.I32, NumberType.I64);
                break;
            }
            case OP.F32_STORE: { // Generated from expression: i32.store offset, memory
                newBody.push({ opcode: OP.I32_STORE, offset: instr.offset, memory: instr.memory });
                this.popTypes(NumberType.I32, NumberType.F32);
                break;
            }
            case OP.F64_STORE: { // Generated from expression: {#mem64} i64.store offset, memory {elif ..offset == 0} @i64_store_0 {else} i32.const value:..offset ; @i64_store {end}
                if (this.ext.mem64) {
                    newBody.push({ opcode: OP.I64_STORE, offset: instr.offset, memory: instr.memory });
                } else if (instr.offset == 0) {
                    newBody.push(this.createTriWasmLibCall('i64_store_0'));
                } else {
                    newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                    newBody.push(this.createTriWasmLibCall('i64_store'));
                }
                this.popTypes(NumberType.I32, NumberType.F64);
                break;
            }
            case OP.I64_STORE8: { // Generated from expression: trivm.pop value: 1 ; i32.store8 offset, memory
                newBody.push({ opcode: OP.TRIVM_POP, value: 1 });
                newBody.push({ opcode: OP.I32_STORE8, offset: instr.offset, memory: instr.memory });
                this.popTypes(NumberType.I32, NumberType.I64);
                break;
            }
            case OP.I64_STORE16: { // Generated from expression: trivm.pop value: 1 ; i32.store16 offset, memory
                newBody.push({ opcode: OP.TRIVM_POP, value: 1 });
                newBody.push({ opcode: OP.I32_STORE16, offset: instr.offset, memory: instr.memory });
                this.popTypes(NumberType.I32, NumberType.I64);
                break;
            }
            case OP.I64_STORE32: { // Generated from expression: trivm.pop value: 1 ; i32.store offset, memory
                newBody.push({ opcode: OP.TRIVM_POP, value: 1 });
                newBody.push({ opcode: OP.I32_STORE, offset: instr.offset, memory: instr.memory });
                this.popTypes(NumberType.I32, NumberType.I64);
                break;
            }
            case OP.MEMORY_SIZE: { // Generated from expression: @memory_size
                newBody.push(this.createTriWasmLibCall('memory_size'));
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.MEMORY_GROW: { // Generated from expression: @memory_grow
                newBody.push(this.createTriWasmLibCall('memory_grow'));
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I64_CONST: { // Generated from expression: {#mem64} ## {else} i32.const value: Number(..value & 0xFFFFFFFFn) & 0xFFFFFFFF ; i32.const value: Number(..value >> 32n) & 0xFFFFFFFF
                if (this.ext.mem64) {
                    newBody.push(instr);
                } else {
                    newBody.push({ opcode: OP.I32_CONST, value: Number(instr.value & 0xFFFFFFFFn) & 0xFFFFFFFF });
                    newBody.push({ opcode: OP.I32_CONST, value: Number(instr.value >> 32n) & 0xFFFFFFFF });
                }
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.F32_CONST: { // Generated from expression: i32.const value
                newBody.push({ opcode: OP.I32_CONST, value: instr.value });
                this.pushTypes(NumberType.F32);
                break;
            }
            case OP.F64_CONST: { // Generated from expression: {#mem64} i64.const value {else} i32.const value: Number(..value & 0xFFFFFFFFn) & 0xFFFFFFFF ; i32.const value: Number(..value >> 32n) & 0xFFFFFFFF
                if (this.ext.mem64) {
                    newBody.push({ opcode: OP.I64_CONST, value: instr.value });
                } else {
                    newBody.push({ opcode: OP.I32_CONST, value: Number(instr.value & 0xFFFFFFFFn) & 0xFFFFFFFF });
                    newBody.push({ opcode: OP.I32_CONST, value: Number(instr.value >> 32n) & 0xFFFFFFFF });
                }
                this.pushTypes(NumberType.F64);
                break;
            }
            case OP.I32_NE: { // Generated from expression: i32.eq ; i32.eqz
                newBody.push({ opcode: OP.I32_EQ });
                newBody.push({ opcode: OP.I32_EQZ });
                this.popTypes(NumberType.I32, NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32_LE_S: { // Generated from expression: i32.gt_s ; i32.eqz
                newBody.push({ opcode: OP.I32_GT_S });
                newBody.push({ opcode: OP.I32_EQZ });
                this.popTypes(NumberType.I32, NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32_LE_U: { // Generated from expression: i32.gt_u ; i32.eqz
                newBody.push({ opcode: OP.I32_GT_U });
                newBody.push({ opcode: OP.I32_EQZ });
                this.popTypes(NumberType.I32, NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32_GE_S: { // Generated from expression: i32.lt_s ; i32.eqz
                newBody.push({ opcode: OP.I32_LT_S });
                newBody.push({ opcode: OP.I32_EQZ });
                this.popTypes(NumberType.I32, NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32_GE_U: { // Generated from expression: i32.lt_u ; i32.eqz
                newBody.push({ opcode: OP.I32_LT_U });
                newBody.push({ opcode: OP.I32_EQZ });
                this.popTypes(NumberType.I32, NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I64_EQZ: { // Generated from expression: i32.or ; i32.eqz
                newBody.push({ opcode: OP.I32_OR });
                newBody.push({ opcode: OP.I32_EQZ });
                this.popTypes(NumberType.I64);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I64_EQ: { // Generated from expression: {#i64} ## {else} @i64_eq
                if (this.ext.i64) {
                    newBody.push(instr);
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_eq'));
                }
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I64_NE: { // Generated from expression: {#i64} i64.eq {else} @i64_eq {end} i32.eqz
                if (this.ext.i64) {
                    newBody.push({ opcode: OP.I64_EQ });
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_eq'));
                }
                newBody.push({ opcode: OP.I32_EQZ });
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I32);
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
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.F32_EQ:
            case OP.F32_NE:
            case OP.F32_LT:
            case OP.F32_GT:
            case OP.F32_LE:
            case OP.F32_GE: { // TODO
                this.popTypes(NumberType.F32, NumberType.F32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.F64_EQ:
            case OP.F64_NE:
            case OP.F64_LT:
            case OP.F64_GT:
            case OP.F64_LE:
            case OP.F64_GE: { // TODO
                this.popTypes(NumberType.F64, NumberType.F64);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32_CLZ: { // Generated from expression: @i32_clz
                newBody.push(this.createTriWasmLibCall('i32_clz'));
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32_CTZ: { // Generated from expression: @i32_ctz
                newBody.push(this.createTriWasmLibCall('i32_ctz'));
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32_POPCNT: { // Generated from expression: @i32_popcnt
                newBody.push(this.createTriWasmLibCall('i32_popcnt'));
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32_ROTL: { // Generated from expression: @i32_rotl
                newBody.push(this.createTriWasmLibCall('i32_rotl'));
                this.popTypes(NumberType.I32, NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32_ROTR: { // Generated from expression: @i32_rotr
                newBody.push(this.createTriWasmLibCall('i32_rotr'));
                this.popTypes(NumberType.I32, NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I64_CLZ: { // Generated from expression: @i64_clz32; i32.const value:0
                newBody.push(this.createTriWasmLibCall('i64_clz32'));
                newBody.push({ opcode: OP.I32_CONST, value: 0 });
                this.popTypes(NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_CTZ: { // Generated from expression: @i64_ctz32; i32.const value:0
                newBody.push(this.createTriWasmLibCall('i64_ctz32'));
                newBody.push({ opcode: OP.I32_CONST, value: 0 });
                this.popTypes(NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_POPCNT: { // Generated from expression: @i64_popcnt32; i32.const value:0
                newBody.push(this.createTriWasmLibCall('i64_popcnt32'));
                newBody.push({ opcode: OP.I32_CONST, value: 0 });
                this.popTypes(NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_ADD: { // Generated from expression: {#i64} ## {else} @i64_add
                if (this.ext.i64) {
                    newBody.push(instr);
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_add'));
                }
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_SUB: { // Generated from expression: {#i64} ## {else} @i64_sub
                if (this.ext.i64) {
                    newBody.push(instr);
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_sub'));
                }
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_MUL: { // Generated from expression: {#i64} ## {else} @i64_mul
                if (this.ext.i64) {
                    newBody.push(instr);
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_mul'));
                }
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_DIV_S: { // Generated from expression: {#i64} ## {else} @i64_div_s
                if (this.ext.i64) {
                    newBody.push(instr);
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_div_s'));
                }
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_DIV_U: { // Generated from expression: {#i64} ## {else} @i64_div_u
                if (this.ext.i64) {
                    newBody.push(instr);
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_div_u'));
                }
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_REM_S: { // Generated from expression: {#i64} ## {else} @i64_rem_s
                if (this.ext.i64) {
                    newBody.push(instr);
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_rem_s'));
                }
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_REM_U: { // Generated from expression: {#i64} ## {else} @i64_rem_u
                if (this.ext.i64) {
                    newBody.push(instr);
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_rem_u'));
                }
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_AND: { // Generated from expression: {#i64} ## {else} @i64_and
                if (this.ext.i64) {
                    newBody.push(instr);
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_and'));
                }
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_OR: { // Generated from expression: {#i64} ## {else} @i64_or
                if (this.ext.i64) {
                    newBody.push(instr);
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_or'));
                }
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_XOR: { // Generated from expression: {#i64} ## {else} @i64_xor
                if (this.ext.i64) {
                    newBody.push(instr);
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_xor'));
                }
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_SHL: { // Generated from expression: {#i64} ## {else} @i64_shl
                if (this.ext.i64) {
                    newBody.push(instr);
                } else {
                    newBody.push(this.createTriWasmLibCall('i64_shl'));
                }
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_SHR_S:
            case OP.I64_SHR_U:
            case OP.I64_ROTL:
            case OP.I64_ROTR: { // TODO
                this.popTypes(NumberType.I64, NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.F32_ABS:
            case OP.F32_NEG:
            case OP.F32_CEIL:
            case OP.F32_FLOOR:
            case OP.F32_TRUNC:
            case OP.F32_NEAREST:
            case OP.F32_SQRT: { // TODO
                this.popTypes(NumberType.F32);
                this.pushTypes(NumberType.F32);
                break;
            }
            case OP.F32_ADD:
            case OP.F32_SUB:
            case OP.F32_MUL:
            case OP.F32_DIV:
            case OP.F32_MIN:
            case OP.F32_MAX:
            case OP.F32_COPYSIGN: { // TODO
                this.popTypes(NumberType.F32, NumberType.F32);
                this.pushTypes(NumberType.F32);
                break;
            }
            case OP.F64_ABS:
            case OP.F64_NEG:
            case OP.F64_CEIL:
            case OP.F64_FLOOR:
            case OP.F64_TRUNC:
            case OP.F64_NEAREST:
            case OP.F64_SQRT: { // TODO
                this.popTypes(NumberType.F64);
                this.pushTypes(NumberType.F64);
                break;
            }
            case OP.F64_ADD:
            case OP.F64_SUB:
            case OP.F64_MUL:
            case OP.F64_DIV:
            case OP.F64_MIN:
            case OP.F64_MAX:
            case OP.F64_COPYSIGN: { // TODO
                this.popTypes(NumberType.F64, NumberType.F64);
                this.pushTypes(NumberType.F64);
                break;
            }
            case OP.I32_WRAP_I64: { // TODO
                this.popTypes(NumberType.I64);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32_TRUNC_F32_S:
            case OP.I32_TRUNC_F32_U:
            case OP.I32_REINTERPRET_F32:
            case OP.I32_TRUNC_SAT_F32_S:
            case OP.I32_TRUNC_SAT_F32_U: { // TODO
                this.popTypes(NumberType.F32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32_TRUNC_F64_S:
            case OP.I32_TRUNC_F64_U:
            case OP.I32_TRUNC_SAT_F64_S:
            case OP.I32_TRUNC_SAT_F64_U: { // TODO
                this.popTypes(NumberType.F64);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I64_EXTEND_I32_S:
            case OP.I64_EXTEND_I32_U: { // TODO
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_TRUNC_F32_S:
            case OP.I64_TRUNC_F32_U:
            case OP.I64_TRUNC_SAT_F32_S:
            case OP.I64_TRUNC_SAT_F32_U: { // TODO
                this.popTypes(NumberType.F32);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64_TRUNC_F64_S:
            case OP.I64_TRUNC_F64_U:
            case OP.I64_REINTERPRET_F64:
            case OP.I64_TRUNC_SAT_F64_S:
            case OP.I64_TRUNC_SAT_F64_U: { // TODO
                this.popTypes(NumberType.F64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.F32_CONVERT_I32_S:
            case OP.F32_CONVERT_I32_U:
            case OP.F32_REINTERPRET_I32: { // TODO
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.F32);
                break;
            }
            case OP.F32_CONVERT_I64_S:
            case OP.F32_CONVERT_I64_U: { // TODO
                this.popTypes(NumberType.I64);
                this.pushTypes(NumberType.F32);
                break;
            }
            case OP.F32_DEMOTE_F64: { // TODO
                this.popTypes(NumberType.F64);
                this.pushTypes(NumberType.F32);
                break;
            }
            case OP.F64_CONVERT_I32_S:
            case OP.F64_CONVERT_I32_U: { // TODO
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.F64);
                break;
            }
            case OP.F64_CONVERT_I64_S:
            case OP.F64_CONVERT_I64_U:
            case OP.F64_REINTERPRET_I64: { // TODO
                this.popTypes(NumberType.I64);
                this.pushTypes(NumberType.F64);
                break;
            }
            case OP.F64_PROMOTE_F32: { // TODO
                this.popTypes(NumberType.F32);
                this.pushTypes(NumberType.F64);
                break;
            }
            case OP.I32_EXTEND8_S:
            case OP.I32_EXTEND16_S: { // TODO
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I64_EXTEND8_S:
            case OP.I64_EXTEND16_S:
            case OP.I64_EXTEND32_S: { // TODO
                this.popTypes(NumberType.I64);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.REF_NULL: { // TODO
                this.pushTypes();
                break;
            }
            case OP.REF_FUNC: { // TODO
                this.pushTypes(RefType.FUNCREF);
                break;
            }
            case OP.MEMORY_INIT:
            case OP.MEMORY_COPY:
            case OP.MEMORY_FILL:
            case OP.TABLE_INIT: { // TODO
                this.popTypes(NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.DATA_DROP:
            case OP.ELEM_DROP: { // Generated from expression: nop
                newBody.push({ opcode: OP.NOP });
                break;
            }
            case OP.TABLE_COPY: { // Generated from expression: i32.const value:..tables[0].index ; i32.const value:..tables[1].index ; @table_copy
                newBody.push({ opcode: OP.I32_CONST, value: instr.tables[0].index });
                newBody.push({ opcode: OP.I32_CONST, value: instr.tables[1].index });
                newBody.push(this.createTriWasmLibCall('table_copy'));
                this.popTypes(NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.TABLE_SIZE: { // Generated from expression: i32.const value:..table.index ; @table_size
                newBody.push({ opcode: OP.I32_CONST, value: instr.table.index });
                newBody.push(this.createTriWasmLibCall('table_size'));
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.V128_LOAD: { // Generated from expression: i32.const value:..offset ; @v128_load
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push(this.createTriWasmLibCall('v128_load'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD8X8_S: { // Generated from expression: i32.const value:..offset ; @v128_load8x8_s
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push(this.createTriWasmLibCall('v128_load8x8_s'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD8X8_U: { // Generated from expression: i32.const value:..offset ; @v128_load8x8_u
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push(this.createTriWasmLibCall('v128_load8x8_u'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD16X4_S: { // Generated from expression: i32.const value:..offset ; @v128_load16x4_s
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push(this.createTriWasmLibCall('v128_load16x4_s'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD16X4_U: { // Generated from expression: i32.const value:..offset ; @v128_load16x4_u
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push(this.createTriWasmLibCall('v128_load16x4_u'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD32X2_S: { // Generated from expression: i32.const value:..offset ; @v128_load32x2_s
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push(this.createTriWasmLibCall('v128_load32x2_s'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD32X2_U: { // Generated from expression: i32.const value:..offset ; @v128_load32x2_u
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push(this.createTriWasmLibCall('v128_load32x2_u'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD8_SPLAT: { // Generated from expression: i32.const value:..offset ; @v128_load8_splat
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push(this.createTriWasmLibCall('v128_load8_splat'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD16_SPLAT: { // Generated from expression: i32.const value:..offset ; @v128_load16_splat
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push(this.createTriWasmLibCall('v128_load16_splat'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD32_SPLAT: { // Generated from expression: i32.const value:..offset ; @v128_load32_splat
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push(this.createTriWasmLibCall('v128_load32_splat'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD64_SPLAT: { // Generated from expression: i32.const value:..offset ; @v128_load64_splat
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push(this.createTriWasmLibCall('v128_load64_splat'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_STORE: { // Generated from expression: i32.const value:..offset ; @v128_store
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push(this.createTriWasmLibCall('v128_store'));
                this.popTypes(NumberType.I32, VectorType.V128);
                break;
            }
            case OP.V128_CONST: { // Generated from expression: i32.const value:this.bytesToI32(..value\, 0) ; i32.const value:this.bytesToI32(..value\, 4) ; i32.const value:this.bytesToI32(..value\, 8) ; i32.const value:this.bytesToI32(..value\, 12)
                newBody.push({ opcode: OP.I32_CONST, value: this.bytesToI32(instr.value, 0) });
                newBody.push({ opcode: OP.I32_CONST, value: this.bytesToI32(instr.value, 4) });
                newBody.push({ opcode: OP.I32_CONST, value: this.bytesToI32(instr.value, 8) });
                newBody.push({ opcode: OP.I32_CONST, value: this.bytesToI32(instr.value, 12) });
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_SHUFFLE: { // Generated from expression: i32.const value:this.bytesToI32(..value\, 0) ; i32.const value:this.bytesToI32(..value\, 4) ; i32.const value:this.bytesToI32(..value\, 8) ; i32.const value:this.bytesToI32(..value\, 12) ; @i8x16_shuffle
                newBody.push({ opcode: OP.I32_CONST, value: this.bytesToI32(instr.value, 0) });
                newBody.push({ opcode: OP.I32_CONST, value: this.bytesToI32(instr.value, 4) });
                newBody.push({ opcode: OP.I32_CONST, value: this.bytesToI32(instr.value, 8) });
                newBody.push({ opcode: OP.I32_CONST, value: this.bytesToI32(instr.value, 12) });
                newBody.push(this.createTriWasmLibCall('i8x16_shuffle'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_SWIZZLE: { // Generated from expression: @i8x16_swizzle
                newBody.push(this.createTriWasmLibCall('i8x16_swizzle'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_SPLAT: { // Generated from expression: @i8x16_splat
                newBody.push(this.createTriWasmLibCall('i8x16_splat'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_SPLAT: { // Generated from expression: @i16x8_splat
                newBody.push(this.createTriWasmLibCall('i16x8_splat'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_SPLAT: { // Generated from expression: @i32x4_splat
                newBody.push(this.createTriWasmLibCall('i32x4_splat'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_SPLAT: { // Generated from expression: @i64x2_splat
                newBody.push(this.createTriWasmLibCall('i64x2_splat'));
                this.popTypes(NumberType.I64);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_SPLAT: { // Generated from expression: @f32x4_splat
                newBody.push(this.createTriWasmLibCall('f32x4_splat'));
                this.popTypes(NumberType.F32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_SPLAT: { // Generated from expression: @f64x2_splat
                newBody.push(this.createTriWasmLibCall('f64x2_splat'));
                this.popTypes(NumberType.F64);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_EXTRACT_LANE_S: { // Generated from expression: i32.const value:..index ; @i8x16_extract_lane_s
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('i8x16_extract_lane_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I8X16_EXTRACT_LANE_U: { // Generated from expression: i32.const value:..index ; @i8x16_extract_lane_u
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('i8x16_extract_lane_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I8X16_REPLACE_LANE: { // Generated from expression: i32.const value:..index ; @i8x16_replace_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('i8x16_replace_lane'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTRACT_LANE_S: { // Generated from expression: i32.const value:..index ; @i16x8_extract_lane_s
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('i16x8_extract_lane_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I16X8_EXTRACT_LANE_U: { // Generated from expression: i32.const value:..index ; @i16x8_extract_lane_u
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('i16x8_extract_lane_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I16X8_REPLACE_LANE: { // Generated from expression: i32.const value:..index ; @i16x8_replace_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('i16x8_replace_lane'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTRACT_LANE: { // Generated from expression: i32.const value:..index ; @i32x4_extract_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('i32x4_extract_lane'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32X4_REPLACE_LANE: { // Generated from expression: i32.const value:..index ; @i32x4_replace_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('i32x4_replace_lane'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTRACT_LANE: { // Generated from expression: i32.const value:..index ; @i64x2_extract_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('i64x2_extract_lane'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I64);
                break;
            }
            case OP.I64X2_REPLACE_LANE: { // Generated from expression: i32.const value:..index ; @i64x2_replace_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('i64x2_replace_lane'));
                this.popTypes(VectorType.V128, NumberType.I64);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_EXTRACT_LANE: { // Generated from expression: i32.const value:..index ; @f32x4_extract_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('f32x4_extract_lane'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.F32);
                break;
            }
            case OP.F32X4_REPLACE_LANE: { // Generated from expression: i32.const value:..index ; @f32x4_replace_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('f32x4_replace_lane'));
                this.popTypes(VectorType.V128, NumberType.F32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_EXTRACT_LANE: { // Generated from expression: i32.const value:..index ; @f64x2_extract_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('f64x2_extract_lane'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.F64);
                break;
            }
            case OP.F64X2_REPLACE_LANE: { // Generated from expression: i32.const value:..index ; @f64x2_replace_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('f64x2_replace_lane'));
                this.popTypes(VectorType.V128, NumberType.F64);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_EQ: { // Generated from expression: @i8x16_eq
                newBody.push(this.createTriWasmLibCall('i8x16_eq'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_NE: { // Generated from expression: @i8x16_ne
                newBody.push(this.createTriWasmLibCall('i8x16_ne'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_LT_S: { // Generated from expression: @i8x16_lt_s
                newBody.push(this.createTriWasmLibCall('i8x16_lt_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_LT_U: { // Generated from expression: @i8x16_lt_u
                newBody.push(this.createTriWasmLibCall('i8x16_lt_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_GT_S: { // Generated from expression: @i8x16_gt_s
                newBody.push(this.createTriWasmLibCall('i8x16_gt_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_GT_U: { // Generated from expression: @i8x16_gt_u
                newBody.push(this.createTriWasmLibCall('i8x16_gt_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_LE_S: { // Generated from expression: @i8x16_le_s
                newBody.push(this.createTriWasmLibCall('i8x16_le_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_LE_U: { // Generated from expression: @i8x16_le_u
                newBody.push(this.createTriWasmLibCall('i8x16_le_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_GE_S: { // Generated from expression: @i8x16_ge_s
                newBody.push(this.createTriWasmLibCall('i8x16_ge_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_GE_U: { // Generated from expression: @i8x16_ge_u
                newBody.push(this.createTriWasmLibCall('i8x16_ge_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_EQ: { // Generated from expression: @i16x8_eq
                newBody.push(this.createTriWasmLibCall('i16x8_eq'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_NE: { // Generated from expression: @i16x8_ne
                newBody.push(this.createTriWasmLibCall('i16x8_ne'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_LT_S: { // Generated from expression: @i16x8_lt_s
                newBody.push(this.createTriWasmLibCall('i16x8_lt_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_LT_U: { // Generated from expression: @i16x8_lt_u
                newBody.push(this.createTriWasmLibCall('i16x8_lt_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_GT_S: { // Generated from expression: @i16x8_gt_s
                newBody.push(this.createTriWasmLibCall('i16x8_gt_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_GT_U: { // Generated from expression: @i16x8_gt_u
                newBody.push(this.createTriWasmLibCall('i16x8_gt_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_LE_S: { // Generated from expression: @i16x8_le_s
                newBody.push(this.createTriWasmLibCall('i16x8_le_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_LE_U: { // Generated from expression: @i16x8_le_u
                newBody.push(this.createTriWasmLibCall('i16x8_le_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_GE_S: { // Generated from expression: @i16x8_ge_s
                newBody.push(this.createTriWasmLibCall('i16x8_ge_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_GE_U: { // Generated from expression: @i16x8_ge_u
                newBody.push(this.createTriWasmLibCall('i16x8_ge_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_EQ: { // Generated from expression: @i32x4_eq
                newBody.push(this.createTriWasmLibCall('i32x4_eq'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_NE: { // Generated from expression: @i32x4_ne
                newBody.push(this.createTriWasmLibCall('i32x4_ne'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_LT_S: { // Generated from expression: @i32x4_lt_s
                newBody.push(this.createTriWasmLibCall('i32x4_lt_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_LT_U: { // Generated from expression: @i32x4_lt_u
                newBody.push(this.createTriWasmLibCall('i32x4_lt_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_GT_S: { // Generated from expression: @i32x4_gt_s
                newBody.push(this.createTriWasmLibCall('i32x4_gt_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_GT_U: { // Generated from expression: @i32x4_gt_u
                newBody.push(this.createTriWasmLibCall('i32x4_gt_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_LE_S: { // Generated from expression: @i32x4_le_s
                newBody.push(this.createTriWasmLibCall('i32x4_le_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_LE_U: { // Generated from expression: @i32x4_le_u
                newBody.push(this.createTriWasmLibCall('i32x4_le_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_GE_S: { // Generated from expression: @i32x4_ge_s
                newBody.push(this.createTriWasmLibCall('i32x4_ge_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_GE_U: { // Generated from expression: @i32x4_ge_u
                newBody.push(this.createTriWasmLibCall('i32x4_ge_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_EQ: { // Generated from expression: @f32x4_eq
                newBody.push(this.createTriWasmLibCall('f32x4_eq'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_NE: { // Generated from expression: @f32x4_ne
                newBody.push(this.createTriWasmLibCall('f32x4_ne'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_LT: { // Generated from expression: @f32x4_lt
                newBody.push(this.createTriWasmLibCall('f32x4_lt'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_GT: { // Generated from expression: @f32x4_gt
                newBody.push(this.createTriWasmLibCall('f32x4_gt'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_LE: { // Generated from expression: @f32x4_le
                newBody.push(this.createTriWasmLibCall('f32x4_le'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_GE: { // Generated from expression: @f32x4_ge
                newBody.push(this.createTriWasmLibCall('f32x4_ge'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_EQ: { // Generated from expression: @f64x2_eq
                newBody.push(this.createTriWasmLibCall('f64x2_eq'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_NE: { // Generated from expression: @f64x2_ne
                newBody.push(this.createTriWasmLibCall('f64x2_ne'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_LT: { // Generated from expression: @f64x2_lt
                newBody.push(this.createTriWasmLibCall('f64x2_lt'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_GT: { // Generated from expression: @f64x2_gt
                newBody.push(this.createTriWasmLibCall('f64x2_gt'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_LE: { // Generated from expression: @f64x2_le
                newBody.push(this.createTriWasmLibCall('f64x2_le'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_GE: { // Generated from expression: @f64x2_ge
                newBody.push(this.createTriWasmLibCall('f64x2_ge'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_NOT: { // Generated from expression: @v128_not
                newBody.push(this.createTriWasmLibCall('v128_not'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_AND: { // Generated from expression: @v128_and
                newBody.push(this.createTriWasmLibCall('v128_and'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_ANDNOT: { // Generated from expression: @v128_andnot
                newBody.push(this.createTriWasmLibCall('v128_andnot'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_OR: { // Generated from expression: @v128_or
                newBody.push(this.createTriWasmLibCall('v128_or'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_XOR: { // Generated from expression: @v128_xor
                newBody.push(this.createTriWasmLibCall('v128_xor'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_BITSELECT: { // Generated from expression: @v128_bitselect
                newBody.push(this.createTriWasmLibCall('v128_bitselect'));
                this.popTypes(VectorType.V128, VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_ANY_TRUE: { // Generated from expression: @v128_any_true
                newBody.push(this.createTriWasmLibCall('v128_any_true'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.V128_LOAD8_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_load8_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('v128_load8_lane'));
                this.popTypes(NumberType.I32, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD16_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_load16_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('v128_load16_lane'));
                this.popTypes(NumberType.I32, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD32_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_load32_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('v128_load32_lane'));
                this.popTypes(NumberType.I32, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD64_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_load64_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('v128_load64_lane'));
                this.popTypes(NumberType.I32, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_STORE8_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_store8_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('v128_store8_lane'));
                this.popTypes(NumberType.I32, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_STORE16_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_store16_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('v128_store16_lane'));
                this.popTypes(NumberType.I32, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_STORE32_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_store32_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('v128_store32_lane'));
                this.popTypes(NumberType.I32, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_STORE64_LANE: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_store64_lane
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('v128_store64_lane'));
                this.popTypes(NumberType.I32, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD32_ZERO: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_load32_zero
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('v128_load32_zero'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.V128_LOAD64_ZERO: { // Generated from expression: i32.const value:..offset ; i32.const value:..index ; @v128_load64_zero
                newBody.push({ opcode: OP.I32_CONST, value: instr.offset });
                newBody.push({ opcode: OP.I32_CONST, value: instr.index });
                newBody.push(this.createTriWasmLibCall('v128_load64_zero'));
                this.popTypes(NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_DEMOTE_F64X2_ZERO: { // Generated from expression: @f32x4_demote_f64x2_zero
                newBody.push(this.createTriWasmLibCall('f32x4_demote_f64x2_zero'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_PROMOTE_LOW_F32X4: { // Generated from expression: @f64x2_promote_low_f32x4
                newBody.push(this.createTriWasmLibCall('f64x2_promote_low_f32x4'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_ABS: { // Generated from expression: @i8x16_abs
                newBody.push(this.createTriWasmLibCall('i8x16_abs'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_NEG: { // Generated from expression: @i8x16_neg
                newBody.push(this.createTriWasmLibCall('i8x16_neg'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_POPCNT: { // Generated from expression: @i8x16_popcnt
                newBody.push(this.createTriWasmLibCall('i8x16_popcnt'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_ALL_TRUE: { // Generated from expression: @i8x16_all_true
                newBody.push(this.createTriWasmLibCall('i8x16_all_true'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I8X16_BITMASK: { // Generated from expression: @i8x16_bitmask
                newBody.push(this.createTriWasmLibCall('i8x16_bitmask'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I8X16_NARROW_I16X8_S: { // Generated from expression: @i8x16_narrow_i16x8_s
                newBody.push(this.createTriWasmLibCall('i8x16_narrow_i16x8_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_NARROW_I16X8_U: { // Generated from expression: @i8x16_narrow_i16x8_u
                newBody.push(this.createTriWasmLibCall('i8x16_narrow_i16x8_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_CEIL: { // Generated from expression: @f32x4_ceil
                newBody.push(this.createTriWasmLibCall('f32x4_ceil'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_FLOOR: { // Generated from expression: @f32x4_floor
                newBody.push(this.createTriWasmLibCall('f32x4_floor'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_TRUNC: { // Generated from expression: @f32x4_trunc
                newBody.push(this.createTriWasmLibCall('f32x4_trunc'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_NEAREST: { // Generated from expression: @f32x4_nearest
                newBody.push(this.createTriWasmLibCall('f32x4_nearest'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_SHL: { // Generated from expression: @i8x16_shl
                newBody.push(this.createTriWasmLibCall('i8x16_shl'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_SHR_S: { // Generated from expression: @i8x16_shr_s
                newBody.push(this.createTriWasmLibCall('i8x16_shr_s'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_SHR_U: { // Generated from expression: @i8x16_shr_u
                newBody.push(this.createTriWasmLibCall('i8x16_shr_u'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_ADD: { // Generated from expression: @i8x16_add
                newBody.push(this.createTriWasmLibCall('i8x16_add'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_ADD_SAT_S: { // Generated from expression: @i8x16_add_sat_s
                newBody.push(this.createTriWasmLibCall('i8x16_add_sat_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_ADD_SAT_U: { // Generated from expression: @i8x16_add_sat_u
                newBody.push(this.createTriWasmLibCall('i8x16_add_sat_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_SUB: { // Generated from expression: @i8x16_sub
                newBody.push(this.createTriWasmLibCall('i8x16_sub'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_SUB_SAT_S: { // Generated from expression: @i8x16_sub_sat_s
                newBody.push(this.createTriWasmLibCall('i8x16_sub_sat_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_SUB_SAT_U: { // Generated from expression: @i8x16_sub_sat_u
                newBody.push(this.createTriWasmLibCall('i8x16_sub_sat_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_CEIL: { // Generated from expression: @f64x2_ceil
                newBody.push(this.createTriWasmLibCall('f64x2_ceil'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_FLOOR: { // Generated from expression: @f64x2_floor
                newBody.push(this.createTriWasmLibCall('f64x2_floor'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_MIN_S: { // Generated from expression: @i8x16_min_s
                newBody.push(this.createTriWasmLibCall('i8x16_min_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_MIN_U: { // Generated from expression: @i8x16_min_u
                newBody.push(this.createTriWasmLibCall('i8x16_min_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_MAX_S: { // Generated from expression: @i8x16_max_s
                newBody.push(this.createTriWasmLibCall('i8x16_max_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_MAX_U: { // Generated from expression: @i8x16_max_u
                newBody.push(this.createTriWasmLibCall('i8x16_max_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_TRUNC: { // Generated from expression: @f64x2_trunc
                newBody.push(this.createTriWasmLibCall('f64x2_trunc'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I8X16_AVGR_U: { // Generated from expression: @i8x16_avgr_u
                newBody.push(this.createTriWasmLibCall('i8x16_avgr_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTADD_PAIRWISE_I8X16_S: { // Generated from expression: @i16x8_extadd_pairwise_i8x16_s
                newBody.push(this.createTriWasmLibCall('i16x8_extadd_pairwise_i8x16_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTADD_PAIRWISE_I8X16_U: { // Generated from expression: @i16x8_extadd_pairwise_i8x16_u
                newBody.push(this.createTriWasmLibCall('i16x8_extadd_pairwise_i8x16_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTADD_PAIRWISE_I16X8_S: { // Generated from expression: @i32x4_extadd_pairwise_i16x8_s
                newBody.push(this.createTriWasmLibCall('i32x4_extadd_pairwise_i16x8_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTADD_PAIRWISE_I16X8_U: { // Generated from expression: @i32x4_extadd_pairwise_i16x8_u
                newBody.push(this.createTriWasmLibCall('i32x4_extadd_pairwise_i16x8_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_ABS: { // Generated from expression: @i16x8_abs
                newBody.push(this.createTriWasmLibCall('i16x8_abs'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_NEG: { // Generated from expression: @i16x8_neg
                newBody.push(this.createTriWasmLibCall('i16x8_neg'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_Q15MULR_SAT_S: { // Generated from expression: @i16x8_q15mulr_sat_s
                newBody.push(this.createTriWasmLibCall('i16x8_q15mulr_sat_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_ALL_TRUE: { // Generated from expression: @i16x8_all_true
                newBody.push(this.createTriWasmLibCall('i16x8_all_true'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I16X8_BITMASK: { // Generated from expression: @i16x8_bitmask
                newBody.push(this.createTriWasmLibCall('i16x8_bitmask'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I16X8_NARROW_I32X4_S: { // Generated from expression: @i16x8_narrow_i32x4_s
                newBody.push(this.createTriWasmLibCall('i16x8_narrow_i32x4_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_NARROW_I32X4_U: { // Generated from expression: @i16x8_narrow_i32x4_u
                newBody.push(this.createTriWasmLibCall('i16x8_narrow_i32x4_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTEND_LOW_I8X16_S: { // Generated from expression: @i16x8_extend_low_i8x16_s
                newBody.push(this.createTriWasmLibCall('i16x8_extend_low_i8x16_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTEND_HIGH_I8X16_S: { // Generated from expression: @i16x8_extend_high_i8x16_s
                newBody.push(this.createTriWasmLibCall('i16x8_extend_high_i8x16_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTEND_LOW_I8X16_U: { // Generated from expression: @i16x8_extend_low_i8x16_u
                newBody.push(this.createTriWasmLibCall('i16x8_extend_low_i8x16_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTEND_HIGH_I8X16_U: { // Generated from expression: @i16x8_extend_high_i8x16_u
                newBody.push(this.createTriWasmLibCall('i16x8_extend_high_i8x16_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_SHL: { // Generated from expression: @i16x8_shl
                newBody.push(this.createTriWasmLibCall('i16x8_shl'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_SHR_S: { // Generated from expression: @i16x8_shr_s
                newBody.push(this.createTriWasmLibCall('i16x8_shr_s'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_SHR_U: { // Generated from expression: @i16x8_shr_u
                newBody.push(this.createTriWasmLibCall('i16x8_shr_u'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_ADD: { // Generated from expression: @i16x8_add
                newBody.push(this.createTriWasmLibCall('i16x8_add'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_ADD_SAT_S: { // Generated from expression: @i16x8_add_sat_s
                newBody.push(this.createTriWasmLibCall('i16x8_add_sat_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_ADD_SAT_U: { // Generated from expression: @i16x8_add_sat_u
                newBody.push(this.createTriWasmLibCall('i16x8_add_sat_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_SUB: { // Generated from expression: @i16x8_sub
                newBody.push(this.createTriWasmLibCall('i16x8_sub'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_SUB_SAT_S: { // Generated from expression: @i16x8_sub_sat_s
                newBody.push(this.createTriWasmLibCall('i16x8_sub_sat_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_SUB_SAT_U: { // Generated from expression: @i16x8_sub_sat_u
                newBody.push(this.createTriWasmLibCall('i16x8_sub_sat_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_NEAREST: { // Generated from expression: @f64x2_nearest
                newBody.push(this.createTriWasmLibCall('f64x2_nearest'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_MUL: { // Generated from expression: @i16x8_mul
                newBody.push(this.createTriWasmLibCall('i16x8_mul'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_MIN_S: { // Generated from expression: @i16x8_min_s
                newBody.push(this.createTriWasmLibCall('i16x8_min_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_MIN_U: { // Generated from expression: @i16x8_min_u
                newBody.push(this.createTriWasmLibCall('i16x8_min_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_MAX_S: { // Generated from expression: @i16x8_max_s
                newBody.push(this.createTriWasmLibCall('i16x8_max_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_MAX_U: { // Generated from expression: @i16x8_max_u
                newBody.push(this.createTriWasmLibCall('i16x8_max_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_AVGR_U: { // Generated from expression: @i16x8_avgr_u
                newBody.push(this.createTriWasmLibCall('i16x8_avgr_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTMUL_LOW_I8X16_S: { // Generated from expression: @i16x8_extmul_low_i8x16_s
                newBody.push(this.createTriWasmLibCall('i16x8_extmul_low_i8x16_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTMUL_HIGH_I8X16_S: { // Generated from expression: @i16x8_extmul_high_i8x16_s
                newBody.push(this.createTriWasmLibCall('i16x8_extmul_high_i8x16_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTMUL_LOW_I8X16_U: { // Generated from expression: @i16x8_extmul_low_i8x16_u
                newBody.push(this.createTriWasmLibCall('i16x8_extmul_low_i8x16_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTMUL_HIGH_I8X16_U: { // Generated from expression: @i16x8_extmul_high_i8x16_u
                newBody.push(this.createTriWasmLibCall('i16x8_extmul_high_i8x16_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_ABS: { // Generated from expression: @i32x4_abs
                newBody.push(this.createTriWasmLibCall('i32x4_abs'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_NEG: { // Generated from expression: @i32x4_neg
                newBody.push(this.createTriWasmLibCall('i32x4_neg'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_ALL_TRUE: { // Generated from expression: @i32x4_all_true
                newBody.push(this.createTriWasmLibCall('i32x4_all_true'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32X4_BITMASK: { // Generated from expression: @i32x4_bitmask
                newBody.push(this.createTriWasmLibCall('i32x4_bitmask'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32X4_EXTEND_LOW_I16X8_S: { // Generated from expression: @i32x4_extend_low_i16x8_s
                newBody.push(this.createTriWasmLibCall('i32x4_extend_low_i16x8_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTEND_HIGH_I16X8_S: { // Generated from expression: @i32x4_extend_high_i16x8_s
                newBody.push(this.createTriWasmLibCall('i32x4_extend_high_i16x8_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTEND_LOW_I16X8_U: { // Generated from expression: @i32x4_extend_low_i16x8_u
                newBody.push(this.createTriWasmLibCall('i32x4_extend_low_i16x8_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTEND_HIGH_I16X8_U: { // Generated from expression: @i32x4_extend_high_i16x8_u
                newBody.push(this.createTriWasmLibCall('i32x4_extend_high_i16x8_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_SHL: { // Generated from expression: @i32x4_shl
                newBody.push(this.createTriWasmLibCall('i32x4_shl'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_SHR_S: { // Generated from expression: @i32x4_shr_s
                newBody.push(this.createTriWasmLibCall('i32x4_shr_s'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_SHR_U: { // Generated from expression: @i32x4_shr_u
                newBody.push(this.createTriWasmLibCall('i32x4_shr_u'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_ADD: { // Generated from expression: @i32x4_add
                newBody.push(this.createTriWasmLibCall('i32x4_add'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_SUB: { // Generated from expression: @i32x4_sub
                newBody.push(this.createTriWasmLibCall('i32x4_sub'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_MUL: { // Generated from expression: @i32x4_mul
                newBody.push(this.createTriWasmLibCall('i32x4_mul'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_MIN_S: { // Generated from expression: @i32x4_min_s
                newBody.push(this.createTriWasmLibCall('i32x4_min_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_MIN_U: { // Generated from expression: @i32x4_min_u
                newBody.push(this.createTriWasmLibCall('i32x4_min_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_MAX_S: { // Generated from expression: @i32x4_max_s
                newBody.push(this.createTriWasmLibCall('i32x4_max_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_MAX_U: { // Generated from expression: @i32x4_max_u
                newBody.push(this.createTriWasmLibCall('i32x4_max_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_DOT_I16X8_S: { // Generated from expression: @i32x4_dot_i16x8_s
                newBody.push(this.createTriWasmLibCall('i32x4_dot_i16x8_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTMUL_LOW_I16X8_S: { // Generated from expression: @i32x4_extmul_low_i16x8_s
                newBody.push(this.createTriWasmLibCall('i32x4_extmul_low_i16x8_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTMUL_HIGH_I16X8_S: { // Generated from expression: @i32x4_extmul_high_i16x8_s
                newBody.push(this.createTriWasmLibCall('i32x4_extmul_high_i16x8_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTMUL_LOW_I16X8_U: { // Generated from expression: @i32x4_extmul_low_i16x8_u
                newBody.push(this.createTriWasmLibCall('i32x4_extmul_low_i16x8_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTMUL_HIGH_I16X8_U: { // Generated from expression: @i32x4_extmul_high_i16x8_u
                newBody.push(this.createTriWasmLibCall('i32x4_extmul_high_i16x8_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_ABS: { // Generated from expression: @i64x2_abs
                newBody.push(this.createTriWasmLibCall('i64x2_abs'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_NEG: { // Generated from expression: @i64x2_neg
                newBody.push(this.createTriWasmLibCall('i64x2_neg'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_ALL_TRUE: { // Generated from expression: @i64x2_all_true
                newBody.push(this.createTriWasmLibCall('i64x2_all_true'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I64X2_BITMASK: { // Generated from expression: @i64x2_bitmask
                newBody.push(this.createTriWasmLibCall('i64x2_bitmask'));
                this.popTypes(VectorType.V128);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I64X2_EXTEND_LOW_I32X4_S: { // Generated from expression: @i64x2_extend_low_i32x4_s
                newBody.push(this.createTriWasmLibCall('i64x2_extend_low_i32x4_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTEND_HIGH_I32X4_S: { // Generated from expression: @i64x2_extend_high_i32x4_s
                newBody.push(this.createTriWasmLibCall('i64x2_extend_high_i32x4_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTEND_LOW_I32X4_U: { // Generated from expression: @i64x2_extend_low_i32x4_u
                newBody.push(this.createTriWasmLibCall('i64x2_extend_low_i32x4_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTEND_HIGH_I32X4_U: { // Generated from expression: @i64x2_extend_high_i32x4_u
                newBody.push(this.createTriWasmLibCall('i64x2_extend_high_i32x4_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_SHL: { // Generated from expression: @i64x2_shl
                newBody.push(this.createTriWasmLibCall('i64x2_shl'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_SHR_S: { // Generated from expression: @i64x2_shr_s
                newBody.push(this.createTriWasmLibCall('i64x2_shr_s'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_SHR_U: { // Generated from expression: @i64x2_shr_u
                newBody.push(this.createTriWasmLibCall('i64x2_shr_u'));
                this.popTypes(VectorType.V128, NumberType.I32);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_ADD: { // Generated from expression: @i64x2_add
                newBody.push(this.createTriWasmLibCall('i64x2_add'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_SUB: { // Generated from expression: @i64x2_sub
                newBody.push(this.createTriWasmLibCall('i64x2_sub'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_MUL: { // Generated from expression: @i64x2_mul
                newBody.push(this.createTriWasmLibCall('i64x2_mul'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_EQ: { // Generated from expression: @i64x2_eq
                newBody.push(this.createTriWasmLibCall('i64x2_eq'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_NE: { // Generated from expression: @i64x2_ne
                newBody.push(this.createTriWasmLibCall('i64x2_ne'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_LT_S: { // Generated from expression: @i64x2_lt_s
                newBody.push(this.createTriWasmLibCall('i64x2_lt_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_GT_S: { // Generated from expression: @i64x2_gt_s
                newBody.push(this.createTriWasmLibCall('i64x2_gt_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_LE_S: { // Generated from expression: @i64x2_le_s
                newBody.push(this.createTriWasmLibCall('i64x2_le_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_GE_S: { // Generated from expression: @i64x2_ge_s
                newBody.push(this.createTriWasmLibCall('i64x2_ge_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTMUL_LOW_I32X4_S: { // Generated from expression: @i64x2_extmul_low_i32x4_s
                newBody.push(this.createTriWasmLibCall('i64x2_extmul_low_i32x4_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTMUL_HIGH_I32X4_S: { // Generated from expression: @i64x2_extmul_high_i32x4_s
                newBody.push(this.createTriWasmLibCall('i64x2_extmul_high_i32x4_s'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTMUL_LOW_I32X4_U: { // Generated from expression: @i64x2_extmul_low_i32x4_u
                newBody.push(this.createTriWasmLibCall('i64x2_extmul_low_i32x4_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTMUL_HIGH_I32X4_U: { // Generated from expression: @i64x2_extmul_high_i32x4_u
                newBody.push(this.createTriWasmLibCall('i64x2_extmul_high_i32x4_u'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_ABS: { // Generated from expression: @f32x4_abs
                newBody.push(this.createTriWasmLibCall('f32x4_abs'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_NEG: { // Generated from expression: @f32x4_neg
                newBody.push(this.createTriWasmLibCall('f32x4_neg'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_SQRT: { // Generated from expression: @f32x4_sqrt
                newBody.push(this.createTriWasmLibCall('f32x4_sqrt'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_ADD: { // Generated from expression: @f32x4_add
                newBody.push(this.createTriWasmLibCall('f32x4_add'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_SUB: { // Generated from expression: @f32x4_sub
                newBody.push(this.createTriWasmLibCall('f32x4_sub'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_MUL: { // Generated from expression: @f32x4_mul
                newBody.push(this.createTriWasmLibCall('f32x4_mul'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_DIV: { // Generated from expression: @f32x4_div
                newBody.push(this.createTriWasmLibCall('f32x4_div'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_MIN: { // Generated from expression: @f32x4_min
                newBody.push(this.createTriWasmLibCall('f32x4_min'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_MAX: { // Generated from expression: @f32x4_max
                newBody.push(this.createTriWasmLibCall('f32x4_max'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_PMIN: { // Generated from expression: @f32x4_pmin
                newBody.push(this.createTriWasmLibCall('f32x4_pmin'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_PMAX: { // Generated from expression: @f32x4_pmax
                newBody.push(this.createTriWasmLibCall('f32x4_pmax'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_ABS: { // Generated from expression: @f64x2_abs
                newBody.push(this.createTriWasmLibCall('f64x2_abs'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_NEG: { // Generated from expression: @f64x2_neg
                newBody.push(this.createTriWasmLibCall('f64x2_neg'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_SQRT: { // Generated from expression: @f64x2_sqrt
                newBody.push(this.createTriWasmLibCall('f64x2_sqrt'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_ADD: { // Generated from expression: @f64x2_add
                newBody.push(this.createTriWasmLibCall('f64x2_add'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_SUB: { // Generated from expression: @f64x2_sub
                newBody.push(this.createTriWasmLibCall('f64x2_sub'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_MUL: { // Generated from expression: @f64x2_mul
                newBody.push(this.createTriWasmLibCall('f64x2_mul'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_DIV: { // Generated from expression: @f64x2_div
                newBody.push(this.createTriWasmLibCall('f64x2_div'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_MIN: { // Generated from expression: @f64x2_min
                newBody.push(this.createTriWasmLibCall('f64x2_min'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_MAX: { // Generated from expression: @f64x2_max
                newBody.push(this.createTriWasmLibCall('f64x2_max'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_PMIN: { // Generated from expression: @f64x2_pmin
                newBody.push(this.createTriWasmLibCall('f64x2_pmin'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_PMAX: { // Generated from expression: @f64x2_pmax
                newBody.push(this.createTriWasmLibCall('f64x2_pmax'));
                this.popTypes(VectorType.V128, VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_TRUNC_SAT_F32X4_S: { // Generated from expression: @i32x4_trunc_sat_f32x4_s
                newBody.push(this.createTriWasmLibCall('i32x4_trunc_sat_f32x4_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_TRUNC_SAT_F32X4_U: { // Generated from expression: @i32x4_trunc_sat_f32x4_u
                newBody.push(this.createTriWasmLibCall('i32x4_trunc_sat_f32x4_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_CONVERT_I32X4_S: { // Generated from expression: @f32x4_convert_i32x4_s
                newBody.push(this.createTriWasmLibCall('f32x4_convert_i32x4_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F32X4_CONVERT_I32X4_U: { // Generated from expression: @f32x4_convert_i32x4_u
                newBody.push(this.createTriWasmLibCall('f32x4_convert_i32x4_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_TRUNC_SAT_F64X2_S_ZERO: { // Generated from expression: @i32x4_trunc_sat_f64x2_s_zero
                newBody.push(this.createTriWasmLibCall('i32x4_trunc_sat_f64x2_s_zero'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.I32X4_TRUNC_SAT_F64X2_U_ZERO: { // Generated from expression: @i32x4_trunc_sat_f64x2_u_zero
                newBody.push(this.createTriWasmLibCall('i32x4_trunc_sat_f64x2_u_zero'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_CONVERT_LOW_I32X4_S: { // Generated from expression: @f64x2_convert_low_i32x4_s
                newBody.push(this.createTriWasmLibCall('f64x2_convert_low_i32x4_s'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
                break;
            }
            case OP.F64X2_CONVERT_LOW_I32X4_U: { // Generated from expression: @f64x2_convert_low_i32x4_u
                newBody.push(this.createTriWasmLibCall('f64x2_convert_low_i32x4_u'));
                this.popTypes(VectorType.V128);
                this.pushTypes(VectorType.V128);
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
                this.popTypes(NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }
            case OP.I32_STORE:
            case OP.I32_STORE8:
            case OP.I32_STORE16: {
                newBody.push(instr);
                this.popTypes(NumberType.I32, NumberType.I32);
                break;
            }
            case OP.I32_CONST: {
                newBody.push(instr);
                this.pushTypes(NumberType.I32);
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
                this.popTypes(NumberType.I32, NumberType.I32);
                this.pushTypes(NumberType.I32);
                break;
            }

            // -- End of source code generated with help of "gen-instr.ts" script --
        }
        return unreachable;
    }
}
