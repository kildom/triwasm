
#ifndef INSTR
#define INSTR(...)
#endif
#ifndef INSTR_LAST
#define INSTR_LAST(...) INSTR(__VA_ARGS__)
#endif
INSTR(ADD)
INSTR(SUB)
INSTR(MUL)
INSTR(DIV)
INSTR(MOD)
INSTR(READ8)
INSTR(READ8S)
INSTR(READ16)
INSTR(READ16S)
INSTR(READ32)
INSTR(READ64)
INSTR(WRITE8)
INSTR(WRITE16)
INSTR(WRITE32)
INSTR_LAST(WRITE64)
#undef INSTR
#undef INSTR_LAST

#ifndef DIR
#define DIR(...)
#endif
#ifndef DIR_LAST
#define DIR_LAST(...) DIR(__VA_ARGS__)
#endif
DIR(DATA8)
DIR(DATA16)
DIR(DATA32)
DIR(DATA64)
DIR(ANNOTATION)
DIR(BEGIN)
DIR_LAST(END)
#undef DIR
#undef DIR_LAST

#ifndef EXPR_OP
#define EXPR_OP(...)
#endif
#ifndef EXPR_OP_LAST
#define EXPR_OP_LAST(...) EXPR_OP(__VA_ARGS__)
#endif
EXPR_OP(OR,      'O')
EXPR_OP(AND,     'A')
EXPR_OP(BIT_OR,  '|')
EXPR_OP(BIT_XOR, '^')
EXPR_OP(BIT_AND, '&')
EXPR_OP(EQ,      'E')
EXPR_OP(NE,      'N')
EXPR_OP(LT,      '<')
EXPR_OP(GT,      '>')
EXPR_OP(LE,      'L')
EXPR_OP(GE,      'G')
EXPR_OP(SHL,     'r')
EXPR_OP(SHR,     'l')
EXPR_OP(PLUS,    '+')
EXPR_OP(SUB,     '-')
EXPR_OP(MINUS,   'M')
EXPR_OP(MUL,     '*')
EXPR_OP(DIV,     '/')
EXPR_OP(NOT,     '!')
EXPR_OP(NEG,     '~')
EXPR_OP_LAST(MOD,'%')
#undef EXPR_OP
#undef EXPR_OP_LAST
