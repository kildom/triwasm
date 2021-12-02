
#include "gtest/gtest.h"

#include "trace.hh"

#define private public
#define protected public
#undef FATAL
#define FATAL(text, ...) testFatal(text)

static const char* expectFatal = NULL;

struct ExpectFatalHere {
    ExpectFatalHere(const char *text) { expectFatal = text; }
    ~ExpectFatalHere() { expectFatal = NULL; }
};
struct ExpectedFatal {};
struct UnexpectedFatal {};

static void testFatal(const char* text) {
    std::string fatalText(text);
    if (expectFatal) {
        std::string expectedText(expectFatal);
        EXPECT_EQ(fatalText, expectedText);
        throw ExpectedFatal();
    } else {
        std::string expectedText;
        EXPECT_EQ(fatalText, expectedText);
        throw UnexpectedFatal();
    }
}

#include "dollar.hh"

DOLLAR_STRUCT(TestSimple);
DOLLAR_STRUCT(TestObject);
DOLLAR_STRUCT(TestObject2);

struct TestObject {
    int value;
    TestObject() : value(-1) { }
};

struct TestSimple {
    int value;
};

struct TestObject2 {
    int x;
    TestObject2() : x(-2) { }
};

#define EXPECT_FATAL_BEGIN(text) try { ExpectFatalHere _ex_3434_(text);
#define EXPECT_FATAL_END EXPECT_TRUE(false) << "Expected fatal error did not happen!"; } catch (ExpectedFatal) {};

TEST(dollar, constructor_default)
{
    TestObject$$ a$$;
    TestObject$ a$;
    TestObject$N a$N;

    EXPECT_EQ(a$$._ptr, nullptr);
    EXPECT_EQ(a$._ptr, nullptr);
    EXPECT_EQ(a$N._ptr, nullptr);
}

TEST(dollar, null_access)
{
    TestObject$$ a$$;
    a$$->value = 123;

    EXPECT_FATAL_BEGIN("Dereferencing uninitialized nonnull dollar reference.") {
        TestObject$ a$;
        a$->value = 123;
    } EXPECT_FATAL_END;

    EXPECT_FATAL_BEGIN("Dereferencing uninitialized nonnull dollar reference.") {
        TestObject$ a$;
        (*a$).value = 123;
    } EXPECT_FATAL_END;

    EXPECT_FATAL_BEGIN("Dereferencing null nullable dollar reference.") {
        TestObject$N a$N;
        a$N->value = 123;
    } EXPECT_FATAL_END;

    EXPECT_FATAL_BEGIN("Dereferencing null nullable dollar reference.") {
        TestObject$N a$N;
        (*a$N).value = 123;
    } EXPECT_FATAL_END;
}

TEST(dollar, operator_equal_null)
{
    TestObject$N a;
    EXPECT_TRUE(a == nullptr);
    EXPECT_TRUE(nullptr == a);
    EXPECT_FALSE(a != nullptr);
    EXPECT_FALSE(nullptr != a);
    a = TestObject();
    EXPECT_FALSE(a == nullptr);
    EXPECT_FALSE(nullptr == a);
    EXPECT_TRUE(a != nullptr);
    EXPECT_TRUE(nullptr != a);
}

TEST(dollar, operator_equal)
{
    TestObject$$ obj1 = TestObject();
    TestObject$$ obj2 = TestObject();

    {
        TestObject$$ a;
        TestObject$$ b;
        EXPECT_TRUE(a != b);
        EXPECT_FALSE(a == b);
        TestObject$$ c = obj1;
        EXPECT_TRUE(a != c);
        EXPECT_FALSE(a == c);
        TestObject$$ d = obj2;
        EXPECT_TRUE(c != d);
        EXPECT_FALSE(c == d);
        TestObject$$ e = obj2;
        EXPECT_TRUE(d == e);
        EXPECT_FALSE(d != e);
    }

}

TEST(dollar, constructorDefault2) {

    TestObject$$ a$$;
    TestObject$ a$;
    TestObject$N a$N;

    EXPECT_EQ(a$$._ptr, nullptr);
    EXPECT_EQ(a$._ptr, nullptr);
    EXPECT_EQ(a$N._ptr, nullptr);

    TestSimple$$ a = TestSimple{.value = 123};
    EXPECT_EQ(a._ptr->data.value, 123);

    /*EXPECT_TRUE(nullptr == a$N);
    EXPECT_FALSE(a$N != nullptr);
    a$N = TestObject();
    EXPECT_FALSE(a$N == nullptr);*/
}

class aaa {

};

typedef ssize_t ssize;

class Range {
public:
    ssize from;
    ssize to;
    Range(ssize from, ssize to) : from(from), to(to) { }
    Range bound(ssize length) const { return Range(*this); }
};

struct RangeFull       {                       Range bound(ssize length) const { return Range(0, length); } };
struct RangeLeftBegin  { ssize to;             Range bound(ssize length) const { return Range(0, to); } };
struct RangeLeftEnd    { ssize to;             Range bound(ssize length) const { return Range(0, length - to); } };
struct RangeRightBegin { ssize from;           Range bound(ssize length) const { return Range(from, length); } };
struct RangeRightEnd   { ssize from;           Range bound(ssize length) const { return Range(length - from, length); } };
struct RangeBeginEnd   { ssize from; ssize to; Range bound(ssize length) const { return Range(from, length - to); } };
struct RangeEndBegin   { ssize from; ssize to; Range bound(ssize length) const { return Range(length - from, to); } };
struct RangeEndEnd     { ssize from; ssize to; Range bound(ssize length) const { return Range(length - from, length - to); } };

static const RangeFull R;

static inline RangeLeftBegin  operator|  (RangeFull, ssize to)            { return RangeLeftBegin{ .to = to }; }
static inline RangeLeftEnd    operator|| (RangeFull, ssize to)            { return RangeLeftEnd{ .to = to }; }
static inline RangeRightBegin operator|  (ssize from, RangeFull)          { return RangeRightBegin{ .from = from }; }
static inline RangeRightEnd   operator|| (ssize from, RangeFull)          { return RangeRightEnd{ .from = from }; }
static inline Range           operator|  (RangeRightBegin from, ssize to) { return Range(from.from, to); }
static inline RangeBeginEnd   operator|| (RangeRightBegin from, ssize to) { return RangeBeginEnd{ .from = from.from, .to = to }; }
static inline RangeEndBegin   operator|| (ssize from, RangeLeftBegin to)  { return RangeEndBegin{ .from = from, .to = to.to }; }
static inline RangeEndEnd     operator|| (RangeRightEnd from, ssize to)   { return RangeEndEnd{ .from = from.from, .to = to }; }

class Arr {
    public:

    Range operator[](const Range& r) {
        return r;
    }

    Range operator[](ssize index) {
        return Range(index, index + 1);
    }

    template<class T>
    std::enable_if_t<std::is_class<T>::value, Range> operator[](const T& r) {
        return operator[](r.bound(100));
    }

    Range operator()(const Range& r) {
        return r;
    }

    Range operator()(ssize index) {
        return Range(index, index + 1);
    }

    template<class T>
    std::enable_if_t<std::is_class<T>::value, Range> operator()(const T& r) {
        return operator()(r.bound(100));
    }
};

TEST(dollar, any) {

    Arr arr;

    auto e = arr[12];
    std::cout << e.from << ":" << e.to << "\n";

    e = arr[3 |R| 4];
    std::cout << e.from << ":" << e.to << "\n";

    e = arr[R|| 1];
    std::cout << e.from << ":" << e.to << "\n";

    e = arr(R|| 1);
    std::cout << e.from << ":" << e.to << "\n";

#define SHOW(x) do { std::cout << #x << "           " << typeid(decltype(x)).name() << "            "; auto a = (x).bound(100); std::cout << a.from << ":" << a.to << "\n"; } while(0)

    SHOW(R);
    SHOW(R| 12);
    SHOW(R|| 34);
    SHOW(56 |R);
    SHOW(56 ||R);
    SHOW(78 |R| 12);
    SHOW(78 |R|| 12);
    SHOW(78 ||R| 12);
    SHOW(78 ||R|| 12);

    /*
    auto view = arr[RR|| 12];

    auto before_last_or_last_if_one_element = arr[RR|| 2][0];

    auto last_element = arr[E| 1];

    arr(E| 0) = 12; // push to the end
    arr.push(12);
    arr.std();

    arr[R| 5].remove(); // remove first 5 elements
    arr[RR| 5].remove(); // remove first 5 elements or all if array is smaller than 5

    arr[0 ||R] = other_array; // append other_array to the end of arr

    Python   C++
    [:]      [R]
    [x:]     [x |R]
    [:x]     [R| x]
    [x:y]    [x |R| y]
    [-x:]    [x ||R]
    [:-x]    [R|| x]
    [x:-y]   [x |R|| y]
    ...

    TODO: x |RR| y - RelaxedRange will never cause index out of bounds fault, but it will adjust to what is available.

    tab[3 |R] = 1;       // 3 | RangeFull -> RangeRightBegin
    tab[3 |R| 7] = 0;    // ..., RangeRightBegin | 7 -> RangeBeginBegin
    tab[R| 7] = 2;       // RangeFull | 7 -> RangeLeftBegin
    tab[3 |R|| 7] = 9;   // ..., RangeRightBegin || 7 -> RangeBeginEnd
    tab[3 ||R|| 1] = 8;
    tab[R|| 7] = 4;
    tab[R] = 9;
    */
}
/*

A) INSTANCE
    any access to reference or referenced object will cause initialization if needed
    use case: fields of structure that are initially owned by the structure
              local variables initially owned by the function
B) NOT NULL REFERENCE
    can be null only after construction, any access to reference or referenced object
    will cause fatal error if null
    use case: fields of structure that cannot be null, but are not owned by the structure
              parameters that cannot be null
              local variables referencing non-optional data
C) NULLABLE REFERENCE
    can be null, any access to referenced object will cause fatal error if null
    use case: optional references in fields, parameters and local variables

    |        A           |        B          |        C          |
A=  |  init ^ if needed  |  fatal if ^ null  |  fatal if ^ null  |
B=  |  init ^ if needed  |  fatal if ^ null  |  fatal if ^ null  |
C=  |  init ^ if needed  |  fatal if ^ null  |  assign always    |

TestObject$$     - A
TestObject$      - B
TestObject$N     - C

any$$ - works with exception: this is not possible "any$$ a, b=null; a = b;", so it will cause fatal error
        in other cases type is known, so works as expected.
any$  - works as expected
any$N - works as expected

       |        any$$       |        any$       |      any$N        |
any$$  |  fatal if ^ null   |  fatal if ^ null  |  fatal if ^ null  |
any$   |  fatal if ^ null   |  fatal if ^ null  |  fatal if ^ null  |
any$N  |  fatal if ^ null   |  fatal if ^ null  |  assign always    |

*/