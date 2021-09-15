
#ifndef _VM_CONFIG_HH_
#define _VM_CONFIG_HH_

#include "Utils.hh"


struct VMConfig
{
    struct {
        bool reduce;
        bool i64;
        bool f64;
        bool f32;
        bool unreachable;
        bool any64;
    } ext;
    bool verboseAsm;
    bool importAllByName;
    std::map<std::string, u32> imports;
};

static const VMConfig vmConfig = {
    .ext = {
        .reduce = true,
        .i64 = false,
        .unreachable = false,
        .any64 = false,
    },
    .verboseAsm = true,
    .importAllByName = true,
};


#endif /* _VM_CONFIG_HH_ */
