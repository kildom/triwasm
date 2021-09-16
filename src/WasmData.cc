

#include "Utils.hh"
#include <iostream>
#include <sstream>
#include <cfloat>
#include <iomanip>

#include "WasmData.hh"
#include "WasmConsts.hh"
#include "WasmInstr.hh"

class DataDump {
public:
    std::ostream& out;
    WasmModule$ mod;
    DumpFlags flags;
    u32 blockLabelIndex;
    Array$$<u32> blockStack;

    DataDump(std::ostream& out, WasmModule$ mod, DumpFlags flags) : out(out), mod(mod), flags(flags), blockLabelIndex(1)
    {
        dumpModule();
    }

    void dumpModule();
    void dumpConstInstr(String$$ ind, ConstExpr$ expr);
    void dumpBlockBody(String$$ ind, Array$$<WasmInstr$> instrList);
    void dumpInstr(String$$ ind, WasmInstr$ instr);

    void showBlockBody(String$$ ind, WasmInstr$ instr, u32 index);
    void showImmLabel(String$$ ind, WasmInstr$ instr, u32 index);
    void showImmLabels(String$$ ind, WasmInstr$ instr, u32 index);
    void showDataWasmInstrBr(String$$ ind, WasmInstr$ instr, u32 index);
    void showDataFunction(String$$ ind, WasmInstr$ instr, u32 index);
    void showDataFunctionType(String$$ ind, WasmInstr$ instr, u32 index);
    void showDataTable(String$$ ind, WasmInstr$ instr, u32 index);
    void showImmOffset(String$$ ind, WasmInstr$ instr, u32 index);
    void showDataGlobal(String$$ ind, WasmInstr$ instr, u32 index);
    void showImmTypes(String$$ ind, WasmInstr$ instr, u32 index);
    void showImmLocal(String$$ ind, WasmInstr$ instr, u32 index);
    void showImmValue(String$$ ind, WasmInstr$ instr, u32 index);
    void showImmF32Value(String$$ ind, WasmInstr$ instr, u32 index);
    void showImmF64Value(String$$ ind, WasmInstr$ instr, u32 index);
    void showImmRefType(String$$ ind, WasmInstr$ instr, u32 index);
    void showImmDataIndex(String$$ ind, WasmInstr$ instr, u32 index);
    void showDataElement(String$$ ind, WasmInstr$ instr, u32 index);
    void showImmBits(String$$ ind, WasmInstr$ instr, u32 index);
};

struct TypeList
{
    Array$$<u32> list;
    bool forceBrackets;
};

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


void dumpModule(std::ostream& out, WasmModule$ mod, DumpFlags flags)
{
    DataDump(out, mod, flags);
}


void DataDump::dumpModule()
{
    if (mod->isMain) {
        out << "================== MAIN MODULE " << mod->name.cStr() << std::endl;
    } else {
        out << "================== MERGED MODULE " << mod->name.cStr() << std::endl;
    }

    /*out << "Function types: " << std::endl;
    for (int i = 0; i < mod->length(); i++) {
        auto t = mod->functionTypes[i];
        out << "  [" << i << "] " << TypeList{t->param, true} << ":" << TypeList{t->result, false} << std::endl;
    }*/

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
            dumpConstInstr("    "_S, g->initializer);
        } else {
            out << std::endl;
        }
    }

    out << "Functions: " << std::endl;
    for (auto f : mod->functions) {
        out << "  [" << f->index << "] " << TypeList{f->type->param, true} << ":" << TypeList{f->type->result, false};
        if (f->exportNames != nullptr) {
            for (auto name : f->exportNames) {
                out << ", export as " << name.cStr();
            }
            if (f->moduleName != nullptr) {
                out << " from module " << f->moduleName.cStr();
            }
        }
        if (f == mod->startFunction) {
            out << ", startup function";
        }
        switch (f->kind)
        {
        case FUNCTION_WASM:
            out << ", normal wasm function";
            if (f->block != nullptr && (flags & DUMP_WASM_ASSEMBLY)) {
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
                blockStack = new$;
                dumpBlockBody("      "_S, f->block->body);
            } else {
                out << std::endl;
            }
            break;

        case FUNCTION_ANNOTATION:
            out << ", annotation function: " << String$$(f->data).cStr() << std::endl;
            break;
        
        case FUNCTION_IMPORT:
            out << ", import function";
            if (f->import != nullptr) {
                out << ", import as " << f->import->module.cStr() << "." << f->import->name.cStr();
            }
            out << std::endl;
            break;
        
        case FUNCTION_HOST_BY_INDEX:
            out << ", host function: index=" << *u32$$(f->data) << std::endl;
            break;
        
        case FUNCTION_HOST_BY_NAME:
            out << ", host function: name=" << String$$(f->data).cStr() << std::endl;
            break;
        
        case FUNCTION_ASSEMBLY:
        case FUNCTION_INLINE_ASSEMBLY:
            if (flags & DUMP_TRI_ASSEMBLY) {
                out << ", " << (f->kind == FUNCTION_ASSEMBLY ? "" : "inline ") << "assembly function:" << std::endl << "----------------------" << std::endl << String$$(f->data).cStr() << std::endl << "----------------------" << std::endl;
            } else {
                out << ", " << (f->kind == FUNCTION_ASSEMBLY ? "" : "inline ") << "assembly function" << std::endl;
            }
            break;
        
        case FUNCTION_LINK:
            out << ", links to function index " << WasmFunction$(f->data)->index << std::endl;
            break;
        
        case FUNCTION_UNUSED:
            out << ", unused function" << std::endl;
            break;
        
        default:
            FATAL("Unknown kind of function");
            break;
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
            dumpConstInstr("      "_S, d->offset);
        }
        if (d->bytes != nullptr && (flags & DUMP_HEX_DATA)) {
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
            dumpConstInstr("      "_S, e->offset);
        }
        if (e->exprItems != nullptr) {
            for (auto item : e->exprItems) {
                out << "    item:" << std::endl;
                dumpConstInstr("      "_S, item);
            }
        }
        if (e->functionItems != nullptr) {
            for (auto item : e->functionItems) {
                out << "    function " << item->index << std::endl;
            }
        }
    }
}

void DataDump::dumpConstInstr(String$$ ind, ConstExpr$ expr)
{
    switch (expr->kind) {
    case CONST_EXPR_UNDEFINED:
        out << ind->buffer() << "UNDEFINED" << std::endl;
        break;
    case CONST_EXPR_I32:
        out << ind->buffer() << "i32 " << expr->i32Value << std::endl;
        break;
    case CONST_EXPR_I64:
        out << ind->buffer() << "i64 " << expr->i64Value << std::endl;
        break;
    case CONST_EXPR_F32:
        out << ind->buffer() << "f32 " << expr->f32Value << std::endl;
        break;
    case CONST_EXPR_F64:
        out << ind->buffer() << "f64 " << expr->f64Value << std::endl;
        break;
    case CONST_EXPR_FUNC:
        out << ind->buffer() << "function " << expr->functionIndex << std::endl;
        break;
    case CONST_EXPR_NULL:
        out << ind->buffer() << "null" << std::endl;
        break;
    case CONST_EXPR_GLOBAL_IMPORT:
        out << ind->buffer() << "import global " << expr->globalIndex << std::endl;
        break;
    }
}

void DataDump::dumpBlockBody(String$$ ind, Array$$<WasmInstr$> instrList)
{
    TRACE();
    for (auto instr : instrList) {
        dumpInstr(ind, instr);
    }
}


void DataDump::showBlockBody(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    out << ", {block" << blockLabelIndex << "}";
    if (instr->block->type->param->length() > 0 || instr->block->type->result->length() > 0) {
        out << ", " << TypeList{instr->block->type->param, true} << ":" << TypeList{instr->block->type->result, false};
    }
    out << std::endl;
    blockStack->push(blockLabelIndex);
    blockLabelIndex++;
    dumpBlockBody(ind + "  ", instr->block->body);
    blockStack->pop();
}

void DataDump::showImmLabel(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    out << ", label = {block" << blockStack[blockStack->length() - 1 - instr->imm[index]] << "} ";
}

void DataDump::showImmLabels(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    out << ", labels = [";
    for (u32 i = index; i < instr->imm->length() - 1; i++) {
        out << " {block" << blockStack[blockStack->length() - 1 - instr->imm[i]] << "}";
    }
    out << " ], default = {block" << blockStack[blockStack->length() - 1 - instr->imm[instr->imm->length() - 1]] << "}";
}

void DataDump::showDataWasmInstrBr(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    auto br = WasmInstrBr$$(instr->data[index]);
    if (br->conditional) out << ", conditional";
    if (br->negated) out << ", negated";
    if (br->forceForward && instr->code == INSTR_LOOP) out << ", forward";
    if (br->skipBrInstr) out << ", skip final BR instruction";
}

void DataDump::showDataFunction(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    auto func = WasmFunction$$(instr->data[index]);
    out << ", funcindex = " << func->index;
}

void DataDump::showDataFunctionType(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    auto type = WasmFunctionType$$(instr->data[index]);
    out << ", type = " << TypeList{type->param, true} << ":" << TypeList{type->result, false};
}

void DataDump::showDataTable(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    auto table = WasmTable$$(instr->data[index]);
    out << ", tableindex = " << table->index;
}

void DataDump::showImmOffset(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    out << ", offset = " << instr->imm[index] << " (0x" << std::hex << instr->imm[index] << std::dec << ")";
}

void DataDump::showDataGlobal(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    auto global = WasmGlobal$$(instr->data[index]);
    out << ", globalindex = " << global->index;
}

void DataDump::showImmTypes(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    out << ", types = [";
    for (u32 i = index; i < instr->imm->length() - 1; i++) {
        out << " " << wasmTypeName(instr->imm[i]);
    }
    out << " ]";
}

void DataDump::showImmLocal(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    out << ", local = " << instr->imm[index];
}

void DataDump::showImmValue(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    out << ", value = " << instr->imm[index] << " (0x" << std::hex << instr->imm[index] << std::dec << ")";
}

void DataDump::showImmF32Value(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    union
    {
        u32 intValue;
        float floatValue;
    } tmp;
    tmp.intValue = instr->imm[index];
    out << ", value = " << std::setprecision(FLT_DIG + 2) << tmp.floatValue << " (0x" << std::hex << tmp.intValue << std::dec << ")";
}

void DataDump::showImmF64Value(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    union
    {
        u64 intValue;
        double floatValue;
    } tmp;
    tmp.intValue = instr->imm[index];
    out << ", value = " << std::setprecision(DBL_DIG + 2) << tmp.floatValue << " (0x" << std::hex << tmp.intValue << std::dec << ")";
}

void DataDump::showImmRefType(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    out << ", type = " << wasmTypeName(instr->imm[index]);
}

void DataDump::showImmDataIndex(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    out << ", dataindex = " << instr->imm[index];
}

void DataDump::showDataElement(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    auto data = WasmData$$(instr->data[index]);
    out << ", dataindex = " << data->index;
}

void DataDump::showImmBits(String$$ ind, WasmInstr$ instr, u32 index)
{
    TRACE();
    out << ", bits = " << instr->imm[index];
}

static void setName(const char* &name, const char* newName)
{
    if (name == nullptr) {
        name = newName;
    }
}

void DataDump::dumpInstr(String$$ ind, WasmInstr$ instr)
{
    const char* name = nullptr;
    auto imm = instr->imm;
    auto data = instr->data;
    bool reduced = flags & DUMP_AFTER_REDUCE;

    /* -- Begin of source code generated with help of "gen_instr.js" script -- */
    switch(instr->code) {
    case INSTR_UNREACHABLE:
        setName(name, "unreachable");
    case INSTR_NOP:
        setName(name, "nop");
    case INSTR_ELSE:
        setName(name, "else");
    case INSTR_END:
        setName(name, "end");
    case INSTR_RETURN:
        setName(name, "return");
    case INSTR_DROP:
        setName(name, "drop");
    case INSTR_SELECT:
        setName(name, "select");
    case INSTR_MEMORY_SIZE:
        setName(name, "memory.size");
    case INSTR_MEMORY_GROW:
        setName(name, "memory.grow");
    case INSTR_I32_EQZ:
        setName(name, "i32.eqz");
    case INSTR_I32_NE:
        setName(name, "i32.ne");
    case INSTR_I32_LE_S:
        setName(name, "i32.le_s");
    case INSTR_I32_LE_U:
        setName(name, "i32.le_u");
    case INSTR_I32_GE_S:
        setName(name, "i32.ge_s");
    case INSTR_I32_GE_U:
        setName(name, "i32.ge_u");
    case INSTR_I64_EQZ:
        setName(name, "i64.eqz");
    case INSTR_I64_NE:
        setName(name, "i64.ne");
    case INSTR_I64_LE_S:
        setName(name, "i64.le_s");
    case INSTR_I64_LE_U:
        setName(name, "i64.le_u");
    case INSTR_I64_GE_S:
        setName(name, "i64.ge_s");
    case INSTR_I64_GE_U:
        setName(name, "i64.ge_u");
    case INSTR_I32_CLZ:
        setName(name, "i32.clz");
    case INSTR_I32_CTZ:
        setName(name, "i32.ctz");
    case INSTR_I32_POPCNT:
        setName(name, "i32.popcnt");
    case INSTR_I32_ROTL:
        setName(name, "i32.rotl");
    case INSTR_I32_ROTR:
        setName(name, "i32.rotr");
    case INSTR_I64_CLZ:
        setName(name, "i64.clz");
    case INSTR_I64_CTZ:
        setName(name, "i64.ctz");
    case INSTR_I64_POPCNT:
        setName(name, "i64.popcnt");
    case INSTR_I64_ROTL:
        setName(name, "i64.rotl");
    case INSTR_I64_ROTR:
        setName(name, "i64.rotr");
    case INSTR_F32_ABS:
        setName(name, "f32.abs");
    case INSTR_F32_NEG:
        setName(name, "f32.neg");
    case INSTR_F32_CEIL:
        setName(name, "f32.ceil");
    case INSTR_F32_FLOOR:
        setName(name, "f32.floor");
    case INSTR_F32_TRUNC:
        setName(name, "f32.trunc");
    case INSTR_F32_NEAREST:
        setName(name, "f32.nearest");
    case INSTR_F32_SQRT:
        setName(name, "f32.sqrt");
    case INSTR_F32_MIN:
        setName(name, "f32.min");
    case INSTR_F32_MAX:
        setName(name, "f32.max");
    case INSTR_F32_COPYSIGN:
        setName(name, "f32.copysign");
    case INSTR_F64_ABS:
        setName(name, "f64.abs");
    case INSTR_F64_NEG:
        setName(name, "f64.neg");
    case INSTR_F64_CEIL:
        setName(name, "f64.ceil");
    case INSTR_F64_FLOOR:
        setName(name, "f64.floor");
    case INSTR_F64_TRUNC:
        setName(name, "f64.trunc");
    case INSTR_F64_NEAREST:
        setName(name, "f64.nearest");
    case INSTR_F64_SQRT:
        setName(name, "f64.sqrt");
    case INSTR_F64_MIN:
        setName(name, "f64.min");
    case INSTR_F64_MAX:
        setName(name, "f64.max");
    case INSTR_F64_COPYSIGN:
        setName(name, "f64.copysign");
    case INSTR_I32_WRAP_I64:
        setName(name, "i32.wrap_i64");
    case INSTR_I32_TRUNC_F32_S:
        setName(name, "i32.trunc_f32_s");
    case INSTR_I32_TRUNC_F32_U:
        setName(name, "i32.trunc_f32_u");
    case INSTR_I32_TRUNC_F64_S:
        setName(name, "i32.trunc_f64_s");
    case INSTR_I32_TRUNC_F64_U:
        setName(name, "i32.trunc_f64_u");
    case INSTR_I64_EXTEND_I32_S:
        setName(name, "i64.extend_i32_s");
    case INSTR_I64_EXTEND_I32_U:
        setName(name, "i64.extend_i32_u");
    case INSTR_I64_TRUNC_F32_S:
        setName(name, "i64.trunc_f32_s");
    case INSTR_I64_TRUNC_F32_U:
        setName(name, "i64.trunc_f32_u");
    case INSTR_I64_TRUNC_F64_S:
        setName(name, "i64.trunc_f64_s");
    case INSTR_I64_TRUNC_F64_U:
        setName(name, "i64.trunc_f64_u");
    case INSTR_F32_CONVERT_I32_S:
        setName(name, "f32.convert_i32_s");
    case INSTR_F32_CONVERT_I32_U:
        setName(name, "f32.convert_i32_u");
    case INSTR_F32_CONVERT_I64_S:
        setName(name, "f32.convert_i64_s");
    case INSTR_F32_CONVERT_I64_U:
        setName(name, "f32.convert_i64_u");
    case INSTR_F32_DEMOTE_F64:
        setName(name, "f32.demote_f64");
    case INSTR_F64_CONVERT_I32_S:
        setName(name, "f64.convert_i32_s");
    case INSTR_F64_CONVERT_I32_U:
        setName(name, "f64.convert_i32_u");
    case INSTR_F64_CONVERT_I64_S:
        setName(name, "f64.convert_i64_s");
    case INSTR_F64_CONVERT_I64_U:
        setName(name, "f64.convert_i64_u");
    case INSTR_F64_PROMOTE_F32:
        setName(name, "f64.promote_f32");
    case INSTR_I32_REINTERPRET_F32:
        setName(name, "i32.reinterpret_f32");
    case INSTR_I64_REINTERPRET_F64:
        setName(name, "i64.reinterpret_f64");
    case INSTR_F32_REINTERPRET_I32:
        setName(name, "f32.reinterpret_i32");
    case INSTR_F64_REINTERPRET_I64:
        setName(name, "f64.reinterpret_i64");
    case INSTR_I32_EXTEND8_S:
        setName(name, "i32.extend8_s");
    case INSTR_I32_EXTEND16_S:
        setName(name, "i32.extend16_s");
    case INSTR_I64_EXTEND8_S:
        setName(name, "i64.extend8_s");
    case INSTR_I64_EXTEND16_S:
        setName(name, "i64.extend16_s");
    case INSTR_I64_EXTEND32_S:
        setName(name, "i64.extend32_s");
    case INSTR_I32_TRUNC_SAT_F32_S:
        setName(name, "i32.trunc_sat_f32_s");
    case INSTR_I32_TRUNC_SAT_F32_U:
        setName(name, "i32.trunc_sat_f32_u");
    case INSTR_I32_TRUNC_SAT_F64_S:
        setName(name, "i32.trunc_sat_f64_s");
    case INSTR_I32_TRUNC_SAT_F64_U:
        setName(name, "i32.trunc_sat_f64_u");
    case INSTR_I64_TRUNC_SAT_F32_S:
        setName(name, "i64.trunc_sat_f32_s");
    case INSTR_I64_TRUNC_SAT_F32_U:
        setName(name, "i64.trunc_sat_f32_u");
    case INSTR_I64_TRUNC_SAT_F64_S:
        setName(name, "i64.trunc_sat_f64_s");
    case INSTR_I64_TRUNC_SAT_F64_U:
        setName(name, "i64.trunc_sat_f64_u");
    case INSTR_MEMORY_COPY:
        setName(name, "memory.copy");
    case INSTR_MEMORY_FILL:
        setName(name, "memory.fill");
    case INSTR_TRIVM_EMPTY:
        setName(name, "trivm.empty");
    case INSTR_TRIVM_POP:
        setName(name, "trivm.pop");
    case INSTR_TRIVM_LOW64WL:
        setName(name, "trivm.low64wl");
    case INSTR_TRIVM_FUNCTION: {
        setName(name, "trivm.function");
        TRACE();
        out << ind.cStr() << name;
        out << std::endl;
        break;
    }
    case INSTR_BLOCK:
        setName(name, "block");
    case INSTR_LOOP:
        setName(name, "loop");
    case INSTR_IF: {
        setName(name, "if");
        TRACE();
        out << ind.cStr() << name;
        showBlockBody(ind, instr, 0);
        break;
    }
    case INSTR_BR: {
        setName(name, "br");
        TRACE();
        out << ind.cStr() << name;
        if (reduced) {
            showImmLabel(ind, instr, 0);
            if (data->length() > 0 && data[0] != nullptr)
                showDataWasmInstrBr(ind, instr, 0);
        } else {
            showImmLabel(ind, instr, 0);
        }
        out << std::endl;
        break;
    }
    case INSTR_BR_IF: {
        setName(name, "br_if");
        TRACE();
        out << ind.cStr() << name;
        showImmLabel(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_BR_TABLE: {
        setName(name, "br_table");
        TRACE();
        out << ind.cStr() << name;
        showImmLabels(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_CALL: {
        setName(name, "call");
        TRACE();
        out << ind.cStr() << name;
        showDataFunction(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_CALL_INDIRECT: {
        setName(name, "call_indirect");
        TRACE();
        out << ind.cStr() << name;
        showDataFunctionType(ind, instr, 0);
        showDataTable(ind, instr, 1);
        out << std::endl;
        break;
    }
    case INSTR_RETURN_CALL:
        setName(name, "return_call");
    case INSTR_REF_FUNC: {
        setName(name, "ref.func");
        TRACE();
        out << ind.cStr() << name;
        showDataFunction(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_RETURN_CALL_INDIRECT: {
        setName(name, "return_call_indirect");
        TRACE();
        out << ind.cStr() << name;
        showDataFunctionType(ind, instr, 0);
        showDataTable(ind, instr, 1);
        out << std::endl;
        break;
    }
    case INSTR_SELECT_T: {
        setName(name, "select_t");
        TRACE();
        out << ind.cStr() << name;
        showImmTypes(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_LOCAL_GET:
        setName(name, "local.get");
    case INSTR_LOCAL_SET:
        setName(name, "local.set");
    case INSTR_LOCAL_TEE: {
        setName(name, "local.tee");
        TRACE();
        out << ind.cStr() << name;
        showImmLocal(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_GLOBAL_GET:
        setName(name, "global.get");
    case INSTR_GLOBAL_SET: {
        setName(name, "global.set");
        TRACE();
        out << ind.cStr() << name;
        showDataGlobal(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_TABLE_GET:
        setName(name, "table.get");
    case INSTR_TABLE_SET:
        setName(name, "table.set");
    case INSTR_TABLE_GROW:
        setName(name, "table.grow");
    case INSTR_TABLE_SIZE:
        setName(name, "table.size");
    case INSTR_TABLE_FILL: {
        setName(name, "table.fill");
        TRACE();
        out << ind.cStr() << name;
        showDataTable(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_I32_LOAD:
        setName(name, "i32.load");
    case INSTR_I64_LOAD:
        setName(name, "i64.load");
    case INSTR_I32_LOAD8_S:
        setName(name, "i32.load8_s");
    case INSTR_I32_LOAD8_U:
        setName(name, "i32.load8_u");
    case INSTR_I32_LOAD16_S:
        setName(name, "i32.load16_s");
    case INSTR_I32_LOAD16_U:
        setName(name, "i32.load16_u");
    case INSTR_I32_STORE:
        setName(name, "i32.store");
    case INSTR_I64_STORE:
        setName(name, "i64.store");
    case INSTR_I32_STORE8:
        setName(name, "i32.store8");
    case INSTR_I32_STORE16: {
        setName(name, "i32.store16");
        TRACE();
        out << ind.cStr() << name;
        showImmOffset(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_F32_LOAD:
        setName(name, "f32.load");
    case INSTR_F64_LOAD:
        setName(name, "f64.load");
    case INSTR_I64_LOAD8_S:
        setName(name, "i64.load8_s");
    case INSTR_I64_LOAD8_U:
        setName(name, "i64.load8_u");
    case INSTR_I64_LOAD16_S:
        setName(name, "i64.load16_s");
    case INSTR_I64_LOAD16_U:
        setName(name, "i64.load16_u");
    case INSTR_I64_LOAD32_S:
        setName(name, "i64.load32_s");
    case INSTR_I64_LOAD32_U:
        setName(name, "i64.load32_u");
    case INSTR_F32_STORE:
        setName(name, "f32.store");
    case INSTR_F64_STORE:
        setName(name, "f64.store");
    case INSTR_I64_STORE8:
        setName(name, "i64.store8");
    case INSTR_I64_STORE16:
        setName(name, "i64.store16");
    case INSTR_I64_STORE32: {
        setName(name, "i64.store32");
        TRACE();
        out << ind.cStr() << name;
        showImmOffset(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_I32_CONST:
        setName(name, "i32.const");
    case INSTR_I64_CONST: {
        setName(name, "i64.const");
        TRACE();
        out << ind.cStr() << name;
        showImmValue(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_F32_CONST: {
        setName(name, "f32.const");
        TRACE();
        out << ind.cStr() << name;
        showImmF32Value(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_F64_CONST: {
        setName(name, "f64.const");
        TRACE();
        out << ind.cStr() << name;
        showImmF64Value(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_I32_EQ:
        setName(name, "i32.eq");
    case INSTR_I32_LT_S:
        setName(name, "i32.lt_s");
    case INSTR_I32_LT_U:
        setName(name, "i32.lt_u");
    case INSTR_I32_GT_S:
        setName(name, "i32.gt_s");
    case INSTR_I32_GT_U:
        setName(name, "i32.gt_u");
    case INSTR_I64_EQ:
        setName(name, "i64.eq");
    case INSTR_I64_LT_S:
        setName(name, "i64.lt_s");
    case INSTR_I64_LT_U:
        setName(name, "i64.lt_u");
    case INSTR_I64_GT_S:
        setName(name, "i64.gt_s");
    case INSTR_I64_GT_U:
        setName(name, "i64.gt_u");
    case INSTR_F32_EQ:
        setName(name, "f32.eq");
    case INSTR_F32_NE:
        setName(name, "f32.ne");
    case INSTR_F32_LT:
        setName(name, "f32.lt");
    case INSTR_F32_GT:
        setName(name, "f32.gt");
    case INSTR_F32_LE:
        setName(name, "f32.le");
    case INSTR_F32_GE:
        setName(name, "f32.ge");
    case INSTR_F64_EQ:
        setName(name, "f64.eq");
    case INSTR_F64_NE:
        setName(name, "f64.ne");
    case INSTR_F64_LT:
        setName(name, "f64.lt");
    case INSTR_F64_GT:
        setName(name, "f64.gt");
    case INSTR_F64_LE:
        setName(name, "f64.le");
    case INSTR_F64_GE:
        setName(name, "f64.ge");
    case INSTR_I32_ADD:
        setName(name, "i32.add");
    case INSTR_I32_SUB:
        setName(name, "i32.sub");
    case INSTR_I32_MUL:
        setName(name, "i32.mul");
    case INSTR_I32_DIV_S:
        setName(name, "i32.div_s");
    case INSTR_I32_DIV_U:
        setName(name, "i32.div_u");
    case INSTR_I32_REM_S:
        setName(name, "i32.rem_s");
    case INSTR_I32_REM_U:
        setName(name, "i32.rem_u");
    case INSTR_I32_AND:
        setName(name, "i32.and");
    case INSTR_I32_OR:
        setName(name, "i32.or");
    case INSTR_I32_XOR:
        setName(name, "i32.xor");
    case INSTR_I32_SHL:
        setName(name, "i32.shl");
    case INSTR_I32_SHR_S:
        setName(name, "i32.shr_s");
    case INSTR_I32_SHR_U:
        setName(name, "i32.shr_u");
    case INSTR_I64_ADD:
        setName(name, "i64.add");
    case INSTR_I64_SUB:
        setName(name, "i64.sub");
    case INSTR_I64_MUL:
        setName(name, "i64.mul");
    case INSTR_I64_DIV_S:
        setName(name, "i64.div_s");
    case INSTR_I64_DIV_U:
        setName(name, "i64.div_u");
    case INSTR_I64_REM_S:
        setName(name, "i64.rem_s");
    case INSTR_I64_REM_U:
        setName(name, "i64.rem_u");
    case INSTR_I64_AND:
        setName(name, "i64.and");
    case INSTR_I64_OR:
        setName(name, "i64.or");
    case INSTR_I64_XOR:
        setName(name, "i64.xor");
    case INSTR_I64_SHL:
        setName(name, "i64.shl");
    case INSTR_I64_SHR_S:
        setName(name, "i64.shr_s");
    case INSTR_I64_SHR_U:
        setName(name, "i64.shr_u");
    case INSTR_F32_ADD:
        setName(name, "f32.add");
    case INSTR_F32_SUB:
        setName(name, "f32.sub");
    case INSTR_F32_MUL:
        setName(name, "f32.mul");
    case INSTR_F32_DIV:
        setName(name, "f32.div");
    case INSTR_F64_ADD:
        setName(name, "f64.add");
    case INSTR_F64_SUB:
        setName(name, "f64.sub");
    case INSTR_F64_MUL:
        setName(name, "f64.mul");
    case INSTR_F64_DIV: {
        setName(name, "f64.div");
        TRACE();
        out << ind.cStr() << name;
        if (reduced) {
            if (imm->length() > 0)
                showImmValue(ind, instr, 0);
        } else {
        }
        out << std::endl;
        break;
    }
    case INSTR_REF_NULL: {
        setName(name, "ref.null");
        TRACE();
        out << ind.cStr() << name;
        showImmRefType(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_REF_IS_NULL: {
        setName(name, "ref.is_null");
        TRACE();
        out << ind.cStr() << name;
        out << std::endl;
        break;
    }
    case INSTR_MEMORY_INIT: {
        setName(name, "memory.init");
        TRACE();
        out << ind.cStr() << name;
        showImmDataIndex(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_DATA_DROP: {
        setName(name, "data.drop");
        TRACE();
        out << ind.cStr() << name;
        showImmDataIndex(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_TABLE_INIT: {
        setName(name, "table.init");
        TRACE();
        out << ind.cStr() << name;
        showDataElement(ind, instr, 0);
        showDataTable(ind, instr, 1);
        out << std::endl;
        break;
    }
    case INSTR_ELEM_DROP: {
        setName(name, "elem.drop");
        TRACE();
        out << ind.cStr() << name;
        showDataElement(ind, instr, 0);
        out << std::endl;
        break;
    }
    case INSTR_TABLE_COPY: {
        setName(name, "table.copy");
        TRACE();
        out << ind.cStr() << name;
        showDataTable(ind, instr, 0);
        showDataTable(ind, instr, 1);
        out << std::endl;
        break;
    }
    case INSTR_TRIVM_EXTS:
        setName(name, "trivm.exts");
    case INSTR_TRIVM_SHL64WL:
        setName(name, "trivm.shl64wl");
    case INSTR_TRIVM_EXTS64LL: {
        setName(name, "trivm.exts64ll");
        TRACE();
        out << ind.cStr() << name;
        if (reduced) {
            showImmBits(ind, instr, 0);
        } else {
        }
        out << std::endl;
        break;
    }
    case INSTR_TRIVM_I32_READ_STACK:
        setName(name, "trivm.i32.read.stack");
    case INSTR_TRIVM_I64_READ_STACK: {
        setName(name, "trivm.i64.read.stack");
        TRACE();
        out << ind.cStr() << name;
        if (reduced) {
            showImmOffset(ind, instr, 0);
        } else {
        }
        out << std::endl;
        break;
    }
    case INSTR_TRIVM_I32_LOCAL_GET:
        setName(name, "trivm.i32.local.get");
    case INSTR_TRIVM_I64_LOCAL_GET:
        setName(name, "trivm.i64.local.get");
    case INSTR_TRIVM_I32_LOCAL_SET:
        setName(name, "trivm.i32.local.set");
    case INSTR_TRIVM_I64_LOCAL_SET: {
        setName(name, "trivm.i64.local.set");
        TRACE();
        out << ind.cStr() << name;
        if (reduced) {
            showImmLocal(ind, instr, 0);
            showImmOffset(ind, instr, 1);
        } else {
        }
        out << std::endl;
        break;
    }
    case INSTR_TRIVM_I32_GLOBAL_GET:
        setName(name, "trivm.i32.global.get");
    case INSTR_TRIVM_I64_GLOBAL_GET:
        setName(name, "trivm.i64.global.get");
    case INSTR_TRIVM_I32_GLOBAL_SET:
        setName(name, "trivm.i32.global.set");
    case INSTR_TRIVM_I64_GLOBAL_SET: {
        setName(name, "trivm.i64.global.set");
        TRACE();
        out << ind.cStr() << name;
        if (reduced) {
            showImmOffset(ind, instr, 0);
            showDataGlobal(ind, instr, 0);
        } else {
        }
        out << std::endl;
        break;
    }
    default:
        FATAL("Unknown instruction 0x%08X", instr->code);
        break;
    };
    /* -- End of source code generated with help of "gen_instr.js" script -- */
}
