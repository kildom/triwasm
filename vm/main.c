/*
 * Copyright (c) 2020 Nordic Semiconductor
 *
 * SPDX-License-Identifier: LicenseRef-BSD-5-Clause-Nordic
 */

#include <stdint.h>
#include <stdbool.h>
#include <stdio.h>
#include <stddef.h>

#include "nrf.h"

#include "trivm.h"

uint32_t my_ext(struct trivm_instance *vm, uint32_t *params, uint32_t num_params)
{
	static volatile uint32_t x;
	x = num_params;
	return x;
}

int main()
{
	struct trivm_instance *vm = trivm_init((void *)NRF_P0->OUTCLR, NRF_P0->OUTCLR, (void *)NRF_P0->OUTCLR, NRF_P0->OUTCLR);
	trivm_run(vm, 100);
	//NRF_P0->OUTCLR = div(NRF_P0->OUTCLR, NRF_P0->OUTCLR);
	return 0;
}
