

#include "Utils.hh"
#include <iostream>
#include <sstream>

#include "WasmData.hh"
#include "WasmConsts.hh"
#include "WasmInstr.hh"

struct TypeList
{
    Array$$<u32> list;
    bool forceBrackets;
};

static const char* instrName(u32 opcode);

std::ostream& operator<<(std::ostream& out, const TypeList& list)
{
    bool brackets = list.forceBrackets || (list.list->length() > 1);
    if (brackets)
        out << "(";
    for (int i = 0; i < list.list->length(); i++) {
        if (i > 0)
            out << ", ";
        auto p = list.list[i];
        out << wasmTypeName(p);
    }
    if (brackets)
        out << ")";
    if (!brackets && list.list->length() == 0)
        out << "void";
    return out;
}

static u32 blockLabelIndex = 1;

static void dumpImm(std::ostream& out, WasmInstr$ instr, Array$$<u32> blockStack) {
    switch (instr->code)
    {
    case INSTR_BR:
    case INSTR_BR_IF: {
        out << instr->imm[0] << " {block" << blockStack[blockStack->length() - 1 - instr->imm[0]] << "} ";
        auto d = WasmInstrBr$$(instr->data);
        if (d->conditional) out << "(conditional)";
        if (d->forceForward) out << "(forward)";
        if (d->negated) out << "(negated)";
        break;
    }
    
    default:
        for (auto imm : instr->imm) {
            out << imm << " ";
        }
        if (instr->immString != nullptr && instr->immString->length()) {
            out << "\"" << instr->immString->buffer() << "\" ";
        }
        break;
    }
}

static void dumpInstr(std::ostream& out, String$$ ind, Array$$<WasmInstr$> instrList, Array$$<u32> blockStack = Array$$<u32>())
{
    for (auto instr : instrList) {
        if (instr->block != nullptr) {
            out << ind->buffer() << instrName(instr->code) << " {block" << blockLabelIndex << "} ";
            dumpImm(out, instr, blockStack);
            if (instr->block->type->param->length() > 0 || instr->block->type->result->length() > 0) {
                out << TypeList{instr->block->type->param, true} << ":" << TypeList{instr->block->type->result, false} << std::endl;
            } else {
                out << std::endl;
            }
            blockStack->push(blockLabelIndex);
            blockLabelIndex++;
            dumpInstr(out, ind + "  ", instr->block->body, blockStack);
            blockStack->pop();
        } else {
            out << ind->buffer() << instrName(instr->code) << " ";
            dumpImm(out, instr, blockStack);
            out << std::endl;
        }
    }
}

void dumpModule(WasmModule$ mod)
{
    //std::stringstream out;
    auto &out = std::cout;

    //out << "================== MODULE " <<  << std::endl;

    out << "Function types: " << std::endl;
    for (int i = 0; i < mod->functionTypes->length(); i++) {
        auto t = mod->functionTypes[i];
        out << "  [" << i << "] " << TypeList{t->param, true} << ":" << TypeList{t->result, false} << std::endl;
    }

    out << "Tables: " << std::endl;
    for (auto t : mod->tables) {
        out << "  [" << t->index << "] " << wasmTypeName(t->type) << ", size = ";
        if (t->unlimited) {
            out << t->min << " or more";
        } else if (t->min == t->max) {
            out << t->min;
        } else {
            out << "from " << t->min << " to " << t->max;
        }
        if (t->import != nullptr) {
            out << ", import as " << t->import->module->buffer() << "." << t->import->name->buffer();
        }
        if (t->exportName != nullptr) {
            out << ", export as " << t->exportName->buffer();
        }
        out << std::endl;
    }

    out << "Memories: " << std::endl;
    for (auto m : mod->memories) {
        out << "  [" << m->index << "] size = ";
        if (m->unlimited) {
            out << m->min << " or more";
        } else if (m->min == m->max) {
            out << m->min;
        } else {
            out << "from " << m->min << " to " << m->max;
        }
        if (m->import != nullptr) {
            out << ", import as " << m->import->module->buffer() << "." << m->import->name->buffer();
        }
        if (m->exportName != nullptr) {
            out << ", export as " << m->exportName->buffer();
        }
        out << std::endl;
    }

    out << "Globals: " << std::endl;
    for (auto g : mod->globals) {
        out << "  [" << g->index << "] " << (g->mut ? "var " : "const ") << wasmTypeName(g->type);
        if (g->import != nullptr) {
            out << ", import as " << g->import->module->buffer() << "." << g->import->name->buffer();
        }
        if (g->exportName != nullptr) {
            out << ", export as " << g->exportName->buffer();
        }
        if (g->initializer != nullptr) {
            out << ", initialization:" << std::endl;
            dumpInstr(out, "    "_S, g->initializer);
        } else {
            out << std::endl;
        }
    }

    out << "Functions: " << std::endl;
    for (auto f : mod->functions) {
        out << "  [" << f->index << "] " << TypeList{f->type->param, true} << ":" << TypeList{f->type->result, false};
        if (f->import != nullptr) {
            out << ", import as " << f->import->module->buffer() << "." << f->import->name->buffer();
        }
        if (f->exportName != nullptr) {
            out << ", export as " << f->exportName->buffer();
        }
        if (f == mod->startFunction) {
            out << ", startup function";
        }
        if (f->block != nullptr) {
            out << std::endl << "    locals:" << std::endl;
            if (f->locals != nullptr) {
                int localIndex = 0;
                for (auto t : f->locals) {
                    out << "      [" << localIndex << "] " << wasmTypeName(t);
                    if (localIndex < f->type->param->length())
                        out << " (param) ";
                    out << std::endl;
                    localIndex++;
                }
            }
            out << "    body:" << std::endl;
            dumpInstr(out, "      "_S, f->block->body);
        } else {
            out << std::endl;
        }
    }

    out << "Data: " << std::endl;
    for (auto d : mod->data) {
        out << "  [" << d->index << "] " << (d->active ? "active" : "passive");
        if (d->memory != nullptr) {
            out << " for memory " << d->memory->index << std::endl;
        } else {
            out << std::endl;
        }
        if (d->offset != nullptr) {
            out << "    offset:" << std::endl;
            dumpInstr(out, "      "_S, d->offset);
        }
        if (d->bytes != nullptr) {
            std::ios::fmtflags saved(out.flags());
            out << "    content:" << std::endl << std::setfill('0') << std::uppercase << std::hex << std::internal;
            for (ssize line = 0; line < d->bytes->length(); line += 32) {
                out << "      0x" << std::setw(8) << line << ": ";
                for (ssize byte = line; byte < std::min(line + 32, d->bytes->length()); byte++) {
                    if (byte % 32 == 16)
                        out << " ";
                    out << ' ' << std::setw(2) << (int)d->bytes[byte];
                }
                out << std::endl;
            }
            out.flags(saved);
        }
    }

    out << "Elements: " << std::endl;
    for (auto e : mod->elements) {
        out << "  [" << e->index << "] " << (e->kind == WASM_ELEMENT_ACTIVE ? "active" : e->kind == WASM_ELEMENT_PASSIVE ? "passive" : "declarative");
        if (e->table != nullptr) {
            out << " for table " << e->table->index << std::endl;
        } else {
            out << std::endl;
        }
        if (e->offset != nullptr) {
            out << "    offset:" << std::endl;
            dumpInstr(out, "      "_S, e->offset);
        }
        if (e->exprItems != nullptr) {
            for (auto item : e->exprItems) {
                out << "    item:" << std::endl;
                dumpInstr(out, "      "_S, item);
            }
        }
        if (e->functionItems != nullptr) {
            for (auto item : e->functionItems) {
                out << "    function " << item->index << std::endl;
            }
        }
    }

    //printf("%s", out.str().c_str());
}

static const char* instrName(u32 opcode)
{
    switch (opcode)
    {
    /* -- Begin of source code generated with help of "gen_instr.js" script -- */
    case INSTR_UNREACHABLE: return "unreachable";
    case INSTR_NOP: return "nop";
    case INSTR_BLOCK: return "block";
    case INSTR_LOOP: return "loop";
    case INSTR_IF: return "if";
    case INSTR_ELSE: return "else";
    case INSTR_END: return "end";
    case INSTR_BR: return "br";
    case INSTR_BR_IF: return "br_if";
    case INSTR_BR_TABLE: return "br_table";
    case INSTR_RETURN: return "return";
    case INSTR_CALL: return "call";
    case INSTR_CALL_INDIRECT: return "call_indirect";
    case INSTR_RETURN_CALL: return "return_call";
    case INSTR_RETURN_CALL_INDIRECT: return "return_call_indirect";
    case INSTR_DROP: return "drop";
    case INSTR_SELECT: return "select";
    case INSTR_SELECT_T: return "select_t";
    case INSTR_LOCAL_GET: return "local.get";
    case INSTR_LOCAL_SET: return "local.set";
    case INSTR_LOCAL_TEE: return "local.tee";
    case INSTR_GLOBAL_GET: return "global.get";
    case INSTR_GLOBAL_SET: return "global.set";
    case INSTR_TABLE_GET: return "table.get";
    case INSTR_TABLE_SET: return "table.set";
    case INSTR_I32_LOAD: return "i32.load";
    case INSTR_I64_LOAD: return "i64.load";
    case INSTR_F32_LOAD: return "f32.load";
    case INSTR_F64_LOAD: return "f64.load";
    case INSTR_I32_LOAD8_S: return "i32.load8_s";
    case INSTR_I32_LOAD8_U: return "i32.load8_u";
    case INSTR_I32_LOAD16_S: return "i32.load16_s";
    case INSTR_I32_LOAD16_U: return "i32.load16_u";
    case INSTR_I64_LOAD8_S: return "i64.load8_s";
    case INSTR_I64_LOAD8_U: return "i64.load8_u";
    case INSTR_I64_LOAD16_S: return "i64.load16_s";
    case INSTR_I64_LOAD16_U: return "i64.load16_u";
    case INSTR_I64_LOAD32_S: return "i64.load32_s";
    case INSTR_I64_LOAD32_U: return "i64.load32_u";
    case INSTR_I32_STORE: return "i32.store";
    case INSTR_I64_STORE: return "i64.store";
    case INSTR_F32_STORE: return "f32.store";
    case INSTR_F64_STORE: return "f64.store";
    case INSTR_I32_STORE8: return "i32.store8";
    case INSTR_I32_STORE16: return "i32.store16";
    case INSTR_I64_STORE8: return "i64.store8";
    case INSTR_I64_STORE16: return "i64.store16";
    case INSTR_I64_STORE32: return "i64.store32";
    case INSTR_MEMORY_SIZE: return "memory.size";
    case INSTR_MEMORY_GROW: return "memory.grow";
    case INSTR_I32_CONST: return "i32.const";
    case INSTR_I64_CONST: return "i64.const";
    case INSTR_F32_CONST: return "f32.const";
    case INSTR_F64_CONST: return "f64.const";
    case INSTR_I32_EQZ: return "i32.eqz";
    case INSTR_I32_EQ: return "i32.eq";
    case INSTR_I32_NE: return "i32.ne";
    case INSTR_I32_LT_S: return "i32.lt_s";
    case INSTR_I32_LT_U: return "i32.lt_u";
    case INSTR_I32_GT_S: return "i32.gt_s";
    case INSTR_I32_GT_U: return "i32.gt_u";
    case INSTR_I32_LE_S: return "i32.le_s";
    case INSTR_I32_LE_U: return "i32.le_u";
    case INSTR_I32_GE_S: return "i32.ge_s";
    case INSTR_I32_GE_U: return "i32.ge_u";
    case INSTR_I64_EQZ: return "i64.eqz";
    case INSTR_I64_EQ: return "i64.eq";
    case INSTR_I64_NE: return "i64.ne";
    case INSTR_I64_LT_S: return "i64.lt_s";
    case INSTR_I64_LT_U: return "i64.lt_u";
    case INSTR_I64_GT_S: return "i64.gt_s";
    case INSTR_I64_GT_U: return "i64.gt_u";
    case INSTR_I64_LE_S: return "i64.le_s";
    case INSTR_I64_LE_U: return "i64.le_u";
    case INSTR_I64_GE_S: return "i64.ge_s";
    case INSTR_I64_GE_U: return "i64.ge_u";
    case INSTR_F32_EQ: return "f32.eq";
    case INSTR_F32_NE: return "f32.ne";
    case INSTR_F32_LT: return "f32.lt";
    case INSTR_F32_GT: return "f32.gt";
    case INSTR_F32_LE: return "f32.le";
    case INSTR_F32_GE: return "f32.ge";
    case INSTR_F64_EQ: return "f64.eq";
    case INSTR_F64_NE: return "f64.ne";
    case INSTR_F64_LT: return "f64.lt";
    case INSTR_F64_GT: return "f64.gt";
    case INSTR_F64_LE: return "f64.le";
    case INSTR_F64_GE: return "f64.ge";
    case INSTR_I32_CLZ: return "i32.clz";
    case INSTR_I32_CTZ: return "i32.ctz";
    case INSTR_I32_POPCNT: return "i32.popcnt";
    case INSTR_I32_ADD: return "i32.add";
    case INSTR_I32_SUB: return "i32.sub";
    case INSTR_I32_MUL: return "i32.mul";
    case INSTR_I32_DIV_S: return "i32.div_s";
    case INSTR_I32_DIV_U: return "i32.div_u";
    case INSTR_I32_REM_S: return "i32.rem_s";
    case INSTR_I32_REM_U: return "i32.rem_u";
    case INSTR_I32_AND: return "i32.and";
    case INSTR_I32_OR: return "i32.or";
    case INSTR_I32_XOR: return "i32.xor";
    case INSTR_I32_SHL: return "i32.shl";
    case INSTR_I32_SHR_S: return "i32.shr_s";
    case INSTR_I32_SHR_U: return "i32.shr_u";
    case INSTR_I32_ROTL: return "i32.rotl";
    case INSTR_I32_ROTR: return "i32.rotr";
    case INSTR_I64_CLZ: return "i64.clz";
    case INSTR_I64_CTZ: return "i64.ctz";
    case INSTR_I64_POPCNT: return "i64.popcnt";
    case INSTR_I64_ADD: return "i64.add";
    case INSTR_I64_SUB: return "i64.sub";
    case INSTR_I64_MUL: return "i64.mul";
    case INSTR_I64_DIV_S: return "i64.div_s";
    case INSTR_I64_DIV_U: return "i64.div_u";
    case INSTR_I64_REM_S: return "i64.rem_s";
    case INSTR_I64_REM_U: return "i64.rem_u";
    case INSTR_I64_AND: return "i64.and";
    case INSTR_I64_OR: return "i64.or";
    case INSTR_I64_XOR: return "i64.xor";
    case INSTR_I64_SHL: return "i64.shl";
    case INSTR_I64_SHR_S: return "i64.shr_s";
    case INSTR_I64_SHR_U: return "i64.shr_u";
    case INSTR_I64_ROTL: return "i64.rotl";
    case INSTR_I64_ROTR: return "i64.rotr";
    case INSTR_F32_ABS: return "f32.abs";
    case INSTR_F32_NEG: return "f32.neg";
    case INSTR_F32_CEIL: return "f32.ceil";
    case INSTR_F32_FLOOR: return "f32.floor";
    case INSTR_F32_TRUNC: return "f32.trunc";
    case INSTR_F32_NEAREST: return "f32.nearest";
    case INSTR_F32_SQRT: return "f32.sqrt";
    case INSTR_F32_ADD: return "f32.add";
    case INSTR_F32_SUB: return "f32.sub";
    case INSTR_F32_MUL: return "f32.mul";
    case INSTR_F32_DIV: return "f32.div";
    case INSTR_F32_MIN: return "f32.min";
    case INSTR_F32_MAX: return "f32.max";
    case INSTR_F32_COPYSIGN: return "f32.copysign";
    case INSTR_F64_ABS: return "f64.abs";
    case INSTR_F64_NEG: return "f64.neg";
    case INSTR_F64_CEIL: return "f64.ceil";
    case INSTR_F64_FLOOR: return "f64.floor";
    case INSTR_F64_TRUNC: return "f64.trunc";
    case INSTR_F64_NEAREST: return "f64.nearest";
    case INSTR_F64_SQRT: return "f64.sqrt";
    case INSTR_F64_ADD: return "f64.add";
    case INSTR_F64_SUB: return "f64.sub";
    case INSTR_F64_MUL: return "f64.mul";
    case INSTR_F64_DIV: return "f64.div";
    case INSTR_F64_MIN: return "f64.min";
    case INSTR_F64_MAX: return "f64.max";
    case INSTR_F64_COPYSIGN: return "f64.copysign";
    case INSTR_I32_WRAP_I64: return "i32.wrap_i64";
    case INSTR_I32_TRUNC_F32_S: return "i32.trunc_f32_s";
    case INSTR_I32_TRUNC_F32_U: return "i32.trunc_f32_u";
    case INSTR_I32_TRUNC_F64_S: return "i32.trunc_f64_s";
    case INSTR_I32_TRUNC_F64_U: return "i32.trunc_f64_u";
    case INSTR_I64_EXTEND_I32_S: return "i64.extend_i32_s";
    case INSTR_I64_EXTEND_I32_U: return "i64.extend_i32_u";
    case INSTR_I64_TRUNC_F32_S: return "i64.trunc_f32_s";
    case INSTR_I64_TRUNC_F32_U: return "i64.trunc_f32_u";
    case INSTR_I64_TRUNC_F64_S: return "i64.trunc_f64_s";
    case INSTR_I64_TRUNC_F64_U: return "i64.trunc_f64_u";
    case INSTR_F32_CONVERT_I32_S: return "f32.convert_i32_s";
    case INSTR_F32_CONVERT_I32_U: return "f32.convert_i32_u";
    case INSTR_F32_CONVERT_I64_S: return "f32.convert_i64_s";
    case INSTR_F32_CONVERT_I64_U: return "f32.convert_i64_u";
    case INSTR_F32_DEMOTE_F64: return "f32.demote_f64";
    case INSTR_F64_CONVERT_I32_S: return "f64.convert_i32_s";
    case INSTR_F64_CONVERT_I32_U: return "f64.convert_i32_u";
    case INSTR_F64_CONVERT_I64_S: return "f64.convert_i64_s";
    case INSTR_F64_CONVERT_I64_U: return "f64.convert_i64_u";
    case INSTR_F64_PROMOTE_F32: return "f64.promote_f32";
    case INSTR_I32_REINTERPRET_F32: return "i32.reinterpret_f32";
    case INSTR_I64_REINTERPRET_F64: return "i64.reinterpret_f64";
    case INSTR_F32_REINTERPRET_I32: return "f32.reinterpret_i32";
    case INSTR_F64_REINTERPRET_I64: return "f64.reinterpret_i64";
    case INSTR_I32_EXTEND8_S: return "i32.extend8_s";
    case INSTR_I32_EXTEND16_S: return "i32.extend16_s";
    case INSTR_I64_EXTEND8_S: return "i64.extend8_s";
    case INSTR_I64_EXTEND16_S: return "i64.extend16_s";
    case INSTR_I64_EXTEND32_S: return "i64.extend32_s";
    case INSTR_REF_NULL: return "ref.null";
    case INSTR_REF_IS_NULL: return "ref.is_null";
    case INSTR_REF_FUNC: return "ref.func";
    case INSTR_I32_TRUNC_SAT_F32_S: return "i32.trunc_sat_f32_s";
    case INSTR_I32_TRUNC_SAT_F32_U: return "i32.trunc_sat_f32_u";
    case INSTR_I32_TRUNC_SAT_F64_S: return "i32.trunc_sat_f64_s";
    case INSTR_I32_TRUNC_SAT_F64_U: return "i32.trunc_sat_f64_u";
    case INSTR_I64_TRUNC_SAT_F32_S: return "i64.trunc_sat_f32_s";
    case INSTR_I64_TRUNC_SAT_F32_U: return "i64.trunc_sat_f32_u";
    case INSTR_I64_TRUNC_SAT_F64_S: return "i64.trunc_sat_f64_s";
    case INSTR_I64_TRUNC_SAT_F64_U: return "i64.trunc_sat_f64_u";
    case INSTR_MEMORY_INIT: return "memory.init";
    case INSTR_DATA_DROP: return "data.drop";
    case INSTR_MEMORY_COPY: return "memory.copy";
    case INSTR_MEMORY_FILL: return "memory.fill";
    case INSTR_TABLE_INIT: return "table.init";
    case INSTR_ELEM_DROP: return "elem.drop";
    case INSTR_TABLE_COPY: return "table.copy";
    case INSTR_TABLE_GROW: return "table.grow";
    case INSTR_TABLE_SIZE: return "table.size";
    case INSTR_TABLE_FILL: return "table.fill";
    case INSTR_TRIVM_EMPTY: return "trivm.empty";
    case INSTR_TRIVM_CALL_IMPORT: return "trivm.call_import";
    case INSTR_TRIVM_EXTS: return "trivm.exts";
    case INSTR_TRIVM_EXTS64: return "trivm.exts64";
    case INSTR_TRIVM_POP: return "trivm.pop";
    case INSTR_TRIVM_DUP: return "trivm.dup";
    case INSTR_TRIVM_FUNCTION: return "trivm.function";
    case INSTR_TRIVM_BUILTIN: return "trivm.builtin";
    /* -- End of source code generated with help of "gen_instr.js" script -- */
    }
    FATAL("Unknown instruction opcode 0x%02X", opcode);
    return "";
}
