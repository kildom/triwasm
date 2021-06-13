#ifndef _IR_DATA_HH_
#define _IR_DATA_HH_

#include "common.hh"

DOLLAR_STRUCT(WasmGlobal);

DOLLAR_STRUCT(IRInstr);

enum IRInstrCode {
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
    IR_NOT,
    IR_NEG,
    IR_CALL,
    // CORE - memory
    IR_READ_LOCAL,
    IR_WRITE_LOCAL,
    IR_READ_GLOBAL,
    IR_WRITE_GLOBAL,
    IR_READ_GLOBAL_HI,
    IR_WRITE_GLOBAL_HI,
    IR_READ_SP,
    // 64-bit extension
    IR_ADDQ,
    IR_SUBQ,
    IR_MULQ,
    IR_ANDQ,
    IR_ORQ,
    IR_UDIVQ,
    IR_SDIVQ,
    IR_UMODQ,
    IR_SMODQ,
    IR_XORQ,
    IR_USHLQ,
    IR_SSHLQ,
    IR_EQQ,
    IR_ULTQ,
    IR_SLTQ,
    IR_NEGQ,
    // 64-bit extension - memory
    IR_READQ_LOCAL, // 2 instructions: READ [SP] + offset ; READQ
    IR_WRITEQ_LOCAL,// 2 instructions: WRITE [SP] + offset ; WRITEQ
    IR_READQ_GLOBAL, // 2 instructions: READ offset ; READQ
    IR_WRITEQ_GLOBAL,// 2 instructions: WRITE offset ; WRITEQ
    // REDUCE extension
    IR_REDUCE,
};

struct IRInstr {
    IRInstrCode code;
    u32 offset;
    u64 value;
    WasmGlobal$ global;
};


#endif /* _IR_DATA_HH_ */
