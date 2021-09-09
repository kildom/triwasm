#ifndef _COMMON_H_
#define _COMMON_H_

#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <utility>
#include <vector>
#include <tuple>
#include <string>
#include <map>
#include <iostream>
#include <algorithm>
#include <iomanip>

using nullptr_t = std::nullptr_t;

// Using type names as in WASM core specification
using u64 = std::uint64_t;
using s64 = std::int64_t;
using u32 = std::uint32_t;
using s32 = std::int32_t;
using u16 = std::uint16_t;
using s16 = std::int16_t;
using u8 = std::uint8_t;
using s8 = std::int8_t;

// Using type names with the same convention as above
using usize = std::uintptr_t;
using ssize = std::intptr_t;

#include "utils/CallTrace.hh"

#define FATAL(text, ...) do { printf(text " :%s:%d\n", ##__VA_ARGS__, __FILE__, __LINE__); CallTrace::print(); exit(100); } while(0)// TODO: Macro for unrecoverable fatal error
#define ASSERT(text, ...) do { printf(text " :%s:%d\n", ##__VA_ARGS__, __FILE__, __LINE__); CallTrace::print(); exit(101); } while(0)// TODO: Macro for unrecoverable fatal error

#include "utils/Init.hh"
#include "utils/Dollar.hh"
#include "utils/Range.hh"
#include "utils/Array.hh"
#include "utils/GenericString.hh"

DOLLAR_TYPEDEF(u64);
DOLLAR_TYPEDEF(s64);
DOLLAR_TYPEDEF(u32);
DOLLAR_TYPEDEF(s32);
DOLLAR_TYPEDEF(u16);
DOLLAR_TYPEDEF(s16);
DOLLAR_TYPEDEF(u8);
DOLLAR_TYPEDEF(s8);

#endif /* _COMMON_H_ */
