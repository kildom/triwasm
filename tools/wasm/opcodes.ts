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


export enum OP {
    // -- Opcodes enum - begin of source code generated with help of "gen-instr.ts" script --

    UNREACHABLE = 0x00, // unreachable    [ 0x00 ]
    NOP = 0x01, // nop    [ 0x01 ]
    BLOCK = 0x02, // block bt    [ 0x02 ]
    LOOP = 0x03, // loop bt    [ 0x03 ]
    IF = 0x04, // if bt    [ 0x04 ]
    ELSE = 0x05, // else    [ 0x05 ]
    END = 0x0B, // end    [ 0x0B ]
    BR = 0x0C, // br l    [ 0x0C ]
    BR_IF = 0x0D, // br_if l    [ 0x0D ]
    BR_TABLE = 0x0E, // br_table l∗ l    [ 0x0E ]
    RETURN = 0x0F, // return    [ 0x0F ]
    CALL = 0x10, // call x    [ 0x10 ]
    CALL_INDIRECT = 0x11, // call_indirect x y    [ 0x11 ]
    DROP = 0x1A, // drop    [ 0x1A ]
    SELECT = 0x1B, // select    [ 0x1B ]
    SELECT_T = 0x1C, // select_t t    [ 0x1C ]
    LOCAL_GET = 0x20, // local.get x    [ 0x20 ]
    LOCAL_SET = 0x21, // local.set x    [ 0x21 ]
    LOCAL_TEE = 0x22, // local.tee x    [ 0x22 ]
    GLOBAL_GET = 0x23, // global.get x    [ 0x23 ]
    GLOBAL_SET = 0x24, // global.set x    [ 0x24 ]
    TABLE_GET = 0x25, // table.get x    [ 0x25 ]
    TABLE_SET = 0x26, // table.set x    [ 0x26 ]
    I32_LOAD = 0x28, // i32.load memarg    [ 0x28 ]
    I64_LOAD = 0x29, // i64.load memarg    [ 0x29 ]
    F32_LOAD = 0x2A, // f32.load memarg    [ 0x2A ]
    F64_LOAD = 0x2B, // f64.load memarg    [ 0x2B ]
    I32_LOAD8_S = 0x2C, // i32.load8_s memarg    [ 0x2C ]
    I32_LOAD8_U = 0x2D, // i32.load8_u memarg    [ 0x2D ]
    I32_LOAD16_S = 0x2E, // i32.load16_s memarg    [ 0x2E ]
    I32_LOAD16_U = 0x2F, // i32.load16_u memarg    [ 0x2F ]
    I64_LOAD8_S = 0x30, // i64.load8_s memarg    [ 0x30 ]
    I64_LOAD8_U = 0x31, // i64.load8_u memarg    [ 0x31 ]
    I64_LOAD16_S = 0x32, // i64.load16_s memarg    [ 0x32 ]
    I64_LOAD16_U = 0x33, // i64.load16_u memarg    [ 0x33 ]
    I64_LOAD32_S = 0x34, // i64.load32_s memarg    [ 0x34 ]
    I64_LOAD32_U = 0x35, // i64.load32_u memarg    [ 0x35 ]
    I32_STORE = 0x36, // i32.store memarg    [ 0x36 ]
    I64_STORE = 0x37, // i64.store memarg    [ 0x37 ]
    F32_STORE = 0x38, // f32.store memarg    [ 0x38 ]
    F64_STORE = 0x39, // f64.store memarg    [ 0x39 ]
    I32_STORE8 = 0x3A, // i32.store8 memarg    [ 0x3A ]
    I32_STORE16 = 0x3B, // i32.store16 memarg    [ 0x3B ]
    I64_STORE8 = 0x3C, // i64.store8 memarg    [ 0x3C ]
    I64_STORE16 = 0x3D, // i64.store16 memarg    [ 0x3D ]
    I64_STORE32 = 0x3E, // i64.store32 memarg    [ 0x3E ]
    MEMORY_SIZE = 0x3F, // memory.size    [ 0x3F ]
    MEMORY_GROW = 0x40, // memory.grow    [ 0x40 ]
    I32_CONST = 0x41, // i32.const i32    [ 0x41 ]
    I64_CONST = 0x42, // i64.const i64    [ 0x42 ]
    F32_CONST = 0x43, // f32.const f32    [ 0x43 ]
    F64_CONST = 0x44, // f64.const f64    [ 0x44 ]
    I32_EQZ = 0x45, // i32.eqz    [ 0x45 ]
    I32_EQ = 0x46, // i32.eq    [ 0x46 ]
    I32_NE = 0x47, // i32.ne    [ 0x47 ]
    I32_LT_S = 0x48, // i32.lt_s    [ 0x48 ]
    I32_LT_U = 0x49, // i32.lt_u    [ 0x49 ]
    I32_GT_S = 0x4A, // i32.gt_s    [ 0x4A ]
    I32_GT_U = 0x4B, // i32.gt_u    [ 0x4B ]
    I32_LE_S = 0x4C, // i32.le_s    [ 0x4C ]
    I32_LE_U = 0x4D, // i32.le_u    [ 0x4D ]
    I32_GE_S = 0x4E, // i32.ge_s    [ 0x4E ]
    I32_GE_U = 0x4F, // i32.ge_u    [ 0x4F ]
    I64_EQZ = 0x50, // i64.eqz    [ 0x50 ]
    I64_EQ = 0x51, // i64.eq    [ 0x51 ]
    I64_NE = 0x52, // i64.ne    [ 0x52 ]
    I64_LT_S = 0x53, // i64.lt_s    [ 0x53 ]
    I64_LT_U = 0x54, // i64.lt_u    [ 0x54 ]
    I64_GT_S = 0x55, // i64.gt_s    [ 0x55 ]
    I64_GT_U = 0x56, // i64.gt_u    [ 0x56 ]
    I64_LE_S = 0x57, // i64.le_s    [ 0x57 ]
    I64_LE_U = 0x58, // i64.le_u    [ 0x58 ]
    I64_GE_S = 0x59, // i64.ge_s    [ 0x59 ]
    I64_GE_U = 0x5A, // i64.ge_u    [ 0x5A ]
    F32_EQ = 0x5B, // f32.eq    [ 0x5B ]
    F32_NE = 0x5C, // f32.ne    [ 0x5C ]
    F32_LT = 0x5D, // f32.lt    [ 0x5D ]
    F32_GT = 0x5E, // f32.gt    [ 0x5E ]
    F32_LE = 0x5F, // f32.le    [ 0x5F ]
    F32_GE = 0x60, // f32.ge    [ 0x60 ]
    F64_EQ = 0x61, // f64.eq    [ 0x61 ]
    F64_NE = 0x62, // f64.ne    [ 0x62 ]
    F64_LT = 0x63, // f64.lt    [ 0x63 ]
    F64_GT = 0x64, // f64.gt    [ 0x64 ]
    F64_LE = 0x65, // f64.le    [ 0x65 ]
    F64_GE = 0x66, // f64.ge    [ 0x66 ]
    I32_CLZ = 0x67, // i32.clz    [ 0x67 ]
    I32_CTZ = 0x68, // i32.ctz    [ 0x68 ]
    I32_POPCNT = 0x69, // i32.popcnt    [ 0x69 ]
    I32_ADD = 0x6A, // i32.add    [ 0x6A ]
    I32_SUB = 0x6B, // i32.sub    [ 0x6B ]
    I32_MUL = 0x6C, // i32.mul    [ 0x6C ]
    I32_DIV_S = 0x6D, // i32.div_s    [ 0x6D ]
    I32_DIV_U = 0x6E, // i32.div_u    [ 0x6E ]
    I32_REM_S = 0x6F, // i32.rem_s    [ 0x6F ]
    I32_REM_U = 0x70, // i32.rem_u    [ 0x70 ]
    I32_AND = 0x71, // i32.and    [ 0x71 ]
    I32_OR = 0x72, // i32.or    [ 0x72 ]
    I32_XOR = 0x73, // i32.xor    [ 0x73 ]
    I32_SHL = 0x74, // i32.shl    [ 0x74 ]
    I32_SHR_S = 0x75, // i32.shr_s    [ 0x75 ]
    I32_SHR_U = 0x76, // i32.shr_u    [ 0x76 ]
    I32_ROTL = 0x77, // i32.rotl    [ 0x77 ]
    I32_ROTR = 0x78, // i32.rotr    [ 0x78 ]
    I64_CLZ = 0x79, // i64.clz    [ 0x79 ]
    I64_CTZ = 0x7A, // i64.ctz    [ 0x7A ]
    I64_POPCNT = 0x7B, // i64.popcnt    [ 0x7B ]
    I64_ADD = 0x7C, // i64.add    [ 0x7C ]
    I64_SUB = 0x7D, // i64.sub    [ 0x7D ]
    I64_MUL = 0x7E, // i64.mul    [ 0x7E ]
    I64_DIV_S = 0x7F, // i64.div_s    [ 0x7F ]
    I64_DIV_U = 0x80, // i64.div_u    [ 0x80 ]
    I64_REM_S = 0x81, // i64.rem_s    [ 0x81 ]
    I64_REM_U = 0x82, // i64.rem_u    [ 0x82 ]
    I64_AND = 0x83, // i64.and    [ 0x83 ]
    I64_OR = 0x84, // i64.or    [ 0x84 ]
    I64_XOR = 0x85, // i64.xor    [ 0x85 ]
    I64_SHL = 0x86, // i64.shl    [ 0x86 ]
    I64_SHR_S = 0x87, // i64.shr_s    [ 0x87 ]
    I64_SHR_U = 0x88, // i64.shr_u    [ 0x88 ]
    I64_ROTL = 0x89, // i64.rotl    [ 0x89 ]
    I64_ROTR = 0x8A, // i64.rotr    [ 0x8A ]
    F32_ABS = 0x8B, // f32.abs    [ 0x8B ]
    F32_NEG = 0x8C, // f32.neg    [ 0x8C ]
    F32_CEIL = 0x8D, // f32.ceil    [ 0x8D ]
    F32_FLOOR = 0x8E, // f32.floor    [ 0x8E ]
    F32_TRUNC = 0x8F, // f32.trunc    [ 0x8F ]
    F32_NEAREST = 0x90, // f32.nearest    [ 0x90 ]
    F32_SQRT = 0x91, // f32.sqrt    [ 0x91 ]
    F32_ADD = 0x92, // f32.add    [ 0x92 ]
    F32_SUB = 0x93, // f32.sub    [ 0x93 ]
    F32_MUL = 0x94, // f32.mul    [ 0x94 ]
    F32_DIV = 0x95, // f32.div    [ 0x95 ]
    F32_MIN = 0x96, // f32.min    [ 0x96 ]
    F32_MAX = 0x97, // f32.max    [ 0x97 ]
    F32_COPYSIGN = 0x98, // f32.copysign    [ 0x98 ]
    F64_ABS = 0x99, // f64.abs    [ 0x99 ]
    F64_NEG = 0x9A, // f64.neg    [ 0x9A ]
    F64_CEIL = 0x9B, // f64.ceil    [ 0x9B ]
    F64_FLOOR = 0x9C, // f64.floor    [ 0x9C ]
    F64_TRUNC = 0x9D, // f64.trunc    [ 0x9D ]
    F64_NEAREST = 0x9E, // f64.nearest    [ 0x9E ]
    F64_SQRT = 0x9F, // f64.sqrt    [ 0x9F ]
    F64_ADD = 0xA0, // f64.add    [ 0xA0 ]
    F64_SUB = 0xA1, // f64.sub    [ 0xA1 ]
    F64_MUL = 0xA2, // f64.mul    [ 0xA2 ]
    F64_DIV = 0xA3, // f64.div    [ 0xA3 ]
    F64_MIN = 0xA4, // f64.min    [ 0xA4 ]
    F64_MAX = 0xA5, // f64.max    [ 0xA5 ]
    F64_COPYSIGN = 0xA6, // f64.copysign    [ 0xA6 ]
    I32_WRAP_I64 = 0xA7, // i32.wrap_i64    [ 0xA7 ]
    I32_TRUNC_F32_S = 0xA8, // i32.trunc_f32_s    [ 0xA8 ]
    I32_TRUNC_F32_U = 0xA9, // i32.trunc_f32_u    [ 0xA9 ]
    I32_TRUNC_F64_S = 0xAA, // i32.trunc_f64_s    [ 0xAA ]
    I32_TRUNC_F64_U = 0xAB, // i32.trunc_f64_u    [ 0xAB ]
    I64_EXTEND_I32_S = 0xAC, // i64.extend_i32_s    [ 0xAC ]
    I64_EXTEND_I32_U = 0xAD, // i64.extend_i32_u    [ 0xAD ]
    I64_TRUNC_F32_S = 0xAE, // i64.trunc_f32_s    [ 0xAE ]
    I64_TRUNC_F32_U = 0xAF, // i64.trunc_f32_u    [ 0xAF ]
    I64_TRUNC_F64_S = 0xB0, // i64.trunc_f64_s    [ 0xB0 ]
    I64_TRUNC_F64_U = 0xB1, // i64.trunc_f64_u    [ 0xB1 ]
    F32_CONVERT_I32_S = 0xB2, // f32.convert_i32_s    [ 0xB2 ]
    F32_CONVERT_I32_U = 0xB3, // f32.convert_i32_u    [ 0xB3 ]
    F32_CONVERT_I64_S = 0xB4, // f32.convert_i64_s    [ 0xB4 ]
    F32_CONVERT_I64_U = 0xB5, // f32.convert_i64_u    [ 0xB5 ]
    F32_DEMOTE_F64 = 0xB6, // f32.demote_f64    [ 0xB6 ]
    F64_CONVERT_I32_S = 0xB7, // f64.convert_i32_s    [ 0xB7 ]
    F64_CONVERT_I32_U = 0xB8, // f64.convert_i32_u    [ 0xB8 ]
    F64_CONVERT_I64_S = 0xB9, // f64.convert_i64_s    [ 0xB9 ]
    F64_CONVERT_I64_U = 0xBA, // f64.convert_i64_u    [ 0xBA ]
    F64_PROMOTE_F32 = 0xBB, // f64.promote_f32    [ 0xBB ]
    I32_REINTERPRET_F32 = 0xBC, // i32.reinterpret_f32    [ 0xBC ]
    I64_REINTERPRET_F64 = 0xBD, // i64.reinterpret_f64    [ 0xBD ]
    F32_REINTERPRET_I32 = 0xBE, // f32.reinterpret_i32    [ 0xBE ]
    F64_REINTERPRET_I64 = 0xBF, // f64.reinterpret_i64    [ 0xBF ]
    I32_EXTEND8_S = 0xC0, // i32.extend8_s    [ 0xC0 ]
    I32_EXTEND16_S = 0xC1, // i32.extend16_s    [ 0xC1 ]
    I64_EXTEND8_S = 0xC2, // i64.extend8_s    [ 0xC2 ]
    I64_EXTEND16_S = 0xC3, // i64.extend16_s    [ 0xC3 ]
    I64_EXTEND32_S = 0xC4, // i64.extend32_s    [ 0xC4 ]
    REF_NULL = 0xD0, // ref.null t    [ 0xD0 ]
    REF_IS_NULL = 0xD1, // ref.is_null    [ 0xD1 ]
    REF_FUNC = 0xD2, // ref.func x    [ 0xD2 ]
    I32_TRUNC_SAT_F32_S = 0xFC, // i32.trunc_sat_f32_s    [ 0xFC 0x00 ]
    I32_TRUNC_SAT_F32_U = 0x01FC, // i32.trunc_sat_f32_u    [ 0xFC 0x01 ]
    I32_TRUNC_SAT_F64_S = 0x02FC, // i32.trunc_sat_f64_s    [ 0xFC 0x02 ]
    I32_TRUNC_SAT_F64_U = 0x03FC, // i32.trunc_sat_f64_u    [ 0xFC 0x03 ]
    I64_TRUNC_SAT_F32_S = 0x04FC, // i64.trunc_sat_f32_s    [ 0xFC 0x04 ]
    I64_TRUNC_SAT_F32_U = 0x05FC, // i64.trunc_sat_f32_u    [ 0xFC 0x05 ]
    I64_TRUNC_SAT_F64_S = 0x06FC, // i64.trunc_sat_f64_s    [ 0xFC 0x06 ]
    I64_TRUNC_SAT_F64_U = 0x07FC, // i64.trunc_sat_f64_u    [ 0xFC 0x07 ]
    MEMORY_INIT = 0x08FC, // memory.init x    [ 0xFC 0x08 ]
    DATA_DROP = 0x09FC, // data.drop x    [ 0xFC 0x09 ]
    MEMORY_COPY = 0x0AFC, // memory.copy    [ 0xFC 0x0A ]
    MEMORY_FILL = 0x0BFC, // memory.fill    [ 0xFC 0x0B ]
    TABLE_INIT = 0x0CFC, // table.init x y    [ 0xFC 0x0C ]
    ELEM_DROP = 0x0DFC, // elem.drop x    [ 0xFC 0x0D ]
    TABLE_COPY = 0x0EFC, // table.copy x y    [ 0xFC 0x0E ]
    TABLE_GROW = 0x0FFC, // table.grow x    [ 0xFC 0x0F ]
    TABLE_SIZE = 0x10FC, // table.size x    [ 0xFC 0x10 ]
    TABLE_FILL = 0x11FC, // table.fill x    [ 0xFC 0x11 ]
    TRIVM_MULTIBYTE_FIRST = 0xFB, // TRIVM.MULTIBYTE_FIRST    [ 0xFB ]
    TRIVM_FUNCTION = -1, // TRIVM.FUNCTION
    TRIVM_POP = -2, // TRIVM.POP
    TRIVM_DUP32 = -3, // TRIVM.DUP32
    TRIVM_DUP64 = -4, // TRIVM.DUP64
    TRIVM_LOCAL_GET32 = -5, // TRIVM.LOCAL_GET32
    TRIVM_LOCAL_GET64 = -6, // TRIVM.LOCAL_GET64
    TRIVM_LOCAL_SET32 = -7, // TRIVM.LOCAL_SET32
    TRIVM_LOCAL_SET64 = -8, // TRIVM.LOCAL_SET64
    TRIVM_GLOBAL_GET32 = -9, // TRIVM.GLOBAL_GET32
    TRIVM_GLOBAL_GET64 = -10, // TRIVM.GLOBAL_GET64
    TRIVM_GLOBAL_SET32 = -11, // TRIVM.GLOBAL_SET32
    TRIVM_GLOBAL_SET64 = -12, // TRIVM.GLOBAL_SET64
    TRIVM_RAW = -13, // TRIVM.RAW

    // -- Opcodes enum - end of source code generated with help of "gen-instr.ts" script --
}

export const OP_NAMES: { [key in OP]: string } = {
    // -- Instruction names - begin of source code generated with help of "gen-instr.ts" script --

    [OP.UNREACHABLE]: 'unreachable',
    [OP.NOP]: 'nop',
    [OP.BLOCK]: 'block',
    [OP.LOOP]: 'loop',
    [OP.IF]: 'if',
    [OP.ELSE]: 'else',
    [OP.END]: 'end',
    [OP.BR]: 'br',
    [OP.BR_IF]: 'br_if',
    [OP.BR_TABLE]: 'br_table',
    [OP.RETURN]: 'return',
    [OP.CALL]: 'call',
    [OP.CALL_INDIRECT]: 'call_indirect',
    [OP.DROP]: 'drop',
    [OP.SELECT]: 'select',
    [OP.SELECT_T]: 'select_t',
    [OP.LOCAL_GET]: 'local.get',
    [OP.LOCAL_SET]: 'local.set',
    [OP.LOCAL_TEE]: 'local.tee',
    [OP.GLOBAL_GET]: 'global.get',
    [OP.GLOBAL_SET]: 'global.set',
    [OP.TABLE_GET]: 'table.get',
    [OP.TABLE_SET]: 'table.set',
    [OP.I32_LOAD]: 'i32.load',
    [OP.I64_LOAD]: 'i64.load',
    [OP.F32_LOAD]: 'f32.load',
    [OP.F64_LOAD]: 'f64.load',
    [OP.I32_LOAD8_S]: 'i32.load8_s',
    [OP.I32_LOAD8_U]: 'i32.load8_u',
    [OP.I32_LOAD16_S]: 'i32.load16_s',
    [OP.I32_LOAD16_U]: 'i32.load16_u',
    [OP.I64_LOAD8_S]: 'i64.load8_s',
    [OP.I64_LOAD8_U]: 'i64.load8_u',
    [OP.I64_LOAD16_S]: 'i64.load16_s',
    [OP.I64_LOAD16_U]: 'i64.load16_u',
    [OP.I64_LOAD32_S]: 'i64.load32_s',
    [OP.I64_LOAD32_U]: 'i64.load32_u',
    [OP.I32_STORE]: 'i32.store',
    [OP.I64_STORE]: 'i64.store',
    [OP.F32_STORE]: 'f32.store',
    [OP.F64_STORE]: 'f64.store',
    [OP.I32_STORE8]: 'i32.store8',
    [OP.I32_STORE16]: 'i32.store16',
    [OP.I64_STORE8]: 'i64.store8',
    [OP.I64_STORE16]: 'i64.store16',
    [OP.I64_STORE32]: 'i64.store32',
    [OP.MEMORY_SIZE]: 'memory.size',
    [OP.MEMORY_GROW]: 'memory.grow',
    [OP.I32_CONST]: 'i32.const',
    [OP.I64_CONST]: 'i64.const',
    [OP.F32_CONST]: 'f32.const',
    [OP.F64_CONST]: 'f64.const',
    [OP.I32_EQZ]: 'i32.eqz',
    [OP.I32_EQ]: 'i32.eq',
    [OP.I32_NE]: 'i32.ne',
    [OP.I32_LT_S]: 'i32.lt_s',
    [OP.I32_LT_U]: 'i32.lt_u',
    [OP.I32_GT_S]: 'i32.gt_s',
    [OP.I32_GT_U]: 'i32.gt_u',
    [OP.I32_LE_S]: 'i32.le_s',
    [OP.I32_LE_U]: 'i32.le_u',
    [OP.I32_GE_S]: 'i32.ge_s',
    [OP.I32_GE_U]: 'i32.ge_u',
    [OP.I64_EQZ]: 'i64.eqz',
    [OP.I64_EQ]: 'i64.eq',
    [OP.I64_NE]: 'i64.ne',
    [OP.I64_LT_S]: 'i64.lt_s',
    [OP.I64_LT_U]: 'i64.lt_u',
    [OP.I64_GT_S]: 'i64.gt_s',
    [OP.I64_GT_U]: 'i64.gt_u',
    [OP.I64_LE_S]: 'i64.le_s',
    [OP.I64_LE_U]: 'i64.le_u',
    [OP.I64_GE_S]: 'i64.ge_s',
    [OP.I64_GE_U]: 'i64.ge_u',
    [OP.F32_EQ]: 'f32.eq',
    [OP.F32_NE]: 'f32.ne',
    [OP.F32_LT]: 'f32.lt',
    [OP.F32_GT]: 'f32.gt',
    [OP.F32_LE]: 'f32.le',
    [OP.F32_GE]: 'f32.ge',
    [OP.F64_EQ]: 'f64.eq',
    [OP.F64_NE]: 'f64.ne',
    [OP.F64_LT]: 'f64.lt',
    [OP.F64_GT]: 'f64.gt',
    [OP.F64_LE]: 'f64.le',
    [OP.F64_GE]: 'f64.ge',
    [OP.I32_CLZ]: 'i32.clz',
    [OP.I32_CTZ]: 'i32.ctz',
    [OP.I32_POPCNT]: 'i32.popcnt',
    [OP.I32_ADD]: 'i32.add',
    [OP.I32_SUB]: 'i32.sub',
    [OP.I32_MUL]: 'i32.mul',
    [OP.I32_DIV_S]: 'i32.div_s',
    [OP.I32_DIV_U]: 'i32.div_u',
    [OP.I32_REM_S]: 'i32.rem_s',
    [OP.I32_REM_U]: 'i32.rem_u',
    [OP.I32_AND]: 'i32.and',
    [OP.I32_OR]: 'i32.or',
    [OP.I32_XOR]: 'i32.xor',
    [OP.I32_SHL]: 'i32.shl',
    [OP.I32_SHR_S]: 'i32.shr_s',
    [OP.I32_SHR_U]: 'i32.shr_u',
    [OP.I32_ROTL]: 'i32.rotl',
    [OP.I32_ROTR]: 'i32.rotr',
    [OP.I64_CLZ]: 'i64.clz',
    [OP.I64_CTZ]: 'i64.ctz',
    [OP.I64_POPCNT]: 'i64.popcnt',
    [OP.I64_ADD]: 'i64.add',
    [OP.I64_SUB]: 'i64.sub',
    [OP.I64_MUL]: 'i64.mul',
    [OP.I64_DIV_S]: 'i64.div_s',
    [OP.I64_DIV_U]: 'i64.div_u',
    [OP.I64_REM_S]: 'i64.rem_s',
    [OP.I64_REM_U]: 'i64.rem_u',
    [OP.I64_AND]: 'i64.and',
    [OP.I64_OR]: 'i64.or',
    [OP.I64_XOR]: 'i64.xor',
    [OP.I64_SHL]: 'i64.shl',
    [OP.I64_SHR_S]: 'i64.shr_s',
    [OP.I64_SHR_U]: 'i64.shr_u',
    [OP.I64_ROTL]: 'i64.rotl',
    [OP.I64_ROTR]: 'i64.rotr',
    [OP.F32_ABS]: 'f32.abs',
    [OP.F32_NEG]: 'f32.neg',
    [OP.F32_CEIL]: 'f32.ceil',
    [OP.F32_FLOOR]: 'f32.floor',
    [OP.F32_TRUNC]: 'f32.trunc',
    [OP.F32_NEAREST]: 'f32.nearest',
    [OP.F32_SQRT]: 'f32.sqrt',
    [OP.F32_ADD]: 'f32.add',
    [OP.F32_SUB]: 'f32.sub',
    [OP.F32_MUL]: 'f32.mul',
    [OP.F32_DIV]: 'f32.div',
    [OP.F32_MIN]: 'f32.min',
    [OP.F32_MAX]: 'f32.max',
    [OP.F32_COPYSIGN]: 'f32.copysign',
    [OP.F64_ABS]: 'f64.abs',
    [OP.F64_NEG]: 'f64.neg',
    [OP.F64_CEIL]: 'f64.ceil',
    [OP.F64_FLOOR]: 'f64.floor',
    [OP.F64_TRUNC]: 'f64.trunc',
    [OP.F64_NEAREST]: 'f64.nearest',
    [OP.F64_SQRT]: 'f64.sqrt',
    [OP.F64_ADD]: 'f64.add',
    [OP.F64_SUB]: 'f64.sub',
    [OP.F64_MUL]: 'f64.mul',
    [OP.F64_DIV]: 'f64.div',
    [OP.F64_MIN]: 'f64.min',
    [OP.F64_MAX]: 'f64.max',
    [OP.F64_COPYSIGN]: 'f64.copysign',
    [OP.I32_WRAP_I64]: 'i32.wrap_i64',
    [OP.I32_TRUNC_F32_S]: 'i32.trunc_f32_s',
    [OP.I32_TRUNC_F32_U]: 'i32.trunc_f32_u',
    [OP.I32_TRUNC_F64_S]: 'i32.trunc_f64_s',
    [OP.I32_TRUNC_F64_U]: 'i32.trunc_f64_u',
    [OP.I64_EXTEND_I32_S]: 'i64.extend_i32_s',
    [OP.I64_EXTEND_I32_U]: 'i64.extend_i32_u',
    [OP.I64_TRUNC_F32_S]: 'i64.trunc_f32_s',
    [OP.I64_TRUNC_F32_U]: 'i64.trunc_f32_u',
    [OP.I64_TRUNC_F64_S]: 'i64.trunc_f64_s',
    [OP.I64_TRUNC_F64_U]: 'i64.trunc_f64_u',
    [OP.F32_CONVERT_I32_S]: 'f32.convert_i32_s',
    [OP.F32_CONVERT_I32_U]: 'f32.convert_i32_u',
    [OP.F32_CONVERT_I64_S]: 'f32.convert_i64_s',
    [OP.F32_CONVERT_I64_U]: 'f32.convert_i64_u',
    [OP.F32_DEMOTE_F64]: 'f32.demote_f64',
    [OP.F64_CONVERT_I32_S]: 'f64.convert_i32_s',
    [OP.F64_CONVERT_I32_U]: 'f64.convert_i32_u',
    [OP.F64_CONVERT_I64_S]: 'f64.convert_i64_s',
    [OP.F64_CONVERT_I64_U]: 'f64.convert_i64_u',
    [OP.F64_PROMOTE_F32]: 'f64.promote_f32',
    [OP.I32_REINTERPRET_F32]: 'i32.reinterpret_f32',
    [OP.I64_REINTERPRET_F64]: 'i64.reinterpret_f64',
    [OP.F32_REINTERPRET_I32]: 'f32.reinterpret_i32',
    [OP.F64_REINTERPRET_I64]: 'f64.reinterpret_i64',
    [OP.I32_EXTEND8_S]: 'i32.extend8_s',
    [OP.I32_EXTEND16_S]: 'i32.extend16_s',
    [OP.I64_EXTEND8_S]: 'i64.extend8_s',
    [OP.I64_EXTEND16_S]: 'i64.extend16_s',
    [OP.I64_EXTEND32_S]: 'i64.extend32_s',
    [OP.REF_NULL]: 'ref.null',
    [OP.REF_IS_NULL]: 'ref.is_null',
    [OP.REF_FUNC]: 'ref.func',
    [OP.I32_TRUNC_SAT_F32_S]: 'i32.trunc_sat_f32_s',
    [OP.I32_TRUNC_SAT_F32_U]: 'i32.trunc_sat_f32_u',
    [OP.I32_TRUNC_SAT_F64_S]: 'i32.trunc_sat_f64_s',
    [OP.I32_TRUNC_SAT_F64_U]: 'i32.trunc_sat_f64_u',
    [OP.I64_TRUNC_SAT_F32_S]: 'i64.trunc_sat_f32_s',
    [OP.I64_TRUNC_SAT_F32_U]: 'i64.trunc_sat_f32_u',
    [OP.I64_TRUNC_SAT_F64_S]: 'i64.trunc_sat_f64_s',
    [OP.I64_TRUNC_SAT_F64_U]: 'i64.trunc_sat_f64_u',
    [OP.MEMORY_INIT]: 'memory.init',
    [OP.DATA_DROP]: 'data.drop',
    [OP.MEMORY_COPY]: 'memory.copy',
    [OP.MEMORY_FILL]: 'memory.fill',
    [OP.TABLE_INIT]: 'table.init',
    [OP.ELEM_DROP]: 'elem.drop',
    [OP.TABLE_COPY]: 'table.copy',
    [OP.TABLE_GROW]: 'table.grow',
    [OP.TABLE_SIZE]: 'table.size',
    [OP.TABLE_FILL]: 'table.fill',
    [OP.TRIVM_MULTIBYTE_FIRST]: 'TRIVM.MULTIBYTE_FIRST',
    [OP.TRIVM_FUNCTION]: 'TRIVM.FUNCTION',
    [OP.TRIVM_POP]: 'TRIVM.POP',
    [OP.TRIVM_DUP32]: 'TRIVM.DUP32',
    [OP.TRIVM_DUP64]: 'TRIVM.DUP64',
    [OP.TRIVM_LOCAL_GET32]: 'TRIVM.LOCAL_GET32',
    [OP.TRIVM_LOCAL_GET64]: 'TRIVM.LOCAL_GET64',
    [OP.TRIVM_LOCAL_SET32]: 'TRIVM.LOCAL_SET32',
    [OP.TRIVM_LOCAL_SET64]: 'TRIVM.LOCAL_SET64',
    [OP.TRIVM_GLOBAL_GET32]: 'TRIVM.GLOBAL_GET32',
    [OP.TRIVM_GLOBAL_GET64]: 'TRIVM.GLOBAL_GET64',
    [OP.TRIVM_GLOBAL_SET32]: 'TRIVM.GLOBAL_SET32',
    [OP.TRIVM_GLOBAL_SET64]: 'TRIVM.GLOBAL_SET64',
    [OP.TRIVM_RAW]: 'TRIVM.RAW',

    // -- Instruction names - end of source code generated with help of "gen-instr.ts" script --
};
