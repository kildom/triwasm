#include <sstream>
#include "Utils.hh"
#include "WasmData.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmParser.hh"
#include "WasmInstr.hh"
#include "Resolver.hh"
#include "Reducer.hh"
#include "VMConfig.hh"


void Reducer::reduce(WasmModule$$ mod)
{
    TRACE();

    this->mod = mod;

    for (auto func: mod->functions) {
        if (func->import == nullptr) {
            reduceFunction(func);
        }
    }

}


void Reducer::reduceFunction(WasmFunction$$ func)
{
    TRACE();

    stack->clear();
    blockStack = new$;
    function = func;

    reduceBlock(function->block);
}

void Reducer::reduceBlock(WasmBlock$ block)
{
    TRACE();
    Array$$<WasmInstr$> reduced = new$;
    blockStack->push(block);
    for (auto instr: block->body) {
        reduceInstr(instr, reduced);
    }
    blockStack->pop();
    block->body = reduced;
}


static u32 immBytes32(s32 value) {
    if (-0x7F <= value && value <= 0x80) {
        return 1;
    } else if (-0x7FFF <= value && value <= 0x8000) {
        return 2;
    } else {
        return 4;
    }
}

static u32 immBytes64(s64 value) {
    if (-0x7F <= value && value <= 0x80) {
        return 1;
    } else if (-0x7FFF <= value && value <= 0x8000) {
        return 2;
    } else if (-0x7FFFFFFFLL <= value && value <= 0x80000000LL) {
        return 4;
    } else if (-0x7FFFFFFFFFLL <= value && value <= 0x8000000000LL) {
        return 5;
    } else if (-0x7FFFFFFFFFFFLL <= value && value <= 0x800000000000LL) {
        return 6;
    } else {
        return 8;
    }
}


void Reducer::reduceInstr(WasmInstr$ instr, Array$$<WasmInstr$> reduced)
{
    Array$$<u64> imm = instr->imm;
    /* -- Begin of source code generated with help of "gen_instr.js" script -- */
    switch(instr->code) {
    case INSTR_BLOCK:
    case INSTR_LOOP:
    case INSTR_IF: {
        TRACE();
        instr->block->stackBase = stack->length() - instr->block->type->param->length();
        reduced->push(instr);
        reduceBlock(instr->block);
        break;
    }
    case INSTR_ELSE: {
        TRACE();
        reduced->push(WasmInstr{
            .code = INSTR_BR,
            .imm = { 0 },
        });
        reduced->push(instr);
        auto block = blockStack[RangeEnd - 1];
        stack[Range(block->stackBase)] = {};
        for (auto t : block->type->param) {
            stack->push(t);
        }
        break;
    }
    case INSTR_END: {
        TRACE();
        auto block = blockStack[RangeEnd - 1];
        reduced->push(WasmInstr{
            .code = INSTR_BR,
            .imm = { 0 },
        });
        WasmInstrBr$$(reduced[RangeEnd - 1]->data[0])->forceForward = true;
        stack[Range(block->stackBase, RangeEnd - block->type->result->length())] = {};
        reduced->push(instr);
        break;
    }
    case INSTR_BR: {
        TRACE();
        reduced->push(instr);
        break;
    }
    case INSTR_RETURN: {
        TRACE();
        reduced->push(WasmInstr{
            .code = INSTR_BR,
            .imm = { (u64)blockStack->length() - 1 },
        });
        break;
    }
    case INSTR_BR_IF: {
        TRACE();
        reduced->push(WasmInstr{
            .code = INSTR_BR,
            .imm = { 0 },
        });
        WasmInstrBr$$(reduced[RangeEnd - 1]->data[0])->conditional = true;
        break;
    }
    case INSTR_BR_TABLE: {
        TRACE();
        stack->pop();
        reduced->push(instr);
        break;
    }
    case INSTR_CALL: {
        TRACE();
        auto callee = mod->functions[imm[0]];
        stack->pop(callee->type->param->length());
        for (auto t : callee->type->result) {
            stack->push(t);
        }
        if (callee->import != nullptr && callee->import->module == "__trivm_builtin__") {
            reduced->push(WasmInstr{
                // TODO: .code = INSTR_TRIVM_BUILTIN,
                // TODO: .imm = { builtinFromName(callee->import->name) },
            });
        } else {
            reduced->push(instr);
        }
        break;
    }
    case INSTR_CALL_INDIRECT: {
        TRACE();
        WasmFunctionType$ type(instr->data[0]);
        stack->pop(type->param->length());
        reduced->push(instr);
        for (auto t : type->result) {
            stack->push(t);
        }
        break;
    }
    case INSTR_RETURN_CALL: {
        TRACE();
        FATAL("Unimplemented");
        auto callee = mod->functions[imm[0]];
        if (callee->import != nullptr && callee->import->module == "__trivm_builtin__") {
            reduced->push(WasmInstr{
                // TODO: .code = INSTR_TRIVM_BUILTIN,
                // TODO: .imm = { builtinFromName(callee->import->name) },
            });
        } else {
            reduced->push(instr);
        }
        break;
    }
    case INSTR_RETURN_CALL_INDIRECT: {
        TRACE();
        FATAL("Unimplemented");
        break;
    }
    case INSTR_DROP: {
        TRACE();
        auto type = stack->pop();
        int words = wasmTypeWords(type);
        for (int i = 0; i < words; i++) {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_POP,
            });
        }
        break;
    }
    case INSTR_SELECT:
    case INSTR_SELECT_T: {
        TRACE();
        stack->pop();
        auto type = stack->pop();
        std::stringstream str;
        str << "__trivmlib__.select" << wasmTypeWords(type);
        reduced->push(WasmInstr{
            // TODO: .code = INSTR_TRIVM_CALL_IMPORT,
            // TODO: .immString = String$$(str.str()),
        });
        break;
    }
    case INSTR_LOCAL_GET: {
        TRACE();
        auto localType = function->locals[imm[0]];
        int words = wasmTypeWords(localType);
        for (int i = words - 1; i >= 0; i--) {
            reduced->push(WasmInstr{
                .code = INSTR_LOCAL_GET,
                .imm = { imm[0], (u64)(4 * i) },
            });
        }
        stack->push(localType);
        break;
    }
    case INSTR_LOCAL_SET: {
        TRACE();
        auto localType = stack->pop();
        int words = wasmTypeWords(localType);
        for (int i = 0; i < words; i++) {
            reduced->push(WasmInstr{
                .code = INSTR_LOCAL_SET,
                .imm = { imm[0], (u64)(4 * i) },
            });
        }
        break;
    }
    case INSTR_LOCAL_TEE: {
        TRACE();
        auto localType = function->locals[imm[0]];
        int words = wasmTypeWords(localType);
        for (int i = 0; i < words; i++) {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_DUP,
                .imm = { (u64)(4 * words - 4) },
            });
        }
        for (int i = 0; i < words; i++) {
            reduced->push(WasmInstr{
                .code = INSTR_LOCAL_SET,
                .imm = { imm[0], (u64)(4 * i) },
            });
        }
        break;
    }
    case INSTR_GLOBAL_GET: {
        TRACE();
        auto global = mod->globals[imm[0]];
        int words = wasmTypeWords(global->type);
        for (int i = words - 1; i >= 0; i--) {
            reduced->push(WasmInstr{
                .code = INSTR_GLOBAL_GET,
                .imm = { imm[0], (u64)(4 * i) },
            });
        }
        stack->push(global->type);
        break;
    }
    case INSTR_GLOBAL_SET: {
        TRACE();
        auto type = stack->pop();
        int words = wasmTypeWords(type);
        for (int i = 0; i < words; i++) {
            reduced->push(WasmInstr{
                .code = INSTR_GLOBAL_SET,
                .imm = { imm[0], (u64)(4 * i) },
            });
        }
        break;
    }
    case INSTR_TABLE_GET: {
        TRACE();
        FATAL("Unimplemented");
        break;
    }
    case INSTR_TABLE_SET: {
        TRACE();
        FATAL("Unimplemented");
        break;
    }
    case INSTR_REF_NULL: {
        TRACE();
        FATAL("Unimplemented");
        break;
    }
    case INSTR_REF_IS_NULL: {
        TRACE();
        FATAL("Unimplemented");
        break;
    }
    case INSTR_REF_FUNC: {
        TRACE();
        FATAL("Unimplemented");
        break;
    }
    case INSTR_MEMORY_INIT: {
        TRACE();
        FATAL("Unimplemented");
        break;
    }
    case INSTR_TABLE_INIT: {
        TRACE();
        FATAL("Unimplemented");
        break;
    }
    case INSTR_TABLE_COPY: {
        TRACE();
        FATAL("Unimplemented");
        break;
    }
    case INSTR_TABLE_GROW: {
        TRACE();
        FATAL("Unimplemented");
        break;
    }
    case INSTR_TABLE_SIZE: {
        TRACE();
        FATAL("Unimplemented");
        break;
    }
    case INSTR_TABLE_FILL: {
        TRACE();
        FATAL("Unimplemented");
        break;
    }
    // ===== Generated reducers =====
    case INSTR_UNREACHABLE: {
        TRACE();
        if (vmConfig.ext.unreachable) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "unreachable"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_EMPTY,
            });
        }
        break;
    }
    #if 1
    case INSTR_NOP:
    case INSTR_DATA_DROP:
    case INSTR_ELEM_DROP: {
        TRACE();
        reduced->push(WasmInstr{
            .code = INSTR_TRIVM_EMPTY,
        });
        break;
    }
    case INSTR_I32_LOAD:
    case INSTR_I32_LOAD8_S:
    case INSTR_I32_LOAD8_U:
    case INSTR_I32_LOAD16_S:
    case INSTR_I32_LOAD16_U:
    case INSTR_I32_EQZ: {
        TRACE();
        stack->pop();
        reduced->push(instr);
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_LOAD: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.any64 && imm[0] == 0) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_load_0"_S, true)) },
            });
        } else if (!vmConfig.ext.any64) {
            reduced->push(WasmInstr{
                .code = INSTR_I32_CONST,
                .imm = { imm[0] },
            });
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_load"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_F32_LOAD: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_I32_LOAD,
            .imm = { imm[0] },
        });
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F64_LOAD: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.any64 && imm[0] == 0) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_load_0"_S, true)) },
            });
        } else if (!vmConfig.ext.any64) {
            reduced->push(WasmInstr{
                .code = INSTR_I32_CONST,
                .imm = { imm[0] },
            });
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_load"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_I64_LOAD,
                .imm = { imm[0] },
            });
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_I64_LOAD8_S: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_I32_LOAD8_S,
            .imm = { imm[0] },
        });
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_extend_i32_s"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_SHL64WL,
                .imm = { 0 },
            });
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_LOAD8_U: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_I32_LOAD8_U,
            .imm = { imm[0] },
        });
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_extend_i32_u"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_LOW64WL,
            });
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_LOAD16_S: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_I32_LOAD16_S,
            .imm = { imm[0] },
        });
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_extend_i32_s"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_SHL64WL,
                .imm = { 0 },
            });
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_LOAD16_U: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_I32_LOAD16_U,
            .imm = { imm[0] },
        });
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_extend_i32_u"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_LOW64WL,
            });
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_LOAD32_S: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_I32_LOAD,
            .imm = { imm[0] },
        });
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_extend_i32_s"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_SHL64WL,
                .imm = { 0 },
            });
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_LOAD32_U: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_I32_LOAD,
            .imm = { imm[0] },
        });
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_extend_i32_u"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_LOW64WL,
            });
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I32_STORE:
    case INSTR_I32_STORE8:
    case INSTR_I32_STORE16: {
        TRACE();
        stack->pop(2);
        reduced->push(instr);
        break;
    }
    case INSTR_I64_STORE: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.any64 && imm[0] == 0) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_store_0"_S, true)) },
            });
        } else if (!vmConfig.ext.any64) {
            reduced->push(WasmInstr{
                .code = INSTR_I32_CONST,
                .imm = { imm[0] },
            });
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_store"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        break;
    }
    case INSTR_F32_STORE: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_I32_STORE,
            .imm = { imm[0] },
        });
        break;
    }
    case INSTR_F64_STORE: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.any64 && imm[0] == 0) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_store_0"_S, true)) },
            });
        } else if (!vmConfig.ext.any64) {
            reduced->push(WasmInstr{
                .code = INSTR_I32_CONST,
                .imm = { imm[0] },
            });
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_store"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        break;
    }
    case INSTR_I64_STORE8: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_I32_STORE8,
            .imm = { imm[0] },
        });
        reduced->push(WasmInstr{
            .code = INSTR_TRIVM_POP,
        });
        break;
    }
    case INSTR_I64_STORE16: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_I32_STORE16,
            .imm = { imm[0] },
        });
        reduced->push(WasmInstr{
            .code = INSTR_TRIVM_POP,
        });
        break;
    }
    case INSTR_I64_STORE32: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_I32_STORE,
            .imm = { imm[0] },
        });
        reduced->push(WasmInstr{
            .code = INSTR_TRIVM_POP,
        });
        break;
    }
    case INSTR_MEMORY_SIZE: {
        TRACE();
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "memory_size"_S, true)) },
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_MEMORY_GROW: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "memory_grow"_S, true)) },
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_CONST: {
        TRACE();
        reduced->push(instr);
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_CONST: {
        TRACE();
        if (!vmConfig.ext.any64 || immBytes32(imm[0]) + immBytes32(imm[0] >> 32) < immBytes64(imm[0])) {
            reduced->push(WasmInstr{
                .code = INSTR_I32_CONST,
                .imm = { imm[0] >> 32 },
            });
            reduced->push(WasmInstr{
                .code = INSTR_I32_CONST,
                .imm = { imm[0] & 0xFFFFFFFF },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_F32_CONST: {
        TRACE();
        reduced->push(WasmInstr{
            .code = INSTR_I32_CONST,
            .imm = { imm[0] },
        });
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F64_CONST: {
        TRACE();
        if (!vmConfig.ext.any64 || immBytes32(imm[0]) + immBytes32(imm[0] >> 32) < immBytes64(imm[0])) {
            reduced->push(WasmInstr{
                .code = INSTR_I32_CONST,
                .imm = { imm[0] >> 32 },
            });
            reduced->push(WasmInstr{
                .code = INSTR_I32_CONST,
                .imm = { imm[0] & 0xFFFFFFFF },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_I64_CONST,
                .imm = { imm[0] },
            });
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_I32_EQ:
    case INSTR_I32_LT_S:
    case INSTR_I32_LT_U:
    case INSTR_I32_GT_S:
    case INSTR_I32_GT_U:
    case INSTR_I32_ADD:
    case INSTR_I32_SUB:
    case INSTR_I32_MUL:
    case INSTR_I32_DIV_S:
    case INSTR_I32_DIV_U:
    case INSTR_I32_REM_S:
    case INSTR_I32_REM_U:
    case INSTR_I32_AND:
    case INSTR_I32_OR:
    case INSTR_I32_XOR:
    case INSTR_I32_SHL:
    case INSTR_I32_SHR_S:
    case INSTR_I32_SHR_U: {
        TRACE();
        stack->pop(2);
        reduced->push(instr);
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_NE: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_I32_EQ,
        });
        reduced->push(WasmInstr{
            .code = INSTR_I32_EQZ,
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_LE_S: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_I32_GT_S,
        });
        reduced->push(WasmInstr{
            .code = INSTR_I32_EQZ,
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_LE_U: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_I32_GT_U,
        });
        reduced->push(WasmInstr{
            .code = INSTR_I32_EQZ,
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_GE_S: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_I32_LT_S,
        });
        reduced->push(WasmInstr{
            .code = INSTR_I32_EQZ,
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_GE_U: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_I32_LT_U,
        });
        reduced->push(WasmInstr{
            .code = INSTR_I32_EQZ,
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_EQZ: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_eqz"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_EQ: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_eq"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_NE: {
        TRACE();
        stack->pop(2);
        if (vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_I64_EQ,
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_eq"_S, true)) },
            });
        }
        reduced->push(WasmInstr{
            .code = INSTR_I32_EQZ,
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_LT_S: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_lt_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_LT_U: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_lt_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_GT_S: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_gt_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_GT_U: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_gt_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_LE_S: {
        TRACE();
        stack->pop(2);
        if (vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_I64_GT_S,
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_gt_s"_S, true)) },
            });
        }
        reduced->push(WasmInstr{
            .code = INSTR_I32_EQZ,
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_LE_U: {
        TRACE();
        stack->pop(2);
        if (vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_I64_GT_U,
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_gt_u"_S, true)) },
            });
        }
        reduced->push(WasmInstr{
            .code = INSTR_I32_EQZ,
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_GE_S: {
        TRACE();
        stack->pop(2);
        if (vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_I64_LT_S,
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_lt_s"_S, true)) },
            });
        }
        reduced->push(WasmInstr{
            .code = INSTR_I32_EQZ,
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_GE_U: {
        TRACE();
        stack->pop(2);
        if (vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_I64_LT_U,
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_lt_u"_S, true)) },
            });
        }
        reduced->push(WasmInstr{
            .code = INSTR_I32_EQZ,
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_F32_EQ: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_eq"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_F32_NE: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_ne"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_F32_LT: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_lt"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_F32_GT: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_gt"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_F32_LE: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_le"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_F32_GE: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_ge"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_F64_EQ: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_eq"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_F64_NE: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_ne"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_F64_LT: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_lt"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_F64_GT: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_gt"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_F64_LE: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_le"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_F64_GE: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_ge"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_CLZ: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_clz"_S, true)) },
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_CTZ: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_ctz"_S, true)) },
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_POPCNT: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_popcnt"_S, true)) },
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_ROTL: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_rotl"_S, true)) },
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_ROTR: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_rotr"_S, true)) },
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_CLZ: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_clz"_S, true)) },
        });
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_CTZ: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_ctz"_S, true)) },
        });
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_POPCNT: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_popcnt"_S, true)) },
        });
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_ADD: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_add"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_SUB: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_sub"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_MUL: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_mul"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_DIV_S: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_div_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_DIV_U: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_div_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_REM_S: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_rem_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_REM_U: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_rem_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_AND: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_and"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_OR: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_or"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_XOR: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_xor"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_SHL: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_shl"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_SHR_S: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_shr_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_SHR_U: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_shr_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_ROTL: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_rotl"_S, true)) },
        });
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_ROTR: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_rotr"_S, true)) },
        });
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_F32_ABS: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_I32_AND,
            .imm = { 0x7FFFFFFFu },
        });
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_NEG: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_I32_XOR,
            .imm = { 0x80000000u },
        });
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_CEIL: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_ceil"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_FLOOR: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_floor"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_TRUNC: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_trunc"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_NEAREST: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_nearest"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_SQRT: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_sqrt"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_ADD: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_add"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_SUB: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_sub"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_MUL: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_mul"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_DIV: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_div"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_MIN: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_min"_S, true)) },
        });
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_MAX: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_max"_S, true)) },
        });
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_COPYSIGN: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_copysign"_S, true)) },
        });
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F64_ABS: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_abs"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_I64_CONST,
                .imm = { u64(-1) },
            });
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_USHR64LL,
                .imm = { 1 },
            });
            reduced->push(WasmInstr{
                .code = INSTR_I64_AND,
            });
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_NEG: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_neg"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_I32_CONST,
                .imm = { 1 },
            });
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_SHL64WL,
                .imm = { 63 },
            });
            reduced->push(WasmInstr{
                .code = INSTR_I64_XOR,
            });
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_CEIL: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_ceil"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_FLOOR: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_floor"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_TRUNC: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_trunc"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_NEAREST: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_nearest"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_SQRT: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_sqrt"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_ADD: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_add"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_SUB: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_sub"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_MUL: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_mul"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_DIV: {
        TRACE();
        stack->pop(2);
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_div"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_MIN: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_min"_S, true)) },
        });
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_MAX: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_max"_S, true)) },
        });
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_COPYSIGN: {
        TRACE();
        stack->pop(2);
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_copysign"_S, true)) },
        });
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_I32_WRAP_I64: {
        TRACE();
        stack->pop();
        reduced->push(instr);
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_TRUNC_F32_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_trunc_f32_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_TRUNC_F32_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_trunc_f32_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_TRUNC_F64_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_trunc_f64_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_TRUNC_F64_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_trunc_f64_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_EXTEND_I32_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_extend_i32_s"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_SHL64WL,
                .imm = { 0 },
            });
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_EXTEND_I32_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_extend_i32_u"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_LOW64WL,
            });
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_TRUNC_F32_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_trunc_f32_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_TRUNC_F32_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_trunc_f32_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_TRUNC_F64_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_trunc_f64_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_TRUNC_F64_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_trunc_f64_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_F32_CONVERT_I32_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_convert_i32_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_CONVERT_I32_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_convert_i32_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_CONVERT_I64_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_convert_i64_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_CONVERT_I64_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_convert_i64_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F32_DEMOTE_F64: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32 || !vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f32_demote_f64"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F64_CONVERT_I32_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_convert_i32_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_CONVERT_I32_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_convert_i32_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_CONVERT_I64_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_convert_i64_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_CONVERT_I64_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_convert_i64_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_F64_PROMOTE_F32: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32 || !vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "f64_promote_f32"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_I32_REINTERPRET_F32: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_TRIVM_EMPTY,
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_REINTERPRET_F64: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_TRIVM_EMPTY,
        });
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_F32_REINTERPRET_I32: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_TRIVM_EMPTY,
        });
        stack->push(TYPE_F32);
        break;
    }
    case INSTR_F64_REINTERPRET_I64: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_TRIVM_EMPTY,
        });
        stack->push(TYPE_F64);
        break;
    }
    case INSTR_I32_EXTEND8_S: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_TRIVM_EXTS,
            .imm = { 24 },
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_EXTEND16_S: {
        TRACE();
        stack->pop();
        reduced->push(WasmInstr{
            .code = INSTR_TRIVM_EXTS,
            .imm = { 16 },
        });
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_EXTEND8_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_extend8_s"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_EXTS64LL,
                .imm = { 56 },
            });
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_EXTEND16_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_extend16_s"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_EXTS64LL,
                .imm = { 48 },
            });
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_EXTEND32_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.i64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_extend32_s"_S, true)) },
            });
        } else {
            reduced->push(WasmInstr{
                .code = INSTR_TRIVM_EXTS64LL,
                .imm = { 32 },
            });
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I32_TRUNC_SAT_F32_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_trunc_sat_f32_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_TRUNC_SAT_F32_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_trunc_sat_f32_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_TRUNC_SAT_F64_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_trunc_sat_f64_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I32_TRUNC_SAT_F64_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i32_trunc_sat_f64_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I32);
        break;
    }
    case INSTR_I64_TRUNC_SAT_F32_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_trunc_sat_f32_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_TRUNC_SAT_F32_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f32) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_trunc_sat_f32_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_TRUNC_SAT_F64_S: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_trunc_sat_f64_s"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_I64_TRUNC_SAT_F64_U: {
        TRACE();
        stack->pop();
        if (!vmConfig.ext.f64) {
            reduced->push(WasmInstr{
                .code = INSTR_CALL,
                .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "i64_trunc_sat_f64_u"_S, true)) },
            });
        } else {
            reduced->push(instr);
        }
        stack->push(TYPE_I64);
        break;
    }
    case INSTR_MEMORY_COPY: {
        TRACE();
        stack->pop(3);
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "memory.copy"_S, true)) },
        });
        break;
    }
    case INSTR_MEMORY_FILL: {
        TRACE();
        stack->pop(3);
        reduced->push(WasmInstr{
            .code = INSTR_CALL,
            .data = { any$::get(Resolver::getExport(mod, "__trivmlib"_S, "memory.fill"_S, true)) },
        });
        break;
    }
    #endif
    default:
        FATAL("Unexpected instruction");
        break;
    };
    /* -- End of source code generated with help of "gen_instr.js" script -- */
}

