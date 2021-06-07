#ifndef _COMMON_H_
#define _COMMON_H_

#include <cstdint>
#include <cstddef>
#include <cstdlib>
#include <utility>
#include <vector>
#include <tuple>
#include <string>

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


typedef std::basic_string<u8> Bytes; // TODO: safer non-standard classes
typedef std::string String;

#define TRACE(...) // TODO: Macro for tracing call stack
#define FATAL(...) do { printf(__VA_ARGS__); exit(100); } while(0)// TODO: Macro for unrecoverable fatal error
#define ASSERT(...) do { printf(__VA_ARGS__); exit(101); } while(0)// TODO: Macro for unrecoverable fatal error

#include "Dollar.hh"
#include "Range.hh"
#include "Array.hh"

#endif /* _COMMON_H_ */
