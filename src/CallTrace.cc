
#include "common.hh"

#include "CallTrace.hh"

CallTrace::CallTrace(const char* file, u32 line, const char* function):
    file(file),
    line(line),
    function(function)
{
    next = CallTrace::first;
    CallTrace::first = this;
}

CallTrace::~CallTrace()
{
    CallTrace::first = next;
}

CallTrace* CallTrace::first = nullptr;


void CallTrace::print()
{
    std::cout << "Call stack:\n";
    auto obj = CallTrace::first;
    while (obj) {
        std::cout << "  " << obj->file << ":" << obj->line << ": " << obj->function << "\n";
        obj = obj->next;
    }
}
