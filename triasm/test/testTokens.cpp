
#include <regex>
#include <string>
#include <iostream>

#include "../src/triasmParser.h"

struct Token {
    int id;
    std::string value;
};

typedef Token (*CreateTokenFunc)(const std::smatch& m, int index);

struct TokenizeMatch
{
    const char* pattern;
    int groups;
    CreateTokenFunc callback;
    int index;
};

static Token createInstr(const std::smatch& m, int index) {
    Token t;
    t.id = 1;
    t.value = m[index].str();
    return t;
}

static Token createNewLine(const std::smatch& m, int index) {
    Token t;
    t.id = 13;
    t.value = m[index].str();
    return t;
}

static Token createDecimal(const std::smatch& m, int index) {
    Token t;
    t.id = 2;
    t.value = m[index].str();
    return t;
}

static Token createIdentifier(const std::smatch& m, int index) {
    Token t;
    t.id = 3;
    t.value = m[index].str();
    return t;
}

static Token createOneCharToken(const std::smatch& m, int index) {
    Token t;
    t.id = 4;
    t.value = m[index].str();
    return t;
}

static Token createBase(const std::smatch& m, int index) {
    Token t;
    t.id = 5;
    t.value = m[index].str();
    return t;
}

static Token createHex(const std::smatch& m, int index) {
    Token t;
    t.id = 6;
    t.value = m[index].str();
    return t;
}

static Token createOct(const std::smatch& m, int index) {
    Token t;
    t.id = 7;
    t.value = m[index].str();
    return t;
}

static Token createTwoCharToken(const std::smatch& m, int index) {
    Token t;
    t.id = 8;
    t.value = m[index].str();
    return t;
}

static Token createString(const std::smatch& m, int index) {
    Token t;
    t.id = 9;
    t.value = m[index].str();
    return t;
}

static Token createComment(const std::smatch& m, int index) {
    Token t;
    t.id = 500;
    t.value = m[index].str();
    return t;
}

TokenizeMatch matches[] = {
    { R"(\r?\n)", 0, createNewLine },
    { R"(add|sub|div|(?:read|write)(?:8|16|32|64|))", 0, createInstr },
    { R"(POP|AMB0|AMB1|SP)", 0, createBase },
    { R"([a-z_\$@\.][a-z_\$@\.0-9]*)", 0, createIdentifier },
    { R"([\(\)\-\+,\]\[])", 0, createOneCharToken },
    { R"(<<|>>|<=)", 0, createTwoCharToken },
    { R"(?:0x([0-9a-f]+))", 0, createHex },
    { R"(?:0o([0-7]+))", 0, createOct },
    { R"([0-9a-z_\$@]+)", 0, createDecimal },
    { R"(//[^\n]*)", 0, createComment },
    { R"(/\*[\S\s]*?\*/)", 0, createComment },
    { R"(\\\r?\n)", 0, createComment },
    { R"-(?:"(|[\S\s]*?[^\\])")-", 0, createString },
};

std::string testInput = R"--(
    add 99
    sub test(0X12F)
    READ8 [POP] \
          + a
    READ [AMB0] + [POP] + 0 /**/ // comment
    /* This is the comment //Next comment */
    POP 0o773, 0x9F, 099 >> 1
    .annotation "license:MIT" "" "a" "\"" "\"\"" "This is the \nstring"
)--";

int main() {
    std::string pattern;
    std::vector<TokenizeMatch*> subToMatch;
    int index = 1;
    pattern = "^[\\t ]*(?:"; // TODO: Optimize pattern by removing "[\\t ]*" at the beginning. Input iterator should skip this before first token. Rest of the tokens does not need this.
    for (auto& m : matches) {
        pattern += '(';
        pattern += m.pattern;
        pattern += ")|";
        std::cout << pattern << "\n";
        m.index = index;
        index += 1 + m.groups;
        subToMatch.push_back(&m);
        for (int i = 0; i < m.groups; i++) {
            subToMatch.push_back(nullptr);
        }
    }
    pattern.resize(pattern.length() - 1);
    pattern += ")[\\t ]*";
    std::regex re(pattern, std::regex_constants::ECMAScript | std::regex_constants::optimize | std::regex_constants::icase);
    std::smatch parts;
    /* TODO: change order of match checking to check from most frequent to least.
    std::stable_sort(matches.begin(), matches.end(), frequencyCompare);
    */
    auto loc = testInput.cbegin();
    int line = 1;
    int col = 1;
    while (loc < testInput.cend()) {
        bool ok = std::regex_search(loc, testInput.cend(), parts, re);
        if (!ok) {
            std::cout << line << ":" << col << ": Invalid input!\n";
            return 1;
        }
        for (auto& m : matches) {
            if (parts[m.index].matched) {
                auto t = m.callback(parts, m.index);
                std::cout << line << ":" << col << ":   " << t.id << ":" << t.value << "\n";
                break;
            }
        }
        auto next = parts[0].second;
        for (auto a = loc; a != next; ++a) {
            col++;
            if (*a == '\n') {
                line++;
                col = 1;
            }
        }
        loc = parts[0].second;
    }
    return 0;
}
