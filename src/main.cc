
#include <fstream>

#include "Utils.hh"

#include "FileInputStream.hh"
#include "WasmParser.hh"
//#include "Reducer.hh"
//#include "Generator.hh"
//#include "Linker.hh"


int main(int argc, char *argv[]) {
    TRACE();

    auto parser = WasmParser$$::create();
    auto trivmlib = parser->parse(FileInputStream$$::create("../../lib/trivmlib.wasm").cast<WasmInputStream>(), false, "__trivmlib"_S);
    auto mod = parser->parse(FileInputStream$$::create("../../test/libbzip2-dec.wasm").cast<WasmInputStream>(), true, "__main"_S);

    std::ofstream ofs1 ("trivmlib.txt", std::ofstream::out);
    dumpModule(ofs1, trivmlib, DUMP_TRI_ASSEMBLY);
    ofs1.close();

    std::ofstream ofs2 ("mainmod.txt", std::ofstream::out);
    dumpModule(ofs2, mod, DUMP_TRI_ASSEMBLY);
    ofs2.close();


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
