#ifndef _CALL_TRACE_HH_
#define _CALL_TRACE_HH_

#include "Utils.hh"

#define TRACE2(a, b) CallTrace _callTraceObject##a##_##b(__FILE__, __LINE__, __FUNCTION__);
#define TRACE1(a, b) TRACE2(a, b)
#define TRACE() TRACE1(__COUNTER__, __LINE__)

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
