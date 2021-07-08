#include "Utils.hh"
#include "Builtins.hh"


u32 builtinFromName(String$ name)
{
    if (name == "make64") {
        return BUILTIN_MAKE64;
    }
    FATAL("Undefined builtin %s", name->buffer());
}

