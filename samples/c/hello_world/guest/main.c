
#include "trivm_guest.h"

TRIVM_IMPORT(env, println)
void println(const char *text);

int main() {
    println("Hello World!");
    return 0;
}

#if 0
TRIVM_EXPORT(a)
void f() {
    char test[] = "sadkjsghlkjshgdfgdfgsadkjsghlkjshgdfgdfgsadkjsghlk";
    println(test);
}
#endif
