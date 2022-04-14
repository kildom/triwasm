
#include "gtest/gtest.h"

#include "trace.hh"

#include "testCommon.h"

#include "dollar.hh"
#include "string.hh"

class regex : public TestBase { };

struct NoDefConstr{
    NoDefConstr(int a, int b) : x(a + b) {}
    int x;
};

TEST_F(regex, create)
{
    RegEx$ a = R"/()/"_Ri;
    RegEx$ b("To jest test");
    EXPECT_TRUE(String$("test").isMatch("Te.t"_Ri));
    EXPECT_FALSE(String$("test").isMatch("Test"_R));
    auto groups = String$("test").match("(.E)(s.)(.)?"_Ri);
    EXPECT_NE(groups, nullptr);
    EXPECT_EQ(groups.length(), 4);
    EXPECT_TRUE(groups[0].valid());
    EXPECT_TRUE(groups[1].valid());
    EXPECT_TRUE(groups[2].valid());
    EXPECT_FALSE(groups[3].valid());
    EXPECT_EQ(groups[0], "test");
    EXPECT_EQ(groups[1], "te");
    EXPECT_EQ(groups[2], "st");
    EXPECT_TRUE(String$("-test-")[1 |R|| 1].isMatch("Te.t"_Ri));
    EXPECT_FALSE(String$("-test-")[1 |R|| 1].isMatch("Test"_R));
    groups = String$("--test---")[2 |R|| 3].match("(.E)(s.)(.)?"_Ri);
    EXPECT_NE(groups, nullptr);
    EXPECT_EQ(groups.length(), 4);
    EXPECT_TRUE(groups[0].valid());
    EXPECT_TRUE(groups[1].valid());
    EXPECT_TRUE(groups[2].valid());
    EXPECT_FALSE(groups[3].valid());
    EXPECT_EQ(groups[0], "test");
    EXPECT_EQ(groups[1], "te");
    EXPECT_EQ(groups[2], "st");

    EXPECT_TRUE(String$("This is test!").isSearch("Te.t"_Ri));
    EXPECT_FALSE(String$("This is test!").isSearch("Test"_R));
    groups = String$("This is test!").search("(.E)(s.)(..)?"_Ri);
    EXPECT_NE(groups, nullptr);
    EXPECT_EQ(groups.length(), 6);
    EXPECT_TRUE(groups[0].valid());
    EXPECT_TRUE(groups[1].valid());
    EXPECT_TRUE(groups[2].valid());
    EXPECT_FALSE(groups[3].valid());
    EXPECT_TRUE(groups[4].valid());
    EXPECT_TRUE(groups[5].valid());
    EXPECT_EQ(groups[0], "test");
    EXPECT_EQ(groups[1], "te");
    EXPECT_EQ(groups[2], "st");
    EXPECT_EQ(groups[4], "This is ");
    EXPECT_EQ(groups[5], "!");

    groups = "This is test!"_S.search("i(j?)"_Ri);
    EXPECT_TRUE(groups[0].valid());
    EXPECT_TRUE(groups[1].valid());
    EXPECT_TRUE(groups[2].valid());
    EXPECT_TRUE(groups[3].valid());
    

    EXPECT_EQ("this is test!"_S.replace("(^|\\s)T"_Ri, "$1T"), "This is Test!");
    EXPECT_EQ("this is test!"_S.replace("(^|\\s)T"_Ri, "$1T", false), "This is test!");
    EXPECT_EQ("this is test!"_S.replace("(^|\\s)T"_Ri, "$1T", true, false), "T T");
    EXPECT_EQ("this is test!"_S.replace("(^|\\s)T"_Ri, "$1T", false, false), "T");

    EXPECT_EQ("This is test!"_S.searchAll("X"_Ri).length(), 0);
    auto all = "This is test!"_S.searchAll("T(...)"_Ri);
    EXPECT_EQ(all.length(), 2);
    EXPECT_EQ(all[0].length(), 4);
    EXPECT_EQ(all[1].length(), 4);
    EXPECT_EQ(all[0][0], "This");
    EXPECT_EQ(all[0][1], "his");
    EXPECT_EQ(all[0][2], "");
    EXPECT_EQ(all[0][3], " is test!");
    EXPECT_EQ(all[1][0], "test");
    EXPECT_EQ(all[1][1], "est");
    EXPECT_EQ(all[1][2], " is ");
    EXPECT_EQ(all[1][3], "!");

    auto test1 = "This is test!"_S;
    test1[4 |R] = test1[4 |R].replace("s"_Ri, "{S}");
    EXPECT_EQ(test1, "This i{S} te{S}t!");

    RegEx$::clearLiteralCache();
}
