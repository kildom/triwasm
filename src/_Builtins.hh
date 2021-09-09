#ifndef _BUILTINS_HH_
#define _BUILTINS_HH_

#include "Utils.hh"

enum {
    BUILTIN_MAKE64, // TODO: this should be removed, because it is possible to do it with TRIVM_INLINE_ASSEMBLY("")
};

u32 builtinFromName(String$$ name);

#endif /* _BUILTINS_HH_ */
