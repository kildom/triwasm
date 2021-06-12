
#include "common.hh"
#include "WasmData.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmParser.hh"
#include "InstrDesc.hh"
#include "IRGenerator.hh"


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
    
    function->irLocals = 0;
    Array$<u32> localsOffsets = allocateLocals(function->locals);
    Array$<u32> paramsOffsets = allocateLocals(function->type->param);
    function->localsOffsets = paramsOffsets + localsOffsets;
    function->paramsCount = function->type->param->length();

    generateBlock(function->body);
}

Array$<u32> IRGenerator::allocateLocals(Array$<u32> typeArray)
{
    Array$<u32> offsetArray;
    for (auto type: typeArray) {
        switch (type)
        {
        case TYPE_FUNCREF:
        case TYPE_EXTERNREF: // TODO: maybe this can be 64-bit on some platforms
        case TYPE_I32:
        case TYPE_F32:
            offsetArray->push(function->irLocals);
            function->irLocals++;
            break;

        case TYPE_I64:
        case TYPE_F64:
            offsetArray->push(function->irLocals);
            function->irLocals += 2;
            break;
        }
    }
    return offsetArray;
}

void IRGenerator::generateBlock(Array$<WasmInstr$$> body)
{
    TRACE();

    for (auto instr: body) {
        printf("Instruction 0x%02X %s\n", instr->code, instr->desc->name);
        switch (instr->code) {
            case 0x22: {
                u32 type;
                u32 offset = function->localsOffsets[instr->imm[0]];
                if (instr->imm[0] < function->paramsCount) {
                    type = function->type->param[instr->imm[0]];
                    ir->push(IRInstr{
                        // code = param set 32/64
                    });
                } else {
                    type = function->locals[instr->imm[0] - function->paramsCount];
                    ir->push(IRInstr{
                        // code = local set 32/64
                    });
                }
                // check wasmStack[RangeEnd - 1] == type
                break;
            }
            case 0x23: {
                auto global = d->globals[instr->imm[0]];
                wasmStack->push(global->type);
                ir->push(IRInstr{
                    // code = global get 32/64
                });
                break;
            }
            case 0x24: {
                auto global = d->globals[instr->imm[0]];
                //auto type = wasmStack->pop();
                // check type == global->type;
                ir->push(IRInstr{
                    // code = global set 32/64
                });
                break;
            }
            case 0x41: {
                wasmStack->push(TYPE_I32);
                ir->push(IRInstr{
                    // code = const
                });
                break;
            }
            case 0x6B: {
                // check wasmStack[RangeEnd - 1] == TYPE_I32
                // check wasmStack[RangeEnd - 2] == TYPE_I32
                //wasmStack->pop();
                ir->push(IRInstr{
                    // code = sub32
                });
                break;
            }
        }
    }
}

