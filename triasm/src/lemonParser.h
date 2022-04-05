#ifndef _LEMON_PARSER_H_
#define _LEMON_PARSER_H_

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define LEMON_EOF                              0
/* BEGIN LEMON TOKENS */
#define LEMON_EOL                              1
#define LEMON_INSTRUCTION                      2
#define LEMON_PRAGMA                           3
#define LEMON_STRING                           4
#define LEMON_COLON                            5
#define LEMON_ASSIGN                           6
#define LEMON_COMMA                            7
#define LEMON_IDENTIFIER                       8
#define LEMON_BASE                             9
#define LEMON_QUESTION                        10
#define LEMON_OR                              11
#define LEMON_AND                             12
#define LEMON_BIT_OR                          13
#define LEMON_BIT_XOR                         14
#define LEMON_BIT_AND                         15
#define LEMON_EQ                              16
#define LEMON_NE                              17
#define LEMON_LT                              18
#define LEMON_GT                              19
#define LEMON_LE                              20
#define LEMON_GE                              21
#define LEMON_SHL                             22
#define LEMON_SHR                             23
#define LEMON_PLUS                            24
#define LEMON_MINUS                           25
#define LEMON_MUL                             26
#define LEMON_DIV                             27
#define LEMON_MOD                             28
#define LEMON_NOT                             29
#define LEMON_BIT_NOT                         30
#define LEMON_OPEN                            31
#define LEMON_CLOSE                           32
#define LEMON_DECIMAL                         33
#define LEMON_HEX                             34
#define LEMON_OCT                             35
#define LEMON_SOPEN                           36
#define LEMON_SCLOSE                          37
/* END LEMON TOKENS */

typedef struct TriASMParser Lemon;
typedef struct LemonCommand LemonCommand;
typedef struct LemonExpr LemonExpr;

typedef struct LemonToken_tag {
    const char* value;
    int32_t length;
    int32_t line;
} LemonToken;

typedef struct LemonProg_tag {
    LemonCommand* first;
    LemonCommand* last;
} LemonProg;

typedef struct LemonArgs_tag {
    LemonExpr* first;
    LemonExpr* last;
} LemonArgs;

void *LemonParseAlloc(void* (*mallocCallback)(size_t), Lemon* th);
void LemonParseFree(void *parser, void (*freeCallback)(void*));
void LemonParse(void *parser, int tokenCode, LemonToken tokenValue);

void lemonProgFree(LemonProg* prog);
void lemonCommandFree(LemonCommand* command);
void lemonArgsFree(LemonArgs* args);
void lemonExprFree(LemonExpr* expr);

void lemonFailure(Lemon* th);
void lemonError(Lemon* th);
void lemonStackOverflow(Lemon* th);

void lemonResult(Lemon* th, LemonProg* prog);
LemonProg lemonProgAppend(LemonProg* prog, LemonCommand* command);
LemonProg lemonProgCreate();

LemonCommand* lemonInstrCreate(LemonToken* name, LemonArgs* args);
LemonCommand* lemonPragmaCreate(LemonToken* value);
LemonCommand* lemonLabelCreate(LemonToken* name);
LemonCommand* lemonAssignCreate(LemonToken* name, LemonExpr* expr);

LemonArgs lemonArgsAppend(LemonArgs* args, LemonExpr* expr);
LemonArgs lemonArgsCreate(LemonExpr* expr);

LemonExpr* lemonExprTernary(LemonExpr* cond, LemonExpr* ifTrue, LemonExpr* ifFalse);
LemonExpr* lemonExprBinOp(char op, LemonExpr* a, LemonExpr* b);
LemonExpr* lemonExprUnOp(char op, LemonExpr* a);
LemonExpr* lemonExprCall(LemonToken* name, LemonArgs* args);
LemonExpr* lemonExprNumber(LemonToken* value, int base);
LemonExpr* lemonExprIdentifier(LemonToken* name);
LemonExpr* lemonExprBase(LemonToken* name);

#ifdef __cplusplus
}
#endif

#endif // _LEMON_PARSER_H_
