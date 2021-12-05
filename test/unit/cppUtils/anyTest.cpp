
#include "gtest/gtest.h"

#include <stdio.h>

#include <iostream>
#include <type_traits>

#define FATAL(...)

#include "dollar.hh"

struct TestObject1 { };
struct TestObject2 { };
struct TestObject3 { };

struct TestChild1 : public TestObject1 { };

DOLLAR_INHERIT(TestObject1, TestChild1);

TEST(aa, aa)
{
    std::cout << "TestObject1: " << _DollarTypeIdHelper<TestObject1>::getId() << "\n";
    std::cout << "TestObject2: " << _DollarTypeIdHelper<TestObject2>::getId() << "\n";
    std::cout << "TestObject3: " << _DollarTypeIdHelper<TestObject3>::getId() << "\n";
    //std::cout << "TestChild1: " << _DollarTypeIdHelper<TestObject1>::isChildOf(_DollarTypeIdHelper<TestObject1>::getId()) << "\n";
    //std::cout << "TestChild1: " << _DollarTypeIdHelper<TestObject1>::isChildOf(_DollarTypeIdHelper<TestObject2>::getId()) << "\n";
    std::cout << "TestChild1: " << _DollarTypeIdHelper<TestObject1>::isChildOf(_DollarTypeIdHelper<TestChild1>::getId()) << "\n";
    std::cout << "TestChild1: " << _DollarTypeIdHelper<TestObject2>::isChildOf(_DollarTypeIdHelper<TestChild1>::getId()) << "\n";
}
