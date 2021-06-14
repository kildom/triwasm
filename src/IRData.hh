#ifndef _IR_DATA_HH_
#define _IR_DATA_HH_

#include "common.hh"

DOLLAR_STRUCT(WasmGlobal);

DOLLAR_STRUCT(IRInstr);

enum IRInstrCode {
    IR_EMPTY = 0,
    // CORE
    IR_BRT,
    IR_BRF,
    IR_BR,
    IR_ADD,
    IR_SUB,
    IR_MUL,
    IR_AND,
    IR_OR,
    IR_UDIV,
    IR_SDIV,
    IR_UMOD,
    IR_SMOD,
    IR_XOR,
    IR_USHL,
    IR_SSHL,
    IR_EQ,
    IR_ULT,
    IR_SLT,
    IR_UGT,
    IR_SGT,
    IR_NOT,
    IR_NEG,
    IR_CALL,
    IR_CLZ,
    IR_CTZ,
    IR_ONES,
    IR_SHL,
    IR_SSHR,
    IR_USHR,
    IR_ROTL,
    IR_ROTR,
    // CORE - memory
    IR_READ_LOCAL,
    IR_WRITE_LOCAL,
    IR_READ_GLOBAL,
    IR_WRITE_GLOBAL,
    IR_READ_GLOBAL_HI,
    IR_WRITE_GLOBAL_HI,
    IR_READ_SP,
    // 64-bit extension
    IR_Q_SGT,
    IR_Q_UGT,
    IR_Q_SGT,
    IR_Q_UGT,
    IR_Q_EQZ,
    IR_Q_ADD,
    IR_Q_SUB,
    IR_Q_MUL,
    IR_Q_AND,
    IR_Q_OR,
    IR_UDIVQ,
    IR_SDIVQ,
    IR_UMODQ,
    IR_SMODQ,
    IR_Q_XOR,
    IR_USHLQ,
    IR_SSHLQ,
    IR_Q_EQ,
    IR_Q_ULT,
    IR_Q_SLT,
    IR_Q_NEG,
    // 64-bit extension - memory
    IR_READQ_LOCAL, // 2 instructions: READ [SP] + offset ; READQ
    IR_WRITEQ_LOCAL,// 2 instructions: WRITE [SP] + offset ; WRITEQ
    IR_READQ_GLOBAL, // 2 instructions: READ offset ; READQ
    IR_WRITEQ_GLOBAL,// 2 instructions: WRITE offset ; WRITEQ
    // REDUCE extension
    IR_REDUCE,
    // 32-bit floating point extension
    IR_F_EQ,
    IR_F_NE,
    IR_F_LT,
    IR_F_GT,
    IR_F_LE,
    IR_F_GE,
    // 64-bit floating point extension
    IR_D_EQ,
    IR_D_NE,
    IR_D_LT,
    IR_D_GT,
    IR_D_LE,
    IR_D_GE,
};

struct IRInstr {
    IRInstrCode code;
    u32 offset;
    u64 value;
    WasmGlobal$ global;
};


#endif /* _IR_DATA_HH_ */
