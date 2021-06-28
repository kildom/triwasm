#ifndef _CALL_TRACE_HH_
#define _CALL_TRACE_HH_

#include "Utils.hh"

#define TRACE() CallTrace _callTraceObject(__FILE__, __LINE__, __FUNCTION__);

struct CallTrace {

    const char* file;
    u32 line;
    const char* function;
    CallTrace* next;

    CallTrace(const char* file, u32 line, const char* function);
    ~CallTrace();

    static CallTrace* first;

    static void print();

};


#endif /* _CALL_TRACE_HH_ */
