#ifndef _GENERATOR_HH_
#define _GENERATOR_HH_

#include "Utils.hh"

#include "WasmData.hh"

DOLLAR_CLASS(Generator);

class Generator {
private:
    WasmProgram$ prog;
    WasmModule$ mod;
    u32 stackSize;
    Array$<WasmBlock$$> blockStack;
    WasmFunction$$ function;
    std::ostream& out;
    String$ ind;
    u32 totalBlocks;

public:
    Generator(std::ostream& out) : out(out) {}
    void generate(WasmProgram$ prog);
    void generateFunction(WasmFunction$ func);
    void generateBlock(WasmBlock$$ body);
    void generateInstr(WasmInstr$$ instr);
    static const char* getTrivmInstr(u32 opcode);
    void generateUnwind(u32 keep, u32 skip);
    void generateBuiltin(WasmInstr$$ instr);
};

#endif /* _GENERATOR_HH_ */
