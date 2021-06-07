#ifndef _COMMON_H_
#define _COMMON_H_

#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>


#define TRACE(...) // TODO: Macro for tracing call stack
#define FATAL(...) do { exit(100); } while(0)// TODO: Macro for unrecoverable fatal error

#endif /* _COMMON_H_ */
