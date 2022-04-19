
#include "gtest/gtest.h"

#include "trace.hh"

#include "testCommon.h"

#include "dollar.hh"
#include "array.hh"

class arrayView : public TestBase { };

struct NoDefConstr{
    NoDefConstr(int a, int b) : x(a + b) {}
    int x;
};

#define EXPECT_EQ_ARR(val, arr) { \
    auto exp = decltype(val)::Type arr; \
    auto b = exp.begin(); \
    auto bEnd = exp.end(); \
    for (auto a : (val)) { \
        EXPECT_EQ(a, *b); \
        EXPECT_NE(b, bEnd); \
        ++b; \
    } \
    EXPECT_EQ(b, bEnd); \
}

TEST_F(arrayView, rangeFull)
{
    Array$<int> in = Array<int>{ 0, 1, 2, 3, 4, 5, 6, 7 };
    {
        Array$<int> arr = *in;
        EXPECT_EQ_ARR(arr,          ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr[R],       ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr[RR],      ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr(R),       ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr(RR),      ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ(8, arr.length());
    }
}

TEST_F(arrayView, rangeRightBegin)
{
    Array$<int> in = Array<int>{ 0, 1, 2, 3, 4, 5, 6, 7 };
    {
        Array$<int> arr = *in;
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr[-1 |R];
        } EXPECT_FATAL_END;
        EXPECT_EQ_ARR(arr[0 |R],    ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr[3 |R],    ({          3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr[8 |R],    ({                        }));
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr[9 |R];
        } EXPECT_FATAL_END;
    }
    {
        Array$<int> arr = *in;
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr(-1 |R);
        } EXPECT_FATAL_END;
        EXPECT_EQ_ARR(arr(0 |R),    ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr(3 |R),    ({          3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr(8 |R),    ({                        }));
        EXPECT_EQ(8, arr.length());
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr(9 |R);
        } EXPECT_FATAL_END;
    }
    {
        Array$<int> arr = *in;
        EXPECT_EQ_ARR(arr[-1 |RR],  ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr[0 |RR],   ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr[3 |RR],   ({          3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr[8 |RR],   ({                        }));
        EXPECT_EQ_ARR(arr[9 |RR],   ({                        }));
        EXPECT_EQ(8, arr.length());
    }
    {
        Array$<int> arr = *in;
        EXPECT_EQ_ARR(arr(-1 |RR),  ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr(0 |RR),   ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr(3 |RR),   ({          3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr(8 |RR),   ({                        }));
        auto v = arr(9 |RR);
        EXPECT_EQ_ARR(v,            ({                        }));
        EXPECT_EQ(9, arr.length());
        EXPECT_EQ(9, v.from);
    }
}

TEST_F(arrayView, rangeRightEnd)
{
    Array$<int> in = Array<int>{ 0, 1, 2, 3, 4, 5, 6, 7 };
    {
        Array$<int> arr = *in;
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr[-1 ||R];
        } EXPECT_FATAL_END;
        EXPECT_EQ_ARR(arr[0 ||R],    ({                        }));
        EXPECT_EQ_ARR(arr[3 ||R],    ({                5, 6, 7 }));
        EXPECT_EQ_ARR(arr[8 ||R],    ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr[9 ||R];
        } EXPECT_FATAL_END;
    }
    {
        Array$<int> arr = *in;
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr(-1 ||R);
        } EXPECT_FATAL_END;
        EXPECT_EQ_ARR(arr(0 ||R),    ({                        }));
        EXPECT_EQ_ARR(arr(3 ||R),    ({                5, 6, 7 }));
        EXPECT_EQ_ARR(arr(8 ||R),    ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ(8, arr.length());
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr(9 ||R);
        } EXPECT_FATAL_END;
    }
    {
        Array$<int> arr = *in;
        EXPECT_EQ_ARR(arr[-1 ||RR],  ({                        }));
        EXPECT_EQ_ARR(arr[0 ||RR],   ({                        }));
        EXPECT_EQ_ARR(arr[3 ||RR],   ({                5, 6, 7 }));
        EXPECT_EQ_ARR(arr[8 ||RR],   ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr[9 ||RR],   ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ(8, arr.length());
    }
    {
        Array$<int> arr = *in;
        EXPECT_EQ_ARR(arr(0 ||RR),   ({                        }));
        EXPECT_EQ_ARR(arr(3 ||RR),   ({                5, 6, 7 }));
        EXPECT_EQ_ARR(arr(8 ||RR),   ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr(9 ||RR),   ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ(8, arr.length());
        auto v = arr(-1 ||RR);
        EXPECT_EQ_ARR(v,             ({                        }));
        EXPECT_EQ(9, arr.length());
        EXPECT_EQ(9, v.from);
    }
}

TEST_F(arrayView, rangeLeftBegin)
{
    Array$<int> in = Array<int>{ 0, 1, 2, 3, 4, 5, 6, 7 };
    {
        Array$<int> arr = *in;
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr[R| -1];
        } EXPECT_FATAL_END;
        EXPECT_EQ_ARR(arr[R| 0],    ({                        }));
        EXPECT_EQ_ARR(arr[R| 3],    ({ 0, 1, 2                }));
        EXPECT_EQ_ARR(arr[R| 8],    ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr[R| 9];
        } EXPECT_FATAL_END;
    }
    {
        Array$<int> arr = *in;
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr(R| -1);
        } EXPECT_FATAL_END;
        EXPECT_EQ_ARR(arr(R| 0),    ({                        }));
        EXPECT_EQ_ARR(arr(R| 3),    ({ 0, 1, 2                }));
        EXPECT_EQ_ARR(arr(R| 8),    ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ(8, arr.length());
        auto v = arr(R| 9);
        EXPECT_EQ_ARR(v,            ({ 0, 1, 2, 3, 4, 5, 6, 7, 0 }));
        EXPECT_EQ(9, arr.length());
    }
    {
        Array$<int> arr = *in;
        EXPECT_EQ_ARR(arr[RR| -1],  ({                        }));
        EXPECT_EQ_ARR(arr[RR| 0],   ({                        }));
        EXPECT_EQ_ARR(arr[RR| 3],   ({ 0, 1, 2                }));
        EXPECT_EQ_ARR(arr[RR| 8],   ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr[RR| 9],   ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ(8, arr.length());
    }
    {
        Array$<int> arr = *in;
        EXPECT_EQ_ARR(arr(RR| -1),  ({                        }));
        EXPECT_EQ_ARR(arr(RR| 0),   ({                        }));
        EXPECT_EQ_ARR(arr(RR| 3),   ({ 0, 1, 2                }));
        EXPECT_EQ_ARR(arr(RR| 8),   ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ(8, arr.length());
        auto v = arr(RR| 9);
        EXPECT_EQ_ARR(v,            ({ 0, 1, 2, 3, 4, 5, 6, 7, 0 }));
        EXPECT_EQ(9, arr.length());
    }
}

TEST_F(arrayView, rangeLeftEnd)
{
    Array$<int> in = Array<int>{ 0, 1, 2, 3, 4, 5, 6, 7 };
    {
        Array$<int> arr = *in;
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr[R|| -1];
        } EXPECT_FATAL_END;
        EXPECT_EQ_ARR(arr[R|| 0],    ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr[R|| 3],    ({ 0, 1, 2, 3, 4          }));
        EXPECT_EQ_ARR(arr[R|| 8],    ({                        }));
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr[R|| 9];
        } EXPECT_FATAL_END;
    }
    {
        Array$<int> arr = *in;
        EXPECT_FATAL_BEGIN("Invalid range.") {
            arr(R|| 9);
        } EXPECT_FATAL_END;
        EXPECT_EQ_ARR(arr(R|| 0),    ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr(R|| 3),    ({ 0, 1, 2, 3, 4          }));
        EXPECT_EQ_ARR(arr(R|| 8),    ({                        }));
        EXPECT_EQ(8, arr.length());
        auto v = arr(R|| -1);
        EXPECT_EQ_ARR(v,             ({ 0, 1, 2, 3, 4, 5, 6, 7, 0 }));
        EXPECT_EQ(9, arr.length());
    }
    {
        Array$<int> arr = *in;
        EXPECT_EQ_ARR(arr[RR|| -1],  ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr[RR|| 0],   ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr[RR|| 3],   ({ 0, 1, 2, 3, 4          }));
        EXPECT_EQ_ARR(arr[RR|| 8],   ({                        }));
        EXPECT_EQ_ARR(arr[RR|| 9],   ({                        }));
    }
    {
        Array$<int> arr = *in;
        EXPECT_EQ_ARR(arr(RR|| 0),   ({ 0, 1, 2, 3, 4, 5, 6, 7 }));
        EXPECT_EQ_ARR(arr(RR|| 3),   ({ 0, 1, 2, 3, 4          }));
        EXPECT_EQ_ARR(arr(RR|| 8),   ({                        }));
        EXPECT_EQ_ARR(arr(RR|| 9),   ({                        }));
        EXPECT_EQ(8, arr.length());
        auto v = arr(R|| -1);
        EXPECT_EQ_ARR(v,             ({ 0, 1, 2, 3, 4, 5, 6, 7, 0 }));
        EXPECT_EQ(9, arr.length());
    }
}
