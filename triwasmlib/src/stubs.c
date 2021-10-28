
#include "common.h"

typedef uint32_t u32;
typedef uint64_t u64;
typedef int32_t s32;
typedef int64_t s64;


//EXPORT(f32_add)             u32 trivm_f32_add(u32 a, u32 b) { return 0; }
//EXPORT(f32_ceil)            u32 trivm_f32_ceil(u32 a) { return 0; }
//EXPORT(f32_convert_i32_s)   u32 trivm_f32_convert_i32_s(s32 a) { return 0; }
//EXPORT(f32_convert_i32_u)   u32 trivm_f32_convert_i32_u(u32 a) { return 0; }
//EXPORT(f32_convert_i64_s)   u32 trivm_f32_convert_i64_s(s64 a) { return 0; }
//EXPORT(f32_convert_i64_u)   u32 trivm_f32_convert_i64_u(u64 a) { return 0; }
EXPORT(f32_copysign)        u32 trivm_f32_copysign(u32 a) { return 0; }
//EXPORT(f32_demote_f64)      u32 trivm_f32_demote_f64(u64 a) { return 0; }
//EXPORT(f32_div)             u32 trivm_f32_div(u32 a, u32 b) { return 0; }
//EXPORT(f32_eq)              u32 trivm_f32_eq(u32 a, u32 b) { return 0; }
//EXPORT(f32_floor)           u32 trivm_f32_floor(u32 a) { return 0; }
EXPORT(f32_ge)              u32 trivm_f32_ge(u32 a, u32 b) { return 0; }
EXPORT(f32_gt)              u32 trivm_f32_gt(u32 a, u32 b) { return 0; }
//EXPORT(f32_le)              u32 trivm_f32_le(u32 a, u32 b) { return 0; }
//EXPORT(f32_lt)              u32 trivm_f32_lt(u32 a, u32 b) { return 0; }
EXPORT(f32_max)             u32 trivm_f32_max(u32 a, u32 b) { return 0; }
EXPORT(f32_min)             u32 trivm_f32_min(u32 a, u32 b) { return 0; }
//EXPORT(f32_mul)             u32 trivm_f32_mul(u32 a, u32 b) { return 0; }
EXPORT(f32_ne)              u32 trivm_f32_ne(u32 a, u32 b) { return 0; }
//EXPORT(f32_nearest)         u32 trivm_f32_nearest(u32 a) { return 0; }
EXPORT(f32_sqrt)            u32 trivm_f32_sqrt(u32 a) { return 0; }
//EXPORT(f32_sub)             u32 trivm_f32_sub(u32 a, u32 b) { return 0; }
//EXPORT(f32_trunc)           u32 trivm_f32_trunc(u32 a) { return 0; }
EXPORT(f64_abs)             u64 trivm_f64_abs(u64 a) { return 0; }
//EXPORT(f64_add)             u64 trivm_f64_add(u64 a, u64 b) { return 0; }
//EXPORT(f64_ceil)            u64 trivm_f64_ceil(u64 a) { return 0; }
//EXPORT(f64_convert_i32_s)   u64 trivm_f64_convert_i32_s(s32 a) { return 0; }
//EXPORT(f64_convert_i32_u)   u64 trivm_f64_convert_i32_u(u32 a) { return 0; }
//EXPORT(f64_convert_i64_s)   u64 trivm_f64_convert_i64_s(s64 a) { return 0; }
//EXPORT(f64_convert_i64_u)   u64 trivm_f64_convert_i64_u(u64 a) { return 0; }
EXPORT(f64_copysign)        u64 trivm_f64_copysign(u64 a) { return 0; }
//EXPORT(f64_div)             u64 trivm_f64_div(u64 a, u64 b) { return 0; }
//EXPORT(f64_eq)              u64 trivm_f64_eq(u64 a, u64 b) { return 0; }
//EXPORT(f64_floor)           u64 trivm_f64_floor(u64 a) { return 0; }
EXPORT(f64_ge)              u32 trivm_f64_ge(u64 a, u64 b) { return 0; }
EXPORT(f64_gt)              u32 trivm_f64_gt(u64 a, u64 b) { return 0; }
//EXPORT(f64_le)              u64 trivm_f64_le(u64 a, u64 b) { return 0; }
//EXPORT(f64_lt)              u64 trivm_f64_lt(u64 a, u64 b) { return 0; }
EXPORT(f64_max)             u64 trivm_f64_max(u64 a, u64 b) { return 0; }
EXPORT(f64_min)             u64 trivm_f64_min(u64 a, u64 b) { return 0; }
//EXPORT(f64_mul)             u64 trivm_f64_mul(u64 a, u64 b) { return 0; }
EXPORT(f64_ne)              u32 trivm_f64_ne(u64 a, u64 b) { return 0; }
//EXPORT(f64_nearest)         u64 trivm_f64_nearest(u64 a) { return 0; }
EXPORT(f64_neg)             u64 trivm_f64_neg(u64 a) { return 0; }
//EXPORT(f64_promote_f32)     u64 trivm_f64_promote_f32(u32 a) { return 0; }
EXPORT(f64_sqrt)            u64 trivm_f64_sqrt(u64 a, u64 b) { return 0; }
//EXPORT(f64_sub)             u64 trivm_f64_sub(u64 a, u64 b) { return 0; }
//EXPORT(f64_trunc)           u64 trivm_f64_trunc(u64 a) { return 0; }
EXPORT(i32_clz)             u32 trivm_i32_clz(u32 a) { return 0; }
EXPORT(i32_ctz)             u32 trivm_i32_ctz(u32 a) { return 0; }
EXPORT(i32_popcnt)          u32 trivm_i32_popcnt(u32 a) { return 0; }
EXPORT(i32_rotl)            u32 trivm_i32_rotl(u32 a) { return 0; }
EXPORT(i32_rotr)            u32 trivm_i32_rotr(u32 a) { return 0; }
EXPORT(i32_trunc_f32_s)     s32 trivm_i32_trunc_f32_s(u32 a) { return 0; }
EXPORT(i32_trunc_f32_u)     u32 trivm_i32_trunc_f32_u(u32 a) { return 0; }
EXPORT(i32_trunc_f64_s)     s32 trivm_i32_trunc_f64_s(u64 a) { return 0; }
EXPORT(i32_trunc_f64_u)     u32 trivm_i32_trunc_f64_u(u64 a) { return 0; }
EXPORT(i32_trunc_sat_f32_s) s32 trivm_i32_trunc_sat_f32_s(u32 a) { return 0; }
EXPORT(i32_trunc_sat_f32_u) u32 trivm_i32_trunc_sat_f32_u(u32 a) { return 0; }
EXPORT(i32_trunc_sat_f64_s) s32 trivm_i32_trunc_sat_f64_s(u64 a) { return 0; }
EXPORT(i32_trunc_sat_f64_u) u32 trivm_i32_trunc_sat_f64_u(u64 a) { return 0; }
EXPORT(i64_add)             u64 trivm_i64_add(u64 a, u64 b) { return 0; }
EXPORT(i64_and)             u64 trivm_i64_and(u64 a, u64 b) { return 0; }
EXPORT(i64_clz)             u64 trivm_i64_clz(u64 a) { return 0; }
EXPORT(i64_ctz)             u64 trivm_i64_ctz(u64 a) { return 0; }
EXPORT(i64_div_s)           u64 trivm_i64_div_s(u64 a, u64 b) { return 0; }
EXPORT(i64_div_u)           u64 trivm_i64_div_u(u64 a, u64 b) { return 0; }
EXPORT(i64_eq)              u32 trivm_i64_eq(u64 a, u64 b) { return 0; }
EXPORT(i64_eqz)             u32 trivm_i64_eqz(u64 a) { return 0; }
EXPORT(i64_extend_i32_s)    u64 trivm_i64_extend_i32_s(s32 a) { return 0; }
EXPORT(i64_extend_i32_u)    u64 trivm_i64_extend_i32_u(u32 a) { return 0; }
EXPORT(i64_extend16_s)      u64 trivm_i64_extend16_s(s64 a) { return 0; }
EXPORT(i64_extend32_s)      u64 trivm_i64_extend32_s(s64 a) { return 0; }
EXPORT(i64_extend8_s)       u64 trivm_i64_extend8_s(s64 a) { return 0; }
EXPORT(i64_gt_s)            u32 trivm_i64_gt_s(u64 a, u64 b) { return 0; }
EXPORT(i64_gt_u)            u32 trivm_i64_gt_u(u64 a, u64 b) { return 0; }
EXPORT(i64_load)            u64 trivm_i64_load(u32 a, u32 offset) { return 0; }
EXPORT(i64_load_0)          u64 trivm_i64_load_0(u32 a) { return 0; }
EXPORT(i64_lt_s)            u32 trivm_i64_lt_s(u64 a, u64 b) { return 0; }
EXPORT(i64_lt_u)            u32 trivm_i64_lt_u(u64 a, u64 b) { return 0; }
EXPORT(i64_mul)             u64 trivm_i64_mul(u64 a, u64 b) { return 0; }
EXPORT(i64_or)              u64 trivm_i64_or(u64 a, u64 b) { return 0; }
EXPORT(i64_popcnt)          u64 trivm_i64_popcnt(u64 a) { return 0; }
EXPORT(i64_rem_s)           u64 trivm_i64_rem_s(u64 a, u64 b) { return 0; }
EXPORT(i64_rem_u)           u64 trivm_i64_rem_u(u64 a, u64 b) { return 0; }
EXPORT(i64_rotl)            u64 trivm_i64_rotl(u64 a) { return 0; }
EXPORT(i64_rotr)            u64 trivm_i64_rotr(u64 a) { return 0; }
EXPORT(i64_shl)             u64 trivm_i64_shl(u64 a, u64 b) { return 0; }
EXPORT(i64_shr_s)           u64 trivm_i64_shr_s(u64 a, u64 b) { return 0; }
EXPORT(i64_shr_u)           u64 trivm_i64_shr_u(u64 a, u64 b) { return 0; }
EXPORT(i64_store)           void trivm_i64_store(u32 a, u64 v, u32 offset) { }
EXPORT(i64_store_0)         void trivm_i64_store_0(u32 a, u64 v) { }
EXPORT(i64_sub)             u64 trivm_i64_sub(u64 a, u64 b) { return 0; }
EXPORT(i64_trunc_f32_s)     s64 trivm_i64_trunc_f32_s(u32 a) { return 0; }
EXPORT(i64_trunc_f32_u)     u64 trivm_i64_trunc_f32_u(u32 a) { return 0; }
EXPORT(i64_trunc_f64_s)     s64 trivm_i64_trunc_f64_s(u64 a) { return 0; }
EXPORT(i64_trunc_f64_u)     u64 trivm_i64_trunc_f64_u(u64 a) { return 0; }
EXPORT(i64_trunc_sat_f32_s) s64 trivm_i64_trunc_sat_f32_s(u32 a) { return 0; }
EXPORT(i64_trunc_sat_f32_u) u64 trivm_i64_trunc_sat_f32_u(u32 a) { return 0; }
EXPORT(i64_trunc_sat_f64_s) s64 trivm_i64_trunc_sat_f64_s(u64 a) { return 0; }
EXPORT(i64_trunc_sat_f64_u) u64 trivm_i64_trunc_sat_f64_u(u64 a) { return 0; }
EXPORT(i64_xor)             u64 trivm_i64_xor(u64 a, u64 b) { return 0; }
EXPORT(memory_copy)         void trivm_memory_copy(u32 a, u32 b, u32 c) { }
EXPORT(memory_fill)         void trivm_memory_fill(u32 a, u32 b, u32 c) { }
EXPORT(memory_grow)         u32 trivm_memory_grow(u32 a) { return 0; }
EXPORT(memory_size)         u32 trivm_memory_size() { return 0; }
EXPORT(unreachable)         void trivm_unreachable() { }

TRIVM_EXPORT_ASSEMBLY(
    unwind_shorts,
    ".begin\n"
    "__triwasmlib_unwind_ret16:\n"
    "READ TMP0\n" // TODO: if (in caller) read of return address and push of unwind parameter
    "READ TMP1\n" // are switched then caller can call __triwasmlib_unwind8 directly
    "WRITE TMP0\n"
    "WRITE TMP1\n"
    ".ref __triwasmlib_unwind16\n"
    ".end\n"
    ".begin\n"
    "__triwasmlib_unwind16:\n"
    "READ [SP] + 4\n"
    "AND 0xFFFF\n"
    "WRITE [SP] + 4\n"
    "BR __triwasmlib_unwind32\n"
    ".end\n"
    ".begin\n"
    "__triwasmlib_unwind_ret8:\n"
    "READ TMP0\n" // TODO: if (in caller) read of return address and push of unwind parameter
    "READ TMP1\n" // are switched then caller can call __triwasmlib_unwind8 directly
    "WRITE TMP0\n"
    "WRITE TMP1\n"
    ".ref __triwasmlib_unwind8\n"
    ".end\n"
    ".begin\n"
    "__triwasmlib_unwind8:\n"
    "READ [SP] + 4\n"
    "AND 0xFF\n"
    "WRITE [SP] + 4\n"
    ".ref __triwasmlib_unwind32\n"
    ".end\n"
    ".begin\n"
    "__triwasmlib_unwind32:\n"
    "DUP\n"
    "READ [SP] + 8\n"
    "DUP\n"
    "AND 0xF\n"
    "WRITE [SP] + 8\n"
    "USHR 4\n"
    "WRITE [SP] + 8\n"
    ".ref __triwasmlib_unwind\n"
    ".end\n"
    ".begin\n"
    "__triwasmlib_unwind:\n"
    ".end\n"
    "",
    void, ()
);

TRIVM_EXPORT_ASSEMBLY(
    select_1,
    "WRITE TMP0\n" 
    "BRT __triwasmlib_select_1_true\n"
    "DUP\n"
    "WRITE [SP] + 4\n"
    "__triwasmlib_select_1_true:\n"
    "POP\n"
    "READ TMP0\n"
    "RETURN\n",
    u32, (u32 a, u32 b, u32 cond));

TRIVM_EXPORT_ASSEMBLY(
    select_2,
    "WRITE TMP0\n"
    "BRT __triwasmlib_select_2_true\n"
    "WRITE [SP] + 4\n"
    "WRITE [SP] + 4\n"
    "BR __triwasmlib_select_2_end\n"
    "__triwasmlib_select_2_true:\n"
    "POP\n"
    "POP\n"
    "__triwasmlib_select_2_end:\n"
    "READ TMP0\n"
    "RETURN\n",
    u64, (u64 a, u64 b, u32 cond));

/*IMPORT(a, b) void func(u32 y, u32 x);
EXPORT(tttttttttttttttttttttt) void tttttttttt(char *ptr, u64 val) {
    *ptr = 12;
    func(1, 2);
    ptr[1] = __builtin_popcountll(val);
}
//build/tools/wasi-sdk/bin/clang --sysroot build/tools/wasi-sdk/share/wasi-sysroot -Wl,--no-entry -nostartfiles -Wl,--import-memory -flto -Oz -g0 src/stubs.c -o a.wasm
*/
