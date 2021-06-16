
exports.SECTION_ID_CUSTOM = 0;
exports.SECTION_ID_TYPE = 1;
exports.SECTION_ID_IMPORT = 2;
exports.SECTION_ID_FUNCTION = 3;
exports.SECTION_ID_TABLE = 4;
exports.SECTION_ID_MEMORY = 5;
exports.SECTION_ID_GLOBAL = 6;
exports.SECTION_ID_EXPORT = 7;
exports.SECTION_ID_START = 8;
exports.SECTION_ID_ELEMENT = 9;
exports.SECTION_ID_CODE = 10;
exports.SECTION_ID_DATA = 11;
exports.SECTION_ID_DATA_COUNT = 12;

exports.TYPE_I32 = 0x7F;
exports.TYPE_I64 = 0x7E;
exports.TYPE_F32 = 0x7D;
exports.TYPE_F64 = 0x7C;
exports.TYPE_FUNCREF = 0x70;
exports.TYPE_EXTERNREF = 0x6F;

const i32 = 0x7F;
const i64 = 0x7E;
const f32 = 0x7D;
const f64 = 0x7C;
const funcref = 0x70;
const externref = 0x6F;

exports.i32 = i32;
exports.i64 = i64;
exports.f32 = f32;
exports.f64 = f64;
exports.funcref = funcref;
exports.externref = externref;

exports.TYPE_BT_CMP_I32 = -1;
exports.TYPE_BT_CMP_I64 = -2;
exports.TYPE_BT_CMP_F32 = -3;
exports.TYPE_BT_CMP_F64 = -4;
exports.TYPE_BT_CMP_FUNCREF = -16;
exports.TYPE_BT_CMP_EXTERNREF = -17;
exports.TYPE_BT_CMP_VOID = -64;

exports.BLOCK_TYPE_KIND_VOID = 0;
exports.BLOCK_TYPE_KIND_VALTYPE = 1;
exports.BLOCK_TYPE_KIND_INDEX = 2;

exports.typeNames = {
    0x7F: 'i32',
    0x7E: 'i64',
    0x7D: 'f32',
    0x7C: 'f64',
    0x70: 'funcref',
    0x6F: 'externref',
};

exports.typeWords = {
    0x7F: 1,
    0x7E: 2,
    0x7D: 1,
    0x7C: 2,
    0x70: 1,
    0x6F: 1,
};

exports.sectionNames = [
    'custom',
    'type',
    'import',
    'function',
    'table',
    'memory',
    'global',
    'export',
    'start',
    'element',
    'code',
    'data',
    'data count',
];


exports.instructions = [
    /* 0x00 */ { name: 'unreachable' },              // [t∗1]→[t∗2]
    /* 0x01 */ { name: 'nop', i: [], o: [] },
    /* 0x02 */ { name: 'block', params: null },      // [t∗1]→[t∗2]
    /* 0x03 */ { name: 'loop', params: null },       // [t∗1]→[t∗2]
    /* 0x04 */ { name: 'if', params: null },         // [t∗1]→[t∗2]
    /* 0x05 */ { name: 'else', params: null },
    /* 0x06 */ { name: '' },
    /* 0x07 */ { name: '' },
    /* 0x08 */ { name: '' },
    /* 0x09 */ { name: '' },
    /* 0x0A */ { name: '' },
    /* 0x0B */ { name: 'end', params: null },
    /* 0x0C */ { name: 'br', params: 'u' },         // [t∗1 t∗]→[t∗2]
    /* 0x0D */ { name: 'br_if', params: 'u' },      // [t∗ i32]→[t∗]
    /* 0x0E */ { name: 'br_table', params: null },   // [t∗1 t∗ i32]→[t∗2]
    /* 0x0F */ { name: 'return' },                   // [t∗1 t∗]→[t∗2]
    /* 0x10 */ { name: 'call', params: 'u' },        // [t∗1]→[t∗2]
    /* 0x11 */ { name: 'call_indirect', params: 'uu' },// [t∗1 i32]→[t∗2]
    /* 0x12 */ { name: '' },
    /* 0x13 */ { name: '' },
    /* 0x14 */ { name: '' },
    /* 0x15 */ { name: '' },
    /* 0x16 */ { name: '' },
    /* 0x17 */ { name: '' },
    /* 0x18 */ { name: '' },
    /* 0x19 */ { name: '' },
    /* 0x1A */ { name: 'drop' },                     // [t]→[]
    /* 0x1B */ { name: 'select' },                   // [t t i32]→[t]
    /* 0x1C */ { name: 'select', params: null },     // [t t i32]→[t]
    /* 0x1D */ { name: '' },
    /* 0x1E */ { name: '' },
    /* 0x1F */ { name: '' },
    /* 0x20 */ { name: 'local.get', params: 'u' },   // []→[t]
    /* 0x21 */ { name: 'local.set', params: 'u' },   // [t]→[]
    /* 0x22 */ { name: 'local.tee', params: 'u' },   // [t]→[t]
    /* 0x23 */ { name: 'global.get', params: 'u' },  // []→[t]
    /* 0x24 */ { name: 'global.set', params: 'u' },  // [t]→[]
    /* 0x25 */ { name: 'table.get', params: 'u' },   // [i32]→[t]
    /* 0x26 */ { name: 'table.set', params: 'u' },   // [i32 t]→[]
    /* 0x27 */ { name: '' },
    /* 0x28 */ { name: 'i32.load', params: 'uu', i: [i32], o: [i32] },
    /* 0x29 */ { name: 'i64.load', params: 'uu', i: [i32], o: [i64] },
    /* 0x2A */ { name: 'f32.load', params: 'uu', i: [i32], o: [f32] },
    /* 0x2B */ { name: 'f64.load', params: 'uu', i: [i32], o: [f64] },
    /* 0x2C */ { name: 'i32.load8_s', params: 'uu', i: [i32], o: [i32] },
    /* 0x2D */ { name: 'i32.load8_u', params: 'uu', i: [i32], o: [i32] },
    /* 0x2E */ { name: 'i32.load16_s', params: 'uu', i: [i32], o: [i32] },
    /* 0x2F */ { name: 'i32.load16_u', params: 'uu', i: [i32], o: [i32] },
    /* 0x30 */ { name: 'i64.load8_s', params: 'uu', i: [i32], o: [i64] },
    /* 0x31 */ { name: 'i64.load8_u', params: 'uu', i: [i32], o: [i64] },
    /* 0x32 */ { name: 'i64.load16_s', params: 'uu', i: [i32], o: [i64] },
    /* 0x33 */ { name: 'i64.load16_u', params: 'uu', i: [i32], o: [i64] },
    /* 0x34 */ { name: 'i64.load32_s', params: 'uu', i: [i32], o: [i64] },
    /* 0x35 */ { name: 'i64.load32_u', params: 'uu', i: [i32], o: [i64] },
    /* 0x36 */ { name: 'i32.store', params: 'uu', i: [i32, i32], o: [] },
    /* 0x37 */ { name: 'i64.store', params: 'uu', i: [i32, i64], o: [] },
    /* 0x38 */ { name: 'f32.store', params: 'uu', i: [i32, f32], o: [] },
    /* 0x39 */ { name: 'f64.store', params: 'uu', i: [i32, f64], o: [] },
    /* 0x3A */ { name: 'i32.store8', params: 'uu', i: [i32, i32], o: [] },
    /* 0x3B */ { name: 'i32.store16', params: 'uu', i: [i32, i32], o: [] },
    /* 0x3C */ { name: 'i64.store8', params: 'uu', i: [i32, i64], o: [] },
    /* 0x3D */ { name: 'i64.store16', params: 'uu', i: [i32, i64], o: [] },
    /* 0x3E */ { name: 'i64.store32', params: 'uu', i: [i32, i64], o: [] },
    /* 0x3F */ { name: 'memory.size', params: 'b', i: [], o: [i32] },
    /* 0x40 */ { name: 'memory.grow', params: 'b', i: [i32], o: [i32] },
    /* 0x41 */ { name: 'i32.const', params: 'i', i: [], o: [i32] },
    /* 0x42 */ { name: 'i64.const', params: 'l', i: [], o: [i64] },
    /* 0x43 */ { name: 'f32.const', params: 'f', i: [], o: [f32] },
    /* 0x44 */ { name: 'f64.const', params: 'd', i: [], o: [f64] },
    /* 0x45 */ { name: 'i32.eqz', i: [i32], o: [i32] },
    /* 0x46 */ { name: 'i32.eq', i: [i32, i32], o: [i32] },
    /* 0x47 */ { name: 'i32.ne', i: [i32, i32], o: [i32] },
    /* 0x48 */ { name: 'i32.lt_s', i: [i32, i32], o: [i32] },
    /* 0x49 */ { name: 'i32.lt_u', i: [i32, i32], o: [i32] },
    /* 0x4A */ { name: 'i32.gt_s', i: [i32, i32], o: [i32] },
    /* 0x4B */ { name: 'i32.gt_u', i: [i32, i32], o: [i32] },
    /* 0x4C */ { name: 'i32.le_s', i: [i32, i32], o: [i32] },
    /* 0x4D */ { name: 'i32.le_u', i: [i32, i32], o: [i32] },
    /* 0x4E */ { name: 'i32.ge_s', i: [i32, i32], o: [i32] },
    /* 0x4F */ { name: 'i32.ge_u', i: [i32, i32], o: [i32] },
    /* 0x50 */ { name: 'i64.eqz', i: [i64], o: [i32] },
    /* 0x51 */ { name: 'i64.eq', i: [i64, i64], o: [i32] },
    /* 0x52 */ { name: 'i64.ne', i: [i64, i64], o: [i32] },
    /* 0x53 */ { name: 'i64.lt_s', i: [i64, i64], o: [i32] },
    /* 0x54 */ { name: 'i64.lt_u', i: [i64, i64], o: [i32] },
    /* 0x55 */ { name: 'i64.gt_s', i: [i64, i64], o: [i32] },
    /* 0x56 */ { name: 'i64.gt_u', i: [i64, i64], o: [i32] },
    /* 0x57 */ { name: 'i64.le_s', i: [i64, i64], o: [i32] },
    /* 0x58 */ { name: 'i64.le_u', i: [i64, i64], o: [i32] },
    /* 0x59 */ { name: 'i64.ge_s', i: [i64, i64], o: [i32] },
    /* 0x5A */ { name: 'i64.ge_u', i: [i64, i64], o: [i32] },
    /* 0x5B */ { name: 'f32.eq', i: [f32, f32], o: [i32] },
    /* 0x5C */ { name: 'f32.ne', i: [f32, f32], o: [i32] },
    /* 0x5D */ { name: 'f32.lt', i: [f32, f32], o: [i32] },
    /* 0x5E */ { name: 'f32.gt', i: [f32, f32], o: [i32] },
    /* 0x5F */ { name: 'f32.le', i: [f32, f32], o: [i32] },
    /* 0x60 */ { name: 'f32.ge', i: [f32, f32], o: [i32] },
    /* 0x61 */ { name: 'f64.eq', i: [f64, f64], o: [i32] },
    /* 0x62 */ { name: 'f64.ne', i: [f64, f64], o: [i32] },
    /* 0x63 */ { name: 'f64.lt', i: [f64, f64], o: [i32] },
    /* 0x64 */ { name: 'f64.gt', i: [f64, f64], o: [i32] },
    /* 0x65 */ { name: 'f64.le', i: [f64, f64], o: [i32] },
    /* 0x66 */ { name: 'f64.ge', i: [f64, f64], o: [i32] },
    /* 0x67 */ { name: 'i32.clz', i: [i32], o: [i32] },
    /* 0x68 */ { name: 'i32.ctz', i: [i32], o: [i32] },
    /* 0x69 */ { name: 'i32.popcnt', i: [i32], o: [i32] },
    /* 0x6A */ { name: 'i32.add', i: [i32, i32], o: [i32] },
    /* 0x6B */ { name: 'i32.sub', i: [i32, i32], o: [i32] },
    /* 0x6C */ { name: 'i32.mul', i: [i32, i32], o: [i32] },
    /* 0x6D */ { name: 'i32.div_s', i: [i32, i32], o: [i32] },
    /* 0x6E */ { name: 'i32.div_u', i: [i32, i32], o: [i32] },
    /* 0x6F */ { name: 'i32.rem_s', i: [i32, i32], o: [i32] },
    /* 0x70 */ { name: 'i32.rem_u', i: [i32, i32], o: [i32] },
    /* 0x71 */ { name: 'i32.and', i: [i32, i32], o: [i32] },
    /* 0x72 */ { name: 'i32.or', i: [i32, i32], o: [i32] },
    /* 0x73 */ { name: 'i32.xor', i: [i32, i32], o: [i32] },
    /* 0x74 */ { name: 'i32.shl', i: [i32, i32], o: [i32] },
    /* 0x75 */ { name: 'i32.shr_s', i: [i32, i32], o: [i32] },
    /* 0x76 */ { name: 'i32.shr_u', i: [i32, i32], o: [i32] },
    /* 0x77 */ { name: 'i32.rotl', i: [i32, i32], o: [i32] },
    /* 0x78 */ { name: 'i32.rotr', i: [i32, i32], o: [i32] },
    /* 0x79 */ { name: 'i64.clz', i: [i64], o: [i64] },
    /* 0x7A */ { name: 'i64.ctz', i: [i64], o: [i64] },
    /* 0x7B */ { name: 'i64.popcnt', i: [i64], o: [i64] },
    /* 0x7C */ { name: 'i64.add', i: [i64, i64], o: [i64] },
    /* 0x7D */ { name: 'i64.sub', i: [i64, i64], o: [i64] },
    /* 0x7E */ { name: 'i64.mul', i: [i64, i64], o: [i64] },
    /* 0x7F */ { name: 'i64.div_s', i: [i64, i64], o: [i64] },
    /* 0x80 */ { name: 'i64.div_u', i: [i64, i64], o: [i64] },
    /* 0x81 */ { name: 'i64.rem_s', i: [i64, i64], o: [i64] },
    /* 0x82 */ { name: 'i64.rem_u', i: [i64, i64], o: [i64] },
    /* 0x83 */ { name: 'i64.and', i: [i64, i64], o: [i64] },
    /* 0x84 */ { name: 'i64.or', i: [i64, i64], o: [i64] },
    /* 0x85 */ { name: 'i64.xor', i: [i64, i64], o: [i64] },
    /* 0x86 */ { name: 'i64.shl', i: [i64, i64], o: [i64] },
    /* 0x87 */ { name: 'i64.shr_s', i: [i64, i64], o: [i64] },
    /* 0x88 */ { name: 'i64.shr_u', i: [i64, i64], o: [i64] },
    /* 0x89 */ { name: 'i64.rotl', i: [i64, i64], o: [i64] },
    /* 0x8A */ { name: 'i64.rotr', i: [i64, i64], o: [i64] },
    /* 0x8B */ { name: 'f32.abs', i: [f32], o: [f32] },
    /* 0x8C */ { name: 'f32.neg', i: [f32], o: [f32] },
    /* 0x8D */ { name: 'f32.ceil', i: [f32], o: [f32] },
    /* 0x8E */ { name: 'f32.floor', i: [f32], o: [f32] },
    /* 0x8F */ { name: 'f32.trunc', i: [f32], o: [f32] },
    /* 0x90 */ { name: 'f32.nearest', i: [f32], o: [f32] },
    /* 0x91 */ { name: 'f32.sqrt', i: [f32], o: [f32] },
    /* 0x92 */ { name: 'f32.add', i: [f32, f32], o: [f32] },
    /* 0x93 */ { name: 'f32.sub', i: [f32, f32], o: [f32] },
    /* 0x94 */ { name: 'f32.mul', i: [f32, f32], o: [f32] },
    /* 0x95 */ { name: 'f32.div', i: [f32, f32], o: [f32] },
    /* 0x96 */ { name: 'f32.min', i: [f32, f32], o: [f32] },
    /* 0x97 */ { name: 'f32.max', i: [f32, f32], o: [f32] },
    /* 0x98 */ { name: 'f32.copysign', i: [f32, f32], o: [f32] },
    /* 0x99 */ { name: 'f64.abs', i: [f64], o: [f64] },
    /* 0x9A */ { name: 'f64.neg', i: [f64], o: [f64] },
    /* 0x9B */ { name: 'f64.ceil', i: [f64], o: [f64] },
    /* 0x9C */ { name: 'f64.floor', i: [f64], o: [f64] },
    /* 0x9D */ { name: 'f64.trunc', i: [f64], o: [f64] },
    /* 0x9E */ { name: 'f64.nearest', i: [f64], o: [f64] },
    /* 0x9F */ { name: 'f64.sqrt', i: [f64], o: [f64] },
    /* 0xA0 */ { name: 'f64.add', i: [f64, f64], o: [f64] },
    /* 0xA1 */ { name: 'f64.sub', i: [f64, f64], o: [f64] },
    /* 0xA2 */ { name: 'f64.mul', i: [f64, f64], o: [f64] },
    /* 0xA3 */ { name: 'f64.div', i: [f64, f64], o: [f64] },
    /* 0xA4 */ { name: 'f64.min', i: [f64, f64], o: [f64] },
    /* 0xA5 */ { name: 'f64.max', i: [f64, f64], o: [f64] },
    /* 0xA6 */ { name: 'f64.copysign', i: [f64, f64], o: [f64] },
    /* 0xA7 */ { name: 'i32.wrap_i64', i: [i64], o: [i32] },
    /* 0xA8 */ { name: 'i32.trunc_f32_s', i: [f32], o: [i32] },
    /* 0xA9 */ { name: 'i32.trunc_f32_u', i: [f32], o: [i32] },
    /* 0xAA */ { name: 'i32.trunc_f64_s', i: [f64], o: [i32] },
    /* 0xAB */ { name: 'i32.trunc_f64_u', i: [f64], o: [i32] },
    /* 0xAC */ { name: 'i64.extend_i32_s', i: [i32], o: [i64] },
    /* 0xAD */ { name: 'i64.extend_i32_u', i: [i32], o: [i64] },
    /* 0xAE */ { name: 'i64.trunc_f32_s', i: [f32], o: [i64] },
    /* 0xAF */ { name: 'i64.trunc_f32_u', i: [f32], o: [i64] },
    /* 0xB0 */ { name: 'i64.trunc_f64_s', i: [f64], o: [i64] },
    /* 0xB1 */ { name: 'i64.trunc_f64_u', i: [f64], o: [i64] },
    /* 0xB2 */ { name: 'f32.convert_i32_s', i: [i32], o: [f32] },
    /* 0xB3 */ { name: 'f32.convert_i32_u', i: [i32], o: [f32] },
    /* 0xB4 */ { name: 'f32.convert_i64_s', i: [i64], o: [f32] },
    /* 0xB5 */ { name: 'f32.convert_i64_u', i: [i64], o: [f32] },
    /* 0xB6 */ { name: 'f32.demote_f64', i: [f64], o: [f32] },
    /* 0xB7 */ { name: 'f64.convert_i32_s', i: [i32], o: [f64] },
    /* 0xB8 */ { name: 'f64.convert_i32_u', i: [i32], o: [f64] },
    /* 0xB9 */ { name: 'f64.convert_i64_s', i: [i64], o: [f64] },
    /* 0xBA */ { name: 'f64.convert_i64_u', i: [i64], o: [f64] },
    /* 0xBB */ { name: 'f64.promote_f32', i: [f32], o: [f64] },
    /* 0xBC */ { name: 'i32.reinterpret_f32', i: [f32], o: [i32] },
    /* 0xBD */ { name: 'i64.reinterpret_f64', i: [f64], o: [i64] },
    /* 0xBE */ { name: 'f32.reinterpret_i32', i: [i32], o: [f32] },
    /* 0xBF */ { name: 'f64.reinterpret_i64', i: [i64], o: [f64] },
    /* 0xC0 */ { name: 'i32.extend8_s', i: [i32], o: [i32] },
    /* 0xC1 */ { name: 'i32.extend16_s', i: [i32], o: [i32] },
    /* 0xC2 */ { name: 'i64.extend8_s', i: [i64], o: [i64] },
    /* 0xC3 */ { name: 'i64.extend16_s', i: [i64], o: [i64] },
    /* 0xC4 */ { name: 'i64.extend32_s', i: [i64], o: [i64] },
    /* 0xC5 */ { name: '' },
    /* 0xC6 */ { name: '' },
    /* 0xC7 */ { name: '' },
    /* 0xC8 */ { name: '' },
    /* 0xC9 */ { name: '' },
    /* 0xCA */ { name: '' },
    /* 0xCB */ { name: '' },
    /* 0xCC */ { name: '' },
    /* 0xCD */ { name: '' },
    /* 0xCE */ { name: '' },
    /* 0xCF */ { name: '' },
    /* 0xD0 */ { name: 'ref.null', params: 'b' },    // []→[t]
    /* 0xD1 */ { name: 'ref.is_null' },              // [t]→[i32]
    /* 0xD2 */ { name: 'ref.func', params: 'u' },    // []→[funcref]
    /* 0xD3 */ { name: '' },
    /* 0xD4 */ { name: '' },
    /* 0xD5 */ { name: '' },
    /* 0xD6 */ { name: '' },
    /* 0xD7 */ { name: '' },
    /* 0xD8 */ { name: '' },
    /* 0xD9 */ { name: '' },
    /* 0xDA */ { name: '' },
    /* 0xDB */ { name: '' },
    /* 0xDC */ { name: '' },
    /* 0xDD */ { name: '' },
    /* 0xDE */ { name: '' },
    /* 0xDF */ { name: '' },
    /* 0xE0 */ { name: '' },
    /* 0xE1 */ { name: '' },
    /* 0xE2 */ { name: '' },
    /* 0xE3 */ { name: '' },
    /* 0xE4 */ { name: '' },
    /* 0xE5 */ { name: '' },
    /* 0xE6 */ { name: '' },
    /* 0xE7 */ { name: '' },
    /* 0xE8 */ { name: '' },
    /* 0xE9 */ { name: '' },
    /* 0xEA */ { name: '' },
    /* 0xEB */ { name: '' },
    /* 0xEC */ { name: '' },
    /* 0xED */ { name: '' },
    /* 0xEE */ { name: '' },
    /* 0xEF */ { name: '' },
    /* 0xF0 */ { name: '' },
    /* 0xF1 */ { name: '' },
    /* 0xF2 */ { name: '' },
    /* 0xF3 */ { name: '' },
    /* 0xF4 */ { name: '' },
    /* 0xF5 */ { name: '' },
    /* 0xF6 */ { name: '' },
    /* 0xF7 */ { name: '' },
    /* 0xF8 */ { name: '' },
    /* 0xF9 */ { name: '' },
    /* 0xFA */ { name: '' },
    /* 0xFB */ { name: '' },
    /* 0xFC */ { name: '' }, // extendedInstructions
    /* 0xFD */ { name: '' },
    /* 0xFE */ { name: '' },
    /* 0xFF */ { name: '' },
];

exports.extendedInstructions = [
    /* 0xFC 0x00 */ { name: 'i32.trunc_sat_f32_s', i: [f32], o: [i32] },
    /* 0xFC 0x01 */ { name: 'i32.trunc_sat_f32_u', i: [f32], o: [i32] },
    /* 0xFC 0x02 */ { name: 'i32.trunc_sat_f64_s', i: [f64], o: [i32] },
    /* 0xFC 0x03 */ { name: 'i32.trunc_sat_f64_u', i: [f64], o: [i32] },
    /* 0xFC 0x04 */ { name: 'i64.trunc_sat_f32_s', i: [f32], o: [i64] },
    /* 0xFC 0x05 */ { name: 'i64.trunc_sat_f32_u', i: [f32], o: [i64] },
    /* 0xFC 0x06 */ { name: 'i64.trunc_sat_f64_s', i: [f64], o: [i64] },
    /* 0xFC 0x07 */ { name: 'i64.trunc_sat_f64_u', i: [f64], o: [i64] },
    /* 0xFC 0x08 */ { name: 'memory.init', params: 'u', i: [i32, i32, i32], o: [] },
    /* 0xFC 0x09 */ { name: 'data.drop', params: 'u', i: [], o: [] },
    /* 0xFC 0x0A */ { name: 'memory.copy', params: 'bb', i: [i32, i32, i32], o: [] },
    /* 0xFC 0x0B */ { name: 'memory.fill', params: 'b', i: [i32, i32, i32], o: [] },
    /* 0xFC 0x0C */ { name: 'table.init', params: 'uu', i: [i32, i32, i32], o: [] },
    /* 0xFC 0x0D */ { name: 'elem.drop', params: 'u', i: [], o: [] },
    /* 0xFC 0x0E */ { name: 'table.copy', params: 'uu', i: [i32, i32, i32], o: [] },
    /* 0xFC 0x0F */ { name: 'table.grow', params: 'u' },  // [t i32]→[]
    /* 0xFC 0x10 */ { name: 'table.size', params: 'u', i: [], o: [i32] },
    /* 0xFC 0x11 */ { name: 'table.fill', params: 'u' },  // [i32 t i32]→[]
];
