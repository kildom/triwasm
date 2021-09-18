#ifndef _WASM_DATA_HH_
#define _WASM_DATA_HH_

#include "Utils.hh"

#include "WasmConsts.hh"

DOLLAR_STRUCT(WasmFunctionType);
DOLLAR_STRUCT(WasmImport);
DOLLAR_STRUCT(WasmTable);
DOLLAR_STRUCT(HostFunction);
DOLLAR_STRUCT(AssemblyFunction);
DOLLAR_STRUCT(WasmAnnotationFunction);
DOLLAR_STRUCT(WasmFunctionData);
DOLLAR_STRUCT(WasmFunction);
DOLLAR_STRUCT(WasmMemory);
DOLLAR_STRUCT(ConstExpr);
DOLLAR_STRUCT(WasmGlobal);
DOLLAR_STRUCT(WasmInstrBr);
DOLLAR_STRUCT(WasmInstr);
DOLLAR_STRUCT(WasmData);
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
    bool brTarget; ///< if first instruction after this block end is reachable
};

enum WasmFunctionKind {
    FUNCTION_WASM,            ///< [WasmFunctionData] Normal WASM function with body
    FUNCTION_ANNOTATION,      ///< [String$$]         Annotation magic function, does not generate a bytecode, call replaced by ".annotation" during triasm generation
    FUNCTION_IMPORT,          ///< [null]             Import function, will be replaced by FUNCTION_HOST_* or FUNCTION_LINK during references resolving
    FUNCTION_HOST_BY_INDEX,   ///< [u32$]             Host function referenced by index
    FUNCTION_HOST_BY_NAME,    ///< [String$$]         Host function referenced by name, trivm runtime startup will resolve its index
    FUNCTION_ASSEMBLY,        ///< [String$$]         Function with triasm body
    FUNCTION_INLINE_ASSEMBLY, ///< [String$$]         Function with triasm body that will be inlined always
    FUNCTION_LINK,            ///< [WasmFunction]     A link to actual function
    FUNCTION_UNUSED,          ///< [null]             Function created as a placeholder, cannot be called, will not be generated
};

struct WasmFunctionData {
    Array$$<u32> localsOffsets;
    u32 returnAddressOffset;
};

struct WasmFunction {
    u32 index;
    WasmFunctionKind kind;
    WasmFunctionType$ type;
    WasmImport$ import;
    Array$$<String$$> exportNames;
    String$$ moduleName;
    Array$$<u32> locals;
    WasmBlock$ block;
    any$ data;
    String$$ name;
};

struct WasmInstrBr {
    bool conditional;
    bool negated;
    bool forceForward;
    bool skipBrInstr;
    WasmInstrBr() : conditional(false), negated(false), forceForward(false), skipBrInstr(false) {}
};

struct WasmInstr {
    u32 code;
    Array$$<u64> imm;
    WasmBlock$ block;
    Array$$<any$> data;
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

struct WasmData
{
    u32 index;
    bool active;
    WasmMemory$ memory;
    ConstExpr$ offset;
    Bytes$$ bytes;
};


struct WasmModule {
    // general information
    String$$ name;
    bool isMain;
    // main collectios
    Array$$<WasmFunction$> functions;
    Array$$<WasmTable$> tables;
    Array$$<WasmMemory$> memories;
    Array$$<WasmGlobal$> globals;
    // table elements
    Array$$<WasmElement$> elements;
    // memory data
    Array$$<WasmData$> data;
    // entry
    WasmFunction$ startFunction;
    // functions with body only
    Array$$<WasmFunction$> definedFunctions;
    // function exports map
    std::map<std::string, std::map<std::string, WasmFunction$>> functionExports;
};

enum DumpFlags {
    DUMP_WASM_ASSEMBLY = 1,
    DUMP_TRI_ASSEMBLY = 2,
    DUMP_HEX_DATA = 4,
    DUMP_AFTER_REDUCE = 8,
};

DEFINE_ENUM_FLAG_OPERATORS(DumpFlags);

void dumpModule(std::ostream& out, WasmModule$ mod, DumpFlags flags);

#endif /* _WASM_DATA_HH_ */
