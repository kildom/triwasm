#ifndef _IR_GENERATOR_
#define _IR_GENERATOR_

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

#endif /* _IR_GENERATOR_ */
