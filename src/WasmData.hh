#ifndef _WASM_DATA_HH_
#define _WASM_DATA_HH_

#include "Utils.hh"

#include "WasmConsts.hh"

DOLLAR_STRUCT(WasmFunctionType);
DOLLAR_STRUCT(WasmImport);
DOLLAR_STRUCT(WasmTable);
DOLLAR_STRUCT(WasmFunction);
DOLLAR_STRUCT(WasmMemory);
DOLLAR_STRUCT(WasmGlobal);
DOLLAR_STRUCT(WasmInstr);
DOLLAR_STRUCT(WasmDataSegment);
DOLLAR_STRUCT(WasmBlock);
DOLLAR_STRUCT(WasmData);
DOLLAR_STRUCT(WasmElement);


struct WasmFunctionType {
    Array$<u32> param;
    Array$<u32> result;
};


struct WasmImport {
    String$ module;
    String$ name;
};


struct WasmTable {
    u32 index;
    u32 type;
    u32 min;
    u32 max;
    bool unlimited;
    WasmImport$$ import;
    String$ exportName;
};


struct WasmBlock {
    WasmInstr$$ instr;
    WasmFunctionType$$ type;
    Array$<WasmInstr$$> body;
    u32 stackBase;
};

struct WasmFunction {
    u32 index;
    WasmFunctionType$$ type;
    Array$<u32> locals;
    WasmBlock$$ block;
    WasmImport$$ import;
    String$ exportName;
    Array$<u32> paramsOffsets;
};

struct WasmInstr {
    u32 code;
    Array$<u64> imm;
    String$ immString;
    WasmBlock$$ block;
};

struct WasmMemory
{
    u32 index;
    u32 min;
    u32 max;
    bool unlimited;
    WasmImport$$ import;
    String$ exportName;
};

struct WasmGlobal
{
    u32 index;
    u32 type;
    bool mut;
    Array$<WasmInstr$$> initializer;
    WasmImport$$ import;
    String$ exportName;
};

struct WasmElement
{
    u32 index;
    WasmElementKind kind;
    WasmTable$$ table;
    Array$<WasmInstr$$> offset;
    Array$<Array$<WasmInstr$$>> exprItems;
    Array$<WasmFunction$> functionItems;
};

struct WasmDataSegment
{
    u32 index;
    bool active;
    WasmMemory$$ memory;
    Array$<WasmInstr$$> offset;
    Bytes$ bytes;
};


struct WasmData {
    // types
    Array$<WasmFunctionType$$> functionTypes;
    // main collectios
    Array$<WasmFunction$$> functions;
    Array$<WasmTable$$> tables;
    Array$<WasmMemory$$> memories;
    Array$<WasmGlobal$$> globals;
    // imports
    Array$<WasmFunction$$> importFunctions;
    Array$<WasmTable$$> importTables;
    Array$<WasmMemory$$> importMemories;
    Array$<WasmGlobal$$> importGlobals;
    // exports
    Array$<WasmFunction$$> exportFunctions;
    Array$<WasmTable$$> exportTables;
    Array$<WasmMemory$$> exportMemories;
    Array$<WasmGlobal$$> exportGlobals;
    // table elements
    Array$<WasmElement$$> elements;
    // memory data
    Array$<WasmDataSegment$$> data;
    // entry
    WasmFunction$$ startFunction;
};

void dumpData(WasmData$$ data);


#endif /* _WASM_DATA_HH_ */
