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

#define TRIVM_EXPORT_ASSEMBLY(name, code, ret_type, params) \
__attribute__((used)) \
__attribute__((export_name("__trivm_magic_function__:assembly:export=" #name ":" code))) \
ret_type __triwasmlib_tmp_assembly2_##name params { __builtin_unreachable(); }

/* TODO: In case TRIVM_EXPORT_ASSEMBLY have to be called locally
__attribute__((used)) \
__attribute__((import_module("__trivm_magic_function__"))) \
__attribute__((import_name("alias:export:" #exp_name))) \
ret_type c_name params;
*/

#define TRIVM_EXPORT_INLINE_ASSEMBLY(name, code, ret_type, params) \
__attribute__((used)) \
__attribute__((export_name("__trivm_magic_function__:assembly:inline,export=" #name ":" code))) \
ret_type __triwasmlib_tmp_assembly2_##name params { __builtin_unreachable(); }

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

#endif
