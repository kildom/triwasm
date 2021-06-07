
#define WASM_EXPORT(name) \
    __attribute__((used)) \
    __attribute__((export_name(#name)))

#define WASM_IMPORT(name) \
    __attribute__((used)) \
    __attribute__((import_name(#name)))

WASM_IMPORT(imptest)
void imptest();

WASM_IMPORT(imptest2)
void imptest2();

WASM_IMPORT(imptest3)
void imptest3(void (*f)());

WASM_IMPORT(imptestdot)
void imptestdot(int x, ...);

__attribute__((noinline))
void sub() {
    imptest();
}

WASM_EXPORT(test1)
void test1() {
    imptest();
    imptest2();
    imptest3(sub);
    imptestdot(1, 2, 3, 4, 5, 6);
}

