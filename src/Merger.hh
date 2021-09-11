#ifndef _MERGER_HH_
#define _MERGER_HH_

#include "Utils.hh"

#include "WasmData.hh"

DOLLAR_CLASS(Merger);

class Merger {
private:
    WasmModule$ main;
    WasmModule$ source;
    u32 funcIndexOffset;

public:
    void setMain(WasmModule$ main);
    void merge(WasmModule$ source);

private:
    void mergeFunction(WasmFunction$ func);
    void updateInstrIndexes(WasmBlock$ block);
};

#endif /* _MERGER_HH_ */
