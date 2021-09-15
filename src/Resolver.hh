#ifndef _RESOLVER_HH_
#define _RESOLVER_HH_

#include "Utils.hh"

#include "WasmData.hh"

DOLLAR_CLASS(Resolver);

class Resolver {
private:
    WasmModule$ mod;

public:
    void resolveImports(WasmModule$ mod);
    static WasmFunction$ getResolved(WasmFunction$ func);
    static WasmFunction$ getExport(WasmModule$ mod, String$$ moduleName, String$$ exportName, bool required = false);
};

#endif /* _RESOLVER_HH_ */
