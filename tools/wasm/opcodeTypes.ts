import { OP } from './opcodes';
import { WasmInstr } from './wasmModule';

// ---- Instruction types - begin - generated with help of script ----

/* eslint-disable max-len */
function ft_UNREACHABLE(i: WasmInstr) { if (i.opcode === OP.UNREACHABLE) return i; throw null; }
export type UNREACHABLE = ReturnType<typeof ft_UNREACHABLE>;
function ft_NOP(i: WasmInstr) { if (i.opcode === OP.NOP) return i; throw null; }
export type NOP = ReturnType<typeof ft_NOP>;
function ft_BLOCK(i: WasmInstr) { if (i.opcode === OP.BLOCK) return i; throw null; }
export type BLOCK = ReturnType<typeof ft_BLOCK>;
function ft_LOOP(i: WasmInstr) { if (i.opcode === OP.LOOP) return i; throw null; }
export type LOOP = ReturnType<typeof ft_LOOP>;
function ft_IF(i: WasmInstr) { if (i.opcode === OP.IF) return i; throw null; }
export type IF = ReturnType<typeof ft_IF>;
function ft_ELSE(i: WasmInstr) { if (i.opcode === OP.ELSE) return i; throw null; }
export type ELSE = ReturnType<typeof ft_ELSE>;
function ft_END(i: WasmInstr) { if (i.opcode === OP.END) return i; throw null; }
export type END = ReturnType<typeof ft_END>;
function ft_BR(i: WasmInstr) { if (i.opcode === OP.BR) return i; throw null; }
export type BR = ReturnType<typeof ft_BR>;
function ft_BR_IF(i: WasmInstr) { if (i.opcode === OP.BR_IF) return i; throw null; }
export type BR_IF = ReturnType<typeof ft_BR_IF>;
function ft_BR_TABLE(i: WasmInstr) { if (i.opcode === OP.BR_TABLE) return i; throw null; }
export type BR_TABLE = ReturnType<typeof ft_BR_TABLE>;
function ft_RETURN(i: WasmInstr) { if (i.opcode === OP.RETURN) return i; throw null; }
export type RETURN = ReturnType<typeof ft_RETURN>;
function ft_CALL(i: WasmInstr) { if (i.opcode === OP.CALL) return i; throw null; }
export type CALL = ReturnType<typeof ft_CALL>;
function ft_CALL_INDIRECT(i: WasmInstr) { if (i.opcode === OP.CALL_INDIRECT) return i; throw null; }
export type CALL_INDIRECT = ReturnType<typeof ft_CALL_INDIRECT>;
function ft_DROP(i: WasmInstr) { if (i.opcode === OP.DROP) return i; throw null; }
export type DROP = ReturnType<typeof ft_DROP>;
function ft_SELECT(i: WasmInstr) { if (i.opcode === OP.SELECT) return i; throw null; }
export type SELECT = ReturnType<typeof ft_SELECT>;
function ft_SELECT_T(i: WasmInstr) { if (i.opcode === OP.SELECT_T) return i; throw null; }
export type SELECT_T = ReturnType<typeof ft_SELECT_T>;
function ft_LOCAL_GET(i: WasmInstr) { if (i.opcode === OP.LOCAL_GET) return i; throw null; }
export type LOCAL_GET = ReturnType<typeof ft_LOCAL_GET>;
function ft_LOCAL_SET(i: WasmInstr) { if (i.opcode === OP.LOCAL_SET) return i; throw null; }
export type LOCAL_SET = ReturnType<typeof ft_LOCAL_SET>;
function ft_LOCAL_TEE(i: WasmInstr) { if (i.opcode === OP.LOCAL_TEE) return i; throw null; }
export type LOCAL_TEE = ReturnType<typeof ft_LOCAL_TEE>;
function ft_GLOBAL_GET(i: WasmInstr) { if (i.opcode === OP.GLOBAL_GET) return i; throw null; }
export type GLOBAL_GET = ReturnType<typeof ft_GLOBAL_GET>;
function ft_GLOBAL_SET(i: WasmInstr) { if (i.opcode === OP.GLOBAL_SET) return i; throw null; }
export type GLOBAL_SET = ReturnType<typeof ft_GLOBAL_SET>;
function ft_TABLE_GET(i: WasmInstr) { if (i.opcode === OP.TABLE_GET) return i; throw null; }
export type TABLE_GET = ReturnType<typeof ft_TABLE_GET>;
function ft_TABLE_SET(i: WasmInstr) { if (i.opcode === OP.TABLE_SET) return i; throw null; }
export type TABLE_SET = ReturnType<typeof ft_TABLE_SET>;
function ft_I32_LOAD(i: WasmInstr) { if (i.opcode === OP.I32_LOAD) return i; throw null; }
export type I32_LOAD = ReturnType<typeof ft_I32_LOAD>;
function ft_I64_LOAD(i: WasmInstr) { if (i.opcode === OP.I64_LOAD) return i; throw null; }
export type I64_LOAD = ReturnType<typeof ft_I64_LOAD>;
function ft_F32_LOAD(i: WasmInstr) { if (i.opcode === OP.F32_LOAD) return i; throw null; }
export type F32_LOAD = ReturnType<typeof ft_F32_LOAD>;
function ft_F64_LOAD(i: WasmInstr) { if (i.opcode === OP.F64_LOAD) return i; throw null; }
export type F64_LOAD = ReturnType<typeof ft_F64_LOAD>;
function ft_I32_LOAD8_S(i: WasmInstr) { if (i.opcode === OP.I32_LOAD8_S) return i; throw null; }
export type I32_LOAD8_S = ReturnType<typeof ft_I32_LOAD8_S>;
function ft_I32_LOAD8_U(i: WasmInstr) { if (i.opcode === OP.I32_LOAD8_U) return i; throw null; }
export type I32_LOAD8_U = ReturnType<typeof ft_I32_LOAD8_U>;
function ft_I32_LOAD16_S(i: WasmInstr) { if (i.opcode === OP.I32_LOAD16_S) return i; throw null; }
export type I32_LOAD16_S = ReturnType<typeof ft_I32_LOAD16_S>;
function ft_I32_LOAD16_U(i: WasmInstr) { if (i.opcode === OP.I32_LOAD16_U) return i; throw null; }
export type I32_LOAD16_U = ReturnType<typeof ft_I32_LOAD16_U>;
function ft_I64_LOAD8_S(i: WasmInstr) { if (i.opcode === OP.I64_LOAD8_S) return i; throw null; }
export type I64_LOAD8_S = ReturnType<typeof ft_I64_LOAD8_S>;
function ft_I64_LOAD8_U(i: WasmInstr) { if (i.opcode === OP.I64_LOAD8_U) return i; throw null; }
export type I64_LOAD8_U = ReturnType<typeof ft_I64_LOAD8_U>;
function ft_I64_LOAD16_S(i: WasmInstr) { if (i.opcode === OP.I64_LOAD16_S) return i; throw null; }
export type I64_LOAD16_S = ReturnType<typeof ft_I64_LOAD16_S>;
function ft_I64_LOAD16_U(i: WasmInstr) { if (i.opcode === OP.I64_LOAD16_U) return i; throw null; }
export type I64_LOAD16_U = ReturnType<typeof ft_I64_LOAD16_U>;
function ft_I64_LOAD32_S(i: WasmInstr) { if (i.opcode === OP.I64_LOAD32_S) return i; throw null; }
export type I64_LOAD32_S = ReturnType<typeof ft_I64_LOAD32_S>;
function ft_I64_LOAD32_U(i: WasmInstr) { if (i.opcode === OP.I64_LOAD32_U) return i; throw null; }
export type I64_LOAD32_U = ReturnType<typeof ft_I64_LOAD32_U>;
function ft_I32_STORE(i: WasmInstr) { if (i.opcode === OP.I32_STORE) return i; throw null; }
export type I32_STORE = ReturnType<typeof ft_I32_STORE>;
function ft_I64_STORE(i: WasmInstr) { if (i.opcode === OP.I64_STORE) return i; throw null; }
export type I64_STORE = ReturnType<typeof ft_I64_STORE>;
function ft_F32_STORE(i: WasmInstr) { if (i.opcode === OP.F32_STORE) return i; throw null; }
export type F32_STORE = ReturnType<typeof ft_F32_STORE>;
function ft_F64_STORE(i: WasmInstr) { if (i.opcode === OP.F64_STORE) return i; throw null; }
export type F64_STORE = ReturnType<typeof ft_F64_STORE>;
function ft_I32_STORE8(i: WasmInstr) { if (i.opcode === OP.I32_STORE8) return i; throw null; }
export type I32_STORE8 = ReturnType<typeof ft_I32_STORE8>;
function ft_I32_STORE16(i: WasmInstr) { if (i.opcode === OP.I32_STORE16) return i; throw null; }
export type I32_STORE16 = ReturnType<typeof ft_I32_STORE16>;
function ft_I64_STORE8(i: WasmInstr) { if (i.opcode === OP.I64_STORE8) return i; throw null; }
export type I64_STORE8 = ReturnType<typeof ft_I64_STORE8>;
function ft_I64_STORE16(i: WasmInstr) { if (i.opcode === OP.I64_STORE16) return i; throw null; }
export type I64_STORE16 = ReturnType<typeof ft_I64_STORE16>;
function ft_I64_STORE32(i: WasmInstr) { if (i.opcode === OP.I64_STORE32) return i; throw null; }
export type I64_STORE32 = ReturnType<typeof ft_I64_STORE32>;
function ft_MEMORY_SIZE(i: WasmInstr) { if (i.opcode === OP.MEMORY_SIZE) return i; throw null; }
export type MEMORY_SIZE = ReturnType<typeof ft_MEMORY_SIZE>;
function ft_MEMORY_GROW(i: WasmInstr) { if (i.opcode === OP.MEMORY_GROW) return i; throw null; }
export type MEMORY_GROW = ReturnType<typeof ft_MEMORY_GROW>;
function ft_I32_CONST(i: WasmInstr) { if (i.opcode === OP.I32_CONST) return i; throw null; }
export type I32_CONST = ReturnType<typeof ft_I32_CONST>;
function ft_I64_CONST(i: WasmInstr) { if (i.opcode === OP.I64_CONST) return i; throw null; }
export type I64_CONST = ReturnType<typeof ft_I64_CONST>;
function ft_F32_CONST(i: WasmInstr) { if (i.opcode === OP.F32_CONST) return i; throw null; }
export type F32_CONST = ReturnType<typeof ft_F32_CONST>;
function ft_F64_CONST(i: WasmInstr) { if (i.opcode === OP.F64_CONST) return i; throw null; }
export type F64_CONST = ReturnType<typeof ft_F64_CONST>;
function ft_I32_EQZ(i: WasmInstr) { if (i.opcode === OP.I32_EQZ) return i; throw null; }
export type I32_EQZ = ReturnType<typeof ft_I32_EQZ>;
function ft_I32_EQ(i: WasmInstr) { if (i.opcode === OP.I32_EQ) return i; throw null; }
export type I32_EQ = ReturnType<typeof ft_I32_EQ>;
function ft_I32_NE(i: WasmInstr) { if (i.opcode === OP.I32_NE) return i; throw null; }
export type I32_NE = ReturnType<typeof ft_I32_NE>;
function ft_I32_LT_S(i: WasmInstr) { if (i.opcode === OP.I32_LT_S) return i; throw null; }
export type I32_LT_S = ReturnType<typeof ft_I32_LT_S>;
function ft_I32_LT_U(i: WasmInstr) { if (i.opcode === OP.I32_LT_U) return i; throw null; }
export type I32_LT_U = ReturnType<typeof ft_I32_LT_U>;
function ft_I32_GT_S(i: WasmInstr) { if (i.opcode === OP.I32_GT_S) return i; throw null; }
export type I32_GT_S = ReturnType<typeof ft_I32_GT_S>;
function ft_I32_GT_U(i: WasmInstr) { if (i.opcode === OP.I32_GT_U) return i; throw null; }
export type I32_GT_U = ReturnType<typeof ft_I32_GT_U>;
function ft_I32_LE_S(i: WasmInstr) { if (i.opcode === OP.I32_LE_S) return i; throw null; }
export type I32_LE_S = ReturnType<typeof ft_I32_LE_S>;
function ft_I32_LE_U(i: WasmInstr) { if (i.opcode === OP.I32_LE_U) return i; throw null; }
export type I32_LE_U = ReturnType<typeof ft_I32_LE_U>;
function ft_I32_GE_S(i: WasmInstr) { if (i.opcode === OP.I32_GE_S) return i; throw null; }
export type I32_GE_S = ReturnType<typeof ft_I32_GE_S>;
function ft_I32_GE_U(i: WasmInstr) { if (i.opcode === OP.I32_GE_U) return i; throw null; }
export type I32_GE_U = ReturnType<typeof ft_I32_GE_U>;
function ft_I64_EQZ(i: WasmInstr) { if (i.opcode === OP.I64_EQZ) return i; throw null; }
export type I64_EQZ = ReturnType<typeof ft_I64_EQZ>;
function ft_I64_EQ(i: WasmInstr) { if (i.opcode === OP.I64_EQ) return i; throw null; }
export type I64_EQ = ReturnType<typeof ft_I64_EQ>;
function ft_I64_NE(i: WasmInstr) { if (i.opcode === OP.I64_NE) return i; throw null; }
export type I64_NE = ReturnType<typeof ft_I64_NE>;
function ft_I64_LT_S(i: WasmInstr) { if (i.opcode === OP.I64_LT_S) return i; throw null; }
export type I64_LT_S = ReturnType<typeof ft_I64_LT_S>;
function ft_I64_LT_U(i: WasmInstr) { if (i.opcode === OP.I64_LT_U) return i; throw null; }
export type I64_LT_U = ReturnType<typeof ft_I64_LT_U>;
function ft_I64_GT_S(i: WasmInstr) { if (i.opcode === OP.I64_GT_S) return i; throw null; }
export type I64_GT_S = ReturnType<typeof ft_I64_GT_S>;
function ft_I64_GT_U(i: WasmInstr) { if (i.opcode === OP.I64_GT_U) return i; throw null; }
export type I64_GT_U = ReturnType<typeof ft_I64_GT_U>;
function ft_I64_LE_S(i: WasmInstr) { if (i.opcode === OP.I64_LE_S) return i; throw null; }
export type I64_LE_S = ReturnType<typeof ft_I64_LE_S>;
function ft_I64_LE_U(i: WasmInstr) { if (i.opcode === OP.I64_LE_U) return i; throw null; }
export type I64_LE_U = ReturnType<typeof ft_I64_LE_U>;
function ft_I64_GE_S(i: WasmInstr) { if (i.opcode === OP.I64_GE_S) return i; throw null; }
export type I64_GE_S = ReturnType<typeof ft_I64_GE_S>;
function ft_I64_GE_U(i: WasmInstr) { if (i.opcode === OP.I64_GE_U) return i; throw null; }
export type I64_GE_U = ReturnType<typeof ft_I64_GE_U>;
function ft_F32_EQ(i: WasmInstr) { if (i.opcode === OP.F32_EQ) return i; throw null; }
export type F32_EQ = ReturnType<typeof ft_F32_EQ>;
function ft_F32_NE(i: WasmInstr) { if (i.opcode === OP.F32_NE) return i; throw null; }
export type F32_NE = ReturnType<typeof ft_F32_NE>;
function ft_F32_LT(i: WasmInstr) { if (i.opcode === OP.F32_LT) return i; throw null; }
export type F32_LT = ReturnType<typeof ft_F32_LT>;
function ft_F32_GT(i: WasmInstr) { if (i.opcode === OP.F32_GT) return i; throw null; }
export type F32_GT = ReturnType<typeof ft_F32_GT>;
function ft_F32_LE(i: WasmInstr) { if (i.opcode === OP.F32_LE) return i; throw null; }
export type F32_LE = ReturnType<typeof ft_F32_LE>;
function ft_F32_GE(i: WasmInstr) { if (i.opcode === OP.F32_GE) return i; throw null; }
export type F32_GE = ReturnType<typeof ft_F32_GE>;
function ft_F64_EQ(i: WasmInstr) { if (i.opcode === OP.F64_EQ) return i; throw null; }
export type F64_EQ = ReturnType<typeof ft_F64_EQ>;
function ft_F64_NE(i: WasmInstr) { if (i.opcode === OP.F64_NE) return i; throw null; }
export type F64_NE = ReturnType<typeof ft_F64_NE>;
function ft_F64_LT(i: WasmInstr) { if (i.opcode === OP.F64_LT) return i; throw null; }
export type F64_LT = ReturnType<typeof ft_F64_LT>;
function ft_F64_GT(i: WasmInstr) { if (i.opcode === OP.F64_GT) return i; throw null; }
export type F64_GT = ReturnType<typeof ft_F64_GT>;
function ft_F64_LE(i: WasmInstr) { if (i.opcode === OP.F64_LE) return i; throw null; }
export type F64_LE = ReturnType<typeof ft_F64_LE>;
function ft_F64_GE(i: WasmInstr) { if (i.opcode === OP.F64_GE) return i; throw null; }
export type F64_GE = ReturnType<typeof ft_F64_GE>;
function ft_I32_CLZ(i: WasmInstr) { if (i.opcode === OP.I32_CLZ) return i; throw null; }
export type I32_CLZ = ReturnType<typeof ft_I32_CLZ>;
function ft_I32_CTZ(i: WasmInstr) { if (i.opcode === OP.I32_CTZ) return i; throw null; }
export type I32_CTZ = ReturnType<typeof ft_I32_CTZ>;
function ft_I32_POPCNT(i: WasmInstr) { if (i.opcode === OP.I32_POPCNT) return i; throw null; }
export type I32_POPCNT = ReturnType<typeof ft_I32_POPCNT>;
function ft_I32_ADD(i: WasmInstr) { if (i.opcode === OP.I32_ADD) return i; throw null; }
export type I32_ADD = ReturnType<typeof ft_I32_ADD>;
function ft_I32_SUB(i: WasmInstr) { if (i.opcode === OP.I32_SUB) return i; throw null; }
export type I32_SUB = ReturnType<typeof ft_I32_SUB>;
function ft_I32_MUL(i: WasmInstr) { if (i.opcode === OP.I32_MUL) return i; throw null; }
export type I32_MUL = ReturnType<typeof ft_I32_MUL>;
function ft_I32_DIV_S(i: WasmInstr) { if (i.opcode === OP.I32_DIV_S) return i; throw null; }
export type I32_DIV_S = ReturnType<typeof ft_I32_DIV_S>;
function ft_I32_DIV_U(i: WasmInstr) { if (i.opcode === OP.I32_DIV_U) return i; throw null; }
export type I32_DIV_U = ReturnType<typeof ft_I32_DIV_U>;
function ft_I32_REM_S(i: WasmInstr) { if (i.opcode === OP.I32_REM_S) return i; throw null; }
export type I32_REM_S = ReturnType<typeof ft_I32_REM_S>;
function ft_I32_REM_U(i: WasmInstr) { if (i.opcode === OP.I32_REM_U) return i; throw null; }
export type I32_REM_U = ReturnType<typeof ft_I32_REM_U>;
function ft_I32_AND(i: WasmInstr) { if (i.opcode === OP.I32_AND) return i; throw null; }
export type I32_AND = ReturnType<typeof ft_I32_AND>;
function ft_I32_OR(i: WasmInstr) { if (i.opcode === OP.I32_OR) return i; throw null; }
export type I32_OR = ReturnType<typeof ft_I32_OR>;
function ft_I32_XOR(i: WasmInstr) { if (i.opcode === OP.I32_XOR) return i; throw null; }
export type I32_XOR = ReturnType<typeof ft_I32_XOR>;
function ft_I32_SHL(i: WasmInstr) { if (i.opcode === OP.I32_SHL) return i; throw null; }
export type I32_SHL = ReturnType<typeof ft_I32_SHL>;
function ft_I32_SHR_S(i: WasmInstr) { if (i.opcode === OP.I32_SHR_S) return i; throw null; }
export type I32_SHR_S = ReturnType<typeof ft_I32_SHR_S>;
function ft_I32_SHR_U(i: WasmInstr) { if (i.opcode === OP.I32_SHR_U) return i; throw null; }
export type I32_SHR_U = ReturnType<typeof ft_I32_SHR_U>;
function ft_I32_ROTL(i: WasmInstr) { if (i.opcode === OP.I32_ROTL) return i; throw null; }
export type I32_ROTL = ReturnType<typeof ft_I32_ROTL>;
function ft_I32_ROTR(i: WasmInstr) { if (i.opcode === OP.I32_ROTR) return i; throw null; }
export type I32_ROTR = ReturnType<typeof ft_I32_ROTR>;
function ft_I64_CLZ(i: WasmInstr) { if (i.opcode === OP.I64_CLZ) return i; throw null; }
export type I64_CLZ = ReturnType<typeof ft_I64_CLZ>;
function ft_I64_CTZ(i: WasmInstr) { if (i.opcode === OP.I64_CTZ) return i; throw null; }
export type I64_CTZ = ReturnType<typeof ft_I64_CTZ>;
function ft_I64_POPCNT(i: WasmInstr) { if (i.opcode === OP.I64_POPCNT) return i; throw null; }
export type I64_POPCNT = ReturnType<typeof ft_I64_POPCNT>;
function ft_I64_ADD(i: WasmInstr) { if (i.opcode === OP.I64_ADD) return i; throw null; }
export type I64_ADD = ReturnType<typeof ft_I64_ADD>;
function ft_I64_SUB(i: WasmInstr) { if (i.opcode === OP.I64_SUB) return i; throw null; }
export type I64_SUB = ReturnType<typeof ft_I64_SUB>;
function ft_I64_MUL(i: WasmInstr) { if (i.opcode === OP.I64_MUL) return i; throw null; }
export type I64_MUL = ReturnType<typeof ft_I64_MUL>;
function ft_I64_DIV_S(i: WasmInstr) { if (i.opcode === OP.I64_DIV_S) return i; throw null; }
export type I64_DIV_S = ReturnType<typeof ft_I64_DIV_S>;
function ft_I64_DIV_U(i: WasmInstr) { if (i.opcode === OP.I64_DIV_U) return i; throw null; }
export type I64_DIV_U = ReturnType<typeof ft_I64_DIV_U>;
function ft_I64_REM_S(i: WasmInstr) { if (i.opcode === OP.I64_REM_S) return i; throw null; }
export type I64_REM_S = ReturnType<typeof ft_I64_REM_S>;
function ft_I64_REM_U(i: WasmInstr) { if (i.opcode === OP.I64_REM_U) return i; throw null; }
export type I64_REM_U = ReturnType<typeof ft_I64_REM_U>;
function ft_I64_AND(i: WasmInstr) { if (i.opcode === OP.I64_AND) return i; throw null; }
export type I64_AND = ReturnType<typeof ft_I64_AND>;
function ft_I64_OR(i: WasmInstr) { if (i.opcode === OP.I64_OR) return i; throw null; }
export type I64_OR = ReturnType<typeof ft_I64_OR>;
function ft_I64_XOR(i: WasmInstr) { if (i.opcode === OP.I64_XOR) return i; throw null; }
export type I64_XOR = ReturnType<typeof ft_I64_XOR>;
function ft_I64_SHL(i: WasmInstr) { if (i.opcode === OP.I64_SHL) return i; throw null; }
export type I64_SHL = ReturnType<typeof ft_I64_SHL>;
function ft_I64_SHR_S(i: WasmInstr) { if (i.opcode === OP.I64_SHR_S) return i; throw null; }
export type I64_SHR_S = ReturnType<typeof ft_I64_SHR_S>;
function ft_I64_SHR_U(i: WasmInstr) { if (i.opcode === OP.I64_SHR_U) return i; throw null; }
export type I64_SHR_U = ReturnType<typeof ft_I64_SHR_U>;
function ft_I64_ROTL(i: WasmInstr) { if (i.opcode === OP.I64_ROTL) return i; throw null; }
export type I64_ROTL = ReturnType<typeof ft_I64_ROTL>;
function ft_I64_ROTR(i: WasmInstr) { if (i.opcode === OP.I64_ROTR) return i; throw null; }
export type I64_ROTR = ReturnType<typeof ft_I64_ROTR>;
function ft_F32_ABS(i: WasmInstr) { if (i.opcode === OP.F32_ABS) return i; throw null; }
export type F32_ABS = ReturnType<typeof ft_F32_ABS>;
function ft_F32_NEG(i: WasmInstr) { if (i.opcode === OP.F32_NEG) return i; throw null; }
export type F32_NEG = ReturnType<typeof ft_F32_NEG>;
function ft_F32_CEIL(i: WasmInstr) { if (i.opcode === OP.F32_CEIL) return i; throw null; }
export type F32_CEIL = ReturnType<typeof ft_F32_CEIL>;
function ft_F32_FLOOR(i: WasmInstr) { if (i.opcode === OP.F32_FLOOR) return i; throw null; }
export type F32_FLOOR = ReturnType<typeof ft_F32_FLOOR>;
function ft_F32_TRUNC(i: WasmInstr) { if (i.opcode === OP.F32_TRUNC) return i; throw null; }
export type F32_TRUNC = ReturnType<typeof ft_F32_TRUNC>;
function ft_F32_NEAREST(i: WasmInstr) { if (i.opcode === OP.F32_NEAREST) return i; throw null; }
export type F32_NEAREST = ReturnType<typeof ft_F32_NEAREST>;
function ft_F32_SQRT(i: WasmInstr) { if (i.opcode === OP.F32_SQRT) return i; throw null; }
export type F32_SQRT = ReturnType<typeof ft_F32_SQRT>;
function ft_F32_ADD(i: WasmInstr) { if (i.opcode === OP.F32_ADD) return i; throw null; }
export type F32_ADD = ReturnType<typeof ft_F32_ADD>;
function ft_F32_SUB(i: WasmInstr) { if (i.opcode === OP.F32_SUB) return i; throw null; }
export type F32_SUB = ReturnType<typeof ft_F32_SUB>;
function ft_F32_MUL(i: WasmInstr) { if (i.opcode === OP.F32_MUL) return i; throw null; }
export type F32_MUL = ReturnType<typeof ft_F32_MUL>;
function ft_F32_DIV(i: WasmInstr) { if (i.opcode === OP.F32_DIV) return i; throw null; }
export type F32_DIV = ReturnType<typeof ft_F32_DIV>;
function ft_F32_MIN(i: WasmInstr) { if (i.opcode === OP.F32_MIN) return i; throw null; }
export type F32_MIN = ReturnType<typeof ft_F32_MIN>;
function ft_F32_MAX(i: WasmInstr) { if (i.opcode === OP.F32_MAX) return i; throw null; }
export type F32_MAX = ReturnType<typeof ft_F32_MAX>;
function ft_F32_COPYSIGN(i: WasmInstr) { if (i.opcode === OP.F32_COPYSIGN) return i; throw null; }
export type F32_COPYSIGN = ReturnType<typeof ft_F32_COPYSIGN>;
function ft_F64_ABS(i: WasmInstr) { if (i.opcode === OP.F64_ABS) return i; throw null; }
export type F64_ABS = ReturnType<typeof ft_F64_ABS>;
function ft_F64_NEG(i: WasmInstr) { if (i.opcode === OP.F64_NEG) return i; throw null; }
export type F64_NEG = ReturnType<typeof ft_F64_NEG>;
function ft_F64_CEIL(i: WasmInstr) { if (i.opcode === OP.F64_CEIL) return i; throw null; }
export type F64_CEIL = ReturnType<typeof ft_F64_CEIL>;
function ft_F64_FLOOR(i: WasmInstr) { if (i.opcode === OP.F64_FLOOR) return i; throw null; }
export type F64_FLOOR = ReturnType<typeof ft_F64_FLOOR>;
function ft_F64_TRUNC(i: WasmInstr) { if (i.opcode === OP.F64_TRUNC) return i; throw null; }
export type F64_TRUNC = ReturnType<typeof ft_F64_TRUNC>;
function ft_F64_NEAREST(i: WasmInstr) { if (i.opcode === OP.F64_NEAREST) return i; throw null; }
export type F64_NEAREST = ReturnType<typeof ft_F64_NEAREST>;
function ft_F64_SQRT(i: WasmInstr) { if (i.opcode === OP.F64_SQRT) return i; throw null; }
export type F64_SQRT = ReturnType<typeof ft_F64_SQRT>;
function ft_F64_ADD(i: WasmInstr) { if (i.opcode === OP.F64_ADD) return i; throw null; }
export type F64_ADD = ReturnType<typeof ft_F64_ADD>;
function ft_F64_SUB(i: WasmInstr) { if (i.opcode === OP.F64_SUB) return i; throw null; }
export type F64_SUB = ReturnType<typeof ft_F64_SUB>;
function ft_F64_MUL(i: WasmInstr) { if (i.opcode === OP.F64_MUL) return i; throw null; }
export type F64_MUL = ReturnType<typeof ft_F64_MUL>;
function ft_F64_DIV(i: WasmInstr) { if (i.opcode === OP.F64_DIV) return i; throw null; }
export type F64_DIV = ReturnType<typeof ft_F64_DIV>;
function ft_F64_MIN(i: WasmInstr) { if (i.opcode === OP.F64_MIN) return i; throw null; }
export type F64_MIN = ReturnType<typeof ft_F64_MIN>;
function ft_F64_MAX(i: WasmInstr) { if (i.opcode === OP.F64_MAX) return i; throw null; }
export type F64_MAX = ReturnType<typeof ft_F64_MAX>;
function ft_F64_COPYSIGN(i: WasmInstr) { if (i.opcode === OP.F64_COPYSIGN) return i; throw null; }
export type F64_COPYSIGN = ReturnType<typeof ft_F64_COPYSIGN>;
function ft_I32_WRAP_I64(i: WasmInstr) { if (i.opcode === OP.I32_WRAP_I64) return i; throw null; }
export type I32_WRAP_I64 = ReturnType<typeof ft_I32_WRAP_I64>;
function ft_I32_TRUNC_F32_S(i: WasmInstr) { if (i.opcode === OP.I32_TRUNC_F32_S) return i; throw null; }
export type I32_TRUNC_F32_S = ReturnType<typeof ft_I32_TRUNC_F32_S>;
function ft_I32_TRUNC_F32_U(i: WasmInstr) { if (i.opcode === OP.I32_TRUNC_F32_U) return i; throw null; }
export type I32_TRUNC_F32_U = ReturnType<typeof ft_I32_TRUNC_F32_U>;
function ft_I32_TRUNC_F64_S(i: WasmInstr) { if (i.opcode === OP.I32_TRUNC_F64_S) return i; throw null; }
export type I32_TRUNC_F64_S = ReturnType<typeof ft_I32_TRUNC_F64_S>;
function ft_I32_TRUNC_F64_U(i: WasmInstr) { if (i.opcode === OP.I32_TRUNC_F64_U) return i; throw null; }
export type I32_TRUNC_F64_U = ReturnType<typeof ft_I32_TRUNC_F64_U>;
function ft_I64_EXTEND_I32_S(i: WasmInstr) { if (i.opcode === OP.I64_EXTEND_I32_S) return i; throw null; }
export type I64_EXTEND_I32_S = ReturnType<typeof ft_I64_EXTEND_I32_S>;
function ft_I64_EXTEND_I32_U(i: WasmInstr) { if (i.opcode === OP.I64_EXTEND_I32_U) return i; throw null; }
export type I64_EXTEND_I32_U = ReturnType<typeof ft_I64_EXTEND_I32_U>;
function ft_I64_TRUNC_F32_S(i: WasmInstr) { if (i.opcode === OP.I64_TRUNC_F32_S) return i; throw null; }
export type I64_TRUNC_F32_S = ReturnType<typeof ft_I64_TRUNC_F32_S>;
function ft_I64_TRUNC_F32_U(i: WasmInstr) { if (i.opcode === OP.I64_TRUNC_F32_U) return i; throw null; }
export type I64_TRUNC_F32_U = ReturnType<typeof ft_I64_TRUNC_F32_U>;
function ft_I64_TRUNC_F64_S(i: WasmInstr) { if (i.opcode === OP.I64_TRUNC_F64_S) return i; throw null; }
export type I64_TRUNC_F64_S = ReturnType<typeof ft_I64_TRUNC_F64_S>;
function ft_I64_TRUNC_F64_U(i: WasmInstr) { if (i.opcode === OP.I64_TRUNC_F64_U) return i; throw null; }
export type I64_TRUNC_F64_U = ReturnType<typeof ft_I64_TRUNC_F64_U>;
function ft_F32_CONVERT_I32_S(i: WasmInstr) { if (i.opcode === OP.F32_CONVERT_I32_S) return i; throw null; }
export type F32_CONVERT_I32_S = ReturnType<typeof ft_F32_CONVERT_I32_S>;
function ft_F32_CONVERT_I32_U(i: WasmInstr) { if (i.opcode === OP.F32_CONVERT_I32_U) return i; throw null; }
export type F32_CONVERT_I32_U = ReturnType<typeof ft_F32_CONVERT_I32_U>;
function ft_F32_CONVERT_I64_S(i: WasmInstr) { if (i.opcode === OP.F32_CONVERT_I64_S) return i; throw null; }
export type F32_CONVERT_I64_S = ReturnType<typeof ft_F32_CONVERT_I64_S>;
function ft_F32_CONVERT_I64_U(i: WasmInstr) { if (i.opcode === OP.F32_CONVERT_I64_U) return i; throw null; }
export type F32_CONVERT_I64_U = ReturnType<typeof ft_F32_CONVERT_I64_U>;
function ft_F32_DEMOTE_F64(i: WasmInstr) { if (i.opcode === OP.F32_DEMOTE_F64) return i; throw null; }
export type F32_DEMOTE_F64 = ReturnType<typeof ft_F32_DEMOTE_F64>;
function ft_F64_CONVERT_I32_S(i: WasmInstr) { if (i.opcode === OP.F64_CONVERT_I32_S) return i; throw null; }
export type F64_CONVERT_I32_S = ReturnType<typeof ft_F64_CONVERT_I32_S>;
function ft_F64_CONVERT_I32_U(i: WasmInstr) { if (i.opcode === OP.F64_CONVERT_I32_U) return i; throw null; }
export type F64_CONVERT_I32_U = ReturnType<typeof ft_F64_CONVERT_I32_U>;
function ft_F64_CONVERT_I64_S(i: WasmInstr) { if (i.opcode === OP.F64_CONVERT_I64_S) return i; throw null; }
export type F64_CONVERT_I64_S = ReturnType<typeof ft_F64_CONVERT_I64_S>;
function ft_F64_CONVERT_I64_U(i: WasmInstr) { if (i.opcode === OP.F64_CONVERT_I64_U) return i; throw null; }
export type F64_CONVERT_I64_U = ReturnType<typeof ft_F64_CONVERT_I64_U>;
function ft_F64_PROMOTE_F32(i: WasmInstr) { if (i.opcode === OP.F64_PROMOTE_F32) return i; throw null; }
export type F64_PROMOTE_F32 = ReturnType<typeof ft_F64_PROMOTE_F32>;
function ft_I32_REINTERPRET_F32(i: WasmInstr) { if (i.opcode === OP.I32_REINTERPRET_F32) return i; throw null; }
export type I32_REINTERPRET_F32 = ReturnType<typeof ft_I32_REINTERPRET_F32>;
function ft_I64_REINTERPRET_F64(i: WasmInstr) { if (i.opcode === OP.I64_REINTERPRET_F64) return i; throw null; }
export type I64_REINTERPRET_F64 = ReturnType<typeof ft_I64_REINTERPRET_F64>;
function ft_F32_REINTERPRET_I32(i: WasmInstr) { if (i.opcode === OP.F32_REINTERPRET_I32) return i; throw null; }
export type F32_REINTERPRET_I32 = ReturnType<typeof ft_F32_REINTERPRET_I32>;
function ft_F64_REINTERPRET_I64(i: WasmInstr) { if (i.opcode === OP.F64_REINTERPRET_I64) return i; throw null; }
export type F64_REINTERPRET_I64 = ReturnType<typeof ft_F64_REINTERPRET_I64>;
function ft_I32_EXTEND8_S(i: WasmInstr) { if (i.opcode === OP.I32_EXTEND8_S) return i; throw null; }
export type I32_EXTEND8_S = ReturnType<typeof ft_I32_EXTEND8_S>;
function ft_I32_EXTEND16_S(i: WasmInstr) { if (i.opcode === OP.I32_EXTEND16_S) return i; throw null; }
export type I32_EXTEND16_S = ReturnType<typeof ft_I32_EXTEND16_S>;
function ft_I64_EXTEND8_S(i: WasmInstr) { if (i.opcode === OP.I64_EXTEND8_S) return i; throw null; }
export type I64_EXTEND8_S = ReturnType<typeof ft_I64_EXTEND8_S>;
function ft_I64_EXTEND16_S(i: WasmInstr) { if (i.opcode === OP.I64_EXTEND16_S) return i; throw null; }
export type I64_EXTEND16_S = ReturnType<typeof ft_I64_EXTEND16_S>;
function ft_I64_EXTEND32_S(i: WasmInstr) { if (i.opcode === OP.I64_EXTEND32_S) return i; throw null; }
export type I64_EXTEND32_S = ReturnType<typeof ft_I64_EXTEND32_S>;
function ft_REF_NULL(i: WasmInstr) { if (i.opcode === OP.REF_NULL) return i; throw null; }
export type REF_NULL = ReturnType<typeof ft_REF_NULL>;
function ft_REF_IS_NULL(i: WasmInstr) { if (i.opcode === OP.REF_IS_NULL) return i; throw null; }
export type REF_IS_NULL = ReturnType<typeof ft_REF_IS_NULL>;
function ft_REF_FUNC(i: WasmInstr) { if (i.opcode === OP.REF_FUNC) return i; throw null; }
export type REF_FUNC = ReturnType<typeof ft_REF_FUNC>;
function ft_I32_TRUNC_SAT_F32_S(i: WasmInstr) { if (i.opcode === OP.I32_TRUNC_SAT_F32_S) return i; throw null; }
export type I32_TRUNC_SAT_F32_S = ReturnType<typeof ft_I32_TRUNC_SAT_F32_S>;
function ft_I32_TRUNC_SAT_F32_U(i: WasmInstr) { if (i.opcode === OP.I32_TRUNC_SAT_F32_U) return i; throw null; }
export type I32_TRUNC_SAT_F32_U = ReturnType<typeof ft_I32_TRUNC_SAT_F32_U>;
function ft_I32_TRUNC_SAT_F64_S(i: WasmInstr) { if (i.opcode === OP.I32_TRUNC_SAT_F64_S) return i; throw null; }
export type I32_TRUNC_SAT_F64_S = ReturnType<typeof ft_I32_TRUNC_SAT_F64_S>;
function ft_I32_TRUNC_SAT_F64_U(i: WasmInstr) { if (i.opcode === OP.I32_TRUNC_SAT_F64_U) return i; throw null; }
export type I32_TRUNC_SAT_F64_U = ReturnType<typeof ft_I32_TRUNC_SAT_F64_U>;
function ft_I64_TRUNC_SAT_F32_S(i: WasmInstr) { if (i.opcode === OP.I64_TRUNC_SAT_F32_S) return i; throw null; }
export type I64_TRUNC_SAT_F32_S = ReturnType<typeof ft_I64_TRUNC_SAT_F32_S>;
function ft_I64_TRUNC_SAT_F32_U(i: WasmInstr) { if (i.opcode === OP.I64_TRUNC_SAT_F32_U) return i; throw null; }
export type I64_TRUNC_SAT_F32_U = ReturnType<typeof ft_I64_TRUNC_SAT_F32_U>;
function ft_I64_TRUNC_SAT_F64_S(i: WasmInstr) { if (i.opcode === OP.I64_TRUNC_SAT_F64_S) return i; throw null; }
export type I64_TRUNC_SAT_F64_S = ReturnType<typeof ft_I64_TRUNC_SAT_F64_S>;
function ft_I64_TRUNC_SAT_F64_U(i: WasmInstr) { if (i.opcode === OP.I64_TRUNC_SAT_F64_U) return i; throw null; }
export type I64_TRUNC_SAT_F64_U = ReturnType<typeof ft_I64_TRUNC_SAT_F64_U>;
function ft_MEMORY_INIT(i: WasmInstr) { if (i.opcode === OP.MEMORY_INIT) return i; throw null; }
export type MEMORY_INIT = ReturnType<typeof ft_MEMORY_INIT>;
function ft_DATA_DROP(i: WasmInstr) { if (i.opcode === OP.DATA_DROP) return i; throw null; }
export type DATA_DROP = ReturnType<typeof ft_DATA_DROP>;
function ft_MEMORY_COPY(i: WasmInstr) { if (i.opcode === OP.MEMORY_COPY) return i; throw null; }
export type MEMORY_COPY = ReturnType<typeof ft_MEMORY_COPY>;
function ft_MEMORY_FILL(i: WasmInstr) { if (i.opcode === OP.MEMORY_FILL) return i; throw null; }
export type MEMORY_FILL = ReturnType<typeof ft_MEMORY_FILL>;
function ft_TABLE_INIT(i: WasmInstr) { if (i.opcode === OP.TABLE_INIT) return i; throw null; }
export type TABLE_INIT = ReturnType<typeof ft_TABLE_INIT>;
function ft_ELEM_DROP(i: WasmInstr) { if (i.opcode === OP.ELEM_DROP) return i; throw null; }
export type ELEM_DROP = ReturnType<typeof ft_ELEM_DROP>;
function ft_TABLE_COPY(i: WasmInstr) { if (i.opcode === OP.TABLE_COPY) return i; throw null; }
export type TABLE_COPY = ReturnType<typeof ft_TABLE_COPY>;
function ft_TABLE_GROW(i: WasmInstr) { if (i.opcode === OP.TABLE_GROW) return i; throw null; }
export type TABLE_GROW = ReturnType<typeof ft_TABLE_GROW>;
function ft_TABLE_SIZE(i: WasmInstr) { if (i.opcode === OP.TABLE_SIZE) return i; throw null; }
export type TABLE_SIZE = ReturnType<typeof ft_TABLE_SIZE>;
function ft_TABLE_FILL(i: WasmInstr) { if (i.opcode === OP.TABLE_FILL) return i; throw null; }
export type TABLE_FILL = ReturnType<typeof ft_TABLE_FILL>;
function ft_TRIVM_MULTIBYTE_FIRST(i: WasmInstr) { if (i.opcode === OP.TRIVM_MULTIBYTE_FIRST) return i; throw null; }
export type TRIVM_MULTIBYTE_FIRST = ReturnType<typeof ft_TRIVM_MULTIBYTE_FIRST>;
function ft_TRIVM_FUNCTION(i: WasmInstr) { if (i.opcode === OP.TRIVM_FUNCTION) return i; throw null; }
export type TRIVM_FUNCTION = ReturnType<typeof ft_TRIVM_FUNCTION>;
function ft_TRIVM_POP(i: WasmInstr) { if (i.opcode === OP.TRIVM_POP) return i; throw null; }
export type TRIVM_POP = ReturnType<typeof ft_TRIVM_POP>;
function ft_TRIVM_DUP32(i: WasmInstr) { if (i.opcode === OP.TRIVM_DUP32) return i; throw null; }
export type TRIVM_DUP32 = ReturnType<typeof ft_TRIVM_DUP32>;
function ft_TRIVM_LOCAL_GET32(i: WasmInstr) { if (i.opcode === OP.TRIVM_LOCAL_GET32) return i; throw null; }
export type TRIVM_LOCAL_GET32 = ReturnType<typeof ft_TRIVM_LOCAL_GET32>;
function ft_TRIVM_LOCAL_GET64(i: WasmInstr) { if (i.opcode === OP.TRIVM_LOCAL_GET64) return i; throw null; }
export type TRIVM_LOCAL_GET64 = ReturnType<typeof ft_TRIVM_LOCAL_GET64>;
function ft_TRIVM_LOCAL_SET32(i: WasmInstr) { if (i.opcode === OP.TRIVM_LOCAL_SET32) return i; throw null; }
export type TRIVM_LOCAL_SET32 = ReturnType<typeof ft_TRIVM_LOCAL_SET32>;
function ft_TRIVM_LOCAL_SET64(i: WasmInstr) { if (i.opcode === OP.TRIVM_LOCAL_SET64) return i; throw null; }
export type TRIVM_LOCAL_SET64 = ReturnType<typeof ft_TRIVM_LOCAL_SET64>;
function ft_TRIVM_GLOBAL_GET32(i: WasmInstr) { if (i.opcode === OP.TRIVM_GLOBAL_GET32) return i; throw null; }
export type TRIVM_GLOBAL_GET32 = ReturnType<typeof ft_TRIVM_GLOBAL_GET32>;
function ft_TRIVM_GLOBAL_GET64(i: WasmInstr) { if (i.opcode === OP.TRIVM_GLOBAL_GET64) return i; throw null; }
export type TRIVM_GLOBAL_GET64 = ReturnType<typeof ft_TRIVM_GLOBAL_GET64>;
function ft_TRIVM_GLOBAL_SET32(i: WasmInstr) { if (i.opcode === OP.TRIVM_GLOBAL_SET32) return i; throw null; }
export type TRIVM_GLOBAL_SET32 = ReturnType<typeof ft_TRIVM_GLOBAL_SET32>;
function ft_TRIVM_GLOBAL_SET64(i: WasmInstr) { if (i.opcode === OP.TRIVM_GLOBAL_SET64) return i; throw null; }
export type TRIVM_GLOBAL_SET64 = ReturnType<typeof ft_TRIVM_GLOBAL_SET64>;
function ft_TRIVM_RAW(i: WasmInstr) { if (i.opcode === OP.TRIVM_RAW) return i; throw null; }
export type TRIVM_RAW = ReturnType<typeof ft_TRIVM_RAW>;
function ft_TRIVM_SHL_CONST(i: WasmInstr) { if (i.opcode === OP.TRIVM_SHL_CONST) return i; throw null; }
export type TRIVM_SHL_CONST = ReturnType<typeof ft_TRIVM_SHL_CONST>;
function ft_TRIVM_USHR_CONST(i: WasmInstr) { if (i.opcode === OP.TRIVM_USHR_CONST) return i; throw null; }
export type TRIVM_USHR_CONST = ReturnType<typeof ft_TRIVM_USHR_CONST>;
function ft_TRIVM_SSHR_CONST(i: WasmInstr) { if (i.opcode === OP.TRIVM_SSHR_CONST) return i; throw null; }
export type TRIVM_SSHR_CONST = ReturnType<typeof ft_TRIVM_SSHR_CONST>;
function ft_TRIVM_EXTS_CONST(i: WasmInstr) { if (i.opcode === OP.TRIVM_EXTS_CONST) return i; throw null; }
export type TRIVM_EXTS_CONST = ReturnType<typeof ft_TRIVM_EXTS_CONST>;
function ft_TRIVM_EXTS64_CONST(i: WasmInstr) { if (i.opcode === OP.TRIVM_EXTS64_CONST) return i; throw null; }
export type TRIVM_EXTS64_CONST = ReturnType<typeof ft_TRIVM_EXTS64_CONST>;
/* eslint-enable max-len */

// ---- Instruction types - end - generated with help of script ----
