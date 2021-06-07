#ifndef _COMMON_H_
#define _COMMON_H_

#include <cstdint>
#include <cstddef>
#include <cstdlib>
#include <utility>
#include <vector>
#include <tuple>
#include <string>

using namespace std;

#define TRACE(...) // TODO: Macro for tracing call stack
#define FATAL(...) do { exit(100); } while(0)// TODO: Macro for unrecoverable fatal error
#define ASSERT(...) do { exit(100); } while(0)// TODO: Macro for unrecoverable fatal error

#endif /* _COMMON_H_ */
