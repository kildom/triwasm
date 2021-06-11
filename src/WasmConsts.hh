#ifndef _WASM_CONSTS_HH_
#define _WASM_CONSTS_HH_

#include "common.hh"

static const u32 SECTION_ID_CUSTOM = 0;
static const u32 SECTION_ID_TYPE = 1;
static const u32 SECTION_ID_IMPORT = 2;
static const u32 SECTION_ID_FUNCTION = 3;
static const u32 SECTION_ID_TABLE = 4;
static const u32 SECTION_ID_MEMORY = 5;
static const u32 SECTION_ID_GLOBAL = 6;
static const u32 SECTION_ID_EXPORT = 7;
static const u32 SECTION_ID_START = 8;
static const u32 SECTION_ID_ELEMENT = 9;
static const u32 SECTION_ID_CODE = 10;
static const u32 SECTION_ID_DATA = 11;
static const u32 SECTION_ID_DATA_COUNT = 12;

static const u32 TYPE_I32 = 0x7F;
static const u32 TYPE_I64 = 0x7E;
static const u32 TYPE_F32 = 0x7D;
static const u32 TYPE_F64 = 0x7C;
static const u32 TYPE_FUNCREF = 0x70;
static const u32 TYPE_EXTERNREF = 0x6F;

static const s64 TYPE_BT_CMP_I32 = -1;
static const s64 TYPE_BT_CMP_I64 = -2;
static const s64 TYPE_BT_CMP_F32 = -3;
static const s64 TYPE_BT_CMP_F64 = -4;
static const s64 TYPE_BT_CMP_FUNCREF = -16;
static const s64 TYPE_BT_CMP_EXTERNREF = -17;
static const s64 TYPE_BT_CMP_VOID = -64;

static Array$<String$> sectionNames = {
    String$("custom"),
    String$("type"),
    String$("import"),
    String$("function"),
    String$("table"),
    String$("memory"),
    String$("global"),
    String$("export"),
    String$("start"),
    String$("element"),
    String$("code"),
    String$("data"),
    String$("data count"),
};

#endif /* _WASM_CONSTS_HH_ */
