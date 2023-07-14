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
#define TRIVM_MEMORY_HEADER (12 + sizeof(uint8_t*))
#else
#define TRIVM_PROGRAM_START 8
#define TRIVM_MEMORY_HEADER 8
#endif

struct trivm_instance
{
	uint32_t ram_size; /**< Size of the RAM memory */
	uint32_t sp;       /**< triVM Stack pointer - offset in RAM */
#if TRIVM_ENABLE_ROM
	const uint8_t *rom;   /**< Pointer to ROM memory */
	uint32_t rom_size; /**< Size of the ROM memory */
#endif
	/* Start of area accessible by the triVM bytecode */
	union {
		uint32_t tmp0;     /**< triVM Temporary register 0 */
		uint8_t ram[1];    /**< RAM memory */
	};
	uint32_t pc;       /**< triVM Program counter - offset in ROM independent from rom_base */
	uint32_t asp;       /**< Auxilary stack pointer */
	uint32_t tmp1;     /**< triVM Temporary register 1 */
	uint32_t tmp2;     /**< triVM Temporary register 2 */
	uint32_t amb[2];
	uint32_t spl; /**< Minimum value for stack if stack guard is enabled */
	uint32_t sph; /**< Minimum value for stack if stack guard is enabled */
	uint32_t aspl; /**< Minimum value for stack if stack guard is enabled */
	uint32_t asph; /**< Minimum value for stack if stack guard is enabled */
};

struct trivm_instance *trivm_init(uint8_t *memory, uint32_t memory_size, const uint8_t *rom, uint32_t program_size);

bool trivm_run(struct trivm_instance *vm, uint32_t limit);

#endif
