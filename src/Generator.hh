#ifndef _GENERATOR_HH_
#define _GENERATOR_HH_

#include "Utils.hh"

#include "WasmData.hh"

DOLLAR_CLASS(Generator);

class Generator {
private:
    WasmModule$$ mod;
    u32 stackSize;
    Array$<WasmBlock$> blockStack;
    WasmFunction$ function;
    WasmFunctionData$ funcData;
    std::ostream& out;
    std::ostream& verbose;
    std::ostream& debug; // TODO: depend on configuration option
    String$$ ind;
    u32 totalBlocks;

public:
    Generator(std::ostream& out) : out(out), verbose(wrapVerbose(out)), debug(wrapVerbose(out)) {}
    void generate(WasmModule$ mod);
    void generateFunction(WasmFunction$$ func);
    void generateBlock(WasmBlock$ body);
    void generateInstr(WasmInstr$ instr);
    static const char* getTrivmInstr(u32 opcode);
    void generateUnwind(u32 keep, u32 skip);
    void generateBuiltin(WasmInstr$ instr);

private:
    static std::ostream& wrapVerbose(std::ostream& out);
};

#endif /* _GENERATOR_HH_ */
