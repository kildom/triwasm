
#include <alloca.h>

#include "../triwasmlib/src/common.h"

#define STACK_POINTER_GUARD() \
    __attribute__((import_module("__trivm_magic_function__"))) \
    __attribute__((import_name("unused"))) \
    void aux_stack_pointer_detector_helper(void*); \
    __attribute__((export_name("__trivm_magic_function__:aux_stack_pointer_detector"))) \
    void aux_stack_pointer_detector() { aux_stack_pointer_detector_helper(alloca(1024)); }

STACK_POINTER_GUARD();

const char *str = "1234";

EXPORT(test)
void startup()
{
    static const char* volatile x;
    x = str;
}


EXPORT(some)
void tttttt()
{
    static const char* volatile x;
    x = str +2;
}

typedef int (*func)();

EXPORT(test2)
void aaaa(func f)
{
    static const char* volatile x;
    x = str + f();
}


EXPORT(test4)
func bbb()
{
    return (void*)0;
}

static int fx() { return 12; }

EXPORT(test5)
func test5()
{
    return fx;
}


EXPORT(test6)
void test6(int* p)
{
    *p = 123;
}

