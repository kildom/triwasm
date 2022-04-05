
#include "gtest/gtest.h"

#include "testCommon.h"

#include "dollar.hh"

DOLLAR_STRUCT(TestSimple);
DOLLAR_STRUCT(TestObject);
DOLLAR_STRUCT(TestObject2);
DOLLAR_STRUCT(NoDefConstr);

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

struct NoDefConstr {
    int value;
    NoDefConstr(int x) : value(x) { }
};

class dollar : public TestBase { };

TEST_F(dollar, constructor_default)
{
    TestObject$$ a;
    TestObject$ b;
    TestObject$N c;

    EXPECT_EQ(a._ptr, nullptr);
    EXPECT_EQ(b._ptr, nullptr);
    EXPECT_EQ(c._ptr, nullptr);
}

TEST_F(dollar, constructor_copy)
{
    TestObject$$ init$$ = TestObject();
    TestObject$ init$ = TestObject();
    TestObject$N init$N = TestObject();

#define TC(suffix) \
    { \
        TestObject$$ uninit; \
        HEAD("Copy constructor of " #suffix " from uninitialized $$"); \
        TestObject##suffix a = uninit; \
        EXPECT_EQ(a._ptr, uninit._ptr); \
        EXPECT_NE(a._ptr, nullptr); \
        EXPECT_EQ(a._ptr->counter, 2u); \
        HEAD("End of scope"); \
    } \
    { \
        TestObject$ uninit; \
        HEAD("Copy constructor of " #suffix " from uninitialized $"); \
        EXPECT_FATAL_BEGIN("Accessing uninitialized nonnull reference.") { \
            TestObject##suffix a = uninit; \
        } EXPECT_FATAL_END; \
        HEAD("End of scope"); \
    } \
    TC2(suffix, $$); \
    TC2(suffix, $); \
    TC2(suffix, $N);

#define TC2(suffix, suffix2) \
    { \
        HEAD("Copy constructor of " #suffix " from initialized " #suffix2); \
        TestObject##suffix a = init##suffix2; \
        EXPECT_EQ(a._ptr, init##suffix2._ptr); \
        EXPECT_EQ(a._ptr->counter, 2u); \
        HEAD("End of scope"); \
    } \

    TC($$);
    TC($);
    TC($N);

#undef TC
#undef TC2

    {
        TestObject$N null;
        HEAD("Copy constructor of $$ from null");
        EXPECT_FATAL_BEGIN("Assigning null to instance reference.") {
            TestObject$$ a = null;
        } EXPECT_FATAL_END;
        HEAD("End of scope");
    }

    {
        TestObject$N null;
        HEAD("Copy constructor of $ from null");
        EXPECT_FATAL_BEGIN("Assigning null to nonnull reference.") {
            TestObject$ a = null;
        } EXPECT_FATAL_END;
        HEAD("End of scope");
    }

    {
        TestObject$N null;
        HEAD("Copy constructor of $N from null");
        TestObject$N a = null;
        EXPECT_EQ(a._ptr, nullptr);
        HEAD("End of scope");
    }

    HEAD("End of test");
}

void *temporary;

TestObject$$ getTemporary$$() {
    TestObject$$ a = TestObject();
    temporary = a._ptr;
    return a;
}

TestObject$ getTemporary$() {
    TestObject$ a = TestObject();
    temporary = a._ptr;
    return a;
}

TestObject$N getTemporary$N() {
    TestObject$N a = TestObject();
    temporary = a._ptr;
    return a;
}

TestObject$$ getUninit$$() {
    return TestObject$$();
}

TestObject$ getUninit$() {
    return TestObject$();
}

TestObject$N getUninit$N() {
    return TestObject$N();
}

TEST_F(dollar, constructor_move)
{
    {
        HEAD("Move constructor of $$ from uninitialized $$");
        TestObject$$ a(std::move(getUninit$$()));
        EXPECT_EQ(a._ptr, nullptr);
        HEAD("End of scope");
    }

    {
        HEAD("Move constructor of $$ from uninitialized $");
        EXPECT_FATAL_BEGIN("Accessing uninitialized nonnull reference.") {
            TestObject$$ a(std::move(getUninit$()));
        } EXPECT_FATAL_END;
        HEAD("End of scope");
    }

    {
        HEAD("Move constructor of $$ from null $N");
        EXPECT_FATAL_BEGIN("Constructing instance reference from null reference.") {
            TestObject$$ a(std::move(getUninit$N()));
        } EXPECT_FATAL_END;
        HEAD("End of scope");
    }

    {
        HEAD("Move constructor of $ from uninitialized $$");
        TestObject$ a(std::move(getUninit$$()));
        EXPECT_NE(a._ptr, nullptr);
        EXPECT_EQ(a._ptr->counter, 1u);
        HEAD("End of scope");
    }

    {
        HEAD("Move constructor of $ from uninitialized $");
        TestObject$ a(std::move(getUninit$()));
        EXPECT_EQ(a._ptr, nullptr);
        HEAD("End of scope");
    }

    {
        HEAD("Move constructor of $ from null $N");
        EXPECT_FATAL_BEGIN("Constructing nonnull reference from null reference.") {
            TestObject$ a(std::move(getUninit$N()));
        } EXPECT_FATAL_END;
        HEAD("End of scope");
    }

    {
        HEAD("Move constructor of $N from uninitialized $$");
        TestObject$N a(std::move(getUninit$$()));
        EXPECT_NE(a._ptr, nullptr);
        EXPECT_EQ(a._ptr->counter, 1u);
        HEAD("End of scope");
    }

    {
        HEAD("Move constructor of $N from uninitialized $");
        EXPECT_FATAL_BEGIN("Accessing uninitialized nonnull reference.") {
            TestObject$N a(std::move(getUninit$()));
        } EXPECT_FATAL_END;
        HEAD("End of scope");
    }

    {
        HEAD("Move constructor of $N from null $N");
        TestObject$N a(std::move(getUninit$N()));
        EXPECT_EQ(a._ptr, nullptr);
        HEAD("End of scope");
    }

#define TC2(suffix, suffix2) \
    { \
        HEAD("Move constructor of " #suffix " from initialized " #suffix2); \
        TestObject##suffix a(std::move(getTemporary##suffix2())); \
        EXPECT_EQ((void*)a._ptr, temporary); \
        EXPECT_EQ(a._ptr->counter, 1u); \
        HEAD("End of scope"); \
    } \

#define TC(suffix) \
    TC2(suffix, $$); \
    TC2(suffix, $); \
    TC2(suffix, $N); \

    TC($$);
    TC($);
    TC($N);

    HEAD("End of test");

#undef TC2
#undef TC
}

TEST_F(dollar, constructor_object)
{
    {
        TestSimple obj1 = {.value = 123};
        TestSimple obj2 = {.value = 456};
        TestSimple obj3 = {.value = 789};
        TestSimple$$ a(obj1);
        TestSimple$ b(obj2);
        TestSimple$N c(obj3);
        EXPECT_EQ(a->value, 123);
        EXPECT_EQ(b->value, 456);
        EXPECT_EQ(c->value, 789);
    }
    {
        TestSimple obj1 = {.value = 123};
        TestSimple obj2 = {.value = 456};
        TestSimple obj3 = {.value = 789};
        TestSimple$$ a(std::move(obj1));
        TestSimple$ b(std::move(obj2));
        TestSimple$N c(std::move(obj3));
        EXPECT_EQ(a->value, 123);
        EXPECT_EQ(b->value, 456);
        EXPECT_EQ(c->value, 789);
    }
}

TEST_F(dollar, constructor_new)
{
#define TC(prefix) \
    { \
        TestObject##prefix a(new$); \
        EXPECT_NE(a._ptr, nullptr); \
        EXPECT_EQ(a->value, -1); \
    }

#define TC2(prefix) \
    EXPECT_FATAL_BEGIN("Default constructible class needed for reference implicit initialization.") { \
        NoDefConstr##prefix a(new$); \
    } EXPECT_FATAL_END;

    TC($$);
    TC($);
    TC($N);

    TC2($$);
    TC2($);
    TC2($N);

#undef TC
#undef TC2
}

TEST_F(dollar, constructor_null)
{
    TestObject$N a(nullptr);
    EXPECT_EQ(a._ptr, nullptr);
    #if BUILD_ERROR_DOLLAR_CONSTR_NULLPTR1
    TestObject$ b(nullptr);
    #endif
    #if BUILD_ERROR_DOLLAR_CONSTR_NULLPTR2
    TestObject$$ c(nullptr);
    #endif
}

TEST_F(dollar, assign_null)
{
    TestObject$N a;
    a = TestObject();
    EXPECT_NE(a._ptr, nullptr);
    a = nullptr;
    EXPECT_EQ(a._ptr, nullptr);
    #if BUILD_ERROR_DOLLAR_ASSIGN_NULLPTR1
    TestObject$ b;
    b = nullptr;
    #endif
    #if BUILD_ERROR_DOLLAR_ASSIGN_NULLPTR2
    TestObject$$ c;
    c = nullptr;
    #endif
}

TEST_F(dollar, assign_copy)
{

#define TC_EQ(prefixA, prefixB, initA, initB) \
    { \
        TestObject##prefixA a; \
        TestObject##prefixB b; \
        if (initA) a = TestObject(); \
        if (initB) b = TestObject(); \
        a = b; \
        EXPECT_EQ(a._ptr, b._ptr); \
        EXPECT_NE(a._ptr, nullptr); \
    }

#define TC_FATAL(prefixA, prefixB, initA, initB, text) \
    { \
        TestObject##prefixA a; \
        TestObject##prefixB b; \
        if (initA) a = TestObject(); \
        if (initB) b = TestObject(); \
        EXPECT_FATAL_BEGIN(text) { \
            a = b; \
        } EXPECT_FATAL_END; \
    }

#define TC_NULL(prefixA, prefixB, initA, initB) \
    { \
        TestObject##prefixA a; \
        TestObject##prefixB b; \
        if (initA) a = TestObject(); \
        if (initB) b = TestObject(); \
        a = b; \
        EXPECT_EQ(a._ptr, nullptr); \
        EXPECT_EQ(b._ptr, nullptr); \
    }

    TC_EQ   ($$, $$, 0, 0);
    TC_EQ   ($$, $$, 0, 1);
    TC_FATAL($$, $$, 1, 0, "Overriding instance reference.");
    TC_FATAL($$, $$, 1, 1, "Overriding instance reference.");

    TC_EQ($, $$, 0, 0);
    TC_EQ($, $$, 0, 1);
    TC_EQ($, $$, 1, 0);
    TC_EQ($, $$, 1, 1);

    TC_EQ($N, $$, 0, 0);
    TC_EQ($N, $$, 0, 1);
    TC_EQ($N, $$, 1, 0);
    TC_EQ($N, $$, 1, 1);

    TC_FATAL($$, $, 0, 0, "Accessing uninitialized nonnull reference.");
    TC_EQ   ($$, $, 0, 1);
    TC_FATAL($$, $, 1, 0, "Accessing uninitialized nonnull reference.");
    TC_FATAL($$, $, 1, 1, "Overriding instance reference.");

    TC_FATAL($, $, 0, 0, "Accessing uninitialized nonnull reference.");
    TC_EQ   ($, $, 0, 1);
    TC_FATAL($, $, 1, 0, "Accessing uninitialized nonnull reference.");
    TC_EQ   ($, $, 1, 1);

    TC_FATAL($N, $, 0, 0, "Accessing uninitialized nonnull reference.");
    TC_EQ   ($N, $, 0, 1);
    TC_FATAL($N, $, 1, 0, "Accessing uninitialized nonnull reference.");
    TC_EQ   ($N, $, 1, 1);

    TC_FATAL($$, $N, 0, 0, "Assigning null to instance reference.");
    TC_EQ   ($$, $N, 0, 1);
    TC_FATAL($$, $N, 1, 0, "Overriding instance reference.");
    TC_FATAL($$, $N, 1, 1, "Overriding instance reference.");

    TC_FATAL($, $N, 0, 0, "Assigning null to nonnull reference.");
    TC_EQ   ($, $N, 0, 1);
    TC_FATAL($, $N, 1, 0, "Assigning null to nonnull reference.");
    TC_EQ   ($, $N, 1, 1);

    TC_NULL($N, $N, 0, 0);
    TC_EQ  ($N, $N, 0, 1);
    TC_NULL($N, $N, 1, 0);
    TC_EQ  ($N, $N, 1, 1);

#undef TC_EQ
#undef TC_FATAL
#undef TC_NULL
}

TEST_F(dollar, assign_move)
{

#define TC_MOVE(prefixA, prefixB, initA, initB) \
    { \
        TestObject##prefixA a; \
        TestObject##prefixB b; \
        if (initA) a = TestObject(); \
        if (initB) b = TestObject(); \
        auto prev = b._ptr; \
        HEAD("Move assign " #prefixA " (init=" #initA ") = " #prefixB " (init=" #initB ")"); \
        a = std::move(b); \
        EXPECT_EQ(a._ptr, prev); \
        EXPECT_EQ(b._ptr, nullptr); \
    }

#define TC_NEW(prefixA, prefixB, initA, initB) \
    { \
        TestObject##prefixA a; \
        TestObject##prefixB b; \
        if (initA) a = TestObject(); \
        if (initB) b = TestObject(); \
        auto prev = b._ptr; \
        HEAD("Move assign " #prefixA " (init=" #initA ") = " #prefixB " (init=" #initB ")"); \
        a = std::move(b); \
        EXPECT_NE(a._ptr, prev); \
        EXPECT_NE(a._ptr, nullptr); \
        EXPECT_EQ(b._ptr, nullptr); \
    }

#define TC_FATAL(prefixA, prefixB, initA, initB, text) \
    { \
        TestObject##prefixA a; \
        TestObject##prefixB b; \
        if (initA) a = TestObject(); \
        if (initB) b = TestObject(); \
        EXPECT_FATAL_BEGIN(text) { \
            HEAD("Move assign " #prefixA " (init=" #initA ") = " #prefixB " (init=" #initB ")"); \
            a = std::move(b); \
        } EXPECT_FATAL_END; \
    }

    TC_MOVE ($$, $$, 0, 0);
    TC_MOVE ($$, $$, 0, 1);
    TC_FATAL($$, $$, 1, 0, "Overriding instance reference.");
    TC_FATAL($$, $$, 1, 1, "Overriding instance reference.");

    TC_NEW ($, $$, 0, 0);
    TC_MOVE($, $$, 0, 1);
    TC_NEW ($, $$, 1, 0);
    TC_MOVE($, $$, 1, 1);

    TC_NEW ($N, $$, 0, 0);
    TC_MOVE($N, $$, 0, 1);
    TC_NEW ($N, $$, 1, 0);
    TC_MOVE($N, $$, 1, 1);

    TC_FATAL($$, $, 0, 0, "Accessing uninitialized nonnull reference.");
    TC_MOVE ($$, $, 0, 1);
    TC_FATAL($$, $, 1, 0, "Overriding instance reference.");
    TC_FATAL($$, $, 1, 1, "Overriding instance reference.");

    TC_MOVE($, $, 0, 0);
    TC_MOVE($, $, 0, 1);
    TC_MOVE($, $, 1, 0);
    TC_MOVE($, $, 1, 1);

    TC_FATAL($N, $, 0, 0, "Accessing uninitialized nonnull reference.");
    TC_MOVE ($N, $, 0, 1);
    TC_FATAL($N, $, 1, 0, "Accessing uninitialized nonnull reference.");
    TC_MOVE ($N, $, 1, 1);

    TC_FATAL($$, $N, 0, 0, "Assigning null reference to instance reference.");
    TC_MOVE ($$, $N, 0, 1);
    TC_FATAL($$, $N, 1, 0, "Overriding instance reference.");
    TC_FATAL($$, $N, 1, 1, "Overriding instance reference.");

    TC_FATAL($, $N, 0, 0, "Assigning null reference to nonnull reference.");
    TC_MOVE ($, $N, 0, 1);
    TC_FATAL($, $N, 1, 0, "Assigning null reference to nonnull reference.");
    TC_MOVE ($, $N, 1, 1);

    TC_MOVE($N, $N, 0, 0);
    TC_MOVE($N, $N, 0, 1);
    TC_MOVE($N, $N, 1, 0);
    TC_MOVE($N, $N, 1, 1);

#undef TC_EQ
#undef TC_FATAL
#undef TC_NULL
}

TEST_F(dollar, assign_object)
{
    {
        TestSimple obj1{.value = 123};
        TestSimple obj2{.value = 456};
        TestSimple obj3{.value = 789};
        TestSimple$$ a;
        TestSimple$ b;
        TestSimple$N c;
        a = obj1;
        b = obj2;
        c = obj3;
        EXPECT_EQ(a->value, 123);
        EXPECT_EQ(b->value, 456);
        EXPECT_EQ(c->value, 789);
    }
    {
        TestSimple obj1{.value = 123};
        TestSimple obj2{.value = 456};
        TestSimple obj3{.value = 789};
        TestSimple$$ a;
        TestSimple$ b;
        TestSimple$N c;
        a = std::move(obj1);
        b = std::move(obj2);
        c = std::move(obj3);
        EXPECT_EQ(a->value, 123);
        EXPECT_EQ(b->value, 456);
        EXPECT_EQ(c->value, 789);
    }
}

TEST_F(dollar, access)
{
    TestObject$ obj1 = TestObject();
    obj1->value = 123;

    {
        TestObject$$ a = obj1;
        EXPECT_EQ(&obj1->value, &a->value);
        EXPECT_EQ(&(*obj1).value, &(*a).value);
    }

    {
        TestObject$ a = obj1;
        EXPECT_EQ(&obj1->value, &a->value);
        EXPECT_EQ(&(*obj1).value, &(*a).value);
    }

    {
        TestObject$N a = obj1;
        EXPECT_EQ(&obj1->value, &a->value);
        EXPECT_EQ(&(*obj1).value, &(*a).value);
    }
}

TEST_F(dollar, null_access)
{
    TestObject$$ a;
    a->value = 123;
    TestObject$$ b;
    (*b).value = 123;

    EXPECT_FATAL_BEGIN("Dereferencing uninitialized nonnull reference.") {
        TestObject$ c;
        c->value = 123;
    } EXPECT_FATAL_END;

    EXPECT_FATAL_BEGIN("Dereferencing uninitialized nonnull reference.") {
        TestObject$ c;
        (*c).value = 123;
    } EXPECT_FATAL_END;

    EXPECT_FATAL_BEGIN("Dereferencing null reference.") {
        TestObject$N c;
        c->value = 123;
    } EXPECT_FATAL_END;

    EXPECT_FATAL_BEGIN("Dereferencing null reference.") {
        TestObject$N c;
        (*c).value = 123;
    } EXPECT_FATAL_END;

    EXPECT_FATAL_BEGIN("Default constructible class needed for reference implicit initialization.") {
        NoDefConstr$$ c;
        c->value = 123;
    } EXPECT_FATAL_END;

    EXPECT_FATAL_BEGIN("Default constructible class needed for reference implicit initialization.") {
        NoDefConstr$$ c;
        (*c).value = 123;
    } EXPECT_FATAL_END;
}

TEST_F(dollar, create)
{
#define TC(prefix) \
    { \
        NoDefConstr##prefix b; \
        b.createInplace(123); \
        EXPECT_NE(b._ptr, nullptr); \
        EXPECT_EQ(b->value, 123); \
        NoDefConstr##prefix c; \
        c = NoDefConstr##prefix::create(456); \
        EXPECT_NE(c._ptr, nullptr); \
        EXPECT_EQ(c->value, 456); \
        TestObject##prefix d; \
        d = new$; \
        EXPECT_NE(d._ptr, nullptr); \
        EXPECT_EQ(d->value, -1); \
        NoDefConstr##prefix e; \
        EXPECT_FATAL_BEGIN("Default constructible class needed for reference implicit initialization.") { \
            e = new$; \
        } EXPECT_FATAL_END; \
    }

    TC($$);
    TC($);
    TC($N);

    {
        NoDefConstr$$ b = NoDefConstr(1);
        EXPECT_FATAL_BEGIN("Overriding instance reference.") {
            HEAD("createInplace of $$");
            b.createInplace(123);
        } EXPECT_FATAL_END;
        NoDefConstr$$ c = NoDefConstr(2);
        EXPECT_FATAL_BEGIN("Overriding instance reference.") {
            HEAD("create of $$");
            c = NoDefConstr$$::create(456);
        } EXPECT_FATAL_END;
        HEAD("new of $$");
        TestObject$$ d = TestObject();
        EXPECT_FATAL_BEGIN("Overriding instance reference.") {
            d = new$;
        } EXPECT_FATAL_END;
        NoDefConstr$$ e = NoDefConstr(3);
        EXPECT_FATAL_BEGIN("Overriding instance reference.") {
            e = new$;
        } EXPECT_FATAL_END;
    }

#define TC2(prefix) \
    { \
        NoDefConstr##prefix b = NoDefConstr(1); \
        auto prev = b._ptr; \
        b.createInplace(123); \
        EXPECT_NE(b._ptr, nullptr); \
        EXPECT_NE(b._ptr, prev); \
        EXPECT_EQ(b->value, 123); \
        NoDefConstr##prefix c = NoDefConstr(2); \
        prev = c._ptr; \
        c = NoDefConstr##prefix::create(456); \
        EXPECT_NE(c._ptr, nullptr); \
        EXPECT_NE(c._ptr, prev); \
        EXPECT_EQ(c->value, 456); \
        TestObject##prefix d = TestObject(); \
        auto prev2 = d._ptr; \
        d = new$; \
        EXPECT_NE(d._ptr, nullptr); \
        EXPECT_NE(d._ptr, prev2); \
        EXPECT_EQ(d->value, -1); \
        NoDefConstr##prefix e = NoDefConstr(3); \
        EXPECT_FATAL_BEGIN("Default constructible class needed for reference implicit initialization.") { \
            e = new$; \
        } EXPECT_FATAL_END; \
    }

    TC2($);
    TC2($N);

#undef TC
#undef TC2
}

TEST_F(dollar, operator_equal_null)
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

TEST_F(dollar, operator_equal)
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

    {
        TestObject$ a;
        TestObject$ b;
        EXPECT_TRUE(a != b);
        EXPECT_FALSE(a == b);
        b = obj1;
        EXPECT_TRUE(a != b);
        EXPECT_FALSE(a == b);
        a = obj2;
        EXPECT_TRUE(a != b);
        EXPECT_FALSE(a == b);
        b = obj2;
        EXPECT_TRUE(a == b);
        EXPECT_FALSE(a != b);
    }

    {
        TestObject$N a;
        TestObject$N b;
        EXPECT_TRUE(a == b);
        EXPECT_FALSE(a != b);
        b = obj1;
        EXPECT_TRUE(a != b);
        EXPECT_FALSE(a == b);
        a = obj2;
        EXPECT_TRUE(a != b);
        EXPECT_FALSE(a == b);
        b = obj2;
        EXPECT_TRUE(a == b);
        EXPECT_FALSE(a != b);
    }

}

DOLLAR_STRUCT(Parent);
DOLLAR_STRUCT(SecondParent);
DOLLAR_STRUCT(Child);
DOLLAR_STRUCT(Grandchild);
DOLLAR_STRUCT(ChildOfTwo);
struct Parent { int x; };
struct SecondParent { int z; };
struct Child : public Parent { int y; };
DOLLAR_INHERIT(Parent, Child);
struct Grandchild : public Child { int z; };
DOLLAR_INHERIT(Child, Grandchild);
struct ChildOfTwo : public Parent, SecondParent { int y; };
DOLLAR_INHERIT(Parent, ChildOfTwo);

TEST_F(dollar, cast)
{
#define TC(prefix) \
    { \
        Child##prefix x = new$; \
        Parent$N p = x.cast<Parent>(); \
        EXPECT_EQ((void*)x._ptr, (void*)p._ptr); \
    } \
    { \
        ChildOfTwo##prefix x = new$; \
        Parent$N p = x.cast<Parent>(); \
        EXPECT_EQ((void*)x._ptr, (void*)p._ptr); \
        EXPECT_FATAL_BEGIN("Casting to non-first parent or unsupported platform or compiler.") { \
            SecondParent$N p2 = x.cast<SecondParent>(); \
        } EXPECT_FATAL_END; \
    }

    TC($$);
    TC($);
    TC($N);

    {
        Child$$ x;
        Parent$N p = x.cast<Parent>();
        EXPECT_NE(x._ptr, nullptr);
        EXPECT_EQ((void*)x._ptr, (void*)p._ptr);
    }

    {
        Child$ x;
        EXPECT_FATAL_BEGIN("Accessing uninitialized nonnull reference.") {
            Parent$N p = x.cast<Parent>();
        } EXPECT_FATAL_END;
    }

    {
        Child$N x;
        Parent$N p = x.cast<Parent>();
        EXPECT_EQ(x._ptr, nullptr);
        EXPECT_EQ(p._ptr, nullptr);
    }

#undef TC
}


TEST_F(dollar, dynamicCast)
{
#define TC(prefix) \
    { \
        Parent##prefix xg = Grandchild$::create().cast<Parent>(); \
        Parent##prefix xc = Child$::create().cast<Parent>(); \
        Parent##prefix xp = new$; \
        { \
            EXPECT_TRUE(xg.canCast<Parent>()); \
            EXPECT_TRUE(xc.canCast<Parent>()); \
            EXPECT_TRUE(xp.canCast<Parent>()); \
            Parent##prefix g = xg.cast<Parent>(); \
            Parent##prefix c = xc.cast<Parent>(); \
            Parent##prefix p = xp.cast<Parent>(); \
        } \
        { \
            EXPECT_TRUE(xg.canCast<Child>()); \
            EXPECT_TRUE(xc.canCast<Child>()); \
            EXPECT_FALSE(xp.canCast<Child>()); \
            Child##prefix g = xg.cast<Child>(); \
            Child##prefix c = xc.cast<Child>(); \
            EXPECT_FATAL_BEGIN("Cannot do dynamic casting.") { \
                Child##prefix p = xp.cast<Child>(); \
            } EXPECT_FATAL_END; \
        } \
        { \
            EXPECT_TRUE(xg.canCast<Grandchild>()); \
            EXPECT_FALSE(xc.canCast<Grandchild>()); \
            EXPECT_FALSE(xp.canCast<Grandchild>()); \
            Grandchild##prefix g = xg.cast<Grandchild>(); \
            EXPECT_FATAL_BEGIN("Cannot do dynamic casting.") { \
                Grandchild##prefix c = xc.cast<Grandchild>(); \
            } EXPECT_FATAL_END; \
            EXPECT_FATAL_BEGIN("Cannot do dynamic casting.") { \
                Grandchild##prefix p = xp.cast<Grandchild>(); \
            } EXPECT_FATAL_END; \
        } \
    }

    TC($$);
    TC($);
    TC($N);

#undef TC
}

TEST_F(dollar, any)
{
#define TC(prefix) \
    { \
        any##prefix x = Grandchild$::create().any(); \
        EXPECT_TRUE(x.canCast<Grandchild>()); \
        EXPECT_TRUE(x.canCast<Child>()); \
        EXPECT_TRUE(x.canCast<Parent>()); \
        EXPECT_FALSE(x.canCast<ChildOfTwo>()); \
        Grandchild##prefix xGrandchild = x.cast<Grandchild>(); \
        Child##prefix xChild = x.cast<Child>(); \
        Parent##prefix xParent = x.cast<Parent>(); \
        EXPECT_FATAL_BEGIN("Cannot do dynamic casting.") { \
            ChildOfTwo##prefix xChildOfTwo = x.cast<ChildOfTwo>(); \
        } EXPECT_FATAL_END; \
    } \
    { \
        any##prefix x = Child$::create().any(); \
        EXPECT_FALSE(x.canCast<Grandchild>()); \
        EXPECT_TRUE(x.canCast<Child>()); \
        EXPECT_TRUE(x.canCast<Parent>()); \
        EXPECT_FALSE(x.canCast<ChildOfTwo>()); \
        EXPECT_FATAL_BEGIN("Cannot do dynamic casting.") { \
            Grandchild##prefix xGrandchild = x.cast<Grandchild>(); \
        } EXPECT_FATAL_END; \
        Child##prefix xChild = x.cast<Child>(); \
        Parent##prefix xParent = x.cast<Parent>(); \
        EXPECT_FATAL_BEGIN("Cannot do dynamic casting.") { \
            ChildOfTwo##prefix xChildOfTwo = x.cast<ChildOfTwo>(); \
        } EXPECT_FATAL_END; \
    }

    TC($);
    TC($N);

#undef TC
}

TEST_F(dollar, raw)
{
    void* ptr;
    {
        TestSimple$$ x;
        x->value = 12;
        ptr = x.exportOpaquePtr();
    }
    EXPECT_EQ(((TestSimple$::Inner*)ptr)->counter, 1);
    {
        TestSimple$ x = TestSimple$::importOpaquePtr(ptr, false);
        EXPECT_EQ(x->value, 12);
    }
    EXPECT_FATAL_BEGIN("Importing raw pointer from invalid type.") {
        Grandchild$ x = Grandchild$::importOpaquePtr(ptr, true);
    } EXPECT_FATAL_END;
    {
        TestSimple$ x = TestSimple$::importOpaquePtr(ptr, true);
        EXPECT_EQ(x._ptr->counter, 1);
        EXPECT_EQ(x->value, 12);
    }
    EXPECT_FATAL_BEGIN("Importing null raw pointer to not nullable reference.") {
        TestSimple$ x = TestSimple$::importOpaquePtr(nullptr, true);
    } EXPECT_FATAL_END;
}

// TODO: Add test cases that will fail in compilation time

#include "dollar.cc"
