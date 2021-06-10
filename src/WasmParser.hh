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
    void parseCodeSection();
    void parseFuncCode(u32 funcIndex);
    Array$<WasmInstruction$> parseExpr(bool allowElse = false);
    Range parseLimits();
    u32 valueType();
    u32 refType();
};

#endif /* _WASM_PARSER_HH_ */
