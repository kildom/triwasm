#ifndef _WASM_DATA_HH_
#define _WASM_DATA_HH_

#include "Utils.hh"

#include "WasmConsts.hh"

DOLLAR_STRUCT(WasmFunctionType);
DOLLAR_STRUCT(WasmImport);
DOLLAR_STRUCT(WasmTable);
DOLLAR_STRUCT(HostFunction);
DOLLAR_STRUCT(AssemblyFunction);
DOLLAR_STRUCT(WasmFunction);
DOLLAR_STRUCT(WasmMemory);
DOLLAR_STRUCT(ConstExpr);
DOLLAR_STRUCT(WasmGlobal);
DOLLAR_STRUCT(WasmInstrBr);
DOLLAR_STRUCT(WasmInstr);
DOLLAR_STRUCT(WasmDataSegment);
DOLLAR_STRUCT(WasmBlock);
DOLLAR_STRUCT(WasmElement);
DOLLAR_STRUCT(WasmModule);
DOLLAR_STRUCT(WasmProgram);


struct WasmFunctionType {
    Array$$<u32> param;
    Array$$<u32> result;
};


struct WasmImport {
    String$$ module;
    String$$ name;
};


struct WasmTable {
    u32 index;
    u32 type;
    u32 min;
    u32 max;
    bool unlimited;
    WasmImport$ import;
    String$$ exportName;
};


struct WasmBlock {
    WasmInstr$ instr;
    WasmFunctionType$ type;
    Array$$<WasmInstr$> body;
    s32 stackBase;
    u32 id;
    bool elsePresent;
};

struct HostFunction {
    u32 index;
};

struct AssemblyFunction {
    bool inlined;
    String$$ code;
};

struct WasmFunction {
    u32 index;
    WasmFunctionType$ type;
    Array$$<u32> locals;
    WasmBlock$ block;
    WasmImport$ import;
    any$ /* WasmFunction, HostFunction, AssemblyFunction */ link;
    String$$ exportName;
    Array$$<u32> localsOffsets;
    u32 returnAddressOffset;
};

struct WasmInstrBr {
    bool conditional;
    bool negated;
    bool forceForward;
    WasmInstrBr() : conditional(false), negated(false), forceForward(false) {}
};

struct WasmInstr {
    u32 code;
    Array$$<u64> imm;
    String$$ immString;
    WasmBlock$ block;
    any$ data;
};

struct WasmMemory
{
    u32 index;
    u32 min;
    u32 max;
    bool unlimited;
    WasmImport$ import;
    String$$ exportName;
};

enum WasmConstExprKind {
    CONST_EXPR_UNDEFINED,
    CONST_EXPR_I32,
    CONST_EXPR_I64,
    CONST_EXPR_F32,
    CONST_EXPR_F64,
    CONST_EXPR_FUNC,
    CONST_EXPR_NULL,
    CONST_EXPR_GLOBAL_IMPORT,
};

struct ConstExpr {
    WasmConstExprKind kind;
    union
    {
        u32 globalIndex;
        u32 functionIndex;
        u32 i32Value;
        u64 i64Value;
        u32 f32Value;
        u64 f64Value;
    };
    ConstExpr() : kind(CONST_EXPR_UNDEFINED) { }
};

struct WasmGlobal
{
    u32 index;
    u32 type;
    bool mut;
    ConstExpr$ initializer;
    WasmImport$ import;
    String$$ exportName;
};

struct WasmElement
{
    u32 index;
    WasmElementKind kind;
    WasmTable$ table;
    ConstExpr$ offset;
    Array$$<ConstExpr$> exprItems;
    Array$$<WasmFunction$$> functionItems;
};

struct WasmDataSegment
{
    u32 index;
    bool active;
    WasmMemory$ memory;
    ConstExpr$ offset;
    Bytes$$ bytes;
};


struct WasmModule {
    // types
    Array$$<WasmFunctionType$> functionTypes;
    // main collectios
    Array$$<WasmFunction$> functions;
    Array$$<WasmTable$> tables;
    Array$$<WasmMemory$> memories;
    Array$$<WasmGlobal$> globals;
    // table elements
    Array$$<WasmElement$> elements;
    // memory data
    Array$$<WasmDataSegment$> data;
    // entry
    WasmFunction$ startFunction;
    // only functions with body
    Array$$<WasmFunction$> definedFunctions;
};

#endif /* _WASM_DATA_HH_ */
