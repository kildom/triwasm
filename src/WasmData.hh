#ifndef _WASM_DATA_HH_
#define _WASM_DATA_HH_

#include "common.hh"

DOLLAR_STRUCT(WasmFunctionType);

struct WasmFunctionType {
    Array$<u32> param;
    Array$<u32> result;
};

DOLLAR_STRUCT(WasmImportFunction);

struct WasmImportFunction {
    String$ module;
    String$ name;
    u32 typeIndex;
};

DOLLAR_STRUCT(WasmImportTable);

struct WasmImportTable {
    String$ module;
    String$ name;
    u32 type;
    u32 min;
    u32 max;
    bool unlimited;
};

DOLLAR_STRUCT(WasmImportMemory);

struct WasmImportMemory {
    String$ module;
    String$ name;
    u32 min;
    u32 max;
    bool unlimited;
};

DOLLAR_STRUCT(WasmFunction);

struct WasmFunction {
    u32 typeIndex;
    WasmFunctionType$ type;
};

DOLLAR_STRUCT(WasmData);

struct WasmData {
    Array$<WasmFunctionType$> functionTypes;
    Array$<WasmFunction$> functions;
    Array$<WasmImportFunction$> importFunctions;
    Array$<WasmImportTable$> importTables;
    Array$<WasmImportMemory$> importMemories;
};



#endif /* _WASM_DATA_HH_ */
