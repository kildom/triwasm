
#include <string>
#include <regex>
#include <iostream>

#include "Parser.hh"

namespace triasm {


Parser::Parser() {

}

bool Parser::parse(String$ input)
{
    return false;
}

};

using namespace triasm;

int main2() {
    Parser p;
    p.parse(R"(
        add 12
    )");
    return 0;
}


const char* operator ""_X(const char* text, std::size_t length)
{
    static std::map<std::string, const char*> cache;
    std::string a(text, length);
    if (cache.count(a)) {
        return cache[a];
    }
    std::cout << __FUNCTION__ << "\n";
    cache[a] = text;
    return text;
}

int main()
{
    for (int i = 0; i < 10; i++) {
        std::cout << R"(abc)"_X << "\n";
        std::cout << R"(def)"_X << "\n";
    }
}