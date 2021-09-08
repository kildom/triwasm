#ifndef _JOINER_HH_
#define _JOINER_HH_

#include "Utils.hh"

#include "WasmData.hh"

DOLLAR_CLASS(Joiner);

class Joiner {
private:
    WasmModule$ main;
    WasmModule$ source;

public:
    void setMain(WasmModule$ main);
    void join(WasmModule$ source);
    void resolveReferences();
};

#endif /* _JOINER_HH_ */
