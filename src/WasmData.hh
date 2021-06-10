#ifndef _WASM_DATA_HH_
#define _WASM_DATA_HH_

#include "common.hh"

DOLLAR_STRUCT(WasmFunctionType);
DOLLAR_STRUCT(WasmImportFunction);
DOLLAR_STRUCT(WasmImportTable);
DOLLAR_STRUCT(WasmImportMemory);
DOLLAR_STRUCT(WasmImportGlobal);
DOLLAR_STRUCT(WasmTable);
DOLLAR_STRUCT(WasmFunction);
DOLLAR_STRUCT(WasmInstruction);
DOLLAR_STRUCT(InstrDesc);
DOLLAR_STRUCT(WasmBlock);
DOLLAR_STRUCT(WasmData);


struct WasmFunctionType {
    Array$<u32> param;
    Array$<u32> result;
};


struct WasmImportFunction {
    String$ module;
    String$ name;
    u32 typeIndex;
};


struct WasmImportTable {
    String$ module;
    String$ name;
    u32 type;
    u32 min;
    u32 max;
    bool unlimited;
};


struct WasmImportMemory {
    String$ module;
    String$ name;
    u32 min;
    u32 max;
    bool unlimited;
};


struct WasmImportGlobal {
    String$ module;
    String$ name;
    u32 type;
    bool mut;
};


struct WasmTable {
    u32 type;
    u32 min;
    u32 max;
    bool unlimited;
};


struct WasmFunction {
    u32 typeIndex;
    WasmFunctionType$ type;
    Array$<u32> locals;
    Array$<WasmInstruction$> body;
};

struct WasmBlock {
    u32 typeIndex;
    WasmFunctionType$ type;
    Array$<WasmInstruction$> instructions;
};

struct WasmInstruction {
    u32 code;
    InstrDesc$ desc;
    Array$<u64> imm;
    WasmBlock$ block;
};

struct InstrDesc
{
    const char* name;
    const char* imm;
    Array$<u32> input;
    Array$<u32> output;
};

struct WasmData {
    Array$<WasmFunctionType$> functionTypes;
    Array$<WasmFunction$> functions;
    Array$<WasmImportFunction$> importFunctions;
    Array$<WasmImportTable$> importTables;
    Array$<WasmImportMemory$> importMemories;
    Array$<WasmImportGlobal$> importGlobals;
    Array$<WasmTable$> tables;
};



#endif /* _WASM_DATA_HH_ */
