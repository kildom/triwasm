
#include <regex>
#include <cstdlib>
#include <string>
#include <iostream>

#include "dollar.hh"
#include "types.hh"

#include "../src/lemonParser.h"

using regex = std::regex;
DOLLAR_TYPEDEF(regex);

enum class BaseType {
    AMB0 = 1,
    AMB1 = 2,
    SP = 3,
    REG_MASK = 3,
    POP = 4,
};

DEFINE_ENUM_FLAGS(BaseType);

std::string strBaseType(BaseType x) {
    std::string r;
    auto reg = x & BaseType::REG_MASK;
    if (reg == BaseType::AMB0) {
        r = "AMB0";
    } else if (reg == BaseType::AMB1) {
        r = "AMB1";
    } else if (reg == BaseType::SP) {
        r = "SP";
    }
    if (BaseType::POP IN x) {
        if (r.length()) r += " + ";
        r += "POP";
    }
    return r;
}

enum class ExpType {
    CALL,
    IDENTIFIER,
    LAST_WITH_STRING,
    NUMBER,
    BASE,
    LAST_WITH_NUMBER,
    TERNARY,
    #define EXPR_OP(name, symbol) OP_##name,
    #include "instr.inc"
};

std::string strExpType(ExpType x) {
    switch (x) {
    case ExpType::NUMBER: return "NUMBER";
    case ExpType::TERNARY: return "TERNARY";
    case ExpType::CALL: return "CALL";
    case ExpType::IDENTIFIER: return "IDENTIFIER";
    case ExpType::BASE: return "BASE";
    #define EXPR_OP(name, symbol) case ExpType::OP_##name: return "OP_" #name;
    #include "instr.inc"
    default: return "???";
    }
}

static ExpType *charToExpType = ([](){ auto t = new ExpType[128];
    #define EXPR_OP(name, symbol) t[symbol] = ExpType::OP_##name;
    #include "instr.inc"
    return t; })();

enum class CommandType {
    ASSIGN,
    LABEL,
    PRAGMA,
    #define INSTR(name) name,
    #define DIR(name) _##name,
    #include "instr.inc"
};

std::string strCommandType(CommandType x) {
    switch (x) {
    case CommandType::ASSIGN: return "ASSIGN";
    case CommandType::LABEL: return "LABEL";
    case CommandType::PRAGMA: return "PRAGMA";
    #define INSTR(name) case CommandType::name: return #name;
    #define DIR(name) case CommandType::_##name: return "." #name;
    #include "instr.inc"
    default: return "???";
    }
}

template<class T>
void deleteList(T* next) {
    while (next != nullptr) {
        T* tmp = next;
        next = next->next;
        delete tmp;
    }
}

struct LemonCommand {
    LemonCommand* next;
    CommandType type;
    int line;
    LemonExpr* first;
    const char* string;
    int stringLength;
    LemonCommand(CommandType type, int line) : next(nullptr), type(type), line(line), first(nullptr), string(nullptr), stringLength(0) { }
    ~LemonCommand() { deleteList(first); }
};

struct LemonExpr {
    LemonExpr* next;
    LemonExpr* args;
    ExpType type;
    int stringLength;
    union
    {
        BaseType baseType;
        uint64_t number;
        const char* string;
    };
    LemonExpr(ExpType type) : next(nullptr), args(nullptr), type(type), string(nullptr), stringLength(0) { }
    ~LemonExpr() { deleteList(args); }
};


enum class InstrId {
    #define INSTR(name) name = (__COUNTER__ * 1000 + __LINE__),
    #define INSTR_LAST(name) name = (__COUNTER__ * 1000 + __LINE__), INSTR_END = (__COUNTER__ * 1000 + __LINE__),
    #define DIR(name) _##name = (__COUNTER__ * 1000 + __LINE__),
    #include "instr.inc"
};

static std::map<std::string, InstrId> instrNameToId = {
    #define INSTR(name) { #name, InstrId::name },
    #define DIR(name) { "." #name, InstrId::_##name },
    #include "instr.inc"
};

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


class TriASMParser {
public:
    struct TokenizeMatch
    {
        int priority;
        const char* pattern;
        void (TriASMParser::*callback)(const TokenizeMatch& m, const std::ssub_match& part);
        int tokenId;
        int index;
    };

    LemonCommand* result;
    static regex$N re;
    void* parser;
    int line;
    int tokenLocation;
    int tokenLength;
    const char* inputString;
    int totalErrors;
    int allowedErrors;
    TriASMParser();
    ~TriASMParser();
    static void prepare();
    void parse(const std::string& input);
    void error(const char* message);
    static TokenizeMatch matches[];

    void parseToken(int id, const LemonToken& value);
    void simpleToken(const TokenizeMatch& m, const std::ssub_match& part);
    void oneCharToken(const TokenizeMatch& m, const std::ssub_match& part);
    void twoCharsToken(const TokenizeMatch& m, const std::ssub_match& part);
    void skipToken(const TokenizeMatch& m, const std::ssub_match& part);

};

TriASMParser::TokenizeMatch TriASMParser::matches[] = {
    { 1,
        #define INSTR(name) #name "|"
        #define DIR(name) "\\." #name "|"
        #define DIR_LAST(name) "\\." #name
        #include "instr.inc"
        , &TriASMParser::simpleToken, LEMON_INSTRUCTION },
    { 9, R"(\.PRAGMA)", &TriASMParser::simpleToken, LEMON_PRAGMA },
    { 0, R"(\r?\n)", &TriASMParser::simpleToken, LEMON_EOL },
    { 5, R"(POP|AMB0|AMB1|SP)", &TriASMParser::simpleToken, LEMON_BASE },
    { 3, R"([a-z_\$@\.][a-z_\$@\.0-9]*)", &TriASMParser::simpleToken, LEMON_IDENTIFIER },
    { 9, R"(//[^\n]*)", &TriASMParser::skipToken },
    { 9, R"(/\*[\S\s]*?\*/)", &TriASMParser::skipToken },
    { 6, R"(<<|>>|<=|>=|\|\||&&|==|!=)", &TriASMParser::twoCharsToken }, // LEMON_OR LEMON_AND LEMON_EQ LEMON_NE LEMON_LE LEMON_GE LEMON_SHL LEMON_SHR
    { 2, R"([~!%/\*\(\)\-\+,\]\[:=\?\|\^&<>])", &TriASMParser::oneCharToken }, // LEMON_COLON LEMON_ASSIGN LEMON_COMMA LEMON_QUESTION LEMON_BIT_OR LEMON_BIT_XOR LEMON_BIT_AND LEMON_LT LEMON_GT LEMON_PLUS LEMON_MINUS LEMON_MUL LEMON_DIV LEMON_MOD LEMON_NOT LEMON_BIT_NOT LEMON_OPEN LEMON_CLOSE LEMON_SOPEN LEMON_SCLOSE
    { 7, R"(?:0x([0-9a-f]+))", &TriASMParser::simpleToken, LEMON_HEX },
    { 7, R"(?:0o([0-7]+))", &TriASMParser::simpleToken, LEMON_OCT },
    { 4, R"([0-9]+)", &TriASMParser::simpleToken, LEMON_DECIMAL },
    { 9, R"(\\[\t ]*\r?\n)", &TriASMParser::skipToken },
    { 8, R"-(?:"(|[\S\s]*?[^\\])")-", &TriASMParser::simpleToken, LEMON_STRING },
};

regex$N TriASMParser::re;

void TriASMParser::prepare() {
    if (re != nullptr) {
        return;
    }
    std::string pattern;
    int index = 1;
    pattern = "^(?:";
    for (auto& m : matches) {
        pattern += '(';
        pattern += m.pattern;
        pattern += ")|";
        m.index = index;
        index++;
    }
    pattern.resize(pattern.length() - 1);
    pattern += ")[\\t ]*";
    std::cout << pattern << "\n";
    re.createInplace(pattern, std::regex_constants::ECMAScript | std::regex_constants::optimize | std::regex_constants::icase);
    std::sort(std::begin(matches), std::end(matches), [](const TokenizeMatch &a, const TokenizeMatch &b) {
        return a.priority < b.priority;
    });
}

void TriASMParser::error(const char* message)
{
    std::cerr << line << ":" << ": " << message << "\n";
    totalErrors++;
}

void TriASMParser::parseToken(int id, const LemonToken& value) {
    std::cout << line << ":" << ": " << "triasm " << id << " " << "????" << "\n";
    LemonParse(parser, id, value);
}

void TriASMParser::simpleToken(const TokenizeMatch& m, const std::ssub_match& part)
{
    parseToken(m.tokenId, LemonToken { .value = inputString + tokenLocation, .length = tokenLength, .line = line, });
}

void TriASMParser::oneCharToken(const TokenizeMatch& m, const std::ssub_match& part)
{
    parseToken(charToLemonTokenId[*part.first], LemonToken { .value = inputString + tokenLocation, .length = tokenLength, .line = line, });
}

void TriASMParser::twoCharsToken(const TokenizeMatch& m, const std::ssub_match& part)
{
    int tokenId;
    char first = *part.first;
    if (first == '|') {
        tokenId = LEMON_OR;
    } else if (first == '&') {
        tokenId = LEMON_AND;
    } else if (first == '=') {
        tokenId = LEMON_EQ;
    } else if (first == '!') {
        tokenId = LEMON_NE;
    } else {
        char second = *(part.first + 1);
        if (first == '<') {
            if (second == '=') {
                tokenId = LEMON_LE;
            } else {
                tokenId = LEMON_SHL;
            }
        } else {
            if (second == '=') {
                tokenId = LEMON_GE;
            } else {
                tokenId = LEMON_SHR;
            }
        }
    }
    parseToken(tokenId, LemonToken { .value = inputString + tokenLocation, .length = tokenLength, .line = line, });
}

void TriASMParser::skipToken(const TokenizeMatch& m, const std::ssub_match& part)
{
}

TriASMParser::TriASMParser() : parser(nullptr), result(nullptr)
{
}

static void* lemonAlloc(size_t size) { return (void*)new char[size]; }
static void lemonFree(void* ptr) { delete[] (char*)ptr; }

TriASMParser::~TriASMParser()
{
    if (parser != nullptr) {
        LemonParseFree(parser, lemonFree);
    }
}

void TriASMParser::parse(const std::string& input)
{
    prepare();
    if (parser != nullptr) {
        LemonParseFree(parser, lemonFree);
    }
    if (result != nullptr) {
        deleteList(result);
    }
    result = nullptr;
    parser = LemonParseAlloc(lemonAlloc, (Lemon*)(void*)this);
    std::smatch parts;
    inputString = input.c_str();
    auto loc = input.cbegin();
    line = 1;
    totalErrors = 0;
    allowedErrors = 50;
    while (*loc == ' ' || *loc == '\t') {
        ++loc;
    }
    while (loc < input.cend() && totalErrors < allowedErrors) {
        bool ok = std::regex_search(loc, input.cend(), parts, *re);
        if (!ok) {
            error("Invalid input");
            do {
                ++loc;
            } while (*loc != '\n' && loc < input.cend());
            continue;
        }
        for (auto& m : matches) {
            auto& part = parts[m.index];
            if (part.matched) {
                tokenLocation = (&*part.first) - inputString;
                tokenLength = part.length();
                (this->*m.callback)(m, part);
                break;
            }
        }
        auto next = parts[0].second;
        for (auto a = loc; a < next; ++a) {
            if (*a == '\n') {
                line++;
            }
        }
        loc = next;
    }
    parseToken(LEMON_EOF, LemonToken { .value = &*input.cend(), .length = 0, .line = line, });
}

std::string testInput = R"--(
    .data8 1, 2, 5 + a, -4, sin(12, 3)
    a = 12 + 3 * 8 == a || b
    add p(9, 10)
    read8 [AMB0] - 12 + [POP]
    label:
    label2:
    .pragma "License:askajhfdf"
    NOT64HL
)--";

void dumpExpr(std::string ind, LemonExpr* first) {
    while (first) {
        std::cout << ind << (first->next ? " ├──" : " └──") << strExpType(first->type) << " ";
        if (first->type <= ExpType::LAST_WITH_STRING) {
            std::cout << std::string(first->string, first->stringLength) << " ";
        } else if (first->type == ExpType::BASE) {
            std::cout << strBaseType((BaseType)first->number);
        } else if (first->type <= ExpType::LAST_WITH_NUMBER) {
            std::cout << first->number;
        }
        std::cout << "\n";
        dumpExpr(ind + (first->next ? " |  " : "    "), first->args);
        first = first->next;
    }
}

void dumpProg(LemonCommand* first) {
    while (first) {
        std::cout << strCommandType(first->type) << " ";
        if (first->string != nullptr) {
            std::cout << std::string(first->string, first->stringLength) << " ";
        }
        std::cout << "\n";
        dumpExpr("", first->first);
        first = first->next;
    }
}

void testOrder()
{
    const char* tab[] = {
        #define INSTR(name) #name,
        #define DIR(name) "." #name,
        #include "instr.inc"
    };
    int len = sizeof(tab) / sizeof(tab[0]);
    for (auto i = 0; i < len; i++) {
        for (auto j = i + 1; j < len; j++) {
            auto first = tab[i];
            auto sec = tab[j];
            if (strlen(first) < strlen(sec) && strncasecmp(first, sec, strlen(first)) == 0) {
                std::cout << first << " <<< " << sec << "\n";
            }
        }
    }
    exit(0);
}

int main() {
    TriASMParser p;
    p.parse(testInput);
    dumpProg(p.result);
    return 0;
}

#define P do { std::cout << "FUNC: " << __FUNCTION__ << "\n"; } while (0)

void lemonProgFree(LemonProg* prog) { P;
    deleteList(prog->first);
}

void lemonCommandFree(LemonCommand* command) { P;
    delete command;
}

void lemonArgsFree(LemonArgs* args) { P;
    deleteList(args->first);
}

void lemonExprFree(LemonExpr* expr) { P;
    delete expr;
}

void lemonFailure(Lemon* th) { P;
    th->totalErrors = th->allowedErrors + 1;
    std::cerr << "Source code parsing failure!\n";
}

void lemonError(Lemon* th) { P;
    th->totalErrors++;
    std::cerr << "Syntax error!\n";
}

void lemonStackOverflow(Lemon* th) { P;
    th->totalErrors = th->allowedErrors + 1;
    std::cerr << "Parser stack overflow!\n";
}

void lemonResult(Lemon* th, LemonProg* prog) { P;
    std::cout << "RESULT: " << (void*)prog << "\n";
    th->result = prog->first;
}

LemonProg lemonProgAppend(LemonProg* prog, LemonCommand* command) { P;
    if (command == nullptr) {
        return *prog;
    }
    if (prog->last == nullptr) {
        prog->first = command;
    } else {
        prog->last->next = command;
    }
    prog->last = command;
    command->next = nullptr;
    return *prog;
}

LemonProg lemonProgCreate() { P;
    return LemonProg { .first = nullptr, .last = nullptr };
}

LemonCommand* lemonInstrCreate(LemonToken* name, LemonArgs* args) { P;
    CommandType type;

    if (name->value[0] != '.') {
        #define INSTR(N) if (strlen(#N) == name->length && strncasecmp(#N, name->value, name->length) == 0) { type = CommandType::N; } else
        #include "instr.inc"
        { FATAL("Internal error"); }
    } else {
        #define DIR(N) if (strlen("." #N) == name->length && strncasecmp("." #N, name->value, name->length) == 0) { type = CommandType::_##N; } else
        #include "instr.inc"
        { FATAL("Internal error"); }
    }

    auto instr = new LemonCommand(type, name->line);
    instr->first = args ? args->first : nullptr;
    return instr;
}

LemonCommand* lemonPragmaCreate(LemonToken* value) { P;
    auto pragma = new LemonCommand(CommandType::PRAGMA, value->line);
    pragma->string = value->value;
    pragma->stringLength = value->length;
    return pragma;
}

LemonCommand* lemonLabelCreate(LemonToken* name) { P;
    auto label = new LemonCommand(CommandType::LABEL, name->line);
    label->string = name->value;
    label->stringLength = name->length;
    return label;
}

LemonCommand* lemonAssignCreate(LemonToken* name, LemonExpr* expr) { P;
    auto assign = new LemonCommand(CommandType::ASSIGN, name->line);
    assign->string = name->value;
    assign->stringLength = name->length;
    assign->first = expr;
    return assign;
}

LemonArgs lemonArgsAppend(LemonArgs* args, LemonExpr* expr) { P;
    if (args->last == nullptr) {
        args->first = expr;
    } else {
        args->last->next = expr;
    }
    args->last = expr;
    expr->next = nullptr;
    return *args;
}

LemonArgs lemonArgsCreate(LemonExpr* expr) { P;
    expr->next = nullptr;
    return LemonArgs { .first = expr, .last = expr };
}

LemonExpr* lemonExprTernary(LemonExpr* cond, LemonExpr* ifTrue, LemonExpr* ifFalse) { P;
    auto exp = new LemonExpr(ExpType::TERNARY);
    exp->args = cond;
    cond->next = ifTrue;
    ifTrue->next = ifFalse;
    return exp;
}

LemonExpr* lemonExprBinOp(char op, LemonExpr* a, LemonExpr* b) { P;
    auto exp = new LemonExpr(charToExpType[op]);
    exp->args = a;
    a->next = b;
    return exp;
}

LemonExpr* lemonExprUnOp(char op, LemonExpr* a) { P;
    auto exp = new LemonExpr(charToExpType[op]);
    exp->args = a;
    return exp;
}

LemonExpr* lemonExprCall(LemonToken* name, LemonArgs* args) { P;
    auto exp = new LemonExpr(ExpType::CALL);
    exp->string = name->value;
    exp->stringLength = name->length;
    exp->args = args->first;
    return exp;
}


LemonExpr* lemonExprNumber(LemonToken* value, int base) { P;
    uint64_t number = 0;
    auto ptr = value->value;
    for (int i = 0; i < value->length; i++) {
        char c = ptr[i];
        number *= base;
        if (c <= '9') {
            number += c - '0';
        } else if (c <= 'F') {
            number += c - 'A' + 10;
        } else {
            number += c - 'a' + 10;
        }
    }
    auto exp = new LemonExpr(ExpType::NUMBER);
    exp->number = number;
    return exp;
}

LemonExpr* lemonExprIdentifier(LemonToken* name) { P;
    auto exp = new LemonExpr(ExpType::IDENTIFIER);
    exp->string = name->value;
    exp->stringLength = name->length;
    return exp;
}

LemonExpr* lemonExprBase(LemonToken* name) { P;
    BaseType type;
    if (name->length == 3) {
        type = BaseType::POP;
    } else if (name->length == 4) {
        const char *ptr = name->value;
        type = (ptr[3] == '0') ? BaseType::AMB0 : BaseType::AMB1;
    } else {
        type = BaseType::SP;
    }
    auto exp = new LemonExpr(ExpType::BASE);
    exp->baseType = type;
    return exp;
}
