// Copyright (C) 2023 Dominik Kilian
// SPDX-License-Identifier: 0BSD

#ifndef _COMMON_H_
#define _COMMON_H_

#include <trivm_guest.h>

typedef uint32_t u32;
typedef uint64_t u64;
typedef int32_t s32;
typedef int64_t s64;

typedef uint32_t v128 __attribute__((ext_vector_type(4)));

#endif
