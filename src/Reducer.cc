
#include "common.hh"
#include "WasmData.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmParser.hh"
#include "WasmInstrDesc.hh"
#include "IRGenerator.hh"
#include "VMConfig.hh"


void IRGenerator::generate(WasmData$ d)
{
    TRACE();

    this->d = d;

    for (auto func: d->functions) {
        if (func->import == nullptr) {
            generateFunction(func);
        }
    }

}


void IRGenerator::generateFunction(WasmFunction$ func)
{
    TRACE();

    wasmStack = new$;
    blockStack = new$;
    function = func;
    function->ir = new$;
    ir = function->ir;
    
    allocateParams();

    generateBlock(function->body);
}

void IRGenerator::allocateParams()
{
    Array$<u32> offsetArray;
    u32 offset = 0;
    for (auto type: function->type->param) {
        offsetArray->push(offset);
        offset += wasmTypeWords(type);
    }
    for (auto& o: offsetArray) {
        o = offset - o
    }
    
    function->paramsOffsets = offsetArray;
}

void IRGenerator::generateBlock(Array$<WasmInstr$$> body)
{
    TRACE();

    for (auto instr: body) {
        printf("Instruction 0x%02X %s\n", instr->code, instr->desc->name);
        switch (instr->code) {
            case INSTR_CODE_BLOCK: {

                break;
            }
            case INSTR_CODE_LOCAL_TEE: {
                u32 index = instr->imm[0];
                u32 offset = function->localsParamsOffsets[index];
                u32 type = function->localsParamsTypes[index];
                if (wasmTypeWords(type) == 1) {
                    ir->push(IRInstr{ .code = IR_READ_SP, .offset = 0, });
                    ir->push(IRInstr{ .code = IR_WRITE_LOCAL, .offset = offset, });
                } else {
                    ir->push(IRInstr{ .code = IR_READ_SP, .offset = 1, });
                    ir->push(IRInstr{ .code = IR_READ_SP, .offset = 1, });
                    if (vmConfig.extension64Bit) {
                        ir->push(IRInstr{ .code = IR_WRITEQ_LOCAL, .offset = offset, });
                    } else {
                        ir->push(IRInstr{ .code = IR_WRITE_LOCAL, .offset = offset, });
                        ir->push(IRInstr{ .code = IR_WRITE_LOCAL, .offset = offset + 1, });
                    }
                }
                if (wasmStack[RangeEnd - 1] != type)
                    FATAL("Invalid WASM stack");
                break;
            }
            case INSTR_CODE_GLOBAL_GET: {
                auto global = d->globals[instr->imm[0]];
                auto type = global->type;
                wasmStack->push(type);
                if (wasmTypeWords(type) == 1) {
                    ir->push(IRInstr{ .code = IR_READ_GLOBAL, .global = global, });
                } else if (vmConfig.extension64Bit) {
                    ir->push(IRInstr{ .code = IR_READQ_GLOBAL, .global = global, });
                } else {
                    ir->push(IRInstr{ .code = IR_READ_GLOBAL_HI, .global = global, });
                    ir->push(IRInstr{ .code = IR_READ_GLOBAL, .global = global, });
                }
                break;
            }
            case INSTR_CODE_GLOBAL_SET: {
                auto global = d->globals[instr->imm[0]];
                auto type = global->type;
                auto stackType = wasmStack->pop();
                if (stackType != type)
                    FATAL("Invalid WASM stack");
                if (wasmTypeWords(type) == 1) {
                    ir->push(IRInstr{ .code = IR_WRITE_GLOBAL, .global = global, });
                } else if (vmConfig.extension64Bit) {
                    ir->push(IRInstr{ .code = IR_WRITEQ_GLOBAL, .global = global, });
                } else {
                    ir->push(IRInstr{ .code = IR_WRITE_GLOBAL, .global = global, });
                    ir->push(IRInstr{ .code = IR_WRITE_GLOBAL_HI, .global = global, });
                }
                break;
            }
            case INSTR_CODE_I32_CONST: {
                wasmStack->push(TYPE_I32);
                ir->push(IRInstr{ .code = IR_NEG, .value = (u64)0 - instr->imm[0], });
                break;
            }
            case INSTR_CODE_I64_CONST: {
                wasmStack->push(TYPE_I64);
                ir->push(IRInstr{ .code = IR_Q_NEG, .value = (u64)0 - instr->imm[0], });
                break;
            }
            case INSTR_CODE_I32_SUB: {
                auto stackType = wasmStack->pop();
                if (stackType != TYPE_I32 || wasmStack[RangeEnd - 1] != TYPE_I32)
                    FATAL("Invalid WASM stack");
                ir->push(IRInstr{ .code = IR_SUB, });
                break;
            }
            case INSTR_CODE_I64_SUB: {
                auto stackType = wasmStack->pop();
                if (stackType != TYPE_I64 || wasmStack[RangeEnd - 1] != TYPE_I64)
                    FATAL("Invalid WASM stack");
                ir->push(IRInstr{ .code = IR_Q_SUB, });
                break;
            }
        }
    }
}

