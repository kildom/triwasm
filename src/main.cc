
#include "common.hh"

#include "WasmParser.hh"

int main(int argc, char *argv[]) {

    auto parser = WasmParser$::create();
    parser->parseFile("test/libbzip2-dec.wasm");

    return 0;

}
