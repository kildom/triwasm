
#include <fstream>

#include "Utils.hh"

#include "FileInputStream.hh"
#include "WasmParser.hh"
#include "Merger.hh"
#include "Resolver.hh"
#include "Reducer.hh"
//#include "Linker.hh"

void dumpModuleToFile(const char *name, WasmModule$ mod, DumpFlags flags)
{

        std::ofstream ofs (name, std::ofstream::out);
        dumpModule(ofs, mod, flags);
        ofs.close();
}

int main(int argc, char *argv[]) {
    TRACE();

    auto parser = WasmParser$$::create();
    auto trivmlib = parser->parse(FileInputStream$$::create("../../lib/trivmlib.wasm").cast<WasmInputStream>(), false, "__trivmlib"_S);
    auto mod = parser->parse(FileInputStream$$::create("../../test/libbzip2-dec.wasm").cast<WasmInputStream>(), true, "__main"_S);

    dumpModuleToFile("trivmlib.txt", trivmlib, DUMP_TRI_ASSEMBLY | DUMP_WASM_ASSEMBLY);
    dumpModuleToFile("mainmod.txt", mod, DUMP_TRI_ASSEMBLY | DUMP_WASM_ASSEMBLY);

    auto merger = Merger$::create();
    merger->setMain(mod);
    merger->merge(trivmlib);

    dumpModuleToFile("merged.txt", mod, DUMP_TRI_ASSEMBLY | DUMP_WASM_ASSEMBLY);

    auto resolver = Resolver$::create();
    resolver->resolveImports(mod);

    dumpModuleToFile("resolved.txt", mod, DUMP_TRI_ASSEMBLY | DUMP_WASM_ASSEMBLY);

    auto reducer = Reducer$::create();
    reducer->reduce(mod);

    dumpModuleToFile("reduced.txt", mod, DUMP_TRI_ASSEMBLY | DUMP_WASM_ASSEMBLY | DUMP_AFTER_REDUCE);

    return 0;

}
