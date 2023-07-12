// Copyright (C) 2023 Dominik Kilian
// SPDX-License-Identifier: 0BSD

#ifndef _COMMON_H_
#define _COMMON_H_

#include <stdint.h>

#define EXPORT(name) __attribute__((used)) __attribute__((export_name(#name)))
#define IMPORT(module, name) __attribute__((used)) __attribute__((import_module(#module))) __attribute__((import_name(#name)))
#define IMPORT_BUILTIN(name) __attribute__((used)) __attribute__((import_module("__trivm_magic_function__"))) __attribute__((import_name("builtin:" #name)))

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

#define TRIVM_EXPORT_ASSEMBLY(name, code, ret_type, params) \
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

#define TRIVM_EXPORT_INLINE_ASSEMBLY(name, code, ret_type, params) \
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

#define _ANNOTATION2(line, counter, file_id, text) do { \
    __attribute__((used)) \
    __attribute__((import_module("__trivm_magic_function__"))) \
    __attribute__((import_name("annotation:" text))) \
    void __trivm_annotation__##line##_##counter##_##file_id(void); \
    __trivm_annotation__##line##_##counter##_##file_id(); \
} while (0)

#define _ANNOTATION1(line, counter, file_id, text) _ANNOTATION2(line, counter, file_id, text)
#define ANNOTATION(text) _ANNOTATION1(__LINE__, __COUNTER__, FILE_ID, text)

#define _TRIVM_ASM2(line, counter, file_id, code, ret_type, params_types, ret, params) do { \
    __attribute__((used)) \
    __attribute__((import_module("__trivm_magic_function__"))) \
    __attribute__((import_name("assembly:inline://__trivm_asm__" #line "_" #counter "_" #file_id "\n" code))) \
    ret_type __trivm_asm__##line##_##counter##_##file_id params_types; \
    ret = __trivm_asm__##line##_##counter##_##file_id params; \
} while (0)

#define _TRIVM_ASM1(line, counter, file_id, code, ret_type, params_types, ret, params) _TRIVM_ASM2(line, counter, file_id, code, ret_type, params_types, ret, params)
#define TRIVM_ASM(code, ret_type, params_types, ret, params) _TRIVM_ASM1(__LINE__, __COUNTER__, FILE_ID, code, ret_type, params_types, ret, params)
// TODO: call different macro implementation if return value is not used (there are less macro __VA_ARGS__)

#ifndef FILE_ID
#define FILE_ID ,
#endif

typedef uint32_t u32;
typedef uint64_t u64;
typedef int32_t s32;
typedef int64_t s64;

typedef uint32_t v128 __attribute__((ext_vector_type(4)));

#endif
