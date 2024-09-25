// Copyright (C) 2023 Dominik Kilian
// SPDX-License-Identifier: 0BSD

#ifndef _TRIVM_GUEST_H_
#define _TRIVM_GUEST_H_

#include <stdint.h>

#define TRIVM_EXPORT(name) __attribute__((used)) __attribute__((export_name(#name)))
#define TRIVM_IMPORT(module, name) __attribute__((used)) __attribute__((import_module(#module))) __attribute__((import_name(#name)))

#define TRIVM_ASSEMBLY(code) \
__attribute__((used)) \
__attribute__((import_module("__trivm_magic_function__"))) \
__attribute__((import_name("assembly::" code)))

#define TRIVM_INLINE_ASSEMBLY(code) \
__attribute__((used)) \
__attribute__((import_module("__trivm_magic_function__"))) \
__attribute__((import_name("assembly:inline:" code)))

__attribute__((import_module("__trivm_magic_function__")))
__attribute__((import_name("unused:dummy_consumer")))
void __triwasmlib_dummy_consumer(int);

#define _TRIVM_EXPORT_ASSEMBLY4(name_str, empty_str, index) \
    if ((name_str empty_str empty_str)[index]) __triwasmlib_dummy_consumer((name_str empty_str empty_str)[index]); \
    if ((name_str empty_str empty_str)[index + 1]) __triwasmlib_dummy_consumer((name_str empty_str empty_str)[index + 1]); \
    if ((name_str empty_str empty_str)[index + 2]) __triwasmlib_dummy_consumer((name_str empty_str empty_str)[index + 2]); \
    if ((name_str empty_str empty_str)[index + 3]) __triwasmlib_dummy_consumer((name_str empty_str empty_str)[index + 3]); \

#define _TRIVM_EXPORT_ASSEMBLY16(name_str, empty_str, index) \
    _TRIVM_EXPORT_ASSEMBLY4(name_str, empty_str empty_str, index) \
    _TRIVM_EXPORT_ASSEMBLY4(name_str, empty_str empty_str, index + 4) \
    _TRIVM_EXPORT_ASSEMBLY4(name_str, empty_str empty_str, index + 8) \
    _TRIVM_EXPORT_ASSEMBLY4(name_str, empty_str empty_str, index + 12)

#define _TRIVM_EXPORT_ASSEMBLY64(name_str, empty_str, index) \
    _TRIVM_EXPORT_ASSEMBLY16(name_str, empty_str empty_str, index) \
    _TRIVM_EXPORT_ASSEMBLY16(name_str, empty_str empty_str, index + 16) \
    _TRIVM_EXPORT_ASSEMBLY16(name_str, empty_str empty_str, index + 32) \
    _TRIVM_EXPORT_ASSEMBLY16(name_str, empty_str empty_str, index + 48)

#define _TRIVM_EXPORT_ASSEMBLY256(name_str, empty_str, index) \
    _TRIVM_EXPORT_ASSEMBLY64(name_str, empty_str empty_str, index) \
    _TRIVM_EXPORT_ASSEMBLY64(name_str, empty_str empty_str, index + 64) \
    _TRIVM_EXPORT_ASSEMBLY64(name_str, empty_str empty_str, index + 128) \
    _TRIVM_EXPORT_ASSEMBLY64(name_str, empty_str empty_str, index + 192)

#define TRIVM_EXPORT_ASSEMBLY(ret_type, name, params, code) \
    __attribute__((used)) \
    __attribute__((export_name("__trivm_magic_function__:assembly:export=" #name ":" code))) \
    ret_type __triwasmlib_tmp_assembly2_##name params { \
    __triwasmlib_dummy_consumer(1); \
    _TRIVM_EXPORT_ASSEMBLY256(#name, "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0", 0) \
    __builtin_unreachable(); } \
    __attribute__((used)) \
    __attribute__((import_module("__trivm_this_module__"))) \
    __attribute__((import_name(#name))) \
    ret_type name params;

#define TRIVM_EXPORT_INLINE_ASSEMBLY(ret_type, name, params, code) \
    __attribute__((used)) \
    __attribute__((export_name("__trivm_magic_function__:assembly:inline,export=" #name ":" code))) \
    ret_type __triwasmlib_tmp_assembly2_##name params { \
    __triwasmlib_dummy_consumer(2); \
    _TRIVM_EXPORT_ASSEMBLY256(#name, "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0", 0) \
    __builtin_unreachable(); } \
    __attribute__((used)) \
    __attribute__((import_module("__trivm_this_module__"))) \
    __attribute__((import_name(#name))) \
    ret_type name params;

#define _ANNOTATION2(line, counter, unique_id, text) do { \
    __attribute__((used)) \
    __attribute__((import_module("__trivm_magic_function__"))) \
    __attribute__((import_name("annotation:" text))) \
    void __trivm_annotation__##line##_##counter##_##unique_id(void); \
    __trivm_annotation__##line##_##counter##_##unique_id(); \
} while (0)

#define _ANNOTATION1(line, counter, unique_id, text) _ANNOTATION2(line, counter, unique_id, text)
#define ANNOTATION(unique_id, text) _ANNOTATION1(__LINE__, __COUNTER__, unique_id, text)

#define TRIVM_FAULT_HANDLER(handler_body) \
    TRIVM_INLINE_ASSEMBLY("$_triwasm_fault_handler_defined = 1") \
    void _trivm_force_fault_handler_defined(); \
    __attribute__((used)) \
    __attribute__((export_name("__trivm_magic_function__:used:_trivm_fault_handler"))) \
    void _trivm_fault_handler(unsigned type, unsigned code, unsigned code2, unsigned addr) { \
        _trivm_force_fault_handler_defined(); \
        ANNOTATION(trivm_fault_handler_impl, "triasm_name:$_triwasm_fault_handler"); \
        { handler_body; } \
    } // TODOv1: Better to create new magic function type "fault". The compiler will handle it specially.

TRIVM_INLINE_ASSEMBLY(
    "WRITE32 GPR2\n"
    "WRITE32 GPR3\n"
    "WRITE32 GPR1\n"
    "WRITE32 GPR0\n"
    "HOST -2\n"
    )
void trivm_host_fault_handler(unsigned type, unsigned code, unsigned code2, unsigned addr);

#endif
