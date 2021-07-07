
#include "Utils.hh"

#include "FileInputStream.hh"
#include "WasmParser.hh"
#include "Reducer.hh"
#include "Generator.hh"

int main(int argc, char *argv[]) {
    TRACE();

    auto fileInput = FileInputStream$::create("../../test/libbzip2-dec.wasm");
    auto wasmInput = fileInput.cast<WasmInputStream>();

    auto parser = WasmParser$::create();
    auto mod = parser->parse(wasmInput);
    mod->index = 0;

    WasmProgram$ prog;
    prog->modules->grow(0) = mod;
    
    Reducer$ reducer;
    reducer->reduce(mod);
    //dumpData(tree);

    Generator$$ generator = Generator$$::create(std::cout);
    generator->generate(prog);

    return 0;

}
