
#include <math.h>
#include <stdio.h>
#include <stdint.h>
#include <fenv.h>

/* =============================================== FLOAT32 extension ================================================ */

static inline uint32_t TO_U32(float x) {
	union {
		float f;
		uint32_t i;
	} c;
	c.f = x;
	return c.i;
}

static inline float TO_F32(uint32_t x) {
	union {
		float f;
		uint32_t i;
	} c;
	c.i = x;
	return c.f;
}


/* ========================================== INT64 and FLOAT64 extensions ========================================== */

static inline uint64_t TO_U64(double x) {
	union {
		double f;
		uint64_t i;
	} c;
	c.f = x;
	return c.i;
}

static inline double TO_F64(uint64_t x) {
	union {
		double f;
		uint64_t i;
	} c;
	c.i = x;
	return c.f;
}

static inline uint32_t convertF32toS32(uint32_t x) {
    uint32_t x_without_sign = x & 0x7FFFFFFF;
    if (x_without_sign < 0x4F000000) { // if x is in valid range: abs(x) < 1.0 * 2^31
        return (int32_t)TO_F32(x);
    } else if (x_without_sign > 0x7F800000) { // if this is NaN: exponent == 255, fraction > 0
        return 0;
    } else if ((int32_t)x > 0) { // if x is positive
        return 0x7FFFFFFF;
    } else { // if x is negative
        return (uint32_t)(-0x80000000);
    }
}

static inline uint32_t convertF32toU32(uint32_t x) {
    if ((int32_t)x < 0) { // if x is negative or -NaN
        return 0;
    } else if (x < 0x4F800000) { // if x is in valid range: x < 1.0 * 2^32
        return (uint32_t)TO_F32(x);
    } else if (x > 0x7F800000) { // if this is NaN: exponent == 255, fraction > 0
        return 0;
    } else {
        return 0xFFFFFFFF;
    }
}

static inline uint64_t convertF32toS64(uint32_t x) {
    uint32_t x_without_sign = x & 0x7FFFFFFF;
    if (x_without_sign < 0x5F000000) { // if x is in valid range: abs(x) < 1.0 * 2^63
        return (int64_t)TO_F32(x);
    } else if (x_without_sign > 0x7F800000) { // if this is NaN: exponent == 255, fraction > 0
        return 0;
    } else if ((int32_t)x > 0) { // if x is positive
        return (uint64_t)0x7FFFFFFFFFFFFFFFuLL;
    } else { // if x is negative
        return (uint64_t)(-0x8000000000000000LL);
    }
}

static inline uint64_t convertF32toU64(uint32_t x) {
    if ((int32_t)x < 0) { // if x is negative or -NaN
        return 0;
    } else if (x < 0x5F800000) { // if x is in valid range: x < 1.0 * 2^64
        return (uint64_t)TO_F32(x);
    } else if (x > 0x7F800000) { // if this is NaN: exponent == 255, fraction > 0
        return 0;
    } else {
        return (uint64_t)0xFFFFFFFFFFFFFFFFuLL;
    }
}

static inline uint32_t convertF64toS32(uint64_t x) {
    uint32_t x_compressed = (uint32_t)(x >> 32);
    if ((uint32_t)x) {
        x_compressed |= 1;
    }
    uint32_t x_without_sign = x_compressed & 0x7FFFFFFF;
    if (x_without_sign < 0x41E00000) { // if x is in valid range: abs(x) < 1.0 * 2^31
        return (int32_t)TO_F64(x);
    } else if (x_without_sign > 0x7FF00000) { // if this is NaN: exponent == 255, fraction > 0
        return 0;
    } else if ((int32_t)x_compressed > 0) { // if x is positive
        return 0x7FFFFFFF;
    } else { // if x is negative
        return (uint32_t)(-0x80000000);
    }
}

static inline uint32_t convertF64toU32(uint64_t x) {
    uint32_t x_compressed = (uint32_t)(x >> 32);
    if ((uint32_t)x) {
        x_compressed |= 1;
    }
    if ((int32_t)x_compressed < 0) { // if x is negative or -NaN
        return 0;
    } else if (x_compressed < 0x41F00000) { // if x is in valid range: x < 1.0 * 2^32
        return (uint32_t)TO_F64(x);
    } else if (x_compressed > 0x7FF00000) { // if this is NaN: exponent == 255, fraction > 0
        return 0;
    } else {
        return 0xFFFFFFFF;
    }
}

static inline uint64_t convertF64toS64(uint64_t x) {
    uint32_t x_compressed = (uint32_t)(x >> 32);
    if ((uint32_t)x) {
        x_compressed |= 1;
    }
    uint32_t x_without_sign = x_compressed & 0x7FFFFFFF;
    if (x_without_sign < 0x42E00000) { // if x is in valid range: abs(x) < 1.0 * 2^63
        return (int64_t)TO_F64(x);
    } else if (x_without_sign > 0x7FF00000) { // if this is NaN: exponent == 255, fraction > 0
        return 0;
    } else if ((int32_t)x_compressed > 0) { // if x is positive
        return (uint64_t)0x7FFFFFFFFFFFFFFFuLL;
    } else { // if x is negative
        return (uint64_t)0x8000000000000000uLL;
    }
}

static inline uint64_t convertF64toU64(uint64_t x) {
    uint32_t x_compressed = (uint32_t)(x >> 32);
    if ((uint32_t)x) {
        x_compressed |= 1;
    }
    if ((int32_t)x_compressed < 0) { // if x is negative or -NaN
        return 0;
    } else if (x_compressed < 0x42F00000) { // if x is in valid range: x < 1.0 * 2^64
        return (uint64_t)TO_F64(x);
    } else if (x_compressed > 0x7FF00000) { // if this is NaN: exponent == 255, fraction > 0
        return 0;
    } else {
        return (uint64_t)0xFFFFFFFFFFFFFFFFuLL;
    }
}

int main() {
    // 4294967296
    float z = 4294967296.0f;
    uint32_t u = TO_U32(z);
    printf("0x%08X %.0f %ld\n", u, z, (uint64_t)(uint32_t)z);
    u--;
    z = TO_F32(u);
    printf("0x%08X %.0f %ld\n", u, z, (uint64_t)(uint32_t)z);
    return 0;
    //for (uint32_t i = 0xCE000000; i < 0xFFFFFFFF; i++) {
    for (uint32_t i = 0x4E000000; i < 0x7FFFFFFF; i++) {
        feclearexcept(FE_ALL_EXCEPT);
        float x = TO_F32(i);
        uint32_t result = (uint32_t)x;
        if (fetestexcept(FE_ALL_EXCEPT)) {
            printf("\n(0x%08X) %f -> 0x%08X\n", i, x, result);
            i--;
            float x = TO_F32(i);
            int result = (int)x;
            printf("\n(0x%08X) %f -> 0x%08X\n", i, x, result);
            break;
        }
        if (i % 100000 == 0) {
            printf("\r%d %%  --  (0x%08X) %f -> %ld    ", i / (0x7FFFFFFF / 100), i, x, (uint64_t)result);
            fflush(stdout);
        }
    }
}