
#include <stdlib.h>
#include <string>

#include "gtest/gtest.h"

#include "testCommon.h"


static bool testRunning = false;
static const char* expectFatal = NULL;
static std::set<uintptr_t> allocated;
static uintptr_t allocBuffer[4 * 1024 * 1024];
static uintptr_t* allocPtr;


void testFatal(const char* text) {
    std::string fatalText(text);
    if (!testRunning) {
        printf("Unexpected FATAL outside test: %s\n", text);
        exit(99);
    } else if (expectFatal) {
        std::string expectedText(expectFatal);
        if (fatalText == expectedText) {
            WARNING("EXPECTED FATAL: %s", text);
        } else {
            ERROR("DIFFERENT FATAL: %s", text);
        }
        EXPECT_EQ(fatalText, expectedText);
        throw ExpectedFatal();
    } else {
        std::string expectedText;
        ERROR("UNEXPECTED FATAL: %s", text);
        EXPECT_EQ(fatalText, expectedText);
        throw UnexpectedFatal();
    }
}


ExpectFatalHere::ExpectFatalHere(const char *text) { expectFatal = text; }
ExpectFatalHere::~ExpectFatalHere() { expectFatal = NULL; }


void* test_new(usize size) {
    void* ptr = (void*)allocPtr;
    allocPtr += (size + sizeof(uintptr_t) - 1) / sizeof(uintptr_t);
    EXPECT_TRUE((uint8_t*)allocPtr <= (uint8_t*)allocBuffer + sizeof(allocBuffer));
    allocated.insert((uintptr_t)ptr);
    DBG("    malloc %p,   size %d", ptr, (int)size);
    return ptr;
}


void test_delete(void* ptr) {
    DBG("    free %p", ptr);
    if (allocated.find((uintptr_t)ptr) == allocated.end()) {
        FATAL("Deleting invalid pointer.");
    }
    allocated.erase((uintptr_t)ptr);
}


void TestBase::SetUp() {
    testRunning = true;
    allocated.clear();
    allocPtr = allocBuffer;
}


void TestBase::TearDown() {
    for (auto ptr : allocated) {
        DBG("Not deleted pointer %p", (void*)ptr);
    }
    EXPECT_EQ(allocated.size(), 0u) << "Memory leak detected!";
    testRunning = false;
}
