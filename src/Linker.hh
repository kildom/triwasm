#ifndef _LINKER_HH_
#define _LINKER_HH_

#include "Utils.hh"

#include "WasmData.hh"

DOLLAR_CLASS(Linker);

class Linker {
private:
    WasmProgram$$ prog;
    WasmModule$$ mod;

public:
    void link(WasmProgram$ prog);
};

#endif /* _LINKER_HH_ */
