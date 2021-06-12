
#include "common.hh"

#include "WasmParser.hh"
#include "IRGenerator.hh"

int main(int argc, char *argv[]) {
    TRACE();

    auto parser = WasmParser$::create();
    auto tree = parser->parseFile("test/libbzip2-dec.wasm");

    auto irGenerator = IRGenerator$::create();
    irGenerator->generate(tree);

    return 0;

}
