#ifndef _REDUCER_HH_
#define _REDUCER_HH_

#include "common.hh"

#include "WasmData.hh"
#include "WasmReader.hh"

DOLLAR_CLASS(IRGenerator);

class IRGenerator {
private:
    WasmData$ d;
    Array$<u32> wasmStack;
    Array$<WasmBlock$$> blockStack;
    WasmFunction$$ function;
    Array$<IRInstr$$> ir;

public:
    void generate(WasmData$ d);
    void generateFunction(WasmFunction$ func);
    void generateBlock(Array$<WasmInstr$$> body);
};

#endif /* _REDUCER_HH_ */
