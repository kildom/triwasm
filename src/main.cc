
#include "Utils.hh"

#include "FileInputStream.hh"
#include "WasmParser.hh"
#include "Reducer.hh"
#include "Generator.hh"
#include "Linker.hh"

int main(int argc, char *argv[]) {
    TRACE();

    auto parser = WasmParser$$::create();
    auto trivmlib = parser->parse(FileInputStream$$::create("../../lib/trivmlib.wasm").cast<WasmInputStream>());
    auto mod = parser->parse(FileInputStream$$::create("../../test/libbzip2-dec.wasm").cast<WasmInputStream>());

    /*
    Linker$$ linker;
    linker->link(prog);
    
    Reducer$$ reducer;
    reducer->reduce(trivmlib);
    reducer = new$;
    reducer->reduce(mod);

    //dumpProgram(prog);

    Generator$$ generator = Generator$::create(std::cout);
    generator->generate(prog);
    */

    return 0;

}
