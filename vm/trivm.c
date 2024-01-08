
#include <stdint.h>
#include <string.h>
#include <stdbool.h>
#include <stddef.h>
#include <math.h>

#include "trivm.h"


/* =========================================== Config defaults and fixups =========================================== */

#ifndef TRIVM_EXT_UNWIND
#define TRIVM_EXT_UNWIND                        0
#endif
#ifndef TRIVM_EXT_MEM64
#define TRIVM_EXT_MEM64                         0
#endif
#ifndef TRIVM_EXT_INT64
#define TRIVM_EXT_INT64                         0
#endif
#ifndef TRIVM_EXT_FLOAT32
#define TRIVM_EXT_FLOAT32                       0
#endif
#ifndef TRIVM_EXT_FLOAT64
#define TRIVM_EXT_FLOAT64                       0
#endif
#ifndef TRIVM_STDLIB
#define TRIVM_STDLIB                     1
#endif
#ifndef TRIVM_TRUNC32_UNDEFINED
#define TRIVM_TRUNC32_UNDEFINED          0
#endif
#ifndef TRIVM_TRUNC64_UNDEFINED
#define TRIVM_TRUNC64_UNDEFINED          0
#endif
#ifndef TRIVM_TRUNC32_SATURATED
#define TRIVM_TRUNC32_SATURATED          0
#endif
#ifndef TRIVM_TRUNC64_SATURATED
#define TRIVM_TRUNC64_SATURATED          0
#endif
#ifndef TRIVM_ALL_FAULTS
#define TRIVM_ALL_FAULTS                 0
#endif
#ifndef TRIVM_FAULT_STACK_OVERFLOW
#define TRIVM_FAULT_STACK_OVERFLOW       0
#endif
#ifndef TRIVM_FAULT_STACK_UNDERFLOW
#define TRIVM_FAULT_STACK_UNDERFLOW      0
#endif
#ifndef TRIVM_FAULT_INSTR_OUT_OF_BOUNDS
#define TRIVM_FAULT_INSTR_OUT_OF_BOUNDS  0
#endif
#ifndef TRIVM_FAULT_INSTR_INVALID
#define TRIVM_FAULT_INSTR_INVALID        0
#endif
#ifndef TRIVM_FAULT_ACCESS_OUT_OF_BOUNDS
#define TRIVM_FAULT_ACCESS_OUT_OF_BOUNDS 0
#endif
#ifndef TRIVM_FAULT_READ_ONLY
#define TRIVM_FAULT_READ_ONLY            0
#endif
#ifndef TRIVM_FAULT_DIVISION_BY_ZERO
#define TRIVM_FAULT_DIVISION_BY_ZERO     0
#endif
#ifndef TRIVM_FAULT_DIVISION_OVERFLOW
#define TRIVM_FAULT_DIVISION_OVERFLOW     0
#endif
#ifndef TRIVM_FAULT_GUEST_STACK_OVERFLOW
#define TRIVM_FAULT_GUEST_STACK_OVERFLOW   0
#endif
#ifndef TRIVM_FAULT_GUEST_STACK_UNDERFLOW
#define TRIVM_FAULT_GUEST_STACK_UNDERFLOW  0
#endif
#ifndef TRIVM_FAULT_TRUNC_INVALID
#define TRIVM_FAULT_TRUNC_INVALID  0
#endif

#if TRIVM_ALL_FAULTS
#undef TRIVM_FAULT_INSTR_OUT_OF_BOUNDS
#undef TRIVM_FAULT_INSTR_INVALID
#undef TRIVM_FAULT_ACCESS_OUT_OF_BOUNDS
#undef TRIVM_FAULT_READ_ONLY
#undef TRIVM_FAULT_DIVISION_BY_ZERO
#undef TRIVM_FAULT_DIVISION_OVERFLOW
#undef TRIVM_FAULT_STACK_OVERFLOW
#undef TRIVM_FAULT_STACK_UNDERFLOW
#undef TRIVM_FAULT_GUEST_STACK_OVERFLOW
#undef TRIVM_FAULT_GUEST_STACK_UNDERFLOW
#undef TRIVM_FAULT_TRUNC_INVALID
#define TRIVM_FAULT_INSTR_OUT_OF_BOUNDS  1
#define TRIVM_FAULT_INSTR_INVALID        1
#define TRIVM_FAULT_ACCESS_OUT_OF_BOUNDS 1
#define TRIVM_FAULT_READ_ONLY            1
#define TRIVM_FAULT_DIVISION_BY_ZERO     1
#define TRIVM_FAULT_DIVISION_OVERFLOW     1
#define TRIVM_FAULT_STACK_OVERFLOW       1
#define TRIVM_FAULT_STACK_UNDERFLOW      1
#define TRIVM_FAULT_GUEST_STACK_OVERFLOW   1
#define TRIVM_FAULT_GUEST_STACK_UNDERFLOW  1
#define TRIVM_FAULT_TRUNC_INVALID        1
#endif


/* ============================================ Include operations tree ============================================= */

#include "trivm_op_tree.h"


/* ================================================== Fault types =================================================== */

#define TRIVM_FAULT_NUMBER_STACK_OVERFLOW         0
#define TRIVM_FAULT_NUMBER_STACK_UNDERFLOW        1
#define TRIVM_FAULT_NUMBER_GUEST_STACK_OVERFLOW   2
#define TRIVM_FAULT_NUMBER_GUEST_STACK_UNDERFLOW  3
#define TRIVM_FAULT_NUMBER_INSTR_OUT_OF_BOUNDS    4
#define TRIVM_FAULT_NUMBER_INSTR_INVALID          5
#define TRIVM_FAULT_NUMBER_ACCESS_OUT_OF_BOUNDS   6
#define TRIVM_FAULT_NUMBER_READ_ONLY              7
#define TRIVM_FAULT_NUMBER_DIVISION_BY_ZERO       8
#define TRIVM_FAULT_NUMBER_DIVISION_OVERFLOW      9
#define TRIVM_FAULT_NUMBER_TRUNC_INVALID         10


/* =============================================== Build-time checks ================================================ */

#if (TRIVM_TREE_CORE_LAST_TWO_ARGS >= TRIVM_TREE_ADV32_FIRST_ONE_ARG) || \
    (TRIVM_TREE_ADV32_LAST_TWO_ARGS >= TRIVM_TREE_CORE_FIRST_ONE_ARG)
#error TREE_CORE and TREE_ADV32 shares the same op code limit where 1-arg instr starts, so they have to be aligned.
#endif

// TODO: more build-time checks


/* ================================================ Utility defines ================================================= */

#define WORD_SIZE 4
#define TOTAL_REGISTERS 11

#define STARTUP_ENTRY_OFFSET (TRIVM_ENABLE_ROM ? 0 : (WORD_SIZE * TOTAL_REGISTERS))
#define FAULT_ENTRY_OFFSET (3 + STARTUP_ENTRY_OFFSET)

#define TWO_BYTE_INSTR_ENABLED (TRIVM_EXT_INT64 || TRIVM_EXT_FLOAT32 || TRIVM_EXT_FLOAT64)
#define EXT32_TREE_ENABLED TRIVM_EXT_FLOAT32
#define EXT64_TREE_ENABLED (TRIVM_EXT_INT64 || TRIVM_EXT_FLOAT64)

#if defined(__GNUC__)
/* In some cases, more size-optimal code is generated when a function is not inlined. */
#define NO_INLINE __attribute__((noinline))
#else
#define NO_INLINE
#endif


/* ========================================== Instruction encoding defines ========================================== */

#define CODE_MAX_SIZE 10               /* Maximum instruction size in bytes  */

#define CODE_INSTR (1 << 7)            /* Flag indivating ordinary (not memory access ) instruction */

#define CODE_INSTR_ARG_MASK 3          /* Mask with instruction argument type */
#define CODE_INSTR_OP_MASK 0x7C        /* Mask with instruction op-code */

#define CODE_INSTR_OP_MASK_ADV 0x78    /* Mask that indicates advanced (TODO: rename) instruction */

#define CODE_INSTR_ARG_4B 0
#define CODE_INSTR_ARG_2B 1
#define CODE_INSTR_ARG_1B 2
#define CODE_INSTR_ARG_POP 3

#define CODE_LONG_RES 0x0004
#define CODE_LONG_ARG0 0x8000
#define CODE_LONG_ARG1 0x4000


/* ================================================ Fault triggering ================================================ */

#define TRIGGER_FAULT(type, ...) do \
	{ \
		if (TRIVM_FAULT_##type) \
		{ \
			/*> FAULT: " #type ", code={code}, addr={vm->pc}# */ \
			trigger_fault(vm, (TRIVM_FAULT_NUMBER_##type)); \
			__VA_ARGS__; \
		} else { \
			/*> IGNORED FAULT: " #type ", code={code}, addr={vm->pc}# */ \
		} \
	} while (0)

#define TRIGGER_FAULT_WITH_CODE(type, code, ...) do \
	{ \
		if (TRIVM_FAULT_##type) \
		{ \
			/*> FAULT: " #type ", code={code}, addr={vm->pc}# */ \
			trigger_fault_with_code(vm, (TRIVM_FAULT_NUMBER_##type), (code)); \
			__VA_ARGS__; \
		} else { \
			/*> IGNORED FAULT: " #type ", code={code}, addr={vm->pc}# */ \
		} \
	} while (0)

static void trigger_fault(struct trivm_instance *vm, uint32_t type)
{
	vm->gpr0 = type;
	vm->gpr2 = vm->pc;
	vm->pc = FAULT_ENTRY_OFFSET;
}

static void trigger_fault_with_code(struct trivm_instance *vm, uint32_t type, uint32_t code)
{
	vm->gpr1 = code;
	trigger_fault(vm, type);
}


/* ============================================= Core utility functions ============================================= */

NO_INLINE
static uint32_t read_prog(struct trivm_instance *vm)
{
	uint32_t result = 0;
#if TRIVM_ENABLE_ROM
	if (vm->pc < vm->rom_size)
	{
		result = vm->rom[vm->pc];
	}
#else
	if (vm->pc < vm->ram_size)
	{
		result = vm->ram[vm->pc];
	}
#endif
	vm->pc++;
	return result;
}

NO_INLINE
static uint32_t mem_pop(struct trivm_instance *vm)
{
	uint32_t result = 0;
	if (vm->sp > 0) // TODO: Those checks are invalid - fix them!
	{
		result = *(uint32_t*)(&vm->ram[vm->sp]);
	}
	vm->sp -= sizeof(uint32_t);
	/*>     POP @{vm->sp} => {{result}} */
	return result;
}

NO_INLINE
static void mem_push(struct trivm_instance *vm, uint32_t value)
{
	vm->sp += sizeof(uint32_t);
	if (vm->sp < vm->ram_size)
	{
		*(uint32_t*)(&vm->ram[vm->sp]) = value;
	}
	/*>     PUSH @{vm->sp} <= {{value}} */
}


/* =============================================== FLOAT32 extension ================================================ */

static inline uint32_t TO_U32(float x) {
	union {
		float f;
		uint32_t i;
	} c;
	c.f = x;
	return c.i;
}

static inline float TO_F32(uint32_t x) {
	union {
		float f;
		uint32_t i;
	} c;
	c.i = x;
	return c.f;
}


/* ========================================== INT64 and FLOAT64 extensions ========================================== */

static inline uint64_t TO_U64(double x) {
	union {
		double f;
		uint64_t i;
	} c;
	c.f = x;
	return c.i;
}

static inline double TO_F64(uint64_t x) {
	union {
		double f;
		uint64_t i;
	} c;
	c.i = x;
	return c.f;
}

static uint64_t check_div64_0(struct trivm_instance *vm, uint64_t arg0, uint64_t arg1)
{
	if (arg1 == 0)
	{
		TRIGGER_FAULT(DIVISION_BY_ZERO);
		return 1;
	}
	return arg1;
}

static uint64_t check_sdiv64(struct trivm_instance *vm, uint64_t arg0, uint64_t arg1)
{
	if (arg0 == ((uint64_t)1 << 63) && arg1 == (uint64_t)(-1))
	{
		TRIGGER_FAULT(DIVISION_OVERFLOW);
		return 1;
	}
	return arg1;
}

static inline uint32_t trunc_f32_to_s32(struct trivm_instance *vm, uint32_t x) {
    uint32_t x_rot = ((x << 1) | (x >> 31)) ^ 1;
    if (x_rot <= 0x9E000000 || !TRIVM_FAULT_TRUNC_INVALID) {
        return (int32_t)TO_F32(x);
    } else {
        TRIGGER_FAULT(TRUNC_INVALID);
        return x;
    }
}

static inline uint32_t trunc_f32_to_u32(struct trivm_instance *vm, uint32_t x) {
    if (x < 0x4F800000 || (x >= 0x80000000 && x < 0xBF800000) || !TRIVM_FAULT_TRUNC_INVALID) {
        return (uint32_t)TO_F32(x);
    } else {
        TRIGGER_FAULT(TRUNC_INVALID);
        return x;
    }
}

static inline uint64_t trunc_f32_to_s64(struct trivm_instance *vm, uint32_t x) {
    uint32_t x_rot = ((x << 1) | (x >> 31)) ^ 1;
    if (x_rot <= 0xBE000000 || !TRIVM_FAULT_TRUNC_INVALID) {
        return (int64_t)TO_F32(x);
    } else {
        TRIGGER_FAULT(TRUNC_INVALID);
        return x;
    }
}

static inline uint64_t trunc_f32_to_u64(struct trivm_instance *vm, uint32_t x) {
    if (x < 0x5F800000 || (x >= 0x80000000 && x < 0xBF800000) || !TRIVM_FAULT_TRUNC_INVALID) {
        return (uint64_t)TO_F32(x);
    } else {
        TRIGGER_FAULT(TRUNC_INVALID);
        return x;
    }
}

static inline uint32_t trunc_f64_to_s32(struct trivm_instance *vm, uint64_t x) {
    uint32_t hi = (uint32_t)(x >> 32);
    if (hi < 0x41E00000 || (hi >= 0x80000000 && x < (uint64_t)0xC1E0000000200000uLL) || !TRIVM_FAULT_TRUNC_INVALID) {
        return (int32_t)TO_F64(x);
    } else {
        TRIGGER_FAULT_WITH_CODE(TRUNC_INVALID, (uint32_t)(x >> 32));
        return (uint32_t)x;
    }
}

static inline uint32_t trunc_f64_to_u32(struct trivm_instance *vm, uint64_t x) {
    uint32_t hi = (uint32_t)(x >> 32);
    if (hi < 0x41F00000 || (hi >= 0x80000000 && hi < 0xBFF00000) || !TRIVM_FAULT_TRUNC_INVALID) {
        return (uint32_t)TO_F64(x);
    } else {
        TRIGGER_FAULT_WITH_CODE(TRUNC_INVALID, (uint32_t)(x >> 32));
        return (uint32_t)x;
    }
}

static inline uint64_t trunc_f64_to_s64(struct trivm_instance *vm, uint64_t x) {
    uint32_t hi = (uint32_t)(x >> 32);
    if (hi < 0x43E00000 || (hi >= 0x80000000 && x <= (uint64_t)0xC3E0000000000000uLL) || !TRIVM_FAULT_TRUNC_INVALID) {
        return (int64_t)TO_F64(x);
    } else {
        TRIGGER_FAULT_WITH_CODE(TRUNC_INVALID, (uint32_t)(x >> 32));
        return x;
    }
}

static inline uint64_t trunc_f64_to_u64(struct trivm_instance *vm, uint64_t x) {
    uint32_t hi = (uint32_t)(x >> 32);
    if (hi < 0x43F00000 || (hi >= 0x80000000 && hi < 0xBFF00000) || !TRIVM_FAULT_TRUNC_INVALID) {
        return (uint64_t)TO_F64(x);
    } else {
        TRIGGER_FAULT_WITH_CODE(TRUNC_INVALID, (uint32_t)(x >> 32));
        return x;
    }
}

static int trivm_instr_long(struct trivm_instance *vm, uint32_t code, uint32_t arg1_lo)
{
	uint32_t op = (code >> 8) & 0x3F;
	uint64_t arg1;
	uint32_t arg1_hi;

	if (code & CODE_LONG_ARG1)
	{
		arg1_hi = arg1_lo;
		if ((code & CODE_INSTR_ARG_MASK) == CODE_INSTR_ARG_POP)
		{
			arg1_lo = mem_pop(vm);
		}
		else
		{
			arg1_lo = read_prog(vm);
			arg1_lo |= read_prog(vm) << 8;
			arg1_lo |= read_prog(vm) << 16;
			arg1_lo |= read_prog(vm) << 24;
		}
	}
	else
	{
		arg1_hi = (uint32_t)((int32_t)arg1_lo >> 31);
	}

	arg1 = (uint64_t)arg1_lo | ((uint64_t)arg1_hi << 32);

	uint64_t arg0 = 0;
	if (op < TRIVM_TREE_EXT32_FIRST_ONE_ARG)
	{
		uint32_t arg0_lo = mem_pop(vm);
		uint32_t arg0_hi;
		if (code & CODE_LONG_ARG0)
		{
			arg0_hi = arg0_lo;
			arg0_lo = mem_pop(vm);
		}
		else
		{
			arg0_hi = (uint32_t)((int32_t)arg0_lo >> 31);
		}
		arg0 = (uint64_t)arg0_lo | ((uint64_t)arg0_hi << 32);
	}

	uint64_t ret;

	/*>     Op:adv64 {$op_name_adv64(op)} */
	TRIVM_TREE_EXT64;

	mem_push(vm, (uint32_t)ret);
	if (code & CODE_LONG_RES)
	{
		mem_push(vm, (uint32_t)(ret >> 32));
	}

	return 0;

#if TRIVM_FAULT_INSTR_INVALID
invalid_instruction:
	TRIGGER_FAULT(INSTR_INVALID);
	return 0;
#endif
}


/* ================================================ UNWIND extension ================================================ */

static void trivm_instr_unwind(struct trivm_instance *vm, uint32_t arg1, uint32_t arg1_shift)
{
	uint32_t keep;
	uint32_t skip;
	uint32_t total;
	uint32_t mask;
	uint32_t return_address = vm->pc;
	uint8_t middle = (32 - arg1_shift) / 2 + 1;

	mask = (1 << middle) - 1;
	skip = (arg1 & mask) + 1;
	keep = (arg1 >> middle) & (mask >> 2);
	if (keep & 1) {
		keep -= 1;
		return_address = mem_pop(vm);
	}
	skip *= 4;
	keep *= 2;
	total = skip + keep;

	if (vm->sp < total || vm->sp - total < vm->spl)
	{
		TRIGGER_FAULT_WITH_CODE(STACK_UNDERFLOW, vm->sp - total, return);
	}

	if (vm->sp < total || vm->sp - total > vm->ram_size || vm->sp >= vm->ram_size)
	{
		return;
	}

	uint8_t* src = &vm->ram[vm->sp - keep + 1];
	uint8_t* dst = &vm->ram[vm->sp - total + 1];

#if TRIVM_STDLIB
	memmove(dst, src, keep);
#else
	uint8_t* end = src + keep;
	while (src < end)
	{
		*dst++ = *src++;
	}
#endif

	vm->sp -= skip;
	vm->pc = return_address;
}


/* ========================================== Core instructions execution =========================================== */

int trivm_instr_ext(struct trivm_instance *vm, uint32_t id)
{
	// TODO: external call
	return 0;
}

static uint32_t check_div_0(struct trivm_instance *vm, uint32_t arg0, uint32_t arg1)
{
	if (arg1 == 0)
	{
		TRIGGER_FAULT(DIVISION_BY_ZERO);
		return 1;
	}
	return arg1;
}

static uint32_t check_sdiv(struct trivm_instance *vm, uint32_t arg0, uint32_t arg1)
{
	if (arg1 == (uint32_t)(-1) && arg0 == (uint32_t)(-0x80000000))
	{
		TRIGGER_FAULT(DIVISION_OVERFLOW);
		return 1;
	}
	return arg1;
}

static int trivm_instr(struct trivm_instance *vm, uint32_t code)
{
	uint32_t arg1 = 0;
	uint32_t arg1_shift = 24;
	uint32_t op = code & CODE_INSTR_OP_MASK;
	switch (code & CODE_INSTR_ARG_MASK)
	{
	case CODE_INSTR_ARG_4B:
		arg1 = read_prog(vm);
		arg1 |= read_prog(vm) << 8;
		arg1_shift -= 16;
		// Intensional missing break
	case CODE_INSTR_ARG_2B:
		arg1 |= read_prog(vm) << 16;
		arg1_shift -= 8;
		// Intensional missing break
	case CODE_INSTR_ARG_1B:
		arg1 |= read_prog(vm) << 24;
		arg1 = (uint32_t)((int32_t)arg1 >> arg1_shift);
		/*>     Arg1 imm {{arg1}}, bits {#32 - arg1_shift} */
		break;
	default: //CODE_INSTR_ARG_POP
		arg1_shift = 0;
		arg1 = mem_pop(vm);
		/*>     Arg1 pop {{arg1}} */
		break;
	}

	if (TWO_BYTE_INSTR_ENABLED && (code & CODE_INSTR_OP_MASK_ADV) == CODE_INSTR_OP_MASK_ADV)
	{
		code = code | (read_prog(vm) << 8);
		if (EXT64_TREE_ENABLED && ((code & 0xC004) != 0))
		{
			return trivm_instr_long(vm, code, arg1);
		}
		op = code >> 7;
	}

	uint32_t arg0 = 0;
	if (op < TRIVM_TREE_CORE_FIRST_ONE_ARG)
	{
		arg0 = mem_pop(vm);
		/*>     Arg0 pop {{arg0}} */
	}

	// TODO: (or not) Put flags from "fenv.h" to GPRn if TRIVM_FENV is enabled to simplify trunc overflow detection on guest side. (OR NOT)
	// https://en.cppreference.com/w/cpp/numeric/fenv

	// TODO: VM trunc instructions may optionally return saturated value.
	// There are different ways to do this:
	// 1. VM trunc outside its bounds is undefined:
	//        guest is responsible for handling all.
	//        TRIVM_TRUNC32_UNDEFINED=1, TRIVM_TRUNC64_UNDEFINED=1 (disabled by default)
	// 2. Platform trunc always returns saturated values as defined by WASM "trunc_sat" instructions.
	//        guest will use them directly
	//        TRIVM_TRUNC32_SATURATED=1, TRIVM_TRUNC64_SATURATED=1 (disabled by default)
	// 3. Platform trunc returns undefined values outside is bounds (or different than WASM "trunc_sat"), but have "fenv.h"
	//        guest will use them directly, host will saturate them with help from "fenv.h".
	//        TRIVM_USE_FENV=1 (disabled by default)
	// 4. Platform trunc returns undefined values outside its bounds (or different than WASM "trunc_sat"), and does not have "fenv.h"
	//    or host may crash when outside its bounds.
	//        guest will use them directly, host will saturate them by comparing floating values before truncating.
	//        [no additional options]

	// TODO: Guest side of it:
	// 1. TRIWASM_FAULT_TRUNC is enabled:
	//        Unsaturated trunc instructions will be compiled to function call that after truncation, check if result is
	//        min or max. If it is, check if input is in range, and trigger fault if not.
	// 2. TRIWASM_FAULT_TRUNC is disabled:
	//        Unsaturated trunc instructions will be the same as saturated.

	uint32_t ret = 0;
	if ((op & 1) && EXT32_TREE_ENABLED)
	{
		/*>     Op:adv32 {$op_name_adv32(op)} */
		TRIVM_TREE_EXT32;
	}
	else
	{
		uint32_t arg1_pc = vm->pc + arg1;
		/*>     Op:core {$op_name_core(op)} */
		TRIVM_TREE_CORE;
	}

	mem_push(vm, ret);

	return 0;

#if TRIVM_FAULT_INSTR_INVALID
invalid_instruction:
	TRIGGER_FAULT(INSTR_INVALID);
	return 0;
#endif
}


/* =========================================== Memory access instructions =========================================== */

static void trivm_mem(struct trivm_instance *vm, uint32_t code)
{
#define CODE_MEM_SP (1 << 6)
#define CODE_MEM_WRITE_SHIFT 5
#define CODE_MEM_WRITE (1 << CODE_MEM_WRITE_SHIFT)
#define CODE_MEM_MAB_SHIFT 1
#define CODE_MEM_MAB_LSB (1 << 1)
#define CODE_MEM_POP (1 << 0)
#define CODE_MEM_OFFSET_MASK 0x1F

#define CODE_MEM_MORE_IMM (1 << 0)

#define CODE_MEM_IMM_SMALL (1 << 0)
#define CODE_MEM_IMM_64BIT (1 << 1)
#define CODE_MEM_IMM_HALF_WORD (1 << 1)
#define CODE_MEM_IMM_SIGN_EXT_SHIFT 2
#define CODE_MEM_IMM_SIGN_EXT (1 << CODE_MEM_IMM_SIGN_EXT_SHIFT)

	uint32_t access_size = 4;
	uint32_t addr;
	uint32_t value[TRIVM_EXT_MEM64 ? 2 : 1];
	uint32_t sign_ext = 0;
	uint8_t *ptr;
	uint32_t offset;
	uint32_t last;
	uint32_t count;
	uint32_t imm;

	addr = code & CODE_MEM_OFFSET_MASK;

	if (code & CODE_MEM_SP) {
		// SP relative
		code &= CODE_MEM_WRITE;
		if (addr <= 0x1E) {
			goto skip_get_args;
		}
	} else {
		// zero/AMB0 relative
		addr = addr >> 2;
		if (addr <= 0x05) {
			code &= CODE_MEM_WRITE | CODE_MEM_POP | CODE_MEM_MAB_LSB;
            goto skip_get_args;
        }
	}

	/*> ARGS ... */
	addr = 0;
	count = 5;
	do
	{
		if (count == 0) {
			TRIGGER_FAULT(INSTR_INVALID, { return; });
			break;
		}
		imm = read_prog(vm);
		/*> ARG byte {imm} */
		addr = (addr << 7) | (imm >> 1);
		count--;
	} while (imm & CODE_MEM_MORE_IMM);

	if (code & CODE_MEM_SP) {
		// SP relative
		addr += 0x1F;
	} else if (addr & CODE_MEM_IMM_SMALL) {
		sign_ext = (addr & CODE_MEM_IMM_SIGN_EXT) << (4 - CODE_MEM_IMM_SIGN_EXT_SHIFT);
		if (addr & CODE_MEM_IMM_HALF_WORD) {
			/*> 16-bit access */
			access_size = 2;
		} else {
			/*> 8-bit access */
			access_size = 1;
			sign_ext |= sign_ext >> 1;
		}
		addr >>= (2 + (code >> CODE_MEM_WRITE_SHIFT));
	} else {
		if (!TRIVM_EXT_MEM64) {
			/*> 32-bit access */
			addr <<= 1;
		} else if (addr & CODE_MEM_IMM_64BIT) {
			/*> 64-bit access */
			access_size = 8;
			/* `imm` is already valid, because two lower bits are 0 and expected: */
			/* imm = (imm >> 2) * 4 */
			/*> ... */
			/*> bytes {#access_size}, sign ext shift {#sign_ext}, offset (items) {{addr}} */
		}
		goto skip_mul_args;
	}

	/*> bytes {#access_size}, sign ext shift {#sign_ext}, offset (items) {{addr}} */

skip_get_args:

	addr *= access_size;

skip_mul_args:

	/*> offset (bytes) {{addr}} */

	if (code & CODE_MEM_WRITE) {
		if (access_size == 8 && TRIVM_EXT_MEM64) {
			value[1] = mem_pop(vm);
		}
		value[0] = mem_pop(vm);
		/*> value hi={{access_size == 8 ? value[1] : 0}}, lo={{value[0]}} */
	}

	if (code & CODE_MEM_POP) {
		uint32_t pop_value = mem_pop(vm);
		addr += pop_value;
		/*> pop {{pop_value}} -> {addr} */
	}

	if (code & CODE_MEM_SP) {
		// SP relative
		addr = vm->sp - addr;
	} else {
		addr += vm->mab[(code >> CODE_MEM_MAB_SHIFT) & 3];
	}

	/*> ADDRESS {addr} */
	/*> ?access_size == 4 && addr / 4 < TOTAL_REGISTERS? REGISTER {$reg_name(addr / 4)} */

#if TRIVM_ENABLE_ROM
	if (addr & 0x80000000)
	{
		ptr = (uint8_t*)vm->rom;
		offset = addr ^ 0x80000000;
		last = vm->rom_size - access_size;
		/*> ROM memory, last accessable address {last} */
		if (code & CODE_MEM_WRITE)
		{
			TRIGGER_FAULT_WITH_CODE(READ_ONLY, addr);
			return;
		}
	}
	else
#endif
	{
		ptr = vm->ram;
		offset = addr;
		last = vm->ram_size - access_size;
		/*> RAM memory, last accessable address {last} */
	}

	if (offset > last)
	{
		TRIGGER_FAULT_WITH_CODE(ACCESS_OUT_OF_BOUNDS, addr);
		return;
	}

	uint8_t* dst;
	uint8_t* src;

	if (code & CODE_MEM_WRITE) {
		/*> WRITE */
		dst = ptr;
		src = (uint8_t*)&value;
	} else {
		/*> READ */
		dst = (uint8_t*)&value;
		src = ptr;
	}

#if TRIVM_STDLIB
	memcpy(dst, src, access_size);
#else
	uint8_t* end = src + access_size;
	uint8_t* curr_dst = dst;
	while (src < end) {
		*curr_dst++ = *src++;
	}
#endif

	if (!(code & CODE_MEM_WRITE)) {
		value[0] = (uint32_t)(((int32_t)value[0] << sign_ext) >> sign_ext);
		/*> value hi={{access_size == 8 ? value[1] : 0}}, lo={{value[0]}} */
		mem_push(vm, value[0]);
		if (access_size == 8 && TRIVM_EXT_MEM64) {
			mem_push(vm, value[1]);
		}
	} else if (dst == (uint8_t*)&vm->sp_shadow) {
		vm->sp = vm->sp_shadow & ~3;
	}
}


/* =============================================== Bytecode executor ================================================ */

static int trivm_step(struct trivm_instance *vm)
{
	uint32_t code;

#if TRIVM_ENABLE_ROM
	if (vm->pc > vm->rom_size - CODE_MAX_SIZE)
	{
		TRIGGER_FAULT(INSTR_OUT_OF_BOUNDS, return 0);
	}
#else
	if (vm->pc > vm->ram_size - CODE_MAX_SIZE)
	{
		TRIGGER_FAULT(INSTR_OUT_OF_BOUNDS, return 0);
	}
#endif

	vm->sp_shadow = vm->sp;

	if ((int32_t)vm->sp < (int32_t)vm->spl)
	{
		TRIGGER_FAULT_WITH_CODE(STACK_UNDERFLOW, vm->sp, { vm->sp = vm->spl; return 0; });
	}

	if ((int32_t)vm->gsp > (int32_t)vm->gsph)
	{
		TRIGGER_FAULT(GUEST_STACK_UNDERFLOW, { vm->gsph = 0x7FFFFFFF; return 0; });
	}

	if (TRIVM_FAULT_STACK_OVERFLOW && vm->gspl == 0x80000000)
	{
		if ((int32_t)vm->sp > (int32_t)(vm->gsp - vm->sph))
		{
			TRIGGER_FAULT(STACK_OVERFLOW, { vm->sph = 0x7FFFFFFF; return 0; });
		}
	}
	else
	{
		if ((int32_t)vm->sp > (int32_t)vm->sph)
		{
			TRIGGER_FAULT(STACK_OVERFLOW, { vm->sph = 0x7FFFFFFF; return 0; });
		}

		if ((int32_t)vm->gsp < (int32_t)vm->gspl)
		{
			TRIGGER_FAULT(GUEST_STACK_OVERFLOW, { vm->gspl = 0x80000000; return 0; });
		}
	}

	code = read_prog(vm);

	if (code & CODE_INSTR)
	{
		/*> INSTR opcode {code} */
		return trivm_instr(vm, code);
	}
	else
	{
		/*> MEM opcode {code} */
		trivm_mem(vm, code);
		return 0;
	}
}


int trivm_run(struct trivm_instance *vm, uint32_t limit)
{
	int result = 0;
	/*> RUN limit={{limit}} */
	while (limit > 0 && result >= 0)
	{
		/*> STEP limit={{limit}} ... */
		result = trivm_step(vm);
		if (result > 0) {
			result = trivm_instr_ext(vm, result);
		}
		/*> ... */
		if (limit != TRIVM_INFINITELY)
		{
			limit--;
		}
		/*> ?result < 0? EXIT to native */
	}
	/*> RUN done */
	return result + 1; // 1 - limit, 0 - normal, -1... - error
}


/* ========================================= Virtual machine initialization ========================================= */

struct trivm_instance *trivm_init(uint8_t *memory, uint32_t memory_size, const uint8_t *rom, uint32_t program_size)
{
	struct trivm_instance *vm = (struct trivm_instance *)memory;
	uint32_t addr = TRIVM_ENABLE_ROM ? 0 : TRIVM_PROGRAM_START + program_size;
#if TRIVM_STDLIB
	memset(&memory[addr], 0, memory_size - addr);
#else
	while (addr < memory_size) {
		memory[addr] = 0;
		addr++;
	}
#endif
#if TRIVM_ENABLE_ROM
	vm->rom = rom;
	vm->rom_size = program_size;
#endif
	vm->ram_size = memory_size - TRIVM_MEMORY_HEADER;
	if (STARTUP_ENTRY_OFFSET != 0) {
		vm->pc = STARTUP_ENTRY_OFFSET;
	}
	vm->sph = vm->ram_size;
	return vm;
}
