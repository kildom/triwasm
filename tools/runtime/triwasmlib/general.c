// Copyright (C) 2023 Dominik Kilian
// SPDX-License-Identifier: 0BSD

#include "common.h"

#define TRIVM_FAULT_WASM_UNREACHABLE "16"
#define TRIVM_FAULT_WASM_TABLE_INDEX "17"


TRIVM_EXPORT_ASSEMBLY(
    void, unreachable, (),
    "NEG -(" TRIVM_FAULT_WASM_UNREACHABLE ")\n"
    "BR $_trigger_fault\n");


TRIVM_EXPORT_ASSEMBLY(
    u32, select32, (u32 a, u32 b, u32 cond),
    ".local is_true\n"
    "WRITE32 GPR0\n"
    "BRT is_true\n"
    "READ32 [SP]\n"
    "WRITE32 [SP] - 4\n"
    "is_true:\n"
    "WRITE32 GPR1\n"
    "READ32 GPR0\n"
    "WRITE32 PC\n");


TRIVM_EXPORT_ASSEMBLY(
    u64, select64, (u64 a, u64 b, u32 cond),
    ".local is_true\n"
    "WRITE32 GPR0\n"
    "BRT is_true\n"
    "WRITE32 [SP] - 4\n"
    "WRITE32 [SP] - 4\n"
    "READ32 GPR0\n"
    "WRITE32 PC\n"
    "is_true:\n"
    "WRITE32 GPR1\n"
    "WRITE32 GPR1\n"
    "READ32 GPR0\n"
    "WRITE32 PC\n");


TRIVM_EXPORT_ASSEMBLY(
    v128, select128, (v128 a, v128 b, u32 cond),
    ".local is_true\n"
    "WRITE32 GPR0\n"
    "BRT is_true\n"
    "WRITE32 [SP] - 12\n"
    "WRITE32 [SP] - 12\n"
    "WRITE32 [SP] - 12\n"
    "WRITE32 [SP] - 12\n"
    "READ32 GPR0\n"
    "WRITE32 PC\n"
    "is_true:\n"
    "WRITE32 GPR1\n"
    "WRITE32 GPR1\n"
    "WRITE32 GPR1\n"
    "WRITE32 GPR1\n"
    "READ32 GPR0\n"
    "WRITE32 PC\n");


TRIVM_EXPORT_INLINE_ASSEMBLY(
    void, call_indirect_table0, (),
    "CALL $_call_indirect_table0\n");


TRIVM_EXPORT_INLINE_ASSEMBLY(
    void, call_indirect_table_ptr, (),
    "CALL $_call_indirect_table_ptr\n");


TRIVM_EXPORT_ASSEMBLY(
    void, call_indirect_table_ptr_ptr, (),
    "READ32 [SP] - 4\n"
    "READ32 [POP]\n"
    "WRITE32 [SP] - 4\n"
    "BR $_call_indirect_table_ptr\n");
