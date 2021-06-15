#ifndef _WASM_DATA_HH_
#define _WASM_DATA_HH_

#include "common.hh"

DOLLAR_STRUCT(WasmFunctionType);
DOLLAR_STRUCT(WasmImport);
DOLLAR_STRUCT(WasmTable);
DOLLAR_STRUCT(WasmFunction);
DOLLAR_STRUCT(WasmMemory);
DOLLAR_STRUCT(WasmGlobal);
DOLLAR_STRUCT(WasmInstr);
DOLLAR_STRUCT(WasmActiveData);
DOLLAR_STRUCT(WasmInstrDesc);
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


struct WasmFunction {
    u32 index;
    WasmFunctionType$$ type;
    Array$<u32> locals;
    Array$<WasmInstr$$> body;
    WasmImport$$ import;
    String$ exportName;
    Array$<u32> paramsOffsets;
};

struct WasmBlock {
    WasmInstr$$ instr;
    WasmFunctionType$$ type;
    Array$<WasmInstr$$> body;
};

struct WasmInstr {
    u32 code;
    WasmInstrDesc$$ desc;
    Array$<u64> imm;
    WasmBlock$$ block;
};

struct WasmInstrDesc
{
    const char* name;
    const char* imm;
    Array$<u32> param;
    Array$<u32> result;
    Array$<u32> repl;
    const char* replName;
    $$<u64> replImm;
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
    WasmTable$$ table;
    Array$<WasmInstr$$> expr;
    Array$<Array$<WasmInstr$$>> exprItems;
    Array$<WasmFunction$> functionItems;
};

struct WasmActiveData
{
    u32 memory;
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
    Array$<WasmElement$$> activeElements;
    Array$<WasmElement$$> passiveElements;
    Array$<WasmElement$$> declarativeElements;
    // memory data
    Array$<WasmActiveData$$> activeData;
    Array$<Bytes$> passiveData;
    // entry
    WasmFunction$$ startFunction;
};


#endif /* _WASM_DATA_HH_ */
