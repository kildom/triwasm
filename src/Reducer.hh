#ifndef _REDUCER_HH_
#define _REDUCER_HH_

#include "Utils.hh"

#include "WasmData.hh"
#include "WasmReader.hh"

DOLLAR_CLASS(Reducer);

class Reducer {
private:
    WasmData$ d;
    Array$<u32> stack;
    Array$<WasmBlock$$> blockStack;
    WasmFunction$$ function;

public:
    void reduce(WasmData$ d);
    void reduceFunction(WasmFunction$ func);
    void reduceBlock(WasmBlock$$ body);
    void reduceInstr(WasmInstr$$ instr, Array$<WasmInstr$$> reduced);
};

#endif /* _REDUCER_HH_ */
