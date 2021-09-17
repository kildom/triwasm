#include "Utils.hh"
#include "WasmData.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmParser.hh"
#include "WasmInstr.hh"
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

void Generator::generate(WasmModule$ mod)
{
    TRACE();

    totalBlocks = 0;

    this->mod = mod;
    for (auto func: mod->functions) {
        if (func->import == nullptr) {
            generateFunction(func);
        }
    }
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
    case FUNCTION_IMPORT:
    case FUNCTION_HOST_BY_INDEX:
    case FUNCTION_HOST_BY_NAME:
    case FUNCTION_INLINE_ASSEMBLY:
    case FUNCTION_LINK:
    case FUNCTION_UNUSED:
        return;

    case FUNCTION_ASSEMBLY:
        verbose << "\n\n// ========== Function " << func->index << " ========== //\n";
        verbose << "    // Assembly function\n";
        out << "func" << func->index << ":\n";
        out << String$$(function->data).cStr() << "\n";
        return;
    
    default:
        FATAL("Unknown function kind");
        break;
    }

    funcData = WasmFunctionData$$(function->data);

    verbose << "\n\n// ========== Function " << func->index << " ========== //\n";

    int localOffset = 0;
    int reserveBytes = 0;
    if (funcData->localsOffsets == nullptr || funcData->localsOffsets->length() != func->locals->length()) {
        funcData->localsOffsets = new$;
        funcData->localsOffsets->length(func->locals->length());
        for (int i = func->type->param->length(); i < func->locals->length(); i++) {
            int words = wasmTypeWords(func->locals[i]);
            funcData->localsOffsets[i] = localOffset;
            verbose << "   // local " << wasmTypeName(func->locals[i]) << " @" << localOffset << "\n";
            localOffset += 4 * words;
            reserveBytes += 4 * words;
        }
    } else {
        for (int i = func->type->param->length(); i < func->locals->length(); i++) {
            int words = wasmTypeWords(func->locals[i]);
            int offset = funcData->localsOffsets[i];
            verbose << "   // local " << wasmTypeName(func->locals[i]) << " @" << offset << "\n";
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
        verbose << "   // param " << wasmTypeName(func->locals[i]) << " @" << localOffset << "\n";
        localOffset += 4 * words;
    }
    function->block->stackBase = -localOffset / 4;

    out << "func" << func->index << ":\n";

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

    if (vmConfig.ext.unwind) {
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
                    verbose << ind.cStr();
                    out << "READ [SP] + " << 4 * stackSize << " + " << funcData->returnAddressOffset << "\n";
                    generateUnwind(keep + 1, skip);
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
    case INSTR_CALL: {
        TRACE();
        auto callee = WasmFunction$(instr->data[0]);
        verbose << ind.cStr();
        out << "CALL func" << callee->index << "\n"; // TODO: use function returning name
        stackSize -= wasmTypesWords(callee->type->param);
        stackSize += wasmTypesWords(callee->type->result);
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

        stackSize++;
        verbose << ind.cStr();
        out << "READ [MAB] + [POP] + " << firstOffset;
        debug << "        // +1 -> " << stackSize;
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

        stackSize--;
        verbose << ind.cStr();
        out << "WRITE [MAB] + [POP]";
        if (firstOffset != 0)
            out << " + " << firstOffset;
        debug << "        // -1 -> " << stackSize;
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
        debug << ind.cStr() << "// empty\b";
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
        stackSize++;
        verbose << ind.cStr();
        out << name << " [MAB] + [POP]";
        if (instr->imm->length() > 0 && instr->imm[0] != 0)
            out << " + " << instr->imm[0];
        debug << "        // +1 -> " << stackSize;
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
        out << name << " [MAB] + [POP]";
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
    case INSTR_F64_GE:
        setName(name, "GEF64");
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
    case INSTR_TRIVM_SHL64WL:
        setName(name, "SHL64WL");
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
        debug << "        // " << stackChange << " -> " << stackSize;
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
        debug << "        // " << stackChange << " -> " << stackSize;
        out << "\n";
        break;
    }
    default:
        break;
    };
    /* -- End of source code generated with help of "gen_instr.js" script -- */
}

# if 0

void Generator::generateFunction(WasmFunction$$ func)
{
    TRACE();

    stackSize = 0;
    blockStack = new$;
    function = func;
    ind = "";

    verbose << "\n\n// ========== Function " << func->index << " ========== //\n";

    int localOffset = 0;
    int reserveBytes = 0;
    function->localsOffsets->length(func->locals->length());
    for (int i = func->type->param->length(); i < func->locals->length(); i++) {
        int words = wasmTypeWords(func->locals[i]);
        function->localsOffsets[i] = localOffset;
        verbose << "   // local " << wasmTypeName(func->locals[i]) << " @" << localOffset << "\n";
        localOffset += 4 * words;
        reserveBytes += 4 * words;
    }
    function->returnAddressOffset = localOffset;
    verbose << "   // return address @" << localOffset << "\n";
    localOffset += 4;
    for (int i = func->type->param->length() - 1; i >= 0; i--) {
        int words = wasmTypeWords(func->locals[i]);
        function->localsOffsets[i] = localOffset;
        verbose << "   // param " << wasmTypeName(func->locals[i]) << " @" << localOffset << "\n";
        localOffset += 4 * words;
    }
    function->block->stackBase = -localOffset / 4;

    out << "func" << func->index << ":\n";

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


void Generator::generateInstr(WasmInstr$ instr)
{
    Array$$<u64> imm = instr->imm;

    switch(instr->code) {
    case INSTR_ELSE: {
        TRACE();
        auto block = blockStack[RangeEnd - 1];
        out << ind->buffer() << "BR block" << block->id << "_end\n";
        out << ind->buffer() << "block" << block->id << "_else:";
        block->elsePresent = true;
        stackSize = block->stackBase + wasmTypesWords(block->type->param);
        break;
    }
    case INSTR_IF: {
        TRACE();
        stackSize--;
        instr->block->id = totalBlocks++;
        instr->block->stackBase = stackSize - wasmTypesWords(instr->block->type->param);
        out << ind->buffer() << "BRF block" << instr->block->id << "_else\n";
        generateBlock(instr->block);
        if (!instr->block->elsePresent)
            out << ind->buffer() << "block" << instr->block->id << "_else:\n";
        out << ind->buffer() << "block" << instr->block->id << "_end:";
        break;
    }
    case INSTR_BLOCK: {
        TRACE();
        instr->block->id = totalBlocks++;
        instr->block->stackBase = stackSize - wasmTypesWords(instr->block->type->param);
        generateBlock(instr->block);
        out << ind->buffer() << "block" << instr->block->id << "_end:";
        break;
    }
    case INSTR_LOOP: {
        TRACE();
        instr->block->id = totalBlocks++;
        instr->block->stackBase = stackSize - wasmTypesWords(instr->block->type->param);
        out << ind->buffer() << "block" << instr->block->id << "_begin:\n";
        generateBlock(instr->block);
        out << ind->buffer() << "block" << instr->block->id << "_end:";
        break;
    }
    case INSTR_END: {
        TRACE();
        auto block = blockStack[RangeEnd - 1];
        stackSize = block->stackBase + wasmTypesWords(block->type->result);
        break;
    }
    case INSTR_GLOBAL_GET: {
        TRACE();
        out << ind->buffer() << "READ global" << instr->imm[0] << " + " << instr->imm[1];
        stackSize++;
        break;
    }
    case INSTR_TRIVM_CALL_IMPORT: {
        TRACE();
        out << ind->buffer() << "CALL " << instr->immString->buffer() << " // TODO: implement";
        break;
    }
    case INSTR_CALL: {
        TRACE();
        auto callee = mod->functions[instr->imm[0]];
        out << ind->buffer() << "CALL func" << instr->imm[0];
        stackSize -= wasmTypesWords(callee->type->param);
        stackSize += wasmTypesWords(callee->type->result);
        break;
    }
    case INSTR_CALL_INDIRECT: {
        TRACE();
        auto functionType = mod->functionTypes[imm[0]]; // TODO: keep type as reference to object (not index)
        auto table = imm[1];
        if (table > 0) {
            out << ind->buffer() << "NEG -table" << table << "\n";
            generateInstr(WasmInstr{
                .code = INSTR_TRIVM_CALL_IMPORT,
                .immString = "__trivmlib__.call_indirect_n"_S,
            });
        } else {
            generateInstr(WasmInstr{
                .code = INSTR_TRIVM_CALL_IMPORT,
                .immString = "__trivmlib__.call_indirect_0"_S,
            });
        }
        break;
    }
    case INSTR_LOCAL_GET: {
        TRACE();
        out << ind->buffer() << "READ [SP] + " << 4 * stackSize << " + " << function->localsOffsets[instr->imm[0]] << " + " << instr->imm[1];
        stackSize++;
        break;
    }
    case INSTR_I32_CONST: {
        TRACE();
        if (instr->imm[0] < 0x80000000 && instr->imm[0] != 0) {
            out << ind->buffer() << "NEG -" << instr->imm[0];
        } else {
            out << ind->buffer() << "NEG " << -(s32)instr->imm[0];
        }
        stackSize++;
        break;
    }
    case INSTR_TRIVM_DUP: {
        TRACE();
        out << ind->buffer() << "READ [SP]";
        stackSize++;
        break;
    }
    case INSTR_LOCAL_SET: {
        TRACE();
        stackSize--;
        out << ind->buffer() << "WRITE [SP] + " << 4 * stackSize << " + " << function->localsOffsets[instr->imm[0]] << " + " << instr->imm[1];
        break;
    }
    case INSTR_GLOBAL_SET: {
        TRACE();
        stackSize--;
        out << ind->buffer() << "WRITE global" << instr->imm[0] << " + " << instr->imm[1];
        break;
    }
    case INSTR_I32_LOAD: {
        TRACE();
        if (instr->imm[0] % 4 == 0) {
            out << ind->buffer() << "READ [IMP] + [POP] + " << instr->imm[0];
        } else {
            out << ind->buffer() << "ADD " << instr->imm[0] << "\n";
            out << ind->buffer() << "READ [IMP] + [POP]";
        }
        break;
    }
    case INSTR_I32_LOAD16_S:
    case INSTR_I32_LOAD16_U: {
        TRACE();
        if (instr->imm[0] % 2 == 0) {
            out << ind->buffer() << getTrivmInstr(instr->code) << " [IMP] + [POP] + " << instr->imm[0];
        } else {
            out << ind->buffer() << "ADD " << instr->imm[0] << "\n";
            out << ind->buffer() << getTrivmInstr(instr->code) << " [IMP] + [POP]";
        }
        break;
    }
    case INSTR_I32_STORE16: {
        TRACE();
        stackSize -= 2;
        if (instr->imm[0] % 2 == 0) {
            out << ind->buffer() << getTrivmInstr(instr->code) << " [IMP] + [POP] + " << instr->imm[0];
        } else {
            out << ind->buffer() << "ADD " << instr->imm[0] << "\n";
            out << ind->buffer() << getTrivmInstr(instr->code) << " [IMP] + [POP]";
        }
        break;
    }
    case INSTR_I32_LOAD8_S:
    case INSTR_I32_LOAD8_U: {
        TRACE();
        out << ind->buffer() << getTrivmInstr(instr->code) << " [IMP] + [POP] + " << instr->imm[0];
        break;
    }
    case INSTR_I32_STORE8: {
        TRACE();
        stackSize -= 2;
        out << ind->buffer() << getTrivmInstr(instr->code) << " [IMP] + [POP] + " << instr->imm[0];
        break;
    }
    case INSTR_TRIVM_EMPTY: {
        TRACE();
        break;
    }
    case INSTR_I32_STORE: {
        TRACE();
        stackSize -= 2;
        if (instr->imm[0] % 4 == 0) {
            out << ind->buffer() << "WRITE [IMP] + [POP] + " << instr->imm[0];
        } else {
            out << ind->buffer() << "ADD " << instr->imm[0] << "\n";
            out << ind->buffer() << "WRITE [IMP] + [POP]";
        }
        break;
    }
    case INSTR_BR_TABLE: {
        TRACE();
        stackSize--;
        break;
    }
    case INSTR_BR: {
        TRACE();
        auto block = blockStack[RangeEnd - (1 + instr->imm[0])];
        auto data = WasmInstrBr$$(instr->data);
        bool backward = (block->instr->code == INSTR_LOOP && !data->forceForward);
        bool isReturn = (block->instr->code == INSTR_TRIVM_FUNCTION);
        int skip;
        int keep;
        const char* label;
        if (data->conditional) {
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
        if (data->conditional) {
            if (skip == 0) {
                out << ind->buffer() << "BR" << (data->negated ? "F" : "T") << " block" << block->id << label;
            } else {
                auto index = totalBlocks++;
                out << ind->buffer() << "BR" << (data->negated ? "T" : "F") << " skip" << index;
                if (isReturn) {
                    if (block->stackBase != -1 || keep != 0 || skip != 1) {
                        out << ind->buffer() << "READ [SP] + " << 4 * stackSize << " + " << function->returnAddressOffset << "\n";
                        generateUnwind(keep + 1, skip);
                    }
                    out << ind->buffer() << "READ PC";
                } else {
                    generateUnwind(keep, skip);
                    out << ind->buffer() << "BR block" << block->id << label;
                }
                out << ind->buffer() << "skip" << index << ":";
            }
        } else {
            if (isReturn) {
                if (block->stackBase != -1 || keep != 0 || skip != 1) {
                    out << ind->buffer() << "READ [SP] + " << 4 * stackSize << " + " << function->returnAddressOffset << "\n";
                    generateUnwind(keep + 1, skip);
                }
                out << ind->buffer() << "READ PC";
            } else if (skip == 0) {
                out << ind->buffer() << "BR block" << block->id << label;
            } else {
                generateUnwind(keep, skip);
                out << ind->buffer() << "BR block" << block->id << label;
            }
        }
        break;
    }
    case INSTR_TRIVM_BUILTIN: {
        TRACE();
        generateBuiltin(instr);
        break;
    }
    case INSTR_TRIVM_POP: {
        TRACE();
        out << ind->buffer() << "BRT 0";
        break;
    }
    case INSTR_I32_SHL:
    case INSTR_I32_SHR_S:
    case INSTR_I32_SHR_U:
    case INSTR_I32_GT_S:
    case INSTR_I32_GT_U:
    case INSTR_I32_LT_S:
    case INSTR_I32_LT_U:
    case INSTR_I32_EQ:
    case INSTR_I32_ADD:
    case INSTR_I32_SUB:
    case INSTR_I32_MUL:
    case INSTR_I32_DIV_S:
    case INSTR_I32_DIV_U:
    case INSTR_I32_AND:
    case INSTR_I32_OR:
    case INSTR_I32_XOR: {
        TRACE();
        out << ind->buffer() << getTrivmInstr(instr->code);
        stackSize--;
        break;
    }
    case INSTR_I32_EQZ: {
        TRACE();
        out << ind->buffer() << getTrivmInstr(instr->code);
        break;
    }
    default: {
        //FATAL("Unexpected instruction");
        out << ind->buffer() << "// Unexpected instruction " << std::hex << instr->code << std::dec;
        break;
    }
    };
    
    verbose << "               // " << stackSize << "\n";
}

void Generator::generateUnwind(u32 keep, u32 skip)
{
    if (vmConfig.ext.reduce) {
        if (keep < 16 && skip < 16) {
            s8 value = (keep << 4) | skip;
            out << ind->buffer() << "UNWIND " << (s32)value << "\n";
            return;
        } else if (keep < 256 && skip < 256) {
            s16 value = (keep << 8) | skip;
            out << ind->buffer() << "UNWIND " << (s32)value << "\n";
            return;
        } else if (keep < 65536 && skip < 65536) {
            u32 value = (keep << 16) | skip;
            out << ind->buffer() << "UNWIND " << value << "\n";
            return;
        }
    }
    // TODO: implement
}


void Generator::generateBuiltin(WasmInstr$ instr)
{
    switch (instr->imm[0])
    {
    case BUILTIN_MAKE64: {
        TRACE();
        // Nothing to generate
        break;
    }
    default:
        FATAL("Unimplemented builtin");
    }
}

const char* Generator::getTrivmInstr(u32 opcode)
{
    switch (opcode)
    {
    case INSTR_CALL:
    case INSTR_CALL_INDIRECT:
    case INSTR_RETURN_CALL:
    case INSTR_RETURN_CALL_INDIRECT:
    case INSTR_TRIVM_CALL_IMPORT:
        return "CALL";
    case INSTR_LOCAL_GET:
    case INSTR_GLOBAL_GET:
    case INSTR_TABLE_GET:
    case INSTR_I32_LOAD:
    case INSTR_I64_LOAD:
    case INSTR_TRIVM_DUP:
        return "READ";
    case INSTR_LOCAL_SET:
    case INSTR_LOCAL_TEE:
    case INSTR_GLOBAL_SET:
    case INSTR_TABLE_SET:
    case INSTR_I32_STORE:
    case INSTR_I64_STORE:
    case INSTR_I32_WRAP_I64:
    case INSTR_TRIVM_POP:
        return "WRITE";
    case INSTR_I32_LOAD8_S:
        return "READSB";
    case INSTR_I32_LOAD8_U:
        return "READB";
    case INSTR_I32_LOAD16_S:
        return "READSH";
    case INSTR_I32_LOAD16_U:
        return "READH";
    case INSTR_I32_STORE8:
        return "WRITEB";
    case INSTR_I32_STORE16:
        return "WRITEH";
    case INSTR_I32_CONST:
    case INSTR_REF_FUNC:
        return "NEG";
    case INSTR_I32_EQZ:
        return "NOT";
    case INSTR_I32_EQ:
        return "EQ";
    case INSTR_I32_LT_S:
        return "SLT";
    case INSTR_I32_LT_U:
        return "ULT";
    case INSTR_I32_GT_S:
        return "SGT";
    case INSTR_I32_GT_U:
        return "UGT";
    case INSTR_I64_EQZ:
        return "NOT64";
    case INSTR_I64_EQ:
        return "EQ64";
    case INSTR_I64_LT_S:
        return "SLT64";
    case INSTR_I64_LT_U:
        return "UTL64";
    case INSTR_I64_GT_S:
        return "SGT64";
    case INSTR_I64_GT_U:
        return "STL64";
    case INSTR_F32_EQ:
        return "EQF32";
    case INSTR_F32_NE:
        return "NEF32";
    case INSTR_F32_LT:
        return "LTF32";
    case INSTR_F32_GT:
        return "GTF32";
    case INSTR_F32_LE:
        return "LEF32";
    case INSTR_F32_GE:
        return "GEF32";
    case INSTR_F64_EQ:
        return "EQF64";
    case INSTR_F64_NE:
        return "NEF64";
    case INSTR_F64_LT:
        return "LTF64";
    case INSTR_F64_GT:
        return "GTF64";
    case INSTR_F64_LE:
        return "LEF64";
    case INSTR_F64_GE:
        return "GEF64";
    case INSTR_I32_ADD:
        return "ADD";
    case INSTR_I32_SUB:
        return "SUB";
    case INSTR_I32_MUL:
        return "MUL";
    case INSTR_I32_DIV_S:
        return "SDIV";
    case INSTR_I32_DIV_U:
        return "UDIV";
    case INSTR_I32_REM_S:
        return "SMOD";
    case INSTR_I32_REM_U:
        return "UMOD";
    case INSTR_I32_AND:
        return "AND";
    case INSTR_I32_OR:
        return "OR";
    case INSTR_I32_XOR:
        return "XOR";
    case INSTR_I32_SHL:
        return "SHL";
    case INSTR_I32_SHR_S:
        return "SSHR";
    case INSTR_I32_SHR_U:
        return "USHR";
    case INSTR_I64_ADD:
        return "ADD64";
    case INSTR_I64_SUB:
        return "SUB64";
    case INSTR_I64_MUL:
        return "MUL64";
    case INSTR_I64_DIV_S:
        return "SDIV64";
    case INSTR_I64_DIV_U:
        return "UDIV64";
    case INSTR_I64_REM_S:
        return "SMOD64";
    case INSTR_I64_REM_U:
        return "UMOD64";
    case INSTR_I64_AND:
        return "AND64";
    case INSTR_I64_OR:
        return "OR64";
    case INSTR_I64_XOR:
        return "XOR64";
    case INSTR_I64_SHL:
        return "SHL64";
    case INSTR_I64_SHR_S:
        return "SSHR64";
    case INSTR_I64_SHR_U:
        return "USHR64";
    case INSTR_F32_CEIL:
        return "CEILF32";
    case INSTR_F32_FLOOR:
        return "FLOORF32";
    case INSTR_F32_TRUNC:
        return "TRUNCF32";
    case INSTR_F32_NEAREST:
        return "NEARESTF32";
    case INSTR_F32_SQRT:
        return "SQRTF32";
    case INSTR_F32_ADD:
        return "ADDF32";
    case INSTR_F32_SUB:
        return "SUBF32";
    case INSTR_F32_MUL:
        return "MULF32";
    case INSTR_F32_DIV:
        return "DIVF32";
    case INSTR_F64_CEIL:
        return "CEILF64";
    case INSTR_F64_FLOOR:
        return "FLOORF64";
    case INSTR_F64_TRUNC:
        return "TRUNCF64";
    case INSTR_F64_NEAREST:
        return "NEARESTF64";
    case INSTR_F64_SQRT:
        return "SQRTF64";
    case INSTR_F64_ADD:
        return "ADDF64";
    case INSTR_F64_SUB:
        return "SUBF64";
    case INSTR_F64_MUL:
        return "MULF64";
    case INSTR_F64_DIV:
        return "DIVF64";
    case INSTR_I32_TRUNC_F32_S:
        return "STRUNCF32";
    case INSTR_I32_TRUNC_F32_U:
        return "UTRUNCF32";
    case INSTR_I32_TRUNC_F64_S:
        return "STRUNCF64";
    case INSTR_I32_TRUNC_F64_U:
        return "UTRUNCF64";
    case INSTR_I64_EXTEND_I32_S:
    case INSTR_I64_EXTEND_I32_U:
    case INSTR_TRIVM_EXTS64:
        return "EXTS64";
    case INSTR_I64_TRUNC_F32_S:
        return "STRUNC64F32";
    case INSTR_I64_TRUNC_F32_U:
        return "UTRUNC64F32";
    case INSTR_I64_TRUNC_F64_S:
        return "STRUNC64F64";
    case INSTR_I64_TRUNC_F64_U:
        return "UTRUNC64F64";
    case INSTR_F32_CONVERT_I32_S:
        return "SCONVF32";
    case INSTR_F32_CONVERT_I32_U:
        return "UCONVF32";
    case INSTR_F32_CONVERT_I64_S:
        return "SCONV64F32";
    case INSTR_F32_CONVERT_I64_U:
        return "UCONV64F32";
    case INSTR_F32_DEMOTE_F64:
        return "DEMOTE";
    case INSTR_F64_CONVERT_I32_S:
        return "SCONVF64";
    case INSTR_F64_CONVERT_I32_U:
        return "UCONVF64";
    case INSTR_F64_CONVERT_I64_S:
        return "SCONV64F64";
    case INSTR_F64_CONVERT_I64_U:
        return "UCONV64F64";
    case INSTR_F64_PROMOTE_F32:
        return "PROMOTE";
    case INSTR_I32_TRUNC_SAT_F32_S:
        return "SSTRUNCF32";
    case INSTR_I32_TRUNC_SAT_F32_U:
        return "USTRUNCF32";
    case INSTR_I32_TRUNC_SAT_F64_S:
        return "SSTRUNCF64";
    case INSTR_I32_TRUNC_SAT_F64_U:
        return "USTRUNCF64";
    case INSTR_I64_TRUNC_SAT_F32_S:
        return "SSTRUNC64F32";
    case INSTR_I64_TRUNC_SAT_F32_U:
        return "USTRUNC64F32";
    case INSTR_I64_TRUNC_SAT_F64_S:
        return "SSTRUNC64F64";
    case INSTR_I64_TRUNC_SAT_F64_U:
        return "USTRUNC64F64";
    case INSTR_TRIVM_EXTS:
        return "EXTS";
    default:
        FATAL("Unexpected instruction");
    }
}

#endif
