
#include "Utils.hh"

#include "WasmConsts.hh"


u32 wasmTypeWords(u32 type)
{
        switch (type)
        {
        case TYPE_FUNCREF:
        case TYPE_EXTERNREF: // TODO: maybe this can be 64-bit on some platforms
        case TYPE_I32:
        case TYPE_F32:
            return 1;

        case TYPE_I64:
        case TYPE_F64:
            return 2;
        
        default:
            FATAL("Unknown type 0x%02X\n", type);
        }
}
