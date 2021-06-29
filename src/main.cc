
#include "Utils.hh"

#include "FileInputStream.hh"
#include "WasmParser.hh"

int main(int argc, char *argv[]) {
    TRACE();

    auto fileInput = FileInputStream$::create("../../test/libbzip2-dec.wasm");
    auto wasmInput = fileInput.cast<WasmInputStream>();

    auto parser = WasmParser$::create();
    auto tree = parser->parse(wasmInput);

    dumpData(tree);

    return 0;

}
