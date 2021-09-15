#include <sstream>
#include "Utils.hh"
#include "WasmData.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmParser.hh"
#include "WasmInstr.hh"
#include "VMConfig.hh"
#include "Merger.hh"

void Merger::setMain(WasmModule$ main)
{
    TRACE();
    this->main = main;
}


void Merger::merge(WasmModule$ source)
{
    TRACE();
    this->source = source;
    funcIndexOffset = main->functions->length();
    for (auto f : source->functions) {
        mergeFunction(f);
    }
}

void Merger::mergeFunction(WasmFunction$ func)
{
    TRACE();
    func->index += funcIndexOffset;
    main->functions->push(func);
    updateInstrIndexes(func->block);
}

void Merger::updateInstrIndexes(WasmBlock$ block)
{
    TRACE();
    if (block == nullptr || block->body == nullptr) {
        return;
    }
    for (auto instr : block->body)
    {
        switch (instr->code)
        {
        case INSTR_CALL:
        case INSTR_RETURN_CALL:
        case INSTR_REF_FUNC:
            //printf("Index updated %d -> %d\n", (int)instr->imm[0], (int)(instr->imm[0] + funcIndexOffset));
            instr->imm[0] += funcIndexOffset;
            break;
        default:
            break;
        }
        if (instr->block != nullptr) {
            updateInstrIndexes(instr->block);
        }
    }
}


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