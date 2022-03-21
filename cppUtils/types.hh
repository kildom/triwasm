#ifndef _TYPES_HH_
#define _TYPES_HH_

#include <stdint.h>

/* cppUtils type recomentations
 * ============================
 *
 * Recommended integer types:
 * - all defined below `i8..64` and `u8..64` to express integers with known size,
 *   e.g. `u8` to express a byte.
 * - `ssize` and `usize` to express architecture-dependent integers (32/64bit only)
 *   e.g. data sizes, pointer difference, memory offsets, number of elements.
 * - `char` to express UTF-8 characters
 * - `int` to express small integers that has no strong size requirements
 *   e.g. return value of comparision function.
 *
 * Preffer integers with sign to lower probability of integer wrap around
 * zero without detection.
 *
 * Preffer `double` over `float`.
 * 
 * For enumerators use `enum class`.
 * 
 * For flags:
 * - use `enum class`
 * - use `bit()` to define values
 * - add `NONE = 0` value for checking if value has no flags set
 * - use `DEFINE_ENUM_FLAGS()` macro to overload bit operators
 */

typedef uint8_t u8;
typedef uint16_t u16;
typedef uint32_t u32;
typedef uint64_t u64;

typedef int8_t i8;
typedef int16_t i16;
typedef int32_t i32;
typedef int64_t i64;

typedef intptr_t ssize;
typedef uintptr_t usize;

#define IN >>

/* Define operators for enum class used as flags:
 * | and |=    set flags        flags that are set on any of the values
 * & and &=    intersect flags  flags that are set on both values
 * / and /=    unset flags      flags that are set on left side except those from right side
 * ^ and ^=    invert flags     flags from left side inverted by flags from the right side
 * ~           invert all flags all flags are inverted (including undefined ones)
 * !           is empty         true if no flag is set (including undefined ones)
 * IN          is flag set      true if any flag is set on both sides
 */
#define DEFINE_ENUM_FLAGS(T) \
    inline T operator | (T a, T b) { return T(((std::underlying_type_t<T>)a) | ((std::underlying_type_t<T>)b)); } \
    inline void operator |= (T &a, T b) { ((std::underlying_type_t<T> &)a) |= ((std::underlying_type_t<T>)b); } \
    inline T operator & (T a, T b) { return T(((std::underlying_type_t<T>)a) & ((std::underlying_type_t<T>)b)); } \
    inline void operator &= (T &a, T b) { ((std::underlying_type_t<T> &)a) &= ((std::underlying_type_t<T>)b); } \
    inline T operator / (T a, T b) { return T(((std::underlying_type_t<T>)a) & ~((std::underlying_type_t<T>)b)); } \
    inline void operator /= (T &a, T b) { ((std::underlying_type_t<T> &)a) &= ~((std::underlying_type_t<T>)b); } \
    inline T operator ~ (T a) { return T(~((std::underlying_type_t<T>)a)); } \
    inline T operator ^ (T a, T b) { return T(((std::underlying_type_t<T>)a) ^ ((std::underlying_type_t<T>)b)); } \
    inline void operator ^= (T &a, T b) { ((std::underlying_type_t<T> &)a) ^= ((std::underlying_type_t<T>)b); } \
    inline bool operator ! (T a) { return (std::underlying_type_t<T>)a == (std::underlying_type_t<T>)0; } \
    inline bool operator IN (T a, T b) { return (((std::underlying_type_t<T>)a) & ((std::underlying_type_t<T>)b)) != (std::underlying_type_t<T>)0; }

template<typename T>
constexpr T bit(T index)
{
    return (T)1 << index;
}

#endif /* _TYPES_HH_ */
