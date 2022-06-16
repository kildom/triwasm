#ifndef _REDUCER_HH_
#define _REDUCER_HH_

#include "Utils.hh"

#include "WasmData.hh"

DOLLAR_CLASS(Reducer);

class Reducer {
private:
    WasmModule$ mod;
    Array$$<WasmBlock$> blockStack;
    WasmFunction$ function;
    Array$$<u32> stack;

public:
    void reduce(WasmModule$$ mod);
    void reduceFunction(WasmFunction$$ func);
    bool reduceBlock(WasmBlock$ body);
    bool reduceInstr(WasmInstr$ instr, Array$$<WasmInstr$> reduced, bool reachable);
};

#endif /* _REDUCER_HH_ */
