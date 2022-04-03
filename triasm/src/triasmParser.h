
#ifdef __cplusplus
extern "C" {
#endif

/* BEGIN LEMON TOKENS */
#define LEMON_QUESTION                         1
#define LEMON_BIT_OR                           2
#define LEMON_BIT_AND                          3
#define LEMON_MUL                              4
#define LEMON_DIV                              5
#define LEMON_MOD                              6
#define LEMON_PLUS                             7
#define LEMON_MINUS                            8
#define LEMON_EOL                              9
#define LEMON_COLON                           10
#define LEMON_ASSIGN                          11
#define LEMON_STRING                          12
#define LEMON_COMMA                           13
#define LEMON_IDENTIFIER                      14
#define LEMON_INSTRUCTION                     15
#define LEMON_DIRECTIVE                       16
#define LEMON_BASE                            17
#define LEMON_NUMBER                          18
#define LEMON_SOPEN                           19
#define LEMON_SCLOSE                          20
#define LEMON_OPEN                            21
#define LEMON_CLOSE                           22
/* END LEMON TOKENS */

typedef struct Lemon_tag Lemon;
typedef struct LemonToken_tag LemonToken;
typedef struct LemonProg_tag LemonProg;
typedef struct LemonCommand_tag LemonCommand;
typedef struct LemonArgs_tag LemonArgs;
typedef struct LemonExpr_tag LemonExpr;

void *LemonParseAlloc(void* (*mallocCallback)(size_t));
void LemonParseFree(void *parser, void (*freeCallback)(void*));
void LemonParse(void *parser, int tokenCode, LemonToken* tokenValue, Lemon* lemonState);

#ifdef __cplusplus
}
#endif
