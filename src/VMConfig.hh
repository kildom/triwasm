
#ifndef _VM_CONFIG_HH_
#define _VM_CONFIG_HH_

#include "Utils.hh"


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
};

static const VMConfig vmConfig = {
    .ext = {
        .unwind = true,
        .i64 = true,
        .f64 = false,
        .f32 = false,
        .unreachable = false,
        .any64 = true,
        .nativeCallbacks = true,
    },
    .verboseAsm = true,
    .importAllByName = true,
};


#endif /* _VM_CONFIG_HH_ */
