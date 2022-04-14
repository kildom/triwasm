
#include <string>
#include <regex>
#include <iostream>

#include "array.hh"
#include "string.hh"
#include "lemonParser.h"

#include "Parser.hh"

namespace triasm {


static Parser::TokenizeMatch tokenizeMatches[] = {
    { 1,
        #define TABLE_INSTR(name) #name "|"
        #define TABLE_DIR(name) "\\." #name "|"
        #define TABLE_DIR_LAST(name) "\\." #name
        #include "tables.inc"
        , &Parser::simpleToken, LEMON_INSTRUCTION },
    { 9, R"(\.PRAGMA)", &Parser::simpleToken, LEMON_PRAGMA },
    { 0, R"(\r?\n)", &Parser::simpleToken, LEMON_EOL },
    { 5, R"(POP|AMB0|AMB1|SP)", &Parser::simpleToken, LEMON_BASE },
    { 3, R"([a-z_\$@\.][a-z_\$@\.0-9]*)", &Parser::simpleToken, LEMON_IDENTIFIER },
    { 9, R"(//[^\n]*)", &Parser::skipToken },
    { 9, R"(/\*[\S\s]*?\*/)", &Parser::skipToken },
    { 6, R"(<<|>>|<=|>=|\|\||&&|==|!=)", &Parser::twoCharsToken }, // LEMON_OR LEMON_AND LEMON_EQ LEMON_NE LEMON_LE LEMON_GE LEMON_SHL LEMON_SHR
    { 2, R"([~!%/\*\(\)\-\+,\]\[:=\?\|\^&<>])", &Parser::oneCharToken }, // LEMON_COLON LEMON_ASSIGN LEMON_COMMA LEMON_QUESTION LEMON_BIT_OR LEMON_BIT_XOR LEMON_BIT_AND LEMON_LT LEMON_GT LEMON_PLUS LEMON_MINUS LEMON_MUL LEMON_DIV LEMON_MOD LEMON_NOT LEMON_BIT_NOT LEMON_OPEN LEMON_CLOSE LEMON_SOPEN LEMON_SCLOSE
    { 7, R"(?:0x([0-9a-f]+))", &Parser::simpleToken, LEMON_HEX },
    { 7, R"(?:0o([0-7]+))", &Parser::simpleToken, LEMON_OCT },
    { 4, R"([0-9]+)", &Parser::simpleToken, LEMON_DECIMAL },
    { 9, R"(\\[\t ]*\r?\n)", &Parser::skipToken },
    { 8, R"-(?:"(|[\S\s]*?[^\\])")-", &Parser::simpleToken, LEMON_STRING },
};

static RegEx$N re;

static void prepare() {
    if (re != nullptr) {
        return;
    }
    String$$ pattern;
    int index = 1;
    pattern = "^(?:";
    for (auto& m : tokenizeMatches) {
        pattern += '(';
        pattern += m.pattern;
        pattern += ")|";
        m.index = index;
        index++;
    }
    pattern.length(pattern.length() - 1);
    pattern += ")[\\t ]*";
    std::cout << *pattern << "\n";
    re = RegEx$(pattern, RegEx$::IGNORE_CASE | RegEx$::OPTIMIZE);
    std::sort(std::begin(tokenizeMatches), std::end(tokenizeMatches), [](const Parser::TokenizeMatch &a, const Parser::TokenizeMatch &b) {
        return a.priority < b.priority;
    });
}

Parser::Parser() {
    prepare();
}

void* lemonAlloc(size_t size)
{
    return new char[size];
}

void Parser::parse(String$ input)
{
    // TODO: check input < 2G
    this->input = input;
    inputPosition = 0;
    line = 1;
    while (inputPosition < input.length()) {
        char c = input[inputPosition];
        if (c != ' ' || c != '\t') {
            break;
        }
        inputPosition++;
    }
    totalErrors = 0;
    allowedErrors = 20;
    argsCache.length(1);
    parser = LemonParseAlloc(lemonAlloc, (void*)this);
}

LemonCommand$N Parser::next()
{
    exprCacheUsed = 0;
    argsCacheUsed = 1;
    commandReady = false;
    while (inputPosition < input.length() && totalErrors < allowedErrors) {
        auto arr = input[inputPosition |R].search(re);
        if (arr == nullptr) {
            //error("Invalid input");
            do {
                ++inputPosition;
            } while (input[inputPosition] != '\n' && inputPosition < input.length());
            continue;
        }
        for (auto& m : tokenizeMatches) {
            auto& sub = arr[m.index];
            if (sub.valid()) {
                std::cout << *String$(sub) << "\n";
                (this->*m.callback)(m, sub);
                break;
            }
        }
        line += arr[0].count('\n');
        inputPosition = arr[0].to;
        if (commandReady) {
            commandReady = false;
            return command;
        }
    }
    return nullptr;
}


void Parser::simpleToken(const TokenizeMatch& m, const StringView& token) {
    std::cerr << "TOKEN: " << *String$(token) << "\n";
    LemonParse(parser, m.tokenId, LemonToken{ .from = (int)token.from, .to = (int)token.to, .line = line });
}

void Parser::skipToken(const TokenizeMatch& m, const StringView& token) {
    // Skipping
}

void Parser::twoCharsToken(const TokenizeMatch& m, const StringView& token) {

}

void Parser::oneCharToken(const TokenizeMatch& m, const StringView& token) {

    static int *charToLemonTokenId = ([](){ auto t = new int[128];
        t['~'] = LEMON_BIT_NOT;
        t['!'] = LEMON_NOT;
        t['%'] = LEMON_MOD;
        t['/'] = LEMON_DIV;
        t['*'] = LEMON_MUL;
        t['('] = LEMON_OPEN;
        t[')'] = LEMON_CLOSE;
        t['-'] = LEMON_MINUS;
        t['+'] = LEMON_PLUS;
        t[','] = LEMON_COMMA;
        t['['] = LEMON_SOPEN;
        t[']'] = LEMON_SCLOSE;
        t[':'] = LEMON_COLON;
        t['='] = LEMON_ASSIGN;
        t['?'] = LEMON_QUESTION;
        t['|'] = LEMON_BIT_OR;
        t['^'] = LEMON_BIT_XOR;
        t['&'] = LEMON_BIT_AND;
        t['<'] = LEMON_LT;
        t['>'] = LEMON_GT;
        return t; })();

    std::cerr << "TOKEN: " << *String$(token) << "\n";

    LemonParse(parser, charToLemonTokenId[token[(ssize)0] & 0x7F], LemonToken());

}


};

using namespace triasm;

void lemonFailure(void* th) {
    std::cout << "FAIL" << "\n";
}

void lemonError(void* th) {
    std::cout << "ERROR" << "\n";
}

void lemonStackOverflow(void* th) {
    std::cout << "STACK OVERFLOW" << "\n";
}

void lemonResultVerify(void* th, int counter) {
    std::cout << "Command consumed: " << counter << "\n";
}

int lemonInstr(void* th, LemonToken* name, int args) {
    Parser* p = (Parser*)th;

    std::cerr << "lemonInstr: ARGS:" << args << "\n";

    if (p->commandReady) {
        FATAL("Internal parser error!");
    }

    CommandType type;
    auto text = p->input[name->from |R| name->to];

    if (text[0] != '.') {
        #define INSTR(N) if (text.icase() == #N) { type = CommandType::N; } else
        #include "tables.inc"
        { FATAL("Internal error"); }
    } else {
        #define DIR(N) if (text.icase() == "." #N) { type = CommandType::_##N; } else
        #include "tables.inc"
        { FATAL("Internal error"); }
    }

    p->command->line = name->line;
    p->command->args = p->argsCache[args];
    p->command->type = type;
    p->commandReady = true;

    return p->commandCreateCounter++;
}

int lemonPragma(void* th, LemonToken* value) {

}

int lemonLabel(void* th, LemonToken* name) {

}

int lemonAssign(void* th, LemonToken* name, int expr) {

}

void lemonArgsFree(void* th, int args) {
    Parser* p = (Parser*)th;
    p->argsCache[args].clear();
}

int lemonArgsAppend(void* th, int args, int expr) {
    Parser* p = (Parser*)th;
    p->argsCache[args]() = p->exprCache[expr];
    std::cerr << "lemonArgsAppend: ARGS:" << args << " <- EXPR:" << expr << "\n";
    return args;
}

int lemonArgsCreate(void* th) {
    Parser* p = (Parser*)th;
    p->argsCache[p->argsCacheUsed].clear();
    std::cerr << "lemonArgsCreate: ARGS:" << p->argsCacheUsed << "\n";
    return p->argsCacheUsed++;
}

void lemonExprFree(void* th, int expr) {
    Parser* p = (Parser*)th;
    p->exprCache[expr]->type = ExprType::UNINITIALIZED;
}

int lemonExprTernary(void* th, int cond, int ifTrue, int ifFalse) {

}

int lemonExprBinOp(void* th, char op, int a, int b) {

}

int lemonExprUnOp(void* th, char op, int a) {

}

int lemonExprCall(void* th, LemonToken* name, int args) {

}

int lemonExprNumber(void* th, LemonToken* value, int base) {
    Parser* p = (Parser*)th;

    u64 number = 0;
    for (int i = value->from; i < value->to; i++) {
        char c = p->input[i];
        number *= base;
        if (c <= '9') {
            number += c - '0';
        } else if (c <= 'F') {
            number += c - 'A' + 10;
        } else {
            number += c - 'a' + 10;
        }
    }

    LemonExpr$ expr = p->exprCache(p->exprCacheUsed);
    expr->type = ExprType::NUMBER;
    expr->number = number;

    std::cerr << "lemonExprNumber: EXPR:" << p->exprCacheUsed << " = " << number << "\n";

    return p->exprCacheUsed++;
}

int lemonExprIdentifier(void* th, LemonToken* name) {

}

int lemonExprBase(void* th, LemonToken* name) {
}


using namespace triasm;

int main() {
    Parser p;
    p.parse(R"(
        .data8 12, 12
    )");
    auto cmd = p.next();
    return 0;
}

