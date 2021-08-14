#include <sstream>
#include "Utils.hh"
#include "WasmData.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmParser.hh"
#include "WasmInstr.hh"
#include "Reducer.hh"
#include "Builtins.hh"
#include "VMConfig.hh"
#include "Linker.hh"


void Linker::link(WasmProgram$ prog)
{
    this->prog = prog;
    for (auto mod : prog->modules) {
        this->mod = mod;
        for (auto func : mod->functions) {
            if (func->import == nullptr) continue;
            auto import = func->import;
            if (import->module == "__trivm_assembly_function__") {
                AssemblyFunction$ af(func->link);
                af->code = import->name;
                af->inlined = false;
            } else if (import->module == "__trivm_inline_assembly_function__") {
                AssemblyFunction$ af(func->link);
                af->code = import->name;
                af->inlined = true;
            } else if (import->module == "__trivmlib__") {
                if (prog->trivmlibExports.count(import->name->buffer()) == 0)
                    FATAL("Undefined trivmlib symbol '%s'", import->name->buffer());
                u32 index = prog->trivmlibExports[import->name->v];
                auto dest = prog->modules[0]->functions[index];
                func->link = dest;
            } else {
                
            }
        }
    }
}

