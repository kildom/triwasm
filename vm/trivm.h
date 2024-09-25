#ifndef _TRIVM_H_
#define _TRIVM_H_

/**
 * @addtogroup host_core Core Host API
 * @{
 *
 * This API provides core triVM functionality. It allows you to create and run program in virtual machine.
 * It provides direct access to virtual machine state and memory including registers.
 *
 * Host-guest interface must be implemented either manually or using helper APIs.
 */

#include <stdint.h>
#include <stdbool.h>

#include "trivm-config.h"

#define TRIVM_INFINITELY 0xFFFFFFFF /**< @brief Run guest code infinitely when calling @ref trivm_run. */

#ifndef __doxygen__

#ifndef TRIVM_ENABLE_ROM
#define TRIVM_ENABLE_ROM 1
#endif

#endif

#if TRIVM_ENABLE_ROM || defined(__doxygen__)
/**
 * @brief Byte offset where the program bytecode starts at provided memory.
 * 
 * If @ref TRIVM_ENABLE_ROM is set, this always points to offset 0 of @p rom parameter of @ref trivm_init.
 * Otherwise, it points to offset in @p memory parameter of @ref trivm_init.
 */
#define TRIVM_PROGRAM_START 0
/**
 * @brief Size of the header inaccessible for guest.
 * 
 * The header is at the beginning of the @p memory parameter of @ref trivm_init.
 * It is inaccessible for the guest, so it is not included in the total memory size available for the guest.
 * Add this value to the expected guest memory size to get size of the @p memory parameter of @ref trivm_init.
 */
#define TRIVM_MEMORY_HEADER (12 + sizeof(uint8_t*)) // TODO: This may be incorrect (and depends on pointer size which is unknown during preprocessing).
#else
#define TRIVM_PROGRAM_START 8
#define TRIVM_MEMORY_HEADER 8
#endif


/**
 * @brief Virtual machine instance.
 * 
 * It provides access to the virtual machine state and memory including the registers.
 */
struct trivm_instance
{
	uint32_t ram_size;   /**< @brief Size of the RAM memory */
	uint32_t sp;         /**< @brief triVM Stack pointer */
#if TRIVM_ENABLE_ROM
	uint32_t rom_size;   /**< @brief Size of the ROM memory */
	const uint8_t *rom;  /**< @brief Pointer to ROM memory */
#endif
	/* Start of area accessible by the triVM bytecode */
	union {
		uint32_t gpr0;   /**< @brief General purpose register 0 */
		uint8_t ram[1];  /**< @brief RAM memory */
	};
	uint32_t gpr1;       /**< @brief General purpose register 1 */
	uint32_t gsp;        /**< @brief Guest stack pointer */
	uint32_t sp_shadow;  /**< @brief triVM Stack pointer accessible by guest. The guest has no direct access to
							  stack pointer for safety reasons. VM copies its value to @ref sp after validation. */
	uint32_t pc;         /**< @brief triVM Program counter - offset in ROM independent from rom_base */
	uint32_t mab[4];     /**< @brief Memory Access Base */
	uint32_t gpr2;       /**< @brief General purpose register 2 */
	uint32_t gpr3;       /**< @brief General purpose register 3 */
	// TODOv1: Always set SP to SPL in case of stack overflow/underflow fault.
	uint32_t spl;        /**< @brief Minimum value for stack if stack guard is enabled, SP reset value after the stack fault */
	uint32_t sph;        /**< @brief Minimum value for stack if stack guard is enabled */ // TODOv1: Set to max in case of stack overflow/underflow fault.
	uint32_t gspl;       /**< @brief Minimum value for guest stack if stack guard is enabled */
	uint32_t gsph;       /**< @brief Minimum value for guest stack if stack guard is enabled */
};

/**
 * @brief Initialize the virtual machine instance.
 * 
 * @param memory       Pointer to virtual machine state and data memory. The returned pointer will point to
 *                     that memory, so no additional memory allocation will be done.
 *                     If @ref TRIVM_ENABLE_ROM is disabled, this memory must contain the bytecode starting at
 *                     @ref TRIVM_PROGRAM_START byte.
 *                     The remaining part of the memory is cleared with zeros for safety reasons.
 * @param memory_size  Size of the @p memory parameter.
 *                     This size is equal to expected guest memory size plus @ref TRIVM_MEMORY_HEADER.
 * @param rom          Pointer to read only memory containing the bytecode for the virtual machine.
 *                     If @ref TRIVM_ENABLE_ROM is disabled, this parameter is ignored.
 * @param program_size Size of the program bytecode.
 *                     If @ref TRIVM_ENABLE_ROM is enabled, it is number of bytes in the @p rom parameter.
 *                     Otherwise, it is number of program bytes after the @ref TRIVM_PROGRAM_START
 *                     in the @p memory parameter.
 * @return             Virtual machine instance, which is the same pointer as @p memory parameter.
 */
struct trivm_instance *trivm_init(uint8_t *memory, uint32_t memory_size, const uint8_t *rom, uint32_t program_size);

/**
 * @brief Run triVM guest program.
 *
 * @param vm            Virtual machine instance
 * @param limit         Maximum number of instructions to execute. Use @ref TRIVM_INFINITELY to disable the limit.
 *                      If @ref TRIVM_ENABLE_PRECISE_RUN_LIMIT is set, the limit will be also applied to all nested
 *                      calls to @ref trivm_run and long-running instructions will take more steps depending on
 *                      the size of the processed data.
 * @retval 1            Instruction limit is reached.
 * @retval 0            Normal exit from the guest.
 * @retval -1           Exit caused by fault, see details about fault in the triVM documentation.
 * @retval "-2 or less" Abnormal exit from the guest, return code is decided by the guest.
 */
int trivm_run(struct trivm_instance *vm, uint32_t limit);

/** @} */

#endif
