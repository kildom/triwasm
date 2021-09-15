#include <sstream>
#include "Utils.hh"
#include "WasmData.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmParser.hh"
#include "WasmInstr.hh"
#include "VMConfig.hh"
#include "Resolver.hh"

void Resolver::resolveImports(WasmModule$ mod)
{
    TRACE();
    this->mod = mod;

    for (auto f : mod->functions)
    {
        if (f->exportName != nullptr && f->moduleName != nullptr) {
            mod->functionExports[f->moduleName->v][f->exportName->v] = f;
        }
    }

    for (auto f : mod->functions)
    {
        if (f->kind != FUNCTION_IMPORT) {
            continue;
        }

        auto moduleName = f->import->module;
        auto functionName = f->import->name;
        auto dest = getExport(mod, moduleName, functionName);

        if (dest != nullptr) {
            f->kind = FUNCTION_LINK;
            f->data = dest;
            printf("Import resolved: %d -> %d\n", f->index, dest->index);
        } else {
            // TODO: function host by index
            f->kind = FUNCTION_HOST_BY_NAME;
            f->data = functionName; // TODO: moduleName + "." + functionName
            printf("Import resolved: %d -> HOST:%s\n", f->index, functionName.cStr());
        }
    }
}

WasmFunction$ Resolver::getResolved(WasmFunction$ func)
{
    while (func->kind == FUNCTION_LINK) {
        func = WasmFunction$(func->data);
    }
    return func;
}

WasmFunction$ Resolver::getExport(WasmModule$ mod, String$$ moduleName, String$$ exportName, bool required)
{
    if (mod->functionExports.count(moduleName->v) > 0) {
        auto& m = mod->functionExports[moduleName->v];
        if (m.count(exportName->v) > 0) {
            return m[exportName->v];
        }
    }
    if (required)
        FATAL("Expected exported function '%s' from module '%s'", exportName.cStr(), moduleName.cStr());
    return nullptr;
}
