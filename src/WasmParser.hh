#ifndef _WASM_PARSER_HH_
#define _WASM_PARSER_HH_

#include "Utils.hh"

#include "WasmData.hh"
#include "WasmReader.hh"

DOLLAR_CLASS(WasmParser);

class WasmParser {
private:
    Array$$<WasmFunctionType$> functionTypes;
    WasmModule$$ mod;
    WasmReader$ r;
    WasmFunction$ function;
    Array$<WasmBlock$$> blockStack;

public:
    WasmModule$$ parse(WasmInputStream$ stream, bool isMain, String$$ name);

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
    void parseTargetFeaturesSection();
    ConstExpr$ parseConstExpr();
    void parseFuncCode();
    WasmFunction$ parseMagicFunction(WasmFunction$ input, String$$ content);
    Array$$<WasmInstr$> parseExpr(bool allowElse = false);
    bool parseInstr(WasmInstr$ instr, bool &allowElse);
    void parseCompressedBlockType(WasmBlock$$ block);
    Range parseLimits();
    u32 valueType();
    u32 refType();
    void utf8Check(String$$ text);
};

#endif /* _WASM_PARSER_HH_ */
