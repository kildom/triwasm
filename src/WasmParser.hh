#ifndef _WASM_PARSER_HH_
#define _WASM_PARSER_HH_

#include "Utils.hh"

#include "WasmData.hh"
#include "WasmReader.hh"

DOLLAR_CLASS(WasmParser);

class WasmParser {
private:
    WasmModule$ mod;
    WasmReader$$ r;
    WasmFunction$$ function;
    Array$<WasmBlock$> blockStack;

public:
    WasmModule$ parse(WasmInputStream$$ stream);

private:
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
    Array$<WasmInstr$$> parseExpr(bool allowElse = false);
    bool parseInstr(WasmInstr$$ instr, bool &allowElse);
    void parseCompressedBlockType(WasmBlock$ block);
    Range parseLimits();
    u32 valueType();
    u32 refType();
    void utf8Check(String$ text);

    void postProcess();
};

#endif /* _WASM_PARSER_HH_ */
