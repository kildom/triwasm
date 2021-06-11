#ifndef _WASM_PARSER_HH_
#define _WASM_PARSER_HH_

#include "common.hh"

#include "WasmData.hh"
#include "WasmReader.hh"

DOLLAR_CLASS(WasmParser);

class WasmParser {
private:
    WasmData$ d;
    WasmReader$$ r;

public:
    WasmData$ parseFile(const char* fileName);

    void parse();
    void parseSection();
    void parseTypeSection();
    void parseImportSection();
    void parseFunctionSection();
    void parseTableSection();
    void parseMemorySection();
    void parseGlobalSection();
    void parseExportSection();
    void parseStartSection();
    void parseElementSection();
    void parseCodeSection();
    void parseDataSection();
    void parseDataCountSection();
    void parseCustomSection();
    void parseFuncCode(u32 funcIndex);
    Array$<WasmInstr$> parseExpr(bool allowElse = false);
    void parseCompressedBlockType(WasmBlock$ block);
    Range parseLimits();
    u32 valueType();
    u32 refType();
    void utf8Check(String$ text);

    void postProcess();
};

#endif /* _WASM_PARSER_HH_ */
