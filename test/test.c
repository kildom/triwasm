
#include <alloca.h>

#include "../trivmlib/src/common.h"

#define STACK_POINTER_GUARD() \
    __attribute__((import_module("__trivm_magic_function__"))) \
    __attribute__((import_name("unused"))) \
    void aux_stack_pointer_detector_helper(void*); \
    __attribute__((export_name("__trivm_magic_function__:aux_stack_pointer_detector"))) \
    void aux_stack_pointer_detector() { aux_stack_pointer_detector_helper(alloca(1024)); }

STACK_POINTER_GUARD();

__attribute__((import_module("env")))
__attribute__((import_name("bbbbbbb")))
void bbbbbbb(void*, int*);

__attribute__((export_name("aaaaaaaa")))
void aaaaaa()
{
    int x = 12;
    bbbbbbb(alloca(1024), &x);
}
