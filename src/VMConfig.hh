
#ifndef _VM_CONFIG_HH_
#define _VM_CONFIG_HH_

#include "common.hh"


struct VMConfig
{
    bool extension64Bit;
};

static const VMConfig vmConfig = {
    .extension64Bit = false,
};


#endif /* _VM_CONFIG_HH_ */
