#include "Utils.hh"
#include "WasmData.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmParser.hh"
#include "WasmInstr.hh"
#include "Generator.hh"
#include "VMConfig.hh"


void Generator::generate(WasmData$ d)
{
    TRACE();

    this->d = d;

    totalBlocks = 0;

    for (auto func: d->functions) {
        if (func->import == nullptr) {
            generateFunction(func);
        }
    }

}


void Generator::generateFunction(WasmFunction$ func)
{
    TRACE();

    stackSize = 0;
    blockStack = new$;
    function = func;
    ind = "";

    int localOffset = 0;
    int reserveBytes = 0;
    function->localsOffsets->length(func->locals->length());
    for (int i = func->type->param->length(); i < func->locals->length(); i++) {
        int words = wasmTypeWords(func->locals[i]);
        function->localsOffsets[i] = localOffset;
        localOffset += 4 * words;
        reserveBytes += 4 * words;
    }
    function->returnAddressOffset = localOffset;
    localOffset += 4;
    for (int i = func->type->param->length() - 1; i >= 0; i--) {
        int words = wasmTypeWords(func->locals[i]);
        function->localsOffsets[i] = localOffset;
        localOffset += 4 * words;
    }

    out << "\n\n// ========== Function " << func->index << " ========== //" << std::endl;
    out << "func" << func->index << ":" << std::endl;

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

void Generator::generateBlock(WasmBlock$$ block)
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


void Generator::generateInstr(WasmInstr$$ instr)
{
    Array$<u64> imm = instr->imm;

    out << ind->buffer() << "                     // " << stackSize << std::endl;

    switch(instr->code) {
    case INSTR_ELSE: {
        TRACE();
        auto block = blockStack[RangeEnd - 1];
        out << ind->buffer() << "BR block" << block->id << "_end" << std::endl;
        out << ind->buffer() << "block" << block->id << "_else:" << std::endl;
        block->elsePresent = true;
        stackSize = block->stackBase + wasmTypesWords(block->type->param);
        break;
    }
    case INSTR_IF: {
        TRACE();
        instr->block->id = totalBlocks++;
        instr->block->stackBase = stackSize - wasmTypesWords(instr->block->type->param);
        out << ind->buffer() << "BRF block" << instr->block->id << "_else" << std::endl;
        generateBlock(instr->block);
        if (!instr->block->elsePresent)
            out << ind->buffer() << "block" << instr->block->id << "_else:" << std::endl;
        out << ind->buffer() << "block" << instr->block->id << "_end:" << std::endl;
        break;
    }
    case INSTR_BLOCK: {
        TRACE();
        instr->block->id = totalBlocks++;
        instr->block->stackBase = stackSize - wasmTypesWords(instr->block->type->param);
        generateBlock(instr->block);
        out << ind->buffer() << "block" << instr->block->id << "_end:" << std::endl;
        break;
    }
    case INSTR_LOOP: {
        TRACE();
        instr->block->id = totalBlocks++;
        instr->block->stackBase = stackSize - wasmTypesWords(instr->block->type->param);
        out << ind->buffer() << "block" << instr->block->id << "_begin:" << std::endl;
        generateBlock(instr->block);
        out << ind->buffer() << "block" << instr->block->id << "_end:" << std::endl;
        break;
    }
    case INSTR_END: {
        TRACE();
        auto block = blockStack[RangeEnd - 1];
        if (block->instr->code == INSTR_LOOP) {

        }
        break;
    }
    case INSTR_GLOBAL_GET: {
        TRACE();
        out << ind->buffer() << "READ global" << instr->imm[0] << " + " << instr->imm[1] << std::endl;
        stackSize++;
        break;
    }
    case INSTR_CALL: {
        TRACE();
        auto callee = d->functions[instr->imm[0]];
        out << ind->buffer() << "CALL func" << instr->imm[0] << std::endl;
        stackSize -= wasmTypesWords(callee->type->param);
        stackSize += wasmTypesWords(callee->type->result);
        break;
    }
    case INSTR_CALL_INDIRECT: {
        TRACE();
        auto functionType = d->functionTypes[imm[0]];
        auto table = imm[1];
        if (table > 0) {
            out << ind->buffer() << "NEG -table" << table << std::endl;
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
        out << ind->buffer() << "READ [SP] + " << 4 * stackSize << " + " << function->localsOffsets[instr->imm[0]] << " + " << instr->imm[1] << std::endl;
        stackSize++;
        break;
    }
    case INSTR_I32_CONST: {
        TRACE();
        if (instr->imm[0] < 0x80000000 && instr->imm[0] != 0) {
            out << ind->buffer() << "NEG -" << instr->imm[0] << std::endl;
        } else {
            out << ind->buffer() << "NEG " << -(s32)instr->imm[0] << std::endl;
        }
        stackSize++;
        break;
    }
    case INSTR_TRIVM_DUP: {
        TRACE();
        out << ind->buffer() << "READ [SP]" << std::endl;
        stackSize++;
        break;
    }
    case INSTR_LOCAL_SET: {
        TRACE();
        stackSize--;
        out << ind->buffer() << "WRITE [SP] + " << 4 * stackSize << " + " << function->localsOffsets[instr->imm[0]] << " + " << instr->imm[1] << std::endl;
        break;
    }
    case INSTR_GLOBAL_SET: {
        TRACE();
        stackSize--;
        out << ind->buffer() << "WRITE global" << instr->imm[0] << " + " << instr->imm[1] << std::endl;
        break;
    }
    case INSTR_I32_LOAD: {
        TRACE();
        if (instr->imm[0] % 4 == 0) {
            out << ind->buffer() << "READ [IMP] + [POP] + " << instr->imm[0] << std::endl;
        } else {
            out << ind->buffer() << "ADD " << instr->imm[0] << std::endl;
            out << ind->buffer() << "READ [IMP] + [POP]" << std::endl;
        }
        break;
    }
    case INSTR_I32_LOAD16_S:
    case INSTR_I32_LOAD16_U: {
        TRACE();
        if (instr->imm[0] % 2 == 0) {
            out << ind->buffer() << getTrivmInstr(instr->code) << " [IMP] + [POP] + " << instr->imm[0] << std::endl;
        } else {
            out << ind->buffer() << "ADD " << instr->imm[0] << std::endl;
            out << ind->buffer() << getTrivmInstr(instr->code) << " [IMP] + [POP]" << std::endl;
        }
        break;
    }
    case INSTR_I32_STORE16: {
        TRACE();
        stackSize -= 2;
        if (instr->imm[0] % 2 == 0) {
            out << ind->buffer() << getTrivmInstr(instr->code) << " [IMP] + [POP] + " << instr->imm[0] << std::endl;
        } else {
            out << ind->buffer() << "ADD " << instr->imm[0] << std::endl;
            out << ind->buffer() << getTrivmInstr(instr->code) << " [IMP] + [POP]" << std::endl;
        }
        break;
    }
    case INSTR_BR_TABLE: {
        TRACE();
        stackSize--;
        break;
    }
    case INSTR_I32_LOAD8_S:
    case INSTR_I32_LOAD8_U: {
        TRACE();
        out << ind->buffer() << getTrivmInstr(instr->code) << " [IMP] + [POP] + " << instr->imm[0] << std::endl;
        break;
    }
    case INSTR_I32_STORE8: {
        TRACE();
        stackSize -= 2;
        out << ind->buffer() << getTrivmInstr(instr->code) << " [IMP] + [POP] + " << instr->imm[0] << std::endl;
        break;
    }
    case INSTR_TRIVM_EMPTY: {
        TRACE();
        break;
    }
    case INSTR_I32_STORE: {
        TRACE();
        if (instr->imm[0] % 4 == 0) {
            out << ind->buffer() << "WRITE [IMP] + [POP] + " << instr->imm[0] << std::endl;
        } else {
            out << ind->buffer() << "ADD " << instr->imm[0] << std::endl;
            out << ind->buffer() << "WRITE [IMP] + [POP]" << std::endl;
        }
        break;
    }
    case INSTR_TRIVM_FBR: {
        TRACE();
        auto block = blockStack[RangeEnd - (1 + instr->imm[0])];
        int skip = stackSize - wasmTypesWords(block->type->result) - block->stackBase;
        if (skip == 0) {
            out << ind->buffer() << "BR block" << block->id << "_end" << std::endl;
        } else {
            generateUnwind(wasmTypesWords(block->type->result), skip);
            out << ind->buffer() << "BR block" << block->id << "_end" << std::endl;
        }
        break;
    }
    case INSTR_TRIVM_BBR: {
        TRACE();
        auto block = blockStack[RangeEnd - (1 + instr->imm[0])];
        int skip = stackSize - wasmTypesWords(block->type->param) - block->stackBase;
        if (skip == 0) {
            out << ind->buffer() << "BR block" << block->id << "_begin" << std::endl;
        } else {
            generateUnwind(wasmTypesWords(block->type->result), skip);
            out << ind->buffer() << "BR block" << block->id << "_begin" << std::endl;
        }
        break;
    }
    case INSTR_RETURN: {
        TRACE();
        out << ind->buffer() << "READ [SP] + " << 4 * stackSize << " + " << function->returnAddressOffset << std::endl;
        generateUnwind(wasmTypesWords(function->type->result) + 1, stackSize + wasmTypesWords(function->type->param) + wasmTypesWords(function->locals) + 1);
        out << ind->buffer() << "WRITE PC" << std::endl;
        break;
    }
    case INSTR_TRIVM_RETURN_IF: {
        TRACE();
        auto index = totalBlocks++;
        out << ind->buffer() << "BRF skip" << index << std::endl;
        generateInstr(WasmInstr{
            .code = INSTR_RETURN,
        });
        out << ind->buffer() << "skip" << index << ":" << std::endl;
        break;
    }
    case INSTR_TRIVM_FBR_IF: {
        TRACE();
        stackSize--;
        auto block = blockStack[RangeEnd - (1 + instr->imm[0])];
        int skip = stackSize - wasmTypesWords(block->type->result) - block->stackBase;
        if (skip == 0) {
            out << ind->buffer() << "BRT block" << block->id << "_end" << std::endl;
        } else {
            auto index = totalBlocks++;
            out << ind->buffer() << "BRF skip" << index << std::endl;
            generateUnwind(wasmTypesWords(block->type->result), skip);
            out << ind->buffer() << "BR block" << block->id << "_end" << std::endl;
            out << ind->buffer() << "skip" << index << ":" << std::endl;
        }
        break;
    }
    case INSTR_TRIVM_BBR_IF: {
        TRACE();
        stackSize--;
        auto block = blockStack[RangeEnd - (1 + instr->imm[0])];
        int skip = stackSize - wasmTypesWords(block->type->param) - block->stackBase;
        if (skip == 0) {
            out << ind->buffer() << "BRT block" << block->id << "_begin" << std::endl;
        } else {
            auto index = totalBlocks++;
            out << ind->buffer() << "BRF skip" << index << std::endl;
            generateUnwind(wasmTypesWords(block->type->result), skip);
            out << ind->buffer() << "BR block" << block->id << "_begin" << std::endl;
            out << ind->buffer() << "skip" << index << ":" << std::endl;
        }
        break;
    }
    case INSTR_BR_IF: {
        TRACE();
        stackSize--;
        auto block = blockStack[RangeEnd - (1 + instr->imm[0])];
        if (block->instr->code == INSTR_LOOP) {
            int skip = stackSize - wasmTypesWords(block->type->param) - block->stackBase;
            if (skip == 0) {
                out << ind->buffer() << "BRT block" << block->id << "_begin" << std::endl;
            } else {
                auto index = totalBlocks++;
                out << ind->buffer() << "BRF skip" << index << std::endl;
                generateUnwind(wasmTypesWords(block->type->result), skip);
                out << ind->buffer() << "BR block" << block->id << "_begin" << std::endl;
                out << ind->buffer() << "skip" << index << ":" << std::endl;
            }
        } else {
            int skip = stackSize - wasmTypesWords(block->type->result) - block->stackBase;
            if (skip == 0) {
                out << ind->buffer() << "BRT block" << block->id << "_end" << std::endl;
            } else {
                auto index = totalBlocks++;
                out << ind->buffer() << "BRF skip" << index << std::endl;
                generateUnwind(wasmTypesWords(block->type->result), skip);
                out << ind->buffer() << "BR block" << block->id << "_end" << std::endl;
                out << ind->buffer() << "skip" << index << ":" << std::endl;
            }
        }
        break;
    }
    case INSTR_TRIVM_CALL_IMPORT: {
        TRACE();
        out << ind->buffer() << "CALL " << instr->immString->buffer() << " // TODO: implement" << std::endl;
        break;
    }
    case INSTR_TRIVM_POP: {
        TRACE();
        out << ind->buffer() << "BRT 0" << std::endl;
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
        out << ind->buffer() << getTrivmInstr(instr->code) << std::endl;
        stackSize--;
        break;
    }
    case INSTR_I32_EQZ: {
        TRACE();
        out << ind->buffer() << getTrivmInstr(instr->code) << std::endl;
        break;
    }
    default: {
        //FATAL("Unexpected instruction");
        out << ind->buffer() << "// Unexpected instruction " << std::hex << instr->code << std::dec << std::endl;
        break;
    }
    };
}

void Generator::generateUnwind(u32 keep, u32 skip)
{
    if (vmConfig.ext.reduce) {
        if (keep < 16 && skip < 16) {
            s8 value = (keep << 4) | skip;
            out << ind->buffer() << "UNWIND " << (s32)value << std::endl;
            return;
        } else if (keep < 256 && skip < 256) {
            s16 value = (keep << 8) | skip;
            out << ind->buffer() << "UNWIND " << (s32)value << std::endl;
            return;
        } else if (keep < 65536 && skip < 65536) {
            u32 value = (keep << 16) | skip;
            out << ind->buffer() << "UNWIND " << value << std::endl;
            return;
        }
    }
    // TODO: implement
}

const char* Generator::getTrivmInstr(u32 opcode)
{
    switch (opcode)
    {
    case INSTR_CALL:
    case INSTR_CALL_INDIRECT:
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