#ifndef _COMMON_H_
#define _COMMON_H_

#include <cstdint>
#include <cstddef>
#include <cstdlib>
#include <cstring>
#include <utility>
#include <vector>
#include <tuple>
#include <string>
#include <iostream>

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

#include "CallTrace.hh"

#define FATAL(text, ...) do { printf(text " :%s:%d\n", ##__VA_ARGS__, __FILE__, __LINE__); CallTrace::print(); exit(100); } while(0)// TODO: Macro for unrecoverable fatal error
#define ASSERT(text, ...) do { printf(text " :%s:%d\\n", ##__VA_ARGS__, __FILE__, __LINE__); CallTrace::print(); exit(101); } while(0)// TODO: Macro for unrecoverable fatal error

#include "Dollar.hh"
#include "Range.hh"
#include "Array.hh"
#include "GenericString.hh"

#endif /* _COMMON_H_ */
