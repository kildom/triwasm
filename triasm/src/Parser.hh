#ifndef _TRIASM_PARSER_HH_
#define _TRIASM_PARSER_HH_

#include "string"

#include "dollar.hh"
#include "array.hh"
#include "string.hh"

namespace triasm {

enum class BaseType {
    ZERO = 0,
    SP = 1,
    AMB0 = 2,
    AMB1 = 3,
    REG_MASK = 3,
    POP = 4,
};

DEFINE_ENUM_FLAGS(BaseType);

enum class ExprType {
    UNINITIALIZED,
    CALL,
    IDENTIFIER,
    NUMBER,
    BASE,
    TERNARY,
    #define TABLE_EXPR_OP(name, symbol) OP_##name,
    #include "tables.inc"
};

enum class CommandType {
    ASSIGN,
    LABEL,
    PRAGMA,
    #define TABLE_INSTR(name) name,
    #define TABLE_DIR(name) _##name,
    #include "tables.inc"
};

DOLLAR_STRUCT(LemonExpr);
DOLLAR_STRUCT(LemonCommand);
DOLLAR_STRUCT(Parser);

struct LemonExpr {
    ExprType type;
    Array$$<LemonExpr$> args;
    String$$ string;
    union
    {
        BaseType baseType;
        uint64_t number;
    };
};

struct LemonCommand {
    CommandType type;
    int line;
    Array$<LemonExpr$> args;
    String$ string;
};



class Parser {
public:

    struct TokenizeMatch
    {
        int priority;
        const char* pattern;
        void (Parser::*callback)(const TokenizeMatch& m, const StringView& token);
        int tokenId;
        int index;
    };

    String$ input;
    ssize inputPosition;
    int line;
    int totalErrors;
    int allowedErrors;
    Array$$<LemonExpr$$> exprCache; // it is growing when more expressions are needed, it is not cleared when new a command is starting
                                    // expr type in lemon is index in this array
    ssize exprCacheUsed; // number of expr used in this command already, it is cleared when new command is starting
                         // validation: check if all used items (and not destructed by lemon) are actually in the command
    Array$$<Array$$<LemonExpr$>> argsCache; // the same as exprCache
    ssize argsCacheUsed;
    Array$$<LemonToken> tokensCache;
    ssize tokensCacheUsed;
    LemonCommand$$ command; // Only a single command is used, adding new command when old is unread should cause FAIL
    bool commandReady;

    int commandCreateCounter;
    int commandVerifyCounter;

    void* parser;

    void init();
public:
    Parser();
    void parse(String$ input);
    LemonCommand$N next();

    void simpleToken(const TokenizeMatch& m, const StringView& token);
    void skipToken(const TokenizeMatch& m, const StringView& token);
    void twoCharsToken(const TokenizeMatch& m, const StringView& token);
    void oneCharToken(const TokenizeMatch& m, const StringView& token);
};

};

#endif
