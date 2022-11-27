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

// types.html#function-types
export interface FunctionType {
    params: ValueType[];
    results: ValueType[];
};

export enum WasmFunctionKind {
    WASM,            ///< [WasmFunctionData] Normal WASM function with body
    ANNOTATION,      ///< [String$$]         Annotation magic function, does not generate a bytecode, call replaced by ".annotation" during triasm generation
    IMPORT,          ///< [null]             Import function, will be replaced by FUNCTION_HOST_* or FUNCTION_LINK during references resolving
    HOST_BY_INDEX,   ///< [u32$]             Host function referenced by index
    HOST_BY_NAME,    ///< [String$$]         Host function referenced by name, trivm runtime startup will resolve its index
    ASSEMBLY,        ///< [String$$]         Function with triasm body
    INLINE_ASSEMBLY, ///< [String$$]         Function with triasm body that will be inlined always
    LINK,            ///< [WasmFunction]     A link to actual function
    UNUSED,          ///< [null]             Function created as a placeholder, cannot be called, will not be generated
};

export interface WasmImport {
    module: string;
    name: string;
};

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
    target: number;
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

export type WasmInstrConst32OP = OP.I32_CONST | OP.F32_CONST;
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
    targets: number[];
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

export type WasmInstrTableOP = OP.TABLE_GET | OP.TABLE_SET | OP.TABLE_GROW | OP.TABLE_SIZE | OP.TABLE_FILL;
export interface WasmInstrTable {
    opcode: WasmInstrTableOP;
    table: WasmTable;
};

export type WasmInstrNoArgsOP = Exclude<OP, WasmInstrBrOP | WasmInstrIndexedOP | WasmInstrWithBlockOP | WasmInstrConst32OP | WasmInstrConst64OP | WasmInstrBrTableOP | WasmInstrRefOP | WasmInstrCallIndirectOP | WasmInstrFuncOP | WasmInstrGlobalOP | WasmInstrTableOP>;
export interface WasmInstrNoArgs {
    opcode: WasmInstrNoArgsOP;
};

export type WasmInstr = WasmInstrNoArgs | WasmInstrBr | WasmInstrIndexed | WasmInstrWithBlock | WasmInstrConst32 | WasmInstrConst64 | WasmInstrBrTable | WasmInstrRef | WasmInstrCallIndirect | WasmInstrFunc | WasmInstrGlobal | WasmInstrTable;

export class WasmBlock {
    public body: WasmInstr[] = [];
    constructor(
        public type: FunctionType,
        public parentInstruction: WasmInstr,
        public parentBlock?: WasmBlock
    ) {
    }
}

export interface ConstExpressionI32Literal {
    type: NumberType.I32;
    value: number;
};

export interface ConstExpressionI64Literal {
    type: NumberType.I64;
    value: bigint;
};

export interface ConstExpressionF32Literal {
    type: NumberType.F32;
    value: number;
};

export interface ConstExpressionF64Literal {
    type: NumberType.F64;
    value: number;
};

export interface ConstExpressionV128Literal {
    type: VectorType.V128;
    value: Uint8Array;
};

export interface ConstExpressionFuncRefLiteral {
    type: RefType.FUNCREF;
    index: number;
};

export interface ConstExpressionExpr {
    type: undefined;
    expr: WasmInstr[];
};

export type ConstExpression = ConstExpressionI32Literal | ConstExpressionI64Literal | ConstExpressionF32Literal | ConstExpressionF64Literal | ConstExpressionV128Literal | ConstExpressionFuncRefLiteral | ConstExpressionExpr;

export enum ElementKind {
    ACTIVE,
    PASSIVE,
    DECLARATIVE,
};

export class WasmElement {
    index: number = 0;
    kind: ElementKind = ElementKind.ACTIVE;
    table?: WasmTable;
    offset?: ConstExpression;
    items: ConstExpression[] = [];
};

export enum DataKind {
    ACTIVE,
    PASSIVE,
};

export class WasmData {
    public index: number = 0;
    public kind: DataKind;
    constructor(
        public content: Uint8Array,
        public memory?: WasmMemory,
        public offset?: ConstExpression
    ) {
        this.kind = memory ? DataKind.ACTIVE : DataKind.PASSIVE;
    }
};

export class WasmEntity {
    public index: number = 0;
    public import?: WasmImport;
    public exports: string[] = [];
}

export class WasmFunction extends WasmEntity {
    public data?: string;
    public locals: ValueType[] = [];
    public block?: WasmBlock;
    constructor(
        public kind: WasmFunctionKind,
        public type: FunctionType
    ) {
        super();
    }
}

export class WasmMemory extends WasmEntity {
    constructor(
        public limits: Limits
    ) {
        super();
    }
}

export class WasmTable extends WasmEntity {
    constructor(
        public type: RefType,
        public limits: Limits
    ) {
        super();
    }
}

export class WasmGlobal extends WasmEntity {
    constructor(
        public kind: GlobalKind,
        public type: ValueType,
        public expr?: ConstExpression
    ) {
        super();
    }
}

export class WasmModule {
    public functions: WasmFunction[] = [];
    public memories: WasmMemory[] = [];
    public tables: WasmTable[] = [];
    public globals: WasmGlobal[] = [];
    public elements: WasmElement[] = [];
    public data: WasmData[] = [];
    public stackPointerDetector?: WasmFunction;

    addFunction(func: WasmFunction) {
        func.index = this.functions.length;
        this.functions.push(func);
    }

    addMemory(mem: WasmMemory) {
        mem.index = this.memories.length;
        this.memories.push(mem);
    }

    addTable(table: WasmTable) {
        table.index = this.tables.length;
        this.tables.push(table);
    }

    addGlobal(global: WasmGlobal) {
        global.index = this.globals.length;
        this.globals.push(global);
    }

    addElement(element: WasmElement) {
        element.index = this.elements.length;
        this.elements.push(element);
    }

    addData(data: WasmData) {
        data.index = this.data.length;
        this.data.push(data);
    }
}
