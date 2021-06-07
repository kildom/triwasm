
#include "common.hh"

#include <string>
#include <cstdio>

#if 0
struct FuncType {
    Array<Type$> param;
    Array<Type$> result;
};
DEFINE_REF(FuncType);
struct Function;
typedef $<Function> Function$;
typedef $$<Function> Function$$;
struct Function {
    u32 index;
    bool imported;
    u32 typeIndex;
    FuncType$ type;
    Array<Type$> locals;
    Block$$ body;
    String module;
    String name;
    struct Inner {
        u32 a;
        u32 b;
    };
    Array<Inner$>
}

template <typename T>
struct ArrayView {
    Array<T> array;
    size_t offset;
    size_t length;
};

template <typename T>
class ArrayInner {
// std::vector wrapper, including begin and end methods for Range-based for loop
    bool isView;
    size_t buffer[MAX((sizeof(std::vector<T>) + sizeof(size_t) - 1) / sizeof(size_t),
                      (sizeof(ArrayView<T>) + sizeof(size_t) - 1) / sizeof(size_t))];
    std::vector<T>& vect() {
        return *(std::vector<T>*)buffer;
    }
    ArrayView<T>& view() {
        return *(ArrayView<T>*)buffer;
    }
    //...
};

template <typename T>
class Array : public $<ArrayInner<T>, false>
{
public:
    T& operator[] (size_t index) {
        return (**this)[index];
    }
    Array operator[] (const range& r) {
        // returns new Array view if range is continues, new Array if not (i.e. step != 1)
    }
    void copy(Array a, size_t length, size_t srcOffset, size_t dstOffset);
};

template <typename T>
class ArrayView
{
public:
    Array<T> array;
    size_t offset; // or begin / end
    size_t length;
    // the same API as Array, but operates on subset of original array
    // TODO: checks if view length is still valid and changes it if original array shrinked
};
#endif

DOLLAR_STRUCT(Test1);

struct Test1
{
    int a;
    int b;
    int c;
    Test1() : a(-1), b(-1), c(-1) {}
    Test1(int a, int b, int c) : a(a), b(b), c(c) {}
};

int main(int argc, char *argv[]) {

    /*Test1$ not_null = Test1{1, 2, 3};
    Test1$ x;
    not_null->c++;
    x->c++;
    not_null = x;
    Test1$$ y;
    printf("%d\n", y == x);
    x = y;
    printf("%d", y == x);*/

    $<std::vector<s32>> v;

    v = $<std::vector<s32>>::create(std::initializer_list<s32>{1, 2, 3});

    Test1$ c = Test1$::create(1,2,3);

    for (auto i : Range((uint8_t)2).bound(20)) {
        printf("--%d\n", (int)i);
    }

    printf("%d %d %d %d\n", -1, (*v)[0], (*v)[1], (*v)[2]);
    //Test1$$ nullable;

    Array$<int> a = {1, 2, 3};
    Array$<int> b;

    a = { 4,5 ,8};

    auto av = a[Range(1)];
    av[0];

    printf("%d %d %d %d\n", av[0], a[0], a[1], a[2]);
    #if 0

    // TODO:

    Array<int> a = {0,1,2,3,4,5,6,7,8};
    auto view = a[range(2, 5)]; // returns ArrayView {2,3,4}

    for (auto i: range(2, 5)) {
        // Loop from 2 to 5 (exclusive)
    }

    for (auto item: view) {
        // Loop over the ArrayView items
    }

    for (auto item: a[range(2, 5)]) {
        // Loop over subset of the Array items
    }

    for (auto item: a[range(1, end - 1)]) {
        // Loop over the Array items except first and last
    }

    for (auto item: a[range(1)]) {
        // Loop over the Array items except first
    }

    for (auto i: range(1, range::end - 1)) { // FAIL: end is unknown in this context
    }

    for (auto i: range(1)) {// FAIL: end is unknown in this context
    }

    a[Range(1, 3)] = a[Range(4)];
    Array$<int> sub = a[Range(1, 3)];

    int a, b, c;
    RefArray(&a, &b, &c) = tab[Range(0, 3)];

    #endif

    return 0;

}
