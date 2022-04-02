/*

The author disclaims copyright to this source code.

*/

#ifdef __cplusplus
extern "C" {
#endif

#include "lemonParser.h"

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
