
#include "trivm_guest.h"

TRIVM_IMPORT(env, println)
void println(const char *text);

int main() {
    println("Hello World!");
    return 0;
}

TRIVM_EXPORT(test)
int test(int x) {
    return x + 1;
}


#if 0
TRIVM_FAULT_HANDLER({
    println("Fault!");
    trivm_host_fault_handler(type, code, code2, addr);
});

TRIVM_EXPORT(a)
void f() {
    char test[] = "sadkjsghlkjshgdfgdfgsadkjsghlkjshgdfgdfgsadkjsghlk";
    println(test);
}
#endif
