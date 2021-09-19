#include <set>
#include "Utils.hh"
#include "WasmData.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmParser.hh"
#include "WasmInstr.hh"
#include "Resolver.hh"
#include "Generator.hh"
#include "VMConfig.hh"
#include "fstream"


static std::ofstream nullStream;

std::ostream& Generator::wrapVerbose(std::ostream& out) {
    if (vmConfig.verboseAsm) {
        return out;
    } else {
        return nullStream;
    }
}

void Generator::generateFunctionNames()
{
    std::set<std::string> taken;

    for (auto func: mod->functions) {
        if (func->name != nullptr && func->name != ""_S) {
            if (taken.count(func->name->v) > 0)
                FATAL("Duplicated triasm function name annotation '%s'", func->name.cStr());
            taken.insert(func->name->v);
        }
    }

    for (auto func: mod->functions) {
        if (func->name == nullptr || func->name == ""_S) {
            std::stringstream str;
            if (func->exportNames->length() > 0) {
                str << func->moduleName.cStr() << "." << func->exportNames[0].cStr();
            } else if (func->import != nullptr) {
                str << func->import->module.cStr() << "." << func->import->name.cStr();
            } else {
                str << "func" << func->index;
            }
            std::string nameBase = str.str(); // TODO: sanitize the string
            std::string name = nameBase;
            int counter = 1;
            while (taken.count(name)) {
                str.str(std::string());
                counter++;
                str << nameBase << "_" << counter;
                name = str.str();
            }
            func->name = name;
        }
    }
}

void Generator::generate(WasmModule$ mod)
{
    TRACE();

    this->mod = mod;
    totalBlocks = 0;

    generateFunctionNames();

    for (auto func: mod->functions) {
        generateFunction(func);
    }

    verbose << "\n\n// ========== Active Fixed Data ========== //\n";
    out << "active_data_begin_PROG:\n";
    out << "active_data_begin = program_memory_base + active_data_begin_PROG\n";
    for (auto data: mod->data)
        if (data->active && data->offset->kind != CONST_EXPR_GLOBAL_IMPORT)
            generateActiveData(data);
    out << ".word 0\n";

    verbose << "\n\n// ========== Passive Data ========== //\n";
    for (auto data: mod->data)
        if (!data->active || data->offset->kind == CONST_EXPR_GLOBAL_IMPORT)
            generatePassiveData(data);
}

void Generator::generateFunction(WasmFunction$$ func)
{
    TRACE();

    stackSize = 0;
    blockStack = new$;
    function = func;
    ind = ""_S;

/*
    FUNCTION_WASM,            ///< [WasmFunctionData] Normal WASM function with body
    FUNCTION_ANNOTATION,      ///< [String$$]         Annotation magic function, does not generate a bytecode, call replaced by ".annotation" during triasm generation
    FUNCTION_IMPORT,          ///< [null]             Import function, will be replaced by FUNCTION_HOST_* or FUNCTION_LINK during references resolving
    FUNCTION_HOST_BY_INDEX,   ///< [u32$]             Host function referenced by index
    FUNCTION_HOST_BY_NAME,    ///< [String$$]         Host function referenced by name, trivm runtime startup will resolve its index
    FUNCTION_ASSEMBLY,        ///< [String$$]         Function with triasm body
    FUNCTION_INLINE_ASSEMBLY, ///< [String$$]         Function with triasm body that will be inlined always
    FUNCTION_LINK,            ///< [WasmFunction]     A link to actual function
    FUNCTION_UNUSED,          ///< [null]             Function created as a placeholder, cannot be called, will not be generated

*/
    switch (function->kind)
    {
    case FUNCTION_WASM:
        break;
    
    case FUNCTION_ANNOTATION:
    case FUNCTION_HOST_BY_INDEX:
    case FUNCTION_HOST_BY_NAME:
    case FUNCTION_INLINE_ASSEMBLY:
    case FUNCTION_LINK:
    case FUNCTION_UNUSED:
        return;

    case FUNCTION_ASSEMBLY:
        verbose << "\n\n// ========== Function " << func->name.cStr() << " [" << func->index << "] ========== //\n";
        verbose << "    // Assembly function\n";
        out << func->name.cStr() << ":\n";
        out << String$$(function->data).cStr() << "\n";
        return;
    
    case FUNCTION_IMPORT:
    default:
        FATAL("Unexpected function kind");
        break;
    }

    funcData = WasmFunctionData$$(function->data);

    verbose << "\n\n// ========== Function " << func->name.cStr() << " [" << func->index << "] ========== //\n";

    int localOffset = 0;
    int reserveBytes = 0;
    if (funcData->localsOffsets == nullptr || funcData->localsOffsets->length() != func->locals->length()) {
        funcData->localsOffsets = new$;
        funcData->localsOffsets->length(func->locals->length());
        for (int i = func->type->param->length(); i < func->locals->length(); i++) {
            int words = wasmTypeWords(func->locals[i]);
            funcData->localsOffsets[i] = localOffset;
            verbose << "   // local " << i << " " << wasmTypeName(func->locals[i]) << " @" << localOffset << "\n";
            localOffset += 4 * words;
            reserveBytes += 4 * words;
        }
    } else {
        for (int i = func->type->param->length(); i < func->locals->length(); i++) {
            int words = wasmTypeWords(func->locals[i]);
            int offset = funcData->localsOffsets[i];
            verbose << "   // local " << i << " " << wasmTypeName(func->locals[i]) << " @" << offset << "\n";
            localOffset = std::max(localOffset, offset + 4 * words);
            reserveBytes = std::max(reserveBytes, offset + 4 * words);
        }
    }
    funcData->returnAddressOffset = localOffset;
    verbose << "   // return address @" << localOffset << "\n";
    localOffset += 4;
    for (int i = func->type->param->length() - 1; i >= 0; i--) {
        int words = wasmTypeWords(func->locals[i]);
        funcData->localsOffsets[i] = localOffset;
        verbose << "   // param " << i << " " << wasmTypeName(func->locals[i]) << " @" << localOffset << "\n";
        localOffset += 4 * words;
    }
    function->block->stackBase = -localOffset / 4;

    out << func->name.cStr() << ":\n";

    if (reserveBytes > 12) {
        out << "READ SP\nSUB " << reserveBytes << "\nWRITE SP\n";
    } else {
        for (int i = 0; i < reserveBytes; i += 4) {
            out << "READ SP\n";
        }
    }
    
    function->block->id = totalBlocks++;
    generateBlock(function->block);
}

void Generator::generateBlock(WasmBlock$ block)
{
    TRACE();
    blockStack->push(block);
    auto old = ind;
    ind = ind + " ";
    for (auto instr: block->body) {
        generateInstr(instr);
    }
    ind = old;
    blockStack->pop();
}

static inline void setName(const char* &name, const char* newName)
{
    if (name == nullptr) {
        name = newName;
    }
}

void Generator::generateUnwind(u32 keep, u32 skip)
{
    verbose << ind.cStr();

    if (skip == 0) {
        verbose << "// UNWIND none";
    } else if (vmConfig.ext.unwind) {
        if (keep < 16 && skip < 16) {
            s8 value = (keep << 4) | skip;
            out << "UNWIND " << (s32)value;
        } else if (keep < 256 && skip < 256) {
            s16 value = (keep << 8) | skip;
            out << "UNWIND " << (s32)value;
        } else if (keep < 65536 && skip < 65536) {
            u32 value = (keep << 16) | skip;
            out << "UNWIND " << value;
        } else {
            out << "PUSH " << keep << "\n";
            verbose << ind.cStr();
            out << "PUSH " << skip << "\n";
            verbose << ind.cStr();
            out << "CALL __trivmlib_unwind";
        }
    } else if (keep < 16 && skip < 16) {
        s8 value = (keep << 4) | skip;
        out << "PUSH " << (s32)value;
        verbose << ind.cStr();
        out << "CALL __trivmlib_unwind8";
    } else if (keep < 256 && skip < 256) {
        s16 value = (keep << 8) | skip;
        out << "PUSH " << (s32)value;
        verbose << ind.cStr();
        out << "CALL __trivmlib_unwind16";
    } else if (keep < 65536 && skip < 65536) {
        u32 value = (keep << 16) | skip;
        out << "PUSH " << value;
        verbose << ind.cStr();
        out << "CALL __trivmlib_unwind32";
    } else {
        out << "PUSH " << keep << "\n";
        verbose << ind.cStr();
        out << "PUSH " << skip << "\n";
        verbose << ind.cStr();
        out << "CALL __trivmlib_unwind";
    }
    debug << "        // keep " << keep << ", skip " << skip;
    out << "\n";
}

void Generator::generateInstr(WasmInstr$ instr)
{
    const char* name = nullptr;

    /* -- Begin of source code generated with help of "gen_instr.js" script -- */
    switch(instr->code) {
    case INSTR_BLOCK: {
        TRACE();
        instr->block->id = totalBlocks++;
        instr->block->stackBase = stackSize - wasmTypesWords(instr->block->type->param);
        verbose << ind.cStr() << "// block" << instr->block->id << "_begin:\n";
        generateBlock(instr->block);
        verbose << ind.cStr();
        out << "block" << instr->block->id << "_end:\n";
        break;
    }
    case INSTR_LOOP: {
        TRACE();
        instr->block->id = totalBlocks++;
        instr->block->stackBase = stackSize - wasmTypesWords(instr->block->type->param);
        verbose << ind.cStr();
        out << "block" << instr->block->id << "_begin:\n";
        generateBlock(instr->block);
        verbose << ind.cStr();
        out << "block" << instr->block->id << "_end:\n";
        break;
    }
    case INSTR_IF: {
        TRACE();
        stackSize--;
        instr->block->id = totalBlocks++;
        instr->block->stackBase = stackSize - wasmTypesWords(instr->block->type->param);
        verbose << ind.cStr();
        out << "BRF block" << instr->block->id << "_else\n";
        verbose << ind.cStr() << "// block" << instr->block->id << "_begin:\n";
        generateBlock(instr->block);
        if (!instr->block->elsePresent) {
            verbose << ind.cStr();
            out << "block" << instr->block->id << "_else:\n";
        }
        verbose << ind.cStr();
        out << "block" << instr->block->id << "_end:\n";
        break;
    }
    case INSTR_ELSE: {
        TRACE();
        auto block = blockStack[RangeEnd - 1];
        out << ind->buffer() << "block" << block->id << "_else:\n";
        block->elsePresent = true;
        stackSize = block->stackBase + wasmTypesWords(block->type->param);
        break;
    }
    case INSTR_END: {
        TRACE();
        auto block = blockStack[RangeEnd - 1];
        stackSize = block->stackBase + wasmTypesWords(block->type->result);
        break;
    }
    case INSTR_BR: {
        TRACE();
        auto block = blockStack[RangeEnd - (1 + instr->imm[0])];
        instr->data->length(1);
        auto data = WasmInstrBr$$(instr->data[0]);
        bool backward = (block->instr->code == INSTR_LOOP && !data->forceForward);
        bool skipBrInstr = data->skipBrInstr;
        bool conditional = data->conditional;
        bool negated = data->negated;
        bool isReturn = (block->instr->code == INSTR_TRIVM_FUNCTION);
        int skip;
        int keep;
        const char* label;
        if (conditional) {
            stackSize--;
        }
        if (backward) {
            label = "_begin";
            keep = wasmTypesWords(block->type->param);
        } else {
            label = "_end";
            keep = wasmTypesWords(block->type->result);
        }
        skip = stackSize - (block->stackBase + keep);
        if (conditional) {
            verbose << ind.cStr();
            if (skip == 0) {
                out << "BR" << (negated ? "F" : "T") << " block" << block->id << label << "\n";
            } else {
                auto index = totalBlocks++;
                out << "BR" << (negated ? "T" : "F") << " skip" << index << "\n";
                if (isReturn) {
                    if (block->stackBase != -1 || keep != 0 || skip != 1) {
                        verbose << ind.cStr();
                        out << "READ [SP] + " << 4 * stackSize << " + " << funcData->returnAddressOffset << "\n";
                        generateUnwind(keep + 1, skip);
                    }
                    verbose << ind.cStr();
                    out << "WRITE PC\n";
                } else {
                    generateUnwind(keep, skip);
                    verbose << ind.cStr();
                    out << "BR block" << block->id << label << "\n";
                }
                verbose << ind.cStr();
                out << "skip" << index << ":\n";
            }
        } else {
            if (isReturn) {
                if (block->stackBase != -1 || keep != 0 || skip != 1) {
                    if (stackSize != 0 || funcData->returnAddressOffset != 0) {
                        verbose << ind.cStr();
                        out << "READ [SP] + " << 4 * stackSize << " + " << funcData->returnAddressOffset << "\n";
                        keep++;
                    }
                    generateUnwind(keep, skip);
                }
                verbose << ind.cStr();
                out << "WRITE PC\n";
            } else {
                generateUnwind(keep, skip);
                if (!skipBrInstr) {
                    verbose << ind.cStr();
                    out << "BR block" << block->id << label << "\n";
                }
            }
        }
        break;
    }
    case INSTR_BR_TABLE: {
        TRACE();
        
        struct ItemInfo {
            int index;
            int label;
            bool backward;
            bool isReturn;
            int skip;
            int keep;
            const char* labelPostfix;
            WasmBlock$ block;
        };

        bool longTable = (instr->imm->length() > 2);
        Array$$<ItemInfo> items = new$;
        items->length(instr->imm->length());
        auto blockIndex = totalBlocks++;
        int indexSub = 0;

        stackSize--;

        for (int i = 0; i < instr->imm->length(); i++) {
            auto& item = items[i];
            item.index = i;
            item.label = instr->imm[i];
            item.block = blockStack[RangeEnd - (1 + item.label)];
            item.backward = (item.block->instr->code == INSTR_LOOP);
            item.isReturn = (item.block->instr->code == INSTR_TRIVM_FUNCTION);
            if (item.backward) {
                item.labelPostfix = "_begin";
                item.keep = wasmTypesWords(item.block->type->param);
            } else {
                item.labelPostfix = "_end";
                item.keep = wasmTypesWords(item.block->type->result);
            }
            item.skip = stackSize - (item.block->stackBase + item.keep);
        }

        debug << ind.cStr() << "// BR_TABLE\n";

        if (longTable)
            out << ind.cStr() << "WRITE TMP0\n";

        for (int i = 0; i < items->length() - 1; i++) {
            auto& item = items[i];

            if (item.index - indexSub == 127 && items->length() - item.index > 5) {
                out << ind.cStr() << "READ TMP0\n";
                out << ind.cStr() << "SUB 127\n";
                out << ind.cStr() << "WRITE TMP0\n";
                indexSub += 127;
            }

            if (longTable)
                out << ind.cStr() << "READ TMP0\n";

            if (indexSub == 0) {
                out << ind.cStr() << "EQ " << item.index << "\n";
            } else {
                out << ind.cStr() << "EQ " << item.index - indexSub;
                verbose << " // actual index " << item.index;
                out << "\n";
            }
            if (item.skip == 0 && !item.isReturn) {
                out << ind.cStr() << "BRT block" << item.block->id << item.labelPostfix << "\n";
            } else {
                out << ind.cStr() << "BRT skip" << blockIndex << "_" << item.index << "\n";
            }
        }

        Array$$<ItemInfo> reorderedItems;
        reorderedItems = items[Range(0, RangeEnd - 1)];
        reorderedItems->pushFront(items[RangeEnd - 1]);

        for (int i = 0; i < reorderedItems->length(); i++) {
            auto& item = reorderedItems[i];

            if (item.skip == 0 && !item.isReturn && i > 0)
                continue;

            if (i > 0)
                out << ind.cStr() << "skip" << blockIndex << "_" << item.index << ":\n";

            if (item.isReturn) {
                if (item.block->stackBase != -1 || item.keep != 0 || item.skip != 1) {
                    out << ind.cStr() << "READ [SP] + " << 4 * stackSize << " + " << funcData->returnAddressOffset << "\n";
                    generateUnwind(item.keep + 1, item.skip);
                }
                verbose << ind.cStr();
                out << "WRITE PC\n";
            } else {
                if (item.skip > 0)
                    generateUnwind(item.keep, item.skip);
                verbose << ind.cStr();
                out << "BR block" << item.block->id << item.labelPostfix << "\n";
            }
        }
        break;
    }
    case INSTR_CALL: {
        TRACE();
        auto callee = Resolver::getResolved(WasmFunction$(instr->data[0]));
        verbose << ind.cStr();
        s32 stackDiff = 0;
        if (callee->type != nullptr) {
            stackDiff -= wasmTypesWords(callee->type->param);
            stackDiff += wasmTypesWords(callee->type->result);
        }
        switch (callee->kind)
        {
        case FUNCTION_ASSEMBLY:
        case FUNCTION_WASM: {
            stackSize += stackDiff;
            out << "CALL " << callee->name.cStr();
            debug << " //        " << stackDiff << "  " << stackSize;
            out << "\n";
            break;
        }
        case FUNCTION_ANNOTATION: {
            out << ".annotation \"" << String$$(callee->data).cStr() << "\"\n";
            break;
        }
        case FUNCTION_IMPORT: {
            ASSERT("Import function not resolved");
            break;
        }
        case FUNCTION_HOST_BY_INDEX: {
            stackSize += stackDiff;
            out << "HOST " << *u32$(callee->data);
            debug << " //        " << stackDiff << "  " << stackSize;
            out << "\n";
            break;
        }
        case FUNCTION_HOST_BY_NAME: {
            stackSize += stackDiff;
            out << "READ host_by_name_" << String$$(callee->data).cStr() << "\n"; // TODO: sanitize the string
            out << ind.cStr() << "HOST";
            debug << " //        " << stackDiff << "  " << stackSize;
            out << "\n";
            break;
        }
        case FUNCTION_INLINE_ASSEMBLY: {
            stackSize += stackDiff;
            verbose << "// inline assembly begin\n";
            out << ind.cStr() << String$$(callee->data).cStr() << "\n";
            debug << ind.cStr() << "//        " << stackDiff << "  " << stackSize << "\n";
            verbose << ind.cStr() << "// inline assembly end\n";
            break;
        }
        case FUNCTION_LINK: {
            ASSERT("Link function not expected here");
            break;
        }
        case FUNCTION_UNUSED: {
            FATAL("Call of unusable function %s [%d]", callee->name.cStr(), callee->index);
            break;
        }
        default:
            break;
        }
        break;
    }
    case INSTR_CALL_INDIRECT: {
        TRACE();
        auto type = WasmFunctionType$(instr->data[0]);
        auto table = WasmTable$(instr->data[1]);
        verbose << ind.cStr();
        out << "PUSH table" << table->index << "\n";
        verbose << ind.cStr();
        if (vmConfig.ext.nativeCallbacks) {
            out << "CALL __trivmlib_call_indirect_with_native\n";
        } else {
            out << "CALL __trivmlib_call_indirect\n";
        }
        stackSize--;
        stackSize -= wasmTypesWords(type->param);
        stackSize += wasmTypesWords(type->result);
        break;
    }
    case INSTR_I64_LOAD: {
        TRACE();
        u32 firstOffset = instr->imm[0] + 4;

        verbose << ind.cStr();
        out << "READ [AMB] + [POP] + " << firstOffset;
        debug << "        // +0 -> " << stackSize;
        out << "\n";

        stackSize++;
        verbose << ind.cStr();
        out << "READ64";
        debug << "        // +1 -> " << stackSize;
        out << "\n";
        break;
    }
    case INSTR_I64_STORE: {
        TRACE();
        u32 firstOffset = instr->imm[0];

        stackSize -= 2;
        verbose << ind.cStr();
        out << "WRITE [AMB] + [POP]";
        if (firstOffset != 0)
            out << " + " << firstOffset;
        debug << "        // -2 -> " << stackSize;
        out << "\n";
        
        stackSize--;
        verbose << ind.cStr();
        out << "WRITE64";
        debug << "        // -1 -> " << stackSize;
        out << "\n";
        break;
    }
    case INSTR_I32_CONST: {
        TRACE();
        stackSize++;
        verbose << ind.cStr();
        out << "NEG -" << (u32)instr->imm[0];
        debug << "        // +1 -> " << stackSize;
        out << "\n";
        break;
    }
    case INSTR_I64_CONST: {
        TRACE();
        stackSize += 2;
        verbose << ind.cStr();
        out << "NEG64 -" << instr->imm[0];
        debug << "        // +2 -> " << stackSize;
        out << "\n";
        break;
    }
    case INSTR_I32_WRAP_I64: {
        TRACE();
        stackSize--;
        verbose << ind.cStr();
        out << "WRITE [SP]";
        debug << "        // -1 -> " << stackSize;
        out << "\n";
        break;
    }
    case INSTR_TRIVM_EMPTY: {
        TRACE();
        debug << ind.cStr() << "// empty\n";
        break;
    }
    case INSTR_TRIVM_SHL64WL: {
        TRACE();
        stackSize++;
        verbose << ind.cStr();
        out << "SHL64WL " << instr->imm[0];
        debug << "        // +1 -> " << stackSize;
        out << "\n";
        break;
    }
    case INSTR_TRIVM_I32_READ_STACK: {
        TRACE();
        stackSize++;
        verbose << ind.cStr();
        out << "READ [SP]";
        if (instr->imm[0] != 0)
            out << " + " << instr->imm[0];
        debug << "        // +1 -> " << stackSize;
        out << "\n";
        break;
    }
    case INSTR_TRIVM_I64_READ_STACK: {
        TRACE();
        u32 offset = instr->imm[0] + 4;

        stackSize++;
        verbose << ind.cStr();
        out << "READ [SP] + " << offset;
        debug << "        // +1 -> " << stackSize;
        out << "\n";

        stackSize++;
        verbose << ind.cStr();
        out << "READ64";
        debug << "        // +1 -> " << stackSize;
        out << "\n";
        break;
    }
    case INSTR_I32_LOAD:
        setName(name, "READ");
    case INSTR_I32_LOAD8_S:
        setName(name, "READSB");
    case INSTR_I32_LOAD8_U:
        setName(name, "READB");
    case INSTR_I32_LOAD16_S:
        setName(name, "READSH");
    case INSTR_I32_LOAD16_U: {
        setName(name, "READH");
        TRACE();
        verbose << ind.cStr();
        out << name << " [AMB] + [POP]";
        if (instr->imm->length() > 0 && instr->imm[0] != 0)
            out << " + " << instr->imm[0];
        debug << "        // +0 -> " << stackSize;
        out << "\n";
        // TODO: Optimization may calculate absolute address from const, then instruction will be e.g. READ 34924
        break;
    }
    case INSTR_I32_STORE:
        setName(name, "WRITE");
    case INSTR_I32_STORE8:
        setName(name, "WRITEB");
    case INSTR_I32_STORE16: {
        setName(name, "WRITEH");
        TRACE();
        stackSize -= 2;
        verbose << ind.cStr();
        out << name << " [AMB] + [POP]";
        if (instr->imm->length() > 0 && instr->imm[0] != 0)
            out << " + " << instr->imm[0];
        debug << "        // -2 -> " << stackSize;
        out << "\n";
        // TODO: Optimization may calculate absolute address from const, then instruction will be e.g. WRITE 34924
        break;
    }
    case INSTR_I32_EQZ:
        setName(name, "NOT");
    case INSTR_F32_CEIL:
        setName(name, "CEILF32");
    case INSTR_F32_FLOOR:
        setName(name, "FLOORF32");
    case INSTR_F32_TRUNC:
        setName(name, "TRUNCF32");
    case INSTR_F32_NEAREST:
        setName(name, "NEARESTF32");
    case INSTR_F32_SQRT:
        setName(name, "SQRTF32");
    case INSTR_F64_CEIL:
        setName(name, "CEILF64");
    case INSTR_F64_FLOOR:
        setName(name, "FLOORF64");
    case INSTR_F64_TRUNC:
        setName(name, "TRUNCF64");
    case INSTR_F64_NEAREST:
        setName(name, "NEARESTF64");
    case INSTR_F64_SQRT:
        setName(name, "SQRTF64");
    case INSTR_I32_TRUNC_F32_S:
        setName(name, "STRUNCF32");
    case INSTR_I32_TRUNC_F32_U:
        setName(name, "UTRUNCF32");
    case INSTR_I64_TRUNC_F64_S:
        setName(name, "STRUNC64F64");
    case INSTR_I64_TRUNC_F64_U:
        setName(name, "UTRUNC64F64");
    case INSTR_F32_CONVERT_I32_S:
        setName(name, "SCONVF32");
    case INSTR_F32_CONVERT_I32_U:
        setName(name, "UCONVF32");
    case INSTR_F64_CONVERT_I64_S:
        setName(name, "SCONV64F64");
    case INSTR_F64_CONVERT_I64_U:
        setName(name, "UCONV64F64");
    case INSTR_I32_TRUNC_SAT_F32_S:
        setName(name, "SSTRUNCF32");
    case INSTR_I32_TRUNC_SAT_F32_U:
        setName(name, "USTRUNCF32");
    case INSTR_I64_TRUNC_SAT_F64_S:
        setName(name, "SSTRUNC64F64");
    case INSTR_I64_TRUNC_SAT_F64_U: {
        setName(name, "USTRUNC64F64");
        TRACE();
        verbose << ind.cStr();
        out << name;
        debug << "        // +0 -> " << stackSize;
        out << "\n";
        break;
    }
    case INSTR_I32_EQ:
        setName(name, "EQ");
    case INSTR_I32_LT_S:
        setName(name, "SLT");
    case INSTR_I32_LT_U:
        setName(name, "ULT");
    case INSTR_I32_GT_S:
        setName(name, "SGT");
    case INSTR_I32_GT_U:
        setName(name, "UGT");
    case INSTR_F32_EQ:
        setName(name, "EQF32");
    case INSTR_F32_NE:
        setName(name, "NEF32");
    case INSTR_F32_LT:
        setName(name, "LTF32");
    case INSTR_F32_GT:
        setName(name, "GTF32");
    case INSTR_F32_LE:
        setName(name, "LEF32");
    case INSTR_F32_GE:
        setName(name, "GEF32");
    case INSTR_I32_ADD:
        setName(name, "ADD");
    case INSTR_I32_SUB:
        setName(name, "SUB");
    case INSTR_I32_MUL:
        setName(name, "MUL");
    case INSTR_I32_DIV_S:
        setName(name, "SDIV");
    case INSTR_I32_DIV_U:
        setName(name, "UDIV");
    case INSTR_I32_REM_S:
        setName(name, "SMOD");
    case INSTR_I32_REM_U:
        setName(name, "UMOD");
    case INSTR_I32_AND:
        setName(name, "AND");
    case INSTR_I32_OR:
        setName(name, "OR");
    case INSTR_I32_XOR:
        setName(name, "XOR");
    case INSTR_I32_SHL:
        setName(name, "SHL");
    case INSTR_I32_SHR_S:
        setName(name, "SSHR");
    case INSTR_I32_SHR_U:
        setName(name, "USHR");
    case INSTR_F32_ADD:
        setName(name, "ADDF32");
    case INSTR_F32_SUB:
        setName(name, "SUBF32");
    case INSTR_F32_MUL:
        setName(name, "MULF32");
    case INSTR_F32_DIV:
        setName(name, "DIVF32");
    case INSTR_TRIVM_EXTS: {
        setName(name, "EXTS");
        TRACE();
        verbose << ind.cStr();
        out << name;
        if (instr->imm->length() > 0) {
            out << " " << instr->imm[0];
            debug << "        // +0 -> " << stackSize;
        } else {
            stackSize--;
            debug << "        // -1 -> " << stackSize;
        }
        out << "\n";
        break;
    }
    case INSTR_I64_EQZ:
        setName(name, "NOT64LW");
    case INSTR_I32_TRUNC_F64_S:
        setName(name, "STRUNCF64");
    case INSTR_I32_TRUNC_F64_U:
        setName(name, "UTRUNCF64");
    case INSTR_F32_CONVERT_I64_S:
        setName(name, "SCONV64F32");
    case INSTR_F32_CONVERT_I64_U:
        setName(name, "UCONV64F32");
    case INSTR_F32_DEMOTE_F64:
        setName(name, "DEMOTE");
    case INSTR_I32_TRUNC_SAT_F64_S:
        setName(name, "SSTRUNCF64");
    case INSTR_I32_TRUNC_SAT_F64_U:
        setName(name, "USTRUNCF64");
    case INSTR_TRIVM_POP: {
        setName(name, "WRITE TMP0");
        TRACE();
        stackSize--;
        verbose << ind.cStr();
        out << name;
        debug << "        // -1 -> " << stackSize;
        out << "\n";
        break;
    }
    case INSTR_I64_EQ:
        setName(name, "EQ64");
    case INSTR_I64_LT_S:
        setName(name, "SLT64");
    case INSTR_I64_LT_U:
        setName(name, "UTL64");
    case INSTR_I64_GT_S:
        setName(name, "SGT64");
    case INSTR_I64_GT_U:
        setName(name, "STL64");
    case INSTR_F64_EQ:
        setName(name, "EQF64");
    case INSTR_F64_NE:
        setName(name, "NEF64");
    case INSTR_F64_LT:
        setName(name, "LTF64");
    case INSTR_F64_GT:
        setName(name, "GTF64");
    case INSTR_F64_LE:
        setName(name, "LEF64");
    case INSTR_F64_GE: {
        setName(name, "GEF64");
        TRACE();
        verbose << ind.cStr();
        out << name;
        if (instr->imm->length() > 0) {
            stackSize--;
            out << " " << instr->imm[0];
            debug << "        // -1 -> " << stackSize;
        } else {
            stackSize -= 3;
            debug << "        // -3 -> " << stackSize;
        }
        out << "\n";
        break;
    }
    case INSTR_I64_ADD:
        setName(name, "ADD64");
    case INSTR_I64_SUB:
        setName(name, "SUB64");
    case INSTR_I64_MUL:
        setName(name, "MUL64");
    case INSTR_I64_DIV_S:
        setName(name, "SDIV64");
    case INSTR_I64_DIV_U:
        setName(name, "UDIV64");
    case INSTR_I64_REM_S:
        setName(name, "SMOD64");
    case INSTR_I64_REM_U:
        setName(name, "UMOD64");
    case INSTR_I64_AND:
        setName(name, "AND64");
    case INSTR_I64_OR:
        setName(name, "OR64");
    case INSTR_I64_XOR:
        setName(name, "XOR64");
    case INSTR_I64_SHL:
        setName(name, "SHL64");
    case INSTR_I64_SHR_S:
        setName(name, "SSHR64");
    case INSTR_I64_SHR_U:
        setName(name, "USHR64");
    case INSTR_F64_ADD:
        setName(name, "ADDF64");
    case INSTR_F64_SUB:
        setName(name, "SUBF64");
    case INSTR_F64_MUL:
        setName(name, "MULF64");
    case INSTR_F64_DIV:
        setName(name, "DIVF64");
    case INSTR_TRIVM_EXTS64LL: {
        setName(name, "EXTS64LL");
        TRACE();
        verbose << ind.cStr();
        out << name;
        if (instr->imm->length() > 0) {
            out << " " << instr->imm[0];
            debug << "        // +0 -> " << stackSize;
        } else {
            stackSize -= 2;
            debug << "        // -2 -> " << stackSize;
        }
        out << "\n";
        break;
    }
    case INSTR_I64_TRUNC_F32_S:
        setName(name, "STRUNC64F32");
    case INSTR_I64_TRUNC_F32_U:
        setName(name, "UTRUNC64F32");
    case INSTR_F64_CONVERT_I32_S:
        setName(name, "SCONVF64");
    case INSTR_F64_CONVERT_I32_U:
        setName(name, "UCONVF64");
    case INSTR_F64_PROMOTE_F32:
        setName(name, "PROMOTE");
    case INSTR_I64_TRUNC_SAT_F32_S:
        setName(name, "SSTRUNC64F32");
    case INSTR_I64_TRUNC_SAT_F32_U:
        setName(name, "USTRUNC64F32");
    case INSTR_TRIVM_LOW64WL: {
        setName(name, "LOW64WL");
        TRACE();
        stackSize++;
        verbose << ind.cStr();
        out << name;
        debug << "        // +1 -> " << stackSize;
        out << "\n";
        break;
    }
    case INSTR_TRIVM_I32_LOCAL_GET:
    case INSTR_TRIVM_I64_LOCAL_GET:
    case INSTR_TRIVM_I32_LOCAL_SET:
    case INSTR_TRIVM_I64_LOCAL_SET: {
        TRACE();
        u32 words = instr->code == INSTR_TRIVM_I32_LOCAL_GET || instr->code == INSTR_TRIVM_I32_LOCAL_SET ? 1 : 2;
        bool write = instr->code == INSTR_TRIVM_I32_LOCAL_SET || instr->code == INSTR_TRIVM_I64_LOCAL_SET;
        u32 index = instr->imm[0];
        u32 innerOffset = instr->imm[1];
        u32 localOffset = funcData->localsOffsets[index] + 4 * stackSize;
        u32 offset = localOffset + innerOffset;
        if (!write && words == 2) {
            offset += 4;
        }
        s32 stackChange = write ? -words : +words;
        stackSize += stackChange;
        
        verbose << ind.cStr();
        out << (write ? "WRITE [SP] + " : "READ [SP] + ") << offset;
        if (words == 2) {
            out << "\n";
            verbose << ind.cStr();
            out << (write ? "WRITE64" : "READ64");
        }
        debug << "        // local " << index << "  " << stackChange << " -> " << stackSize;
        out << "\n";
        break;
    }
    case INSTR_TRIVM_I32_GLOBAL_GET:
    case INSTR_TRIVM_I64_GLOBAL_GET:
    case INSTR_TRIVM_I32_GLOBAL_SET:
    case INSTR_TRIVM_I64_GLOBAL_SET: {
        TRACE();
        u32 words = instr->code == INSTR_TRIVM_I32_GLOBAL_GET || instr->code == INSTR_TRIVM_I32_GLOBAL_SET ? 1 : 2;
        bool write = instr->code == INSTR_TRIVM_I32_GLOBAL_SET || instr->code == INSTR_TRIVM_I64_GLOBAL_SET;
        auto global = WasmGlobal$(instr->data[0]); // TODO: exported global should work as host call
        u32 offset = instr->imm[0];
        if (!write && words == 2) {
            offset += 4;
        }
        s32 stackChange = write ? -words : +words;
        stackSize += stackChange;
        
        verbose << ind.cStr();
        out << (write ? "WRITE global" : "READ global") << global->index;
        if (offset != 0)
            out << " + " << offset;
        if (words == 2) {
            out << "\n";
            verbose << ind.cStr();
            out << (write ? "WRITE64" : "READ64");
        }
        debug << "        // global " << global->index << "  " << stackChange << " -> " << stackSize;
        out << "\n";
        break;
    }
    default:
        break;
    };
    /* -- End of source code generated with help of "gen_instr.js" script -- */
}

static void generateBytes(std::ostream& out, Bytes$$ bytes)
{
    std::ios::fmtflags saved(out.flags());
    out << std::setfill('0') << std::uppercase << std::hex << std::internal;
    for (ssize line = 0; line < bytes->length(); line += 16) {
        out << " .byte ";
        for (ssize byte = line; byte < std::min(line + 16, bytes->length()); byte++) {
            if (byte % 16 == 8)
                out << " ";
            out << " 0x" << std::setw(2) << (int)bytes[byte] << ",";
        }
        out << std::endl;
    }
    out.flags(saved);
}

void Generator::generateActiveData(WasmData$ data)
{
    u32 offset;

    if (data->offset->kind == CONST_EXPR_I32) {
        offset = data->offset->i32Value;
    } else if (data->offset->kind == CONST_EXPR_I64) {
        offset = data->offset->i64Value;
    } else {
        FATAL("Cannot calculate active data %d offset", data->index);
    }

    verbose << "// Fixed active data index " << data->index << "\n";
    out << ".word " << offset << " + auxillary_memory_base\n";
    out << ".word " << data->bytes->length() << "\n";

    generateBytes(out, data->bytes);
}


void Generator::generatePassiveData(WasmData$ data)
{
    if (data->active) {
        verbose << "// Movable active data index " << data->index << "\n";
    } else {
        verbose << "// Passive data index " << data->index << "\n";
    }
    out << "data" << data->index << ":\n";
    out << ".word " << data->bytes->length() << "\n";

    generateBytes(out, data->bytes);
}
