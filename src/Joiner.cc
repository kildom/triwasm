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
#include "Joiner.hh"

void Joiner::setMain(WasmModule$ main)
{
    this->main = main;
}


void Joiner::join(WasmModule$ source)
{
    this->source = source;
}


void Joiner::resolveReferences()
{

}

