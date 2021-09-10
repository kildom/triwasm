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



void Merger::resolveReferences()
{
    for (auto f : main->functions)
    {
        if (f->kind != FUNCTION_IMPORT) {
            continue;
        }

        auto moduleName = f->import->module;
        auto functionName = f->import->name;
        //TODO: resolving imports (also for globals and tables maybe) should be done in separate class
        //TODO: fast way of finding exports (e.g. map of all exports), this will be also useful for Reducer when instructions are replaced by calls to trivmlib
    }
}

