/*
 * Copyright (c) 2020 Nordic Semiconductor
 *
 * SPDX-License-Identifier: LicenseRef-BSD-5-Clause-Nordic
 */

#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <stddef.h>

#include "trivm.h"

uint8_t program[256] = {

};

uint8_t mem[1024];

uint32_t my_ext(struct trivm_instance *vm, uint32_t *params, uint32_t num_params)
{
	static volatile uint32_t x;
	x = num_params;
	return x;
}

int main()
{
	struct trivm_instance *vm = trivm_init(mem, sizeof(mem), program, sizeof(program));
	trivm_run(vm, 1);
	return 0;
}
