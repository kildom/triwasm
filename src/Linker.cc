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
    /*
        Requirements:
            1. All modules except __main cannot have any memory, table or global
            2. Each module has a unique name:
                Main is: __trivm_main,
                trivmlib is __trivm_trivmlib,
                any user provided is named by user or __trivm_modN by default

        Procedure:
            1. Load main module
            2. For each linked module, merge it to main
            3. Resolve internal references
            4. Continue with the compilation

        Load module requirements for linking:
            1. Add export entry for each "assembly:export" magic function

        Merging modules:
            1. Do nothing with the types - they are already resolved during module loading
            2. Add ALL imports to the main module and keep the index base. Error on non-function import.
            3. Do nothing with the function section - it is already resolved during module loading
            4. Error if table section contains any table
            5. Error if memory section contains any memory
            6. Error if global section contains any global
            7. Add ALL exports adding base index to function indexes
                Keep them in some collection for later use by the reference resolver AND Reducer
            8. Ignore start/element/data section
            9. Add ALL functions and add base index to function indexes used in the instructions
        
        Resolve internal references:
            1. For each import from known module resolve actual function (or special function)
                Travel the chain of references if needed
                Error if not found
            2. Travel the code and change references to resolved imports to actual function (or special function)
                This includes also code other than functions.
                This also includes element's functions index vector.

        Final requirements:
            1. WASM exports are matched with virtual machine exports using exports from all modules (without module name)
            2. If list of virtual machine exports is known and some wasm export is not in the list, then
               this export can be removed (and all unreferenced symbols cause by this removal).

    */
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

