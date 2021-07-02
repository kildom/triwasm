
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
    } ext;
};

static const VMConfig vmConfig = {
    .ext = {
        .i64 = false,
        .unreachable = false,
    },
};


#endif /* _VM_CONFIG_HH_ */
