
#ifndef _VM_CONFIG_HH_
#define _VM_CONFIG_HH_

#include "Utils.hh"


enum UnresolvedExportKind {
    UNRESOLVED_EXPORT_FORBIDDEN,
    UNRESOLVED_EXPORT_IGNORE,
    UNRESOLVED_EXPORT_BY_NAME,
};

struct VMConfig
{
    struct {
        bool unwind;
        bool i64;
        bool f64;
        bool f32;
        bool unreachable;
        bool any64;
        bool nativeCallbacks;
    } ext;
    bool verboseAsm;
    bool importAllByName;
    std::map<std::string, u32> imports;
    bool namedExports;
    UnresolvedExportKind unresolvedExports;
    std::map<std::string, u32> exports;
};

static VMConfig vmConfig = {
    .ext = {
        .unwind = false,
        .i64 = true,
        .f64 = false,
        .f32 = false,
        .unreachable = false,
        .any64 = true,
        .nativeCallbacks = true,
    },
    .verboseAsm = true,
    .importAllByName = true,
    .namedExports = true,
    .unresolvedExports = UNRESOLVED_EXPORT_BY_NAME,
    .exports = {{"test", 0}, {"some", 2}},
};


#endif /* _VM_CONFIG_HH_ */
