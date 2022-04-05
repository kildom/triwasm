
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define LEMON_EOF                              0
/* BEGIN LEMON TOKENS */
#define LEMON_EOL                              1
#define LEMON_INSTRUCTION                      2
#define LEMON_COLON                            3
#define LEMON_ASSIGN                           4
#define LEMON_STRING                           5
#define LEMON_COMMA                            6
#define LEMON_IDENTIFIER                       7
#define LEMON_BASE                             8
#define LEMON_QUESTION                         9
#define LEMON_OR                              10
#define LEMON_AND                             11
#define LEMON_BIT_OR                          12
#define LEMON_BIT_XOR                         13
#define LEMON_BIT_AND                         14
#define LEMON_EQ                              15
#define LEMON_NE                              16
#define LEMON_LT                              17
#define LEMON_GT                              18
#define LEMON_LE                              19
#define LEMON_GE                              20
#define LEMON_SHL                             21
#define LEMON_SHR                             22
#define LEMON_PLUS                            23
#define LEMON_MINUS                           24
#define LEMON_MUL                             25
#define LEMON_DIV                             26
#define LEMON_MOD                             27
#define LEMON_NOT                             28
#define LEMON_BIT_NOT                         29
#define LEMON_OPEN                            30
#define LEMON_CLOSE                           31
#define LEMON_DECIMAL                         32
#define LEMON_HEX                             33
#define LEMON_OCT                             34
#define LEMON_SOPEN                           35
#define LEMON_SCLOSE                          36
/* END LEMON TOKENS */

typedef struct TriASMParser Lemon;
typedef struct LemonProg LemonProg;
typedef struct LemonCommand LemonCommand;
typedef struct LemonArgs LemonArgs;
typedef struct LemonExpr LemonExpr;

void *LemonParseAlloc(void* (*mallocCallback)(size_t), Lemon* th);
void LemonParseFree(void *parser, void (*freeCallback)(void*));
void LemonParse(void *parser, int tokenCode, const char* tokenValue);

void lemonTokenFree(Lemon* th, const char* token);
void lemonProgFree(Lemon* th, LemonProg* prog);
void lemonCommandFree(Lemon* th, LemonCommand* command);
void lemonArgsFree(Lemon* th, LemonArgs* args);
void lemonExprFree(Lemon* th, LemonExpr* expr);

void lemonFailure(Lemon* th);
void lemonError(Lemon* th);
void lemonStackOverflow(Lemon* th);

void lemonResult(Lemon* th, LemonProg* prog);
LemonProg* lemonProgAppend(Lemon* th, LemonProg* prog, LemonCommand* command);

LemonCommand* lemonInstrCreate(Lemon* th, const char* name, LemonArgs* args, const char* stringLiteral);
LemonCommand* lemonLabelCreate(Lemon* th, const char* name);
LemonCommand* lemonAssignCreate(Lemon* th, const char* name, LemonExpr* expr);

const char* lemonStringAppend(Lemon* th, const char* string, const char* append);
LemonArgs* lemonArgsAppend(Lemon* th, LemonArgs* args, LemonExpr* expr);

LemonExpr* lemonExprTernary(Lemon* th, LemonExpr* cond, LemonExpr* ifTrue, LemonExpr* ifFalse);
LemonExpr* lemonExprBinOp(Lemon* th, char op, LemonExpr* a, LemonExpr* b);
LemonExpr* lemonExprUnOp(Lemon* th, char op, LemonExpr* a);
LemonExpr* lemonExprCall(Lemon* th, const char* name, LemonArgs* args);
LemonExpr* lemonExprNumber(Lemon* th, const char* value, int base);
LemonExpr* lemonExprIdentifier(Lemon* th, const char* name);
LemonExpr* lemonExprBase(Lemon* th, const char* name);

#ifdef __cplusplus
}
#endif
