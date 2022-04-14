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

typedef struct LemonToken_s {
    int from;
    int to;
    int line;
} LemonToken;

void *LemonParseAlloc(void* (*mallocCallback)(size_t), void* th);
void LemonParseFree(void *parser, void (*freeCallback)(void*));
void LemonParse(void *parser, int tokenCode, LemonToken tokenValue);

void lemonFailure(void* th);
void lemonError(void* th);
void lemonStackOverflow(void* th);

void lemonResultVerify(void* th, int counter);

int lemonInstr(void* th, LemonToken* name, int args);
int lemonPragma(void* th, LemonToken* value);
int lemonLabel(void* th, LemonToken* name);
int lemonAssign(void* th, LemonToken* name, int expr);

void lemonArgsFree(void* th, int args);
int lemonArgsAppend(void* th, int args, int expr);
int lemonArgsCreate(void* th);

void lemonExprFree(void* th, int expr);
int lemonExprTernary(void* th, int cond, int ifTrue, int ifFalse);
int lemonExprBinOp(void* th, char op, int a, int b);
int lemonExprUnOp(void* th, char op, int a);
int lemonExprCall(void* th, LemonToken* name, int args);
int lemonExprNumber(void* th, LemonToken* value, int base);
int lemonExprIdentifier(void* th, LemonToken* name);
int lemonExprBase(void* th, LemonToken* name);

#ifdef __cplusplus
}
#endif

#endif // _LEMON_PARSER_H_
