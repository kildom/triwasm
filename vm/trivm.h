#ifndef _TRIVM_H_
#define _TRIVM_H_

#include <stdint.h>
#include <stdbool.h>

#include "trivm-config.h"

#define TRIVM_INFINITELY 0xFFFFFFFF

#ifndef TRIVM_ENABLE_ROM
#define TRIVM_ENABLE_ROM 1
#endif

#if TRIVM_ENABLE_ROM
#define TRIVM_PROGRAM_START 0
#define TRIVM_MEMORY_HEADER (12 + sizeof(uint8_t*)) // TODO: This may be incorrect (and depends on pointer size).
#else
#define TRIVM_PROGRAM_START 8
#define TRIVM_MEMORY_HEADER 8
#endif

struct trivm_instance
{
	uint32_t ram_size; /**< Size of the RAM memory */
	uint32_t sp;       /**< triVM Stack pointer */
#if TRIVM_ENABLE_ROM
	uint32_t rom_size; /**< Size of the ROM memory */
	const uint8_t *rom;   /**< Pointer to ROM memory */
#endif
	/* Start of area accessible by the triVM bytecode */
	union {
		uint32_t gpr0;       /**< triVM Temporary register 0 */
		uint8_t ram[1];    /**< RAM memory */
	};
	uint32_t gpr1;       /**< triVM Temporary register 1 */
	uint32_t gsp;      /**< Guest stack pointer */
	uint32_t sp_shadow;   /**< triVM Stack pointer accessible by guest */
	uint32_t pc;     /**< triVM Program counter - offset in ROM independent from rom_base */
	uint32_t mab[4];  /**< Memory Access Base */
	uint32_t gpr2;     /**< triVM Temporary register 2 */
	uint32_t gpr3;     /**< triVM Temporary register 3 */
	// TODOv1: Always set SP to SPL in case of stack overflow/underflow fault.
	uint32_t spl; /**< Minimum value for stack if stack guard is enabled, SP reset value after the stack fault */
	uint32_t sph; /**< Minimum value for stack if stack guard is enabled */ // TODOv1: Set to max in case of stack overflow/underflow fault.
	uint32_t gspl; /**< Minimum value for guest stack if stack guard is enabled */
	uint32_t gsph; /**< Minimum value for guest stack if stack guard is enabled */
};

struct trivm_instance *trivm_init(uint8_t *memory, uint32_t memory_size, const uint8_t *rom, uint32_t program_size);

int trivm_run(struct trivm_instance *vm, uint32_t limit);

#endif
