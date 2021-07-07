#ifndef _REDUCER_HH_
#define _REDUCER_HH_

#include "Utils.hh"

#include "WasmData.hh"
#include "WasmReader.hh"

DOLLAR_CLASS(Reducer);

class Reducer {
private:
    WasmModule$$ mod;
    Array$<u32> stack;
    Array$<WasmBlock$$> blockStack;
    WasmFunction$$ function;

public:
    void reduce(WasmModule$ mod);
    void reduceFunction(WasmFunction$ func);
    void reduceBlock(WasmBlock$$ body);
    void reduceInstr(WasmInstr$$ instr, Array$<WasmInstr$$> reduced);
};

#endif /* _REDUCER_HH_ */
