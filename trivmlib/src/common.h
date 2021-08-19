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
ret_type __trivmlib_tmp_assembly2_##name params { __builtin_unreachable(); }

/* TODO: In case TRIVM_EXPORT_ASSEMBLY have to be called locally
__attribute__((used)) \
__attribute__((import_module("__trivm_magic_function__"))) \
__attribute__((import_name("alias:export:" #exp_name))) \
ret_type c_name params;
*/

#define TRIVM_EXPORT_INLINE_ASSEMBLY(name, code, ret_type, params) \
__attribute__((used)) \
__attribute__((export_name("__trivm_magic_function__:assembly:inline,export=" #name ":" code))) \
ret_type __trivmlib_tmp_assembly2_##name params { __builtin_unreachable(); }

#define DEFINE_ANNOTATION(name, text) \
__attribute__((used)) \
__attribute__((import_module("__trivm_magic_function__"))) \
__attribute__((import_name("annotation:" text))) \
void __trivm_annotation__##name(void);

#define USE_ANNOTATION(name) __trivm_annotation__##name()

#endif
