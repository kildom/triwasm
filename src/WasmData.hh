#ifndef _WASM_DATA_HH_
#define _WASM_DATA_HH_

#include "common.hh"

DOLLAR_STRUCT(WasmFunctionType);
DOLLAR_STRUCT(WasmImport);
DOLLAR_STRUCT(WasmTable);
DOLLAR_STRUCT(WasmFunction);
DOLLAR_STRUCT(WasmMemory);
DOLLAR_STRUCT(WasmGlobal);
DOLLAR_STRUCT(WasmExportTable);
DOLLAR_STRUCT(WasmExportFunction);
DOLLAR_STRUCT(WasmExportMemory);
DOLLAR_STRUCT(WasmExportGlobal);
DOLLAR_STRUCT(WasmInstr);
DOLLAR_STRUCT(WasmActiveData);
DOLLAR_STRUCT(InstrDesc);
DOLLAR_STRUCT(WasmBlock);
DOLLAR_STRUCT(WasmData);
DOLLAR_STRUCT(WasmElement);


struct WasmFunctionType {  // VRF8
    Array$<u32> param;     // VRF9
    Array$<u32> result;    // VRF10
};


struct WasmImport { // VRF7
    String$ module;         // VRF0: by r->string()
    String$ name;           // VRF1: by r->string()
};


struct WasmTable {
    u32 index;
    u32 type;
    u32 min;
    u32 max;
    bool unlimited;
    WasmImport$ import;
};


struct WasmFunction {
    u32 index;                  // VRF4
    u32 typeIndex;              // VRF3
    WasmFunctionType$ type;     // VRF3
    Array$<u32> locals;         // VRF5
    Array$<WasmInstr$> body;
    WasmImport$ import; // VRF6->VRF7
};

struct WasmBlock {
    WasmInstr$ parent;
    u32 typeIndex;
    WasmFunctionType$ type;
    Array$<WasmInstr$> instrs;
};

struct WasmInstr {
    u32 code;
    InstrDesc$ desc;
    Array$<u64> imm;
    WasmBlock$ block;
};

struct InstrDesc
{
    const char* name;
    const char* imm;
    Array$<u32> param;
    Array$<u32> result;
};

struct WasmMemory
{
    u32 index;
    u32 min;
    u32 max;
    bool unlimited;
    WasmImport$ import;
};

struct WasmGlobal
{
    u32 index;
    u32 type;
    bool mut;
    Array$<WasmInstr$> initializer;
    WasmImport$ import;
};

struct WasmExportFunction
{
    String$ name;
    u32 index;
    WasmFunction$ function;
};

struct WasmExportTable
{
    String$ name;
    u32 index;
    WasmTable$ table;
};

struct WasmExportMemory
{
    String$ name;
    u32 index;
    WasmMemory$ memory;
};

struct WasmExportGlobal
{
    String$ name;
    u32 index;
    WasmGlobal$ global;
};

struct WasmElement
{
    u32 tableidx;
    Array$<WasmInstr$> expr;
    Array$<Array$<WasmInstr$>> exprItems;
    Array$<u32> indexItems;
};

struct WasmActiveData
{
    u32 memory;
    Array$<WasmInstr$> offset;
    Bytes$ bytes;
};

struct WasmData {
    // types
    Array$<WasmFunctionType$> functionTypes;
    // main collectios
    Array$<WasmFunction$> functions;
    Array$<WasmTable$> tables;
    Array$<WasmMemory$> memories;
    Array$<WasmGlobal$> globals;
    // exports
    Array$<WasmExportFunction$> exportFunctions;
    Array$<WasmExportTable$> exportTables;
    Array$<WasmExportMemory$> exportMemories;
    Array$<WasmExportGlobal$> exportGlobals;
    // table elements
    Array$<WasmElement$> activeElements;
    Array$<WasmElement$> passiveElements;
    Array$<WasmElement$> declarativeElements;
    // memory data
    Array$<WasmActiveData$> activeData;
    Array$<Bytes$> passiveData;
    // miscellaneous data
    u32 importFunctionsCount;
    s32 startFunction;
    s32 dataCount;
};



#endif /* _WASM_DATA_HH_ */
