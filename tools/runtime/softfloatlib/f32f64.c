
#define FILE_ID triwasmlib_f32f64

#include "common.h"

#include "softfloat.h"

TRIVM_EXPORT(trivm_f32_demote_f64)
float32_t trivm_f32_demote_f64(float64_t a)
{
    ANNOTATION(trivm_f32_demote_f64, "license:Berkeley-SoftFloat");
    return f64_to_f32(a);
}

TRIVM_EXPORT(trivm_f64_promote_f32)
float64_t trivm_f64_promote_f32(float32_t a)
{
    ANNOTATION(trivm_f64_promote_f32, "license:Berkeley-SoftFloat");
    return f32_to_f64(a);
}

TRIVM_EXPORT_ASSEMBLY(
    bool, __softfloatlib_helpers, (),
    ".BEGIN discardable\n"
    "__softfloatlib_return_first32:\n"
    "WRITE32 [SP]\n"
    "RET\n"
    ".END\n"
    ".BEGIN discardable\n"
    "__softfloatlib_return_first64:\n"
    "WRITE32 [SP]\n"
    "WRITE32 [SP]\n"
    "RET\n"
    ".END\n"
    ".BEGIN discardable\n"
    "__softfloatlib_return_second32:\n"
    "READ32 [SP] - 4\n"
    "WRITE32 [SP] - 8\n"
    "WRITE32 [SP]\n"
    "RET\n"
    ".END\n"
    ".BEGIN discardable\n"
    "__softfloatlib_return_second64:\n"
    "READ32 [SP] - 8\n"
    "WRITE32 [SP] - 16\n"
    "READ32 [SP] - 4\n"
    "WRITE32 [SP] - 12\n"
    "WRITE32 [SP]\n"
    "WRITE32 [SP]\n"
    "RET\n"
    ".END\n"
    ".BEGIN discardable\n"
    "softfloat_approxRecip_1k0s_table:\n"
    ".DATA16 0xFFC4, 0xF0BE, 0xE363, 0xD76F, 0xCCAD, 0xC2F0, 0xBA16, 0xB201,\n"
    ".DATA16 0xAA97, 0xA3C6, 0x9D7A, 0x97A6, 0x923C, 0x8D32, 0x887E, 0x8417,\n"
    ".end\n"
    ".BEGIN discardable\n"
    "softfloat_approxRecip_1k1s_table:\n"
    ".DATA16 0xF0F1, 0xD62C, 0xBFA1, 0xAC77, 0x9C0A, 0x8DDB, 0x8185, 0x76BA,\n"
    ".DATA16 0x6D3B, 0x64D4, 0x5D5C, 0x56B1, 0x50B6, 0x4B55, 0x4679, 0x4211,\n"
    ".END\n"
    ".BEGIN discardable\n"
    "softfloat_approxRecip_1k0s_table:\n"
    ".DATA16 0xB4C9, 0xFFAB, 0xAA7D, 0xF11C, 0xA1C5, 0xE4C7, 0x9A43, 0xDA29,\n"
    ".DATA16 0x93B5, 0xD0E5, 0x8DED, 0xC8B7, 0x88C6, 0xC16D, 0x8424, 0xBAE1,\n"
    ".end\n"
    ".BEGIN discardable\n"
    "softfloat_approxRecip_1k1s_table:\n"
    ".DATA16 0xA5A5, 0xEA42, 0x8C21, 0xC62D, 0x788F, 0xAA7F, 0x6928, 0x94B6,\n"
    ".DATA16 0x5CC7, 0x8335, 0x52A6, 0x74E2, 0x4A3E, 0x68FE, 0x432B, 0x5EFD,\n"
    ".END\n"
    );

TRIVM_INLINE_ASSEMBLY(
    "MUL 2\n"
    "READ16 [POP] + $_ProgramMemBase + softfloat_approxRecipSqrt_1k0s_table\n")
uint16_t softfloat_approxRecipSqrt_1k0s_asm(int index);

TRIVM_INLINE_ASSEMBLY(
    "MUL 2\n"
    "READ16 [POP] + $_ProgramMemBase + softfloat_approxRecipSqrt_1k1s_table\n")
uint16_t softfloat_approxRecipSqrt_1k1s_asm(int index);

TRIVM_INLINE_ASSEMBLY(
    "MUL 2\n"
    "READ16 [POP] + $_ProgramMemBase + softfloat_approxRecip_1k0s_table\n")
uint16_t softfloat_approxRecip_1k0s_asm(int index);

TRIVM_INLINE_ASSEMBLY(
    "MUL 2\n"
    "READ16 [POP] + $_ProgramMemBase + softfloat_approxRecip_1k1s_table\n")
uint16_t softfloat_approxRecip_1k1s_asm(int index);

uint16_t softfloat_approxRecipSqrt_1k0s(int index)
{
    return softfloat_approxRecipSqrt_1k0s_asm(index);
}

uint16_t softfloat_approxRecipSqrt_1k1s(int index)
{
    return softfloat_approxRecipSqrt_1k1s_asm(index);
}

uint16_t softfloat_approxRecip_1k0s(int index)
{
    return softfloat_approxRecip_1k0s_asm(index);
}

uint16_t softfloat_approxRecip_1k1s(int index)
{
    return softfloat_approxRecip_1k1s_asm(index);
}

TRIVM_INLINE_ASSEMBLY(
    "NEG -($_triwasm_temp_buffer12 - $_triwasm_mem0_start_address)\n")
void* softfloatlib_get_temp_buffer12_asm();

void* softfloatlib_get_temp_buffer12()
{
    return softfloatlib_get_temp_buffer12_asm();
}

TRIVM_EXPORT(temp)
uint32_t temp(uint32_t x) {
    TRIVM_IMPORT(__triwasm__triwasmlib, i32_clz)
    uint32_t i32_clz(uint32_t);
    return i32_clz(x);
}
