
#include <regex>
#include <cstdlib>
#include <string>
#include <iostream>

#include "dollar.hh"

#include "../src/triasmParser.h"

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
    UNINITIALIZED,
    NUMBER,
    TERNARY,
    CALL,
    IDENTIFIER,
    BASE,
    #define EXPR_OP(name, symbol) OP_##name,
    #include "instr.inc"
};

std::string strExpType(ExpType x) {
    switch (x) {
    case ExpType::UNINITIALIZED: return "UNINITIALIZED";
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
    UNINITIALIZED,
    ADD,
    SUB,
    _ANNOTATION,
    ASSIGN,
    LABEL,
};

std::string strCommandType(CommandType x) {
    switch (x) {
    case CommandType::UNINITIALIZED: return "UNINITIALIZED";
    case CommandType::ADD: return "ADD";
    case CommandType::SUB: return "SUB";
    case CommandType::_ANNOTATION: return "_ANNOTATION";
    case CommandType::ASSIGN: return "ASSIGN";
    case CommandType::LABEL: return "LABEL";
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
    LemonExpr* first;
    const char* string;
    LemonCommand() : next(nullptr), type(CommandType::UNINITIALIZED), first(nullptr), string(nullptr) { }
    ~LemonCommand() { deleteList(first); if (string != nullptr) delete[] string; }
};

struct LemonProg : public LemonCommand { };

struct LemonExpr {
    LemonExpr* next;
    LemonExpr* args;
    ExpType type;
    union
    {
        BaseType baseType;
        uint64_t number;
    };
    const char* string;
    LemonExpr() : next(nullptr), args(nullptr), type(ExpType::UNINITIALIZED), number(0), string(nullptr) { }
    ~LemonExpr() { if (string != nullptr) delete[] string; }
};

struct LemonArgs : LemonExpr { };

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
    int col;
    int totalErrors;
    int allowedErrors;
    TriASMParser();
    ~TriASMParser();
    static void prepare();
    void parse(const std::string& input);
    void error(const char* message);
    static TokenizeMatch matches[];

    void parseToken(int id, const char* value);
    void simpleToken(const TokenizeMatch& m, const std::ssub_match& part);
    void simpleTokenWithoutVal(const TokenizeMatch& m, const std::ssub_match& part);
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
    { 0, R"(\r?\n)", &TriASMParser::simpleTokenWithoutVal, LEMON_EOL },
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
    std::cerr << line << ":" << col << ": " << message << "\n";
    totalErrors++;
}

void TriASMParser::parseToken(int id, const char* value) {
    std::cout << line << ":" << col << ": " << "triasm " << id << " " << (value == nullptr ? std::string() : std::string("'") + value + "'") << "\n";
    LemonParse(parser, id, value);
}

void TriASMParser::simpleToken(const TokenizeMatch& m, const std::ssub_match& part)
{
    size_t size = part.second - part.first;
    char* str = new char[size + 1];
    memcpy(str, &*part.first, size);
    str[size] = 0;
    parseToken(m.tokenId, str);
}

void TriASMParser::simpleTokenWithoutVal(const TokenizeMatch& m, const std::ssub_match& part)
{
    parseToken(m.tokenId, nullptr);
}

void TriASMParser::oneCharToken(const TokenizeMatch& m, const std::ssub_match& part)
{
    parseToken(charToLemonTokenId[*part.first], nullptr);
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
    parseToken(tokenId, nullptr);
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
        lemonProgFree(this, (LemonProg*)result);
    }
    result = nullptr;
    parser = LemonParseAlloc(lemonAlloc, (Lemon*)(void*)this);
    std::smatch parts;
    auto loc = input.cbegin();
    line = 1;
    col = 1;
    totalErrors = 0;
    allowedErrors = 50;
    while (*loc == ' ' || *loc == '\t') {
        ++col;
        ++loc;
    }
    while (loc < input.cend() && totalErrors < allowedErrors) {
        bool ok = std::regex_search(loc, input.cend(), parts, *re);
        if (!ok) {
            error("Invalid input");
            do {
                ++loc;
                ++col;
            } while (*loc != '\n' && loc < input.cend());
            continue;
        }
        for (auto& m : matches) {
            auto& part = parts[m.index];
            if (part.matched) {
                (this->*m.callback)(m, part);
                break;
            }
        }
        auto next = parts[0].second;
        for (auto a = loc; a < next; ++a) {
            col++;
            if (*a == '\n') {
                line++;
                col = 1;
            }
        }
        loc = next;
    }
    parseToken(LEMON_EOF, nullptr);
}

std::string testInput = R"--(
    .data8 1, 2, 3 + a, -4, sin(12, 3)
    a = 12 + 3 * 8 == a || b
    read8 [AMB0] + [POP]
    label:
    label2:
)--";

void dumpExpr(std::string ind, LemonExpr* first) {
    while (first) {
        std::cout << ind << "EXPR " << strExpType(first->type) << ": ";
        if (first->string != nullptr) {
            std::cout << first->string << " ";
        }
        switch (first->type)
        {
        case ExpType::BASE:
            std::cout << strBaseType((BaseType)first->number);
            break;
        
        default:
            std::cout << first->number;
            break;
        }
        std::cout << "\n";
        dumpExpr(ind + "   ", first->args);
        first = first->next;
    }
}

void dumpProg(LemonCommand* first) {
    while (first) {
        std::cout << "COMMAND " << strCommandType(first->type) << ": ";
        if (first->string != nullptr) {
            std::cout << first->string << " ";
        }
        std::cout << "\n";
        dumpExpr("   ", first->first);
        first = first->next;
    }
}

int main() {
    TriASMParser p;
    p.parse(testInput);
    dumpProg(p.result);
    return 0;
}

#define P do { std::cout << "FUNC: " << __FUNCTION__ << "\n"; } while (0)

template<class T>
T* useList(T* last) {
    T* first = nullptr;
    while (last != nullptr)
    {
        T* next = last->next;
        last->next = first;
        first = last;
        last = next;
    }
    return first;
}

void lemonTokenFree(Lemon* th, const char* token) { P;
    if (token != nullptr) {
        delete[] token;
    }
}

void lemonProgFree(Lemon* th, LemonProg* prog) { P;
    deleteList<LemonCommand>(prog);
}

void lemonCommandFree(Lemon* th, LemonCommand* command) { P;
    delete command;
}

void lemonArgsFree(Lemon* th, LemonArgs* args) { P;
    deleteList<LemonExpr>(args);
}

void lemonExprFree(Lemon* th, LemonExpr* expr) { P;
    delete expr;
}

void lemonFailure(Lemon* th) { P;
    std::cerr << "Source code parsing failure!\n";
}

void lemonError(Lemon* th) { P;
    std::cerr << "Syntax error!\n";
}

void lemonStackOverflow(Lemon* th) { P;
    std::cerr << "Parser stack overflow!\n";
}

void lemonResult(Lemon* th, LemonProg* prog) { P;
    std::cout << "RESULT: " << (void*)prog << "\n";
    th->result = useList<LemonCommand>(prog);
}

LemonProg* lemonProgAppend(Lemon* th, LemonProg* prog, LemonCommand* command) { P;
    if (command == nullptr) {
        return prog;
    }
    command->next = prog;
    return (LemonProg*)command;
}


LemonCommand* lemonInstrCreate(Lemon* th, const char* name, LemonArgs* args, const char* stringLiteral) { P;
    auto instr = new LemonCommand();
    instr->first = useList<LemonExpr>(args);
    instr->string = stringLiteral;
    instr->type = CommandType::ADD;
    return instr;
}

LemonCommand* lemonLabelCreate(Lemon* th, const char* name) { P;
    auto label = new LemonCommand();
    label->string = name;
    label->type = CommandType::LABEL;
    return label;
}

LemonCommand* lemonAssignCreate(Lemon* th, const char* name, LemonExpr* expr) { P;
    auto assign = new LemonCommand();
    assign->string = name;
    assign->first = expr;
    assign->type = CommandType::ASSIGN;
    return assign;
}

const char* lemonStringAppend(Lemon* th, const char* string, const char* append) { P;
    auto len1 = strlen(string);
    auto len2 = strlen(append);
    auto res = new char[len1 + len2 + 1];
    std::memcpy(res, string, len1);
    std::memcpy(res + len1, append, len2 + 1);
    delete[] string;
    delete[] append;
    return res;
}

LemonArgs* lemonArgsAppend(Lemon* th, LemonArgs* args, LemonExpr* expr) { P;
    expr->next = args;
    return (LemonArgs*)expr;
}

LemonExpr* lemonExprTernary(Lemon* th, LemonExpr* cond, LemonExpr* ifTrue, LemonExpr* ifFalse) { P;
    auto exp = new LemonExpr();
    exp->type = ExpType::TERNARY;
    exp->args = cond;
    cond->next = ifTrue;
    ifTrue->next = ifFalse;
    return exp;
}

LemonExpr* lemonExprBinOp(Lemon* th, char op, LemonExpr* a, LemonExpr* b) { P;
    auto exp = new LemonExpr();
    exp->type = charToExpType[op];
    exp->args = a;
    a->next = b;
    return exp;
}

LemonExpr* lemonExprUnOp(Lemon* th, char op, LemonExpr* a) { P;
    auto exp = new LemonExpr();
    exp->type = charToExpType[op];
    exp->args = a;
    return exp;
}

LemonExpr* lemonExprCall(Lemon* th, const char* name, LemonArgs* args) { P;
    auto exp = new LemonExpr();
    exp->type = ExpType::CALL;
    exp->string = name;
    exp->args = useList<LemonExpr>(args);
    return exp;
}


LemonExpr* lemonExprNumber(Lemon* th, const char* value, int base) { P;
    uint64_t number = 0;
    auto ptr = value;
    while (*ptr) {
        number *= (uint64_t)base;
        if (*ptr <= '9') {
            number += *ptr - '0';
        } else if (*ptr <= 'F') {
            number += *ptr - 'A' + 10;
        } else {
            number += *ptr - 'a' + 10;
        }
        ptr++;
    }
    delete[] value;
    auto exp = new LemonExpr();
    exp->type = ExpType::NUMBER;
    exp->number = number;
    return exp;
}

LemonExpr* lemonExprIdentifier(Lemon* th, const char* name) { P;
    auto exp = new LemonExpr();
    exp->type = ExpType::IDENTIFIER;
    exp->string = name;
    return exp;
}

LemonExpr* lemonExprBase(Lemon* th, const char* name) { P;
    BaseType type;
    if (strcasecmp(name, "AMB0") == 0) {
        type = BaseType::AMB0;
    } else if (strcasecmp(name, "AMB1") == 0) {
        type = BaseType::AMB1;
    } else if (strcasecmp(name, "SP") == 0) {
        type = BaseType::SP;
    } else {
        type = BaseType::POP;
    }
    delete[] name;
    auto exp = new LemonExpr();
    exp->type = ExpType::BASE;
    exp->baseType = type;
    return exp;
}
