
#include "gtest/gtest.h"

#include "trace.hh"

#include "testCommon.h"

#include "dollar.hh"
#include "array.hh"

class array : public TestBase { };

template<typename T>
void showArray(T arr) {
    for (auto x: arr) {
        std::cout << x << " ";
    }
    std::cout << "\n";
}

struct NoDefConstr{
    NoDefConstr(int, int) {}
    int x;
};

TEST_F(array, create)
{
    {
        Array$$<int> arr;
        EXPECT_EQ(arr._ptr, nullptr);
        EXPECT_EQ(arr.length(), 0);
        EXPECT_NE(arr._ptr, nullptr);
    }
    {
        Array$<int> arr = Array<int>{ 1, 2, 3 };
        EXPECT_NE(arr._ptr, nullptr);
        EXPECT_EQ(arr.length(), 3);
        EXPECT_EQ(arr[0], 1);
        EXPECT_EQ(arr[2], 3);
    }
    {
        Array$N<int> arr = Array<int>{ 1, 2, 3 };
        EXPECT_NE(arr._ptr, nullptr);
        EXPECT_EQ(arr.length(), 3);
        arr = nullptr;
        EXPECT_EQ(arr._ptr, nullptr);
    }
}

TEST_F(array, elementAccess)
{
    Array$<int> arr = Array<int>{ 1, 2, 3, };
    EXPECT_NE(arr._ptr, nullptr);
    EXPECT_EQ(arr.length(), 3);
    EXPECT_EQ(arr[0], 1);
    EXPECT_EQ(arr[1], 2);
    EXPECT_EQ(arr[2], 3);
    EXPECT_EQ(arr(0), 1);
    EXPECT_EQ(arr(1), 2);
    EXPECT_EQ(arr(2), 3);
    EXPECT_FATAL_BEGIN("Index out of bounds.") {
        std::cout << arr[3];
    } EXPECT_FATAL_END;
    EXPECT_FATAL_BEGIN("Index out of bounds.") {
        std::cout << arr[-1];
    } EXPECT_FATAL_END;
    arr(3) = 9;
    EXPECT_EQ(9, arr(3));
    EXPECT_FATAL_BEGIN("Index out of bounds.") {
        std::cout << arr(-1);
    } EXPECT_FATAL_END;
    arr() = 10;
    EXPECT_EQ(5, arr.length());
    EXPECT_EQ(10, arr(4));
    EXPECT_FALSE(arr.empty());
    arr.clear();
    EXPECT_TRUE(arr.empty());
    EXPECT_EQ(0, arr.length());
    arr = Array<int>{ 1, 2, 3, };
    EXPECT_EQ(3, arr.back());
    EXPECT_EQ(3, arr.back(0));
    EXPECT_EQ(2, arr.back(1));
    EXPECT_EQ(1, arr.back(2));
    EXPECT_FATAL_BEGIN("Index out of bounds.") {
        std::cout << arr.back(3);
    } EXPECT_FATAL_END;
    EXPECT_FATAL_BEGIN("Index out of bounds.") {
        std::cout << arr.back(-1);
    } EXPECT_FATAL_END;
}

TEST_F(array, iterators)
{
    Array$<int> arr = Array<int>{ 1, 2, 3, };
    int exp = 1;
    for (auto& val : arr) {
        EXPECT_EQ(exp++, val);
    }
    exp = 3;
    for (auto& val : arr.reverseIterate()) {
        EXPECT_EQ(exp--, val);
    }
    exp = 0;
    for (auto val : arr.indexIterate()) {
        EXPECT_EQ(exp++, val);
    }
}

TEST_F(array, aaa)
{
    Array$$<NoDefConstr> ndc;
    #if BUILD_ERROR_NO_DEF_CONSTR_ROUND
    ndc(0).x = 123;
    #endif
    ndc() = NoDefConstr(0, 0);
    ndc[0].x = 123;
    ndc.length(0);
    EXPECT_FATAL_BEGIN("Cannot construct non-default-constructible elements.") {
        ndc.length(1);
    } EXPECT_FATAL_END;
    Array$<int> a = Array<int>{0, 1, 2, 3, 4, 5, 6, 7, 8};
    Array$<int> c = Array<int>{10, 11, 12, 13, 14, 15, 16, 17, 18};
    Array$<int> b = new$;
    showArray(a);

    any$ any = a.any();
    printf("%d\n", any.canCast<Array<int>>());
    printf("%d\n", any.canCast<Array<long>>());

    Array$$<int> xx;
    xx = any.cast<Array<int>>();

    b[R] = a;
    b[2 |R| 7] = b[6 |R| 8];
    std::cout << "---------\n"; showArray(a); showArray(b);

    printf("OK %d %d %d\n", a[2], b[1], a.back(2));
}
