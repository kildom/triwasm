#ifndef _TEST_COMMON_H_
#define _TEST_COMMON_H_

#include <stdlib.h>

#include "trace.hh"
#include "types.hh"

#define private public
#define protected public
#undef FATAL
#define FATAL(text, ...) testFatal(text)

#if 0
#define DBG(text, ...) printf(text "\n", ##__VA_ARGS__)
#define HEAD(text, ...) printf("\x1b[34m" text "\x1b[0m\n", ##__VA_ARGS__)
#define WARNING(text, ...) printf("\x1b[33m" text "\x1b[0m\n", ##__VA_ARGS__)
#define ERROR(text, ...) printf("\x1b[31m" text "\x1b[0m\n", ##__VA_ARGS__)
#else
#define DBG(text, ...) do { } while (0)
#define HEAD(text, ...) do { } while (0)
#define WARNING(text, ...) do { } while (0)
#define ERROR(text, ...) do { } while (0)
#endif

#define EXPECT_FATAL_BEGIN(text) try { ExpectFatalHere _ex_1025953_(text);
#define EXPECT_FATAL_END EXPECT_TRUE(false) << "Expected fatal error did not happen!"; } catch (ExpectedFatal) {};

#define DBG_NEW test_new
#define DBG_DELETE test_delete

class TestBase : public ::testing::Test {
protected:
    void SetUp() override;
    void TearDown() override;
};

struct ExpectFatalHere {
    ExpectFatalHere(const char *text);
    ~ExpectFatalHere();
};
struct ExpectedFatal {};
struct UnexpectedFatal {};

void testFatal(const char* text);
void* test_new(usize size);
void test_delete(void* ptr);

#endif // _TEST_COMMON_H_
