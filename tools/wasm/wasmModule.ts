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


// types.html#binary-numtype
export enum NumberType {
    I32 = 0x7F,
    I64 = 0x7E,
    F32 = 0x7D,
    F64 = 0x7C,
};

// types.html#vector-types
export enum VectorType {
    V128 = 0x7B,
};

// types.html#reference-types
export enum RefType {
    FUNCREF = 0x70,
    EXTERNREF = 0x6F,
};

// types.html#value-types
export type ValueType = NumberType | VectorType | RefType;
export const ValueTypeObject = { ...NumberType, ...VectorType, ...RefType };

export function valueTypeWords(type: ValueType) : 1 | 2 | 4 {
    switch (type) {
        case NumberType.I32:
        case NumberType.F32:
        case RefType.FUNCREF:
        case RefType.EXTERNREF:
            return 1;
        case NumberType.I64:
        case NumberType.F64:
            return 2;
        case VectorType.V128:
            return 4;
        default:
            throw new Error('Invalid value type.');
    }
}

// types.html#function-types

export interface FunctionType {
    params: ValueType[];
    results: ValueType[];
};

export enum WasmFunctionKind {
    WASM,            ///< [WasmFunctionData] Normal WASM function with body
    WASM_TYPE_UNKNOWN,//< Normal WASM function with body, but the result is unknown and must be determined using the code.
    ANNOTATION,      ///< [String$$]         Annotation magic function, does not generate a bytecode, call replaced by ".annotation" during triasm generation
    IMPORT,          ///< [null]             Import function, will be replaced by FUNCTION_HOST or FUNCTION_LINK during references resolving
    HOST,            ///< [u32$]             Host function referenced by index
    ASSEMBLY,        ///< [String$$]         Function with triasm body
    INLINE_ASSEMBLY, ///< [String$$]         Function with triasm body that will be inlined always
    LINK,            ///< [WasmFunction]     A link to actual function
    UNUSED,          ///< [null]             Function created as a placeholder, cannot be called, will not be generated
};

export interface WasmImport {
    module: string;
    name: string;
};

export interface WasmExport {
    module: string;
    name: string;
}

// types.html#binary-globaltype
export enum GlobalKind {
    CONST = 0x00,
    MUTABLE = 0x01,
};

// types.html#binary-limits
export interface Limits {
    min: number;
    max: number;
};

export type WasmInstrBrOP = OP.BR | OP.BR_IF;
export interface WasmInstrBr {
    opcode: WasmInstrBrOP;
    target: WasmBlock;
};

export type WasmInstrIndexedOP = OP.LOCAL_GET | OP.LOCAL_SET | OP.LOCAL_TEE | OP.I8X16_EXTRACT_LANE_S | OP.I8X16_EXTRACT_LANE_U | OP.I8X16_REPLACE_LANE | OP.I16X8_EXTRACT_LANE_S | OP.I16X8_EXTRACT_LANE_U | OP.I16X8_REPLACE_LANE | OP.I32X4_EXTRACT_LANE | OP.I32X4_REPLACE_LANE | OP.I64X2_EXTRACT_LANE | OP.I64X2_REPLACE_LANE | OP.F32X4_EXTRACT_LANE | OP.F32X4_REPLACE_LANE | OP.F64X2_EXTRACT_LANE | OP.F64X2_REPLACE_LANE;
export interface WasmInstrIndexed {
    opcode: WasmInstrIndexedOP;
    index: number;
};

export type WasmInstrWithBlockOP = OP.IF | OP.BLOCK | OP.LOOP | OP.TRIVM_FUNCTION;
export interface WasmInstrWithBlock {
    opcode: WasmInstrWithBlockOP;
    block: WasmBlock;
}

export type WasmInstrConst32OP = OP.I32_CONST | OP.F32_CONST | OP.TRIVM_POP;
export interface WasmInstrConst32 {
    opcode: WasmInstrConst32OP;
    value: number;
};

export type WasmInstrConst64OP = OP.I64_CONST | OP.F64_CONST;
export interface WasmInstrConst64 {
    opcode: WasmInstrConst64OP;
    value: bigint;
};

export type WasmInstrBrTableOP = OP.BR_TABLE;
export interface WasmInstrBrTable {
    opcode: WasmInstrBrTableOP;
    targets: WasmBlock[];
};

export type WasmInstrRefOP = OP.REF_NULL;
export interface WasmInstrRef {
    opcode: WasmInstrRefOP;
    type: RefType;
};

export type WasmInstrCallIndirectOP = OP.CALL_INDIRECT;
export interface WasmInstrCallIndirect {
    opcode: WasmInstrCallIndirectOP;
    type: FunctionType;
    table: WasmTable;
};

export type WasmInstrFuncOP = OP.CALL | OP.REF_FUNC;
export interface WasmInstrFunc {
    opcode: WasmInstrFuncOP;
    func: WasmFunction;
};

export type WasmInstrGlobalOP = OP.GLOBAL_GET | OP.GLOBAL_SET;
export interface WasmInstrGlobal {
    opcode: WasmInstrGlobalOP;
    global: WasmGlobal;
};

export type WasmInstrValueV128OP = OP.V128_CONST | OP.I8X16_SHUFFLE;
export interface WasmInstrValueV128 {
    opcode: WasmInstrValueV128OP;
    value: Uint8Array;
};

export type WasmInstrTableOP = OP.TABLE_GET | OP.TABLE_SET | OP.TABLE_GROW | OP.TABLE_SIZE | OP.TABLE_FILL;
export interface WasmInstrTable {
    opcode: WasmInstrTableOP;
    table: WasmTable;
};

export type WasmInstrMemArgOP = OP.I32_LOAD | OP.I64_LOAD | OP.F32_LOAD | OP.F64_LOAD | OP.I32_LOAD8_S | OP.I32_LOAD8_U | OP.I32_LOAD16_S | OP.I32_LOAD16_U | OP.I64_LOAD8_S | OP.I64_LOAD8_U | OP.I64_LOAD16_S | OP.I64_LOAD16_U | OP.I64_LOAD32_S | OP.I64_LOAD32_U | OP.I32_STORE | OP.I64_STORE | OP.F32_STORE | OP.F64_STORE | OP.I32_STORE8 | OP.I32_STORE16 | OP.I64_STORE8 | OP.I64_STORE16 | OP.I64_STORE32 | OP.V128_LOAD | OP.V128_LOAD8X8_S | OP.V128_LOAD8X8_U | OP.V128_LOAD16X4_S | OP.V128_LOAD16X4_U | OP.V128_LOAD32X2_S | OP.V128_LOAD32X2_U | OP.V128_LOAD8_SPLAT | OP.V128_LOAD16_SPLAT | OP.V128_LOAD32_SPLAT | OP.V128_LOAD64_SPLAT | OP.V128_STORE;
export interface WasmInstrMemArg {
    opcode: WasmInstrMemArgOP;
    offset: number;
    memory: WasmMemory;
};

export type WasmInstrMemArgWithIndexOP = OP.V128_LOAD8_LANE | OP.V128_STORE8_LANE | OP.V128_LOAD16_LANE | OP.V128_STORE16_LANE | OP.V128_LOAD32_LANE | OP.V128_STORE32_LANE | OP.V128_LOAD32_ZERO | OP.V128_LOAD64_LANE | OP.V128_STORE64_LANE | OP.V128_LOAD64_ZERO;
export interface WasmInstrMemArgWithIndex {
    opcode: WasmInstrMemArgWithIndexOP;
    offset: number;
    memory: WasmMemory;
    index: number;
};

export type WasmInstrMemOP = OP.MEMORY_SIZE | OP.MEMORY_GROW | OP.MEMORY_FILL;
export interface WasmInstrMem {
    opcode: WasmInstrMemOP;
    memory: WasmMemory;
};

export type WasmInstrMemInitOP = OP.MEMORY_INIT;
export interface WasmInstrMemInit {
    opcode: WasmInstrMemInitOP;
    data: WasmData;
    memory: WasmMemory;
};

export type WasmInstrDataDropOP = OP.DATA_DROP;
export interface WasmInstrDataDrop {
    opcode: WasmInstrDataDropOP;
    data: WasmData;
};

export type WasmInstrMemCopyOP = OP.MEMORY_COPY;
export interface WasmInstrMemCopy {
    opcode: WasmInstrMemCopyOP;
    memories: [WasmMemory, WasmMemory];
};

export type WasmInstrTableCopyOP = OP.TABLE_COPY;
export interface WasmInstrTableCopy {
    opcode: WasmInstrTableCopyOP;
    tables: [WasmTable, WasmTable];
};

export type WasmInstrElemDropOP = OP.ELEM_DROP;
export interface WasmInstrElemDrop {
    opcode: WasmInstrElemDropOP;
    element: WasmElement;
};

export type WasmInstrTableInitOP = OP.TABLE_INIT;
export interface WasmInstrTableInit {
    opcode: WasmInstrTableInitOP;
    element: WasmElement;
    table: WasmTable;
};

export type WasmInstrNoArgsOP = Exclude<OP, WasmInstrBrOP | WasmInstrIndexedOP | WasmInstrWithBlockOP | WasmInstrConst32OP | WasmInstrConst64OP | WasmInstrBrTableOP | WasmInstrRefOP | WasmInstrCallIndirectOP | WasmInstrFuncOP | WasmInstrGlobalOP | WasmInstrTableOP | WasmInstrValueV128OP | WasmInstrMemArgOP | WasmInstrMemOP | WasmInstrMemInitOP | WasmInstrDataDropOP | WasmInstrMemCopyOP | WasmInstrMemArgWithIndexOP | WasmInstrElemDropOP | WasmInstrTableInitOP | WasmInstrTableCopyOP>;
export interface WasmInstrNoArgs {
    opcode: WasmInstrNoArgsOP;
};

export type WasmInstr = WasmInstrNoArgs | WasmInstrBr | WasmInstrIndexed | WasmInstrWithBlock | WasmInstrConst32 | WasmInstrConst64 | WasmInstrBrTable | WasmInstrRef | WasmInstrCallIndirect | WasmInstrFunc | WasmInstrGlobal | WasmInstrTable | WasmInstrValueV128 | WasmInstrMemArg | WasmInstrMem | WasmInstrMemInit | WasmInstrDataDrop | WasmInstrMemCopy | WasmInstrMemArgWithIndex | WasmInstrElemDrop | WasmInstrTableInit | WasmInstrTableCopy;

export class WasmBlock {
    public body: WasmInstr[] = [];
    constructor(
        public type: FunctionType,
        public parentInstruction: WasmInstr,
        public parentBlock?: WasmBlock
    ) {
    }
}

export enum ElementKind {
    ACTIVE,
    PASSIVE,
    DECLARATIVE,
};

export class WasmElement {
    public deleted = false;
    kind: ElementKind = ElementKind.ACTIVE;
    table?: WasmTable;
    offset?: WasmFunction;
    items: WasmFunction[] = [];
};

export enum DataKind {
    ACTIVE,
    PASSIVE,
};

export class WasmData {
    public deleted = false;
    public kind: DataKind = DataKind.ACTIVE;
    public content: Uint8Array = allowTemporaryNull as Uint8Array; // will be filled during data section parsing
    public memory?: WasmMemory;
    public offset?: WasmFunction;
};

export class WasmEntity {
    public index: number = 0;
    public import?: WasmImport;
    public exports: WasmExport[] = [];
}

export class WasmFunction extends WasmEntity {
    public resolved: WasmFunction;
    public data?: string;
    public locals: ValueType[] = [];
    public block?: WasmBlock;
    constructor(
        public kind: WasmFunctionKind,
        public type: FunctionType
    ) {
        super();
        this.resolved = this;
    }
}

export class WasmMemory extends WasmEntity {
    public deleted = false;
    constructor(
        public limits: Limits
    ) {
        super();
    }
}

export class WasmTable extends WasmEntity {
    public deleted = false;
    constructor(
        public type: RefType,
        public limits: Limits
    ) {
        super();
    }
}

export class WasmGlobal extends WasmEntity {
    public deleted = false;
    public kind: GlobalKind = GlobalKind.MUTABLE;
    public type: ValueType = NumberType.I32;
    public expr?: WasmFunction;
}

export class WasmModule {
    public functions: WasmFunction[] = [];
    public memories: WasmMemory[] = [];
    public tables: WasmTable[] = [];
    public globals: WasmGlobal[] = [];
    public elements: WasmElement[] = [];
    public data: WasmData[] = [];
    public stackPointerDetector?: WasmFunction;
    public startFunction?: WasmFunction;
    public exported: Map<string, Map<string, WasmFunction>> = new Map();

    public getExported(module: string, name: string, required: true): WasmFunction;
    public getExported(module: string, name: string, required: false): WasmFunction | undefined;

    public getExported(module: string, name: string, required: boolean = true): WasmFunction | undefined {
            let func = this.exported.get(module)?.get(module);
        if (required && func === undefined) {
            throw new Error(`Requested function '${name}' from module '${module}' not found.`);
        }
        return func?.resolved;
    }
}
