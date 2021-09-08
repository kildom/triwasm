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
#include "Merger.hh"

void Merger::setMain(WasmModule$ main)
{
    this->main = main;
}


void Merger::join(WasmModule$ source)
{
    this->source = source;
}


void Merger::resolveReferences()
{

}

