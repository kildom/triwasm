
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

static inline uint32_t trunc_f32_to_s32(uint32_t x) {
    uint32_t x_rot = ((x << 1) | (x >> 31)) ^ 1;
    if (x_rot <= 0x9E000000) {
        return (int32_t)TO_F32(x);
    } else {
        //TRIGGER_FAULT(TRUNC_INVALID);
        return 0xdeadbeef;
    }
}

static inline uint32_t trunc_f32_to_u32(uint32_t x) {
    if (x < 0x4F800000 || (x >= 0x80000000 && x < 0xBF800000)) {
        return (uint32_t)TO_F32(x);
    } else {
        //TRIGGER_FAULT(TRUNC_INVALID);
        return 0xdeadbeef;
    }
}

static inline uint64_t trunc_f32_to_s64(uint32_t x) {
    uint32_t x_rot = ((x << 1) | (x >> 31)) ^ 1;
    if (x_rot <= 0xBE000000) {
        return (int64_t)TO_F32(x);
    } else {
        //TRIGGER_FAULT(TRUNC_INVALID);
        return 0xdeadbeef;
    }
}

static inline uint64_t trunc_f32_to_u64(uint32_t x) {
    if (x < 0x5F800000 || (x >= 0x80000000 && x < 0xBF800000)) {
        return (uint64_t)TO_F32(x);
    } else {
        //TRIGGER_FAULT(TRUNC_INVALID);
        return 0xdeadbeef;
    }
}

static inline uint32_t trunc_f64_to_s32(uint64_t x) {
    uint32_t hi = (uint32_t)(x >> 32);
    if (hi < 0x41E00000 || (hi >= 0x80000000 && x < (uint64_t)0xC1E0000000200000uLL)) {
        return (int32_t)TO_F64(x);
    } else {
        //TRIGGER_FAULT(TRUNC_INVALID);
        return 0xdeadbeef;
    }
}

static inline uint32_t trunc_f64_to_u32(uint64_t x) {
    uint32_t hi = (uint32_t)(x >> 32);
    if (hi < 0x41F00000 || (hi >= 0x80000000 && hi < 0xBFF00000)) {
        return (uint32_t)TO_F64(x);
    } else {
        //TRIGGER_FAULT(TRUNC_INVALID);
        return 0xdeadbeef;
    }
}

static inline uint64_t trunc_f64_to_s64(uint64_t x) {
    uint32_t hi = (uint32_t)(x >> 32);
    if (hi < 0x43E00000 || (hi >= 0x80000000 && x <= (uint64_t)0xC3E0000000000000uLL)) {
        return (int64_t)TO_F64(x);
    } else {
        //TRIGGER_FAULT(TRUNC_INVALID);
        return 0xdeadbeef;
    }
}

static inline uint64_t trunc_f64_to_u64(uint64_t x) {
    uint32_t hi = (uint32_t)(x >> 32);
    if (hi < 0x43F00000 || (hi >= 0x80000000 && hi < 0xBFF00000)) {
        return (uint64_t)TO_F64(x);
    } else {
        //TRIGGER_FAULT(TRUNC_INVALID);
        return 0xdeadbeef;
    }
}

int main() {
    printf("0x%016lX\n", TO_U64(-9223372036854775808LL));
    printf("0x%016lX\n", TO_U64(-9223372036854775808LL)+1);
    printf("0x%016lX\n", TO_U64(-1.0));
    printf("0x%016lX\n", TO_U64(-1.0)-1);
    printf("trunc_f64_to_u64\n");
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0x43F0000000000001), TO_F64(0x43F0000000000001));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0x43F0000000000000), TO_F64(0x43F0000000000000));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0x43EFFFFFFFFFFFFF), TO_F64(0x43EFFFFFFFFFFFFF));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0xC3F0000000200001), TO_F64(0xC3F0000000200001));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0xC3F0000000200000), TO_F64(0xC3F0000000200000));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0xC3F00000001FFFFF), TO_F64(0xC3F00000001FFFFF));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0xBFF0000000000001), TO_F64(0xBFF0000000000001));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0xBFF0000000000000), TO_F64(0xBFF0000000000000));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0xBFEFFFFFFFFFFFFF), TO_F64(0xBFEFFFFFFFFFFFFF));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0x8000000000000001), TO_F64(0x8000000000000001));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0x8000000000000000), TO_F64(0x8000000000000000));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0x7FFFFFFFFFFFFFFF), TO_F64(0x7FFFFFFFFFFFFFFF));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0x4000000000000001), TO_F64(0x4000000000000001));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0x4000000000000000), TO_F64(0x4000000000000000));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0x3FFFFFFFFFFFFFFF), TO_F64(0x3FFFFFFFFFFFFFFF));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_u64(0x3FF0000000000001), TO_F64(0x3FF0000000000001));
    printf("trunc_f64_to_s64\n");
    printf("0x%016lX    %0.17f\n", trunc_f64_to_s64(0x43E0000000000001), TO_F64(0x43E0000000000001));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_s64(0x43E0000000000000), TO_F64(0x43E0000000000000));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_s64(0x43DFFFFFFFFFFFFF), TO_F64(0x43DFFFFFFFFFFFFF));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_s64(0xC3E0000000000001), TO_F64(0xC3E0000000000001));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_s64(0xC3E0000000000000), TO_F64(0xC3E0000000000000));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_s64(0xC3DFFFFFFFFFFFFF), TO_F64(0xC3DFFFFFFFFFFFFF));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_s64(0x8000000000000001), TO_F64(0x8000000000000001));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_s64(0x8000000000000000), TO_F64(0x8000000000000000));
    printf("0x%016lX    %0.17f\n", trunc_f64_to_s64(0x7FFFFFFFFFFFFFFF), TO_F64(0x7FFFFFFFFFFFFFFF));
    printf("trunc_f64_to_u32\n");
    printf("0x%08X    %0.17f\n", trunc_f64_to_u32(0x41F0000000000001), TO_F64(0x41F0000000000001));
    printf("0x%08X    %0.17f\n", trunc_f64_to_u32(0x41F0000000000000), TO_F64(0x41F0000000000000));
    printf("0x%08X    %0.17f\n", trunc_f64_to_u32(0x41EFFFFFFFFFFFFF), TO_F64(0x41EFFFFFFFFFFFFF));
    printf("0x%08X    %0.17f\n", trunc_f64_to_u32(0xC1F0000000200001), TO_F64(0xC1F0000000200001));
    printf("0x%08X    %0.17f\n", trunc_f64_to_u32(0xC1F0000000200000), TO_F64(0xC1F0000000200000));
    printf("0x%08X    %0.17f\n", trunc_f64_to_u32(0xC1F00000001FFFFF), TO_F64(0xC1F00000001FFFFF));
    printf("0x%08X    %0.17f\n", trunc_f64_to_u32(0xBFF0000000000001), TO_F64(0xBFF0000000000001));
    printf("0x%08X    %0.17f\n", trunc_f64_to_u32(0xBFF0000000000000), TO_F64(0xBFF0000000000000));
    printf("0x%08X    %0.17f\n", trunc_f64_to_u32(0xBFEFFFFFFFFFFFFF), TO_F64(0xBFEFFFFFFFFFFFFF));
    printf("0x%08X    %0.17f\n", trunc_f64_to_u32(0x8000000000000001), TO_F64(0x8000000000000001));
    printf("0x%08X    %0.17f\n", trunc_f64_to_u32(0x8000000000000000), TO_F64(0x8000000000000000));
    printf("0x%08X    %0.17f\n", trunc_f64_to_u32(0x7FFFFFFFFFFFFFFF), TO_F64(0x7FFFFFFFFFFFFFFF));
    printf("trunc_f64_to_s32\n");
    printf("0x%08X    %0.17f\n", trunc_f64_to_s32(0x41E0000000000001), TO_F64(0x41E0000000000001));
    printf("0x%08X    %0.17f\n", trunc_f64_to_s32(0x41E0000000000000), TO_F64(0x41E0000000000000));
    printf("0x%08X    %0.17f\n", trunc_f64_to_s32(0x41DFFFFFFFFFFFFF), TO_F64(0x41DFFFFFFFFFFFFF));
    printf("0x%08X    %0.17f\n", trunc_f64_to_s32(0xC1E0000000200001), TO_F64(0xC1E0000000200001));
    printf("0x%08X    %0.17f\n", trunc_f64_to_s32(0xC1E0000000200000), TO_F64(0xC1E0000000200000));
    printf("0x%08X    %0.17f\n", trunc_f64_to_s32(0xC1E00000001FFFFF), TO_F64(0xC1E00000001FFFFF));
    printf("0x%08X    %0.17f\n", trunc_f64_to_s32(0x8000000000000001), TO_F64(0x8000000000000001));
    printf("0x%08X    %0.17f\n", trunc_f64_to_s32(0x8000000000000000), TO_F64(0x8000000000000000));
    printf("0x%08X    %0.17f\n", trunc_f64_to_s32(0x7FFFFFFFFFFFFFFF), TO_F64(0x7FFFFFFFFFFFFFFF));
    printf("trunc_f32_to_u64\n");
    printf("0x%016lX    %0.10f\n", trunc_f32_to_u64(0xBF800001), TO_F32(0xBF800001));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_u64(0xBF800000), TO_F32(0xBF800000));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_u64(0xBF7FFFFF), TO_F32(0xBF7FFFFF));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_u64(0x80000001), TO_F32(0x80000001));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_u64(0x80000000), TO_F32(0x80000000));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_u64(0x7FFFFFFF), TO_F32(0x7FFFFFFF));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_u64(0x5F800001), TO_F32(0x5F800001));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_u64(0x5F800000), TO_F32(0x5F800000));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_u64(0x5F7FFFFF), TO_F32(0x5F7FFFFF));
    printf("trunc_f32_to_s64\n");
    printf("0x%016lX    %0.10f\n", trunc_f32_to_s64(0x5F000001), TO_F32(0x5F000001));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_s64(0x5F000000), TO_F32(0x5F000000));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_s64(0x5EFFFFFF), TO_F32(0x5EFFFFFF));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_s64(0xDF000001), TO_F32(0xDF000001));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_s64(0xDF000000), TO_F32(0xDF000000));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_s64(0xDEFFFFFF), TO_F32(0xDEFFFFFF));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_s64(0x80000000), TO_F32(0x80000000));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_s64(0x80000001), TO_F32(0x80000001));
    printf("0x%016lX    %0.10f\n", trunc_f32_to_s64(0x7FFFFFFF), TO_F32(0x7FFFFFFF));
    printf("trunc_f32_to_u32\n");
    printf("0x%08X    %0.10f\n", trunc_f32_to_u32(0xBF800001), TO_F32(0xBF800001));
    printf("0x%08X    %0.10f\n", trunc_f32_to_u32(0xBF800000), TO_F32(0xBF800000));
    printf("0x%08X    %0.10f\n", trunc_f32_to_u32(0xBF7FFFFF), TO_F32(0xBF7FFFFF));
    printf("0x%08X    %0.10f\n", trunc_f32_to_u32(0x80000001), TO_F32(0x80000001));
    printf("0x%08X    %0.10f\n", trunc_f32_to_u32(0x80000000), TO_F32(0x80000000));
    printf("0x%08X    %0.10f\n", trunc_f32_to_u32(0x7FFFFFFF), TO_F32(0x7FFFFFFF));
    printf("0x%08X    %0.10f\n", trunc_f32_to_u32(0x4F800001), TO_F32(0x4F800001));
    printf("0x%08X    %0.10f\n", trunc_f32_to_u32(0x4F800000), TO_F32(0x4F800000));
    printf("0x%08X    %0.10f\n", trunc_f32_to_u32(0x4F7FFFFF), TO_F32(0x4F7FFFFF));
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