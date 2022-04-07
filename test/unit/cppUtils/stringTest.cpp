
#include "gtest/gtest.h"

#include "trace.hh"

#include "testCommon.h"

#include "dollar.hh"
#include "string.hh"

class string : public TestBase { };

struct NoDefConstr{
    NoDefConstr(int a, int b) : x(a + b) {}
    int x;
};

TEST_F(string, create)
{
    String$ str("abc");
    EXPECT_EQ(*str, std::string("abc"));
    str = "def";
    EXPECT_EQ(*str, std::string("def"));
    auto str2 = "ghi\n\0"_S;
    EXPECT_EQ(*str2, std::string("ghi\n\0", 5));
}

#if 0
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

    Array$$<NoDefConstr> ndc;
    #if BUILD_ERROR_NO_DEF_CONSTR_ROUND
    ndc(0).x = 123;
    #endif
    ndc() = NoDefConstr(100, 23);
    EXPECT_EQ(123, ndc[0].x);
}

TEST_F(array, changeLength)
{
    Array$<int> arr = Array<int>{ 1, 2, 3, };
    arr.length(4);
    EXPECT_EQ(4, arr.length());
    EXPECT_EQ(0, arr[3]);
    arr() = 9;
    EXPECT_EQ(5, arr.length());
    EXPECT_EQ(9, arr[4]);
    arr.length(7);
    EXPECT_EQ(7, arr.length());
    EXPECT_EQ(0, arr[5]);
    EXPECT_EQ(0, arr[6]);
    arr.length(2);
    EXPECT_EQ(2, arr.length());
    EXPECT_EQ(2, arr[1]);
    EXPECT_FALSE(arr.empty());
    arr.clear();
    EXPECT_TRUE(arr.empty());
    EXPECT_EQ(0, arr.length());

    Array$$<NoDefConstr> ndc;
    ndc() = NoDefConstr(1, 2);
    ndc() = NoDefConstr(3, 4);
    EXPECT_EQ(2, ndc.length());
    EXPECT_EQ(3, ndc[0].x);
    EXPECT_EQ(7, ndc[1].x);
    EXPECT_FATAL_BEGIN("Cannot construct non-default-constructible elements.") {
        ndc.length(5);
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

TEST_F(array, casting) {
    typedef int int_alias;
    Array$<int> a = Array<int>{ 1, 2, 3, };
    EXPECT_TRUE(a.canCast<Array<int_alias>>());
    EXPECT_FALSE(a.canCast<Array<char>>());

    any$ any;
    any = a.any();

    EXPECT_TRUE(any.canCast<Array<int>>());
    EXPECT_TRUE(any.canCast<Array<int_alias>>());
    EXPECT_FALSE(any.canCast<Array<char>>());

    Array$$<int> a_int = any.cast<Array<int>>();
    Array$$<int_alias> a_int_alias = any.cast<Array<int_alias>>();
    EXPECT_FATAL_BEGIN("Cannot do dynamic casting.") {
        Array$$<char> a_char = any.cast<Array<char>>();
    } EXPECT_FATAL_END;
}

TEST_F(array, stack) {
    Array$<int> stack = Array<int>{ 1, 2, 3, };
    EXPECT_EQ(3, stack.back());
    EXPECT_EQ(3, stack.pop());
    EXPECT_EQ(2, stack.length());
    stack.push(99);
    EXPECT_EQ(99, stack.back());
    EXPECT_EQ(3, stack.length());
    EXPECT_FATAL_BEGIN("Invalid length.") {
        stack.pop(4);
    } EXPECT_FATAL_END;
    stack.pop(3);
    EXPECT_FATAL_BEGIN("Cannot pop from empty array.") {
        stack.pop();
    } EXPECT_FATAL_END;
    EXPECT_FATAL_BEGIN("Cannot get value from empty array.") {
        stack.back();
    } EXPECT_FATAL_END;
}
#endif
