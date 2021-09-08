#ifndef _MERGER_HH_
#define _MERGER_HH_

#include "Utils.hh"

#include "WasmData.hh"

DOLLAR_CLASS(Joiner);

class Merger {
private:
    WasmModule$ main;
    WasmModule$ source;

public:
    void setMain(WasmModule$ main);
    void join(WasmModule$ source);
    void resolveReferences();
};

#endif /* _MERGER_HH_ */
