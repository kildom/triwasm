#ifndef _COMMON_H_
#define _COMMON_H_

#include <stdint.h>

#define EXPORT(name) __attribute__((used)) __attribute__((export_name(#name)))
#define IMPORT(module, name) __attribute__((used)) __attribute__((import_module(module))) __attribute__((import_name(#name)))

#define TRIVM_ASSEMBLY(code) \
__attribute__((used)) \
__attribute__((import_module("__trivm_assembly_function__"))) \
__attribute__((import_name(code)))

#define TRIVM_INLINE_ASSEMBLY(code) \
__attribute__((used)) \
__attribute__((import_module("__trivm_inline_assembly_function__"))) \
__attribute__((import_name(code)))

#endif
