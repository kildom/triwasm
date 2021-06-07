
#include "Vector.hh"

#include <string>

#include <stdio.h>

void f(std::initializer_list<int> a) {

}

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
#endif

template<typename T>
struct _$_Inner {
    size_t counter;
    T data;
};

template<typename T, bool nullable = false>
class $ {
public:
    typedef _$_Inner<T> Inner;
    Inner *_ptr;

    $() : _ptr(nullptr) { }

    $(nullptr_t) : _ptr(nullptr) { }

    $(const $ &a) : _ptr(a._ptr) {
        if (_ptr)
            _ptr->counter++;
    }

    $(const $<T, !nullable> &a) : _ptr(a._ptr) {
        if (_ptr)
            _ptr->counter++;
    }

    $($ &&a) : _ptr(a._ptr) {
        a._ptr = nullptr;
    }

    $($<T, !nullable> &&a) : _ptr(a._ptr) {
        a._ptr = nullptr;
    }

    $(const T& a) : _ptr(new Inner{1, a}) { }

    ~$() {
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
    }

    $& operator=(nullptr_t) {
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = nullptr;
        return *this;
    }

    $& operator=(const $& a) {
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = a._ptr;
        if (_ptr)
            _ptr->counter++;
        return *this;
    }

    $& operator=(const $<T, !nullable>& a) {
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = a._ptr;
        if (_ptr)
            _ptr->counter++;
        return *this;
    }

    $& operator=($&& a) {
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = a._ptr;
        a._ptr = nullptr;
        return *this;
    }

    $& operator=($<T, !nullable>&& a) {
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = a._ptr;
        a._ptr = nullptr;
        return *this;
    }

    $& operator=(const T& a) {
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = new Inner{.counter = 1, .data = a};
        return *this;
    }

    T* operator->() {
        if (!_ptr) {
            if (!nullable)
                _ptr = new Inner{.counter = 1};
            else
                ASSERT("Dereferencing nullptr");
        }
        return &_ptr->data;
    }

    T& operator*() {
        if (!_ptr) {
            if (!nullable)
                _ptr = new Inner{.counter = 1};
            else
                ASSERT("Dereferencing nullptr");
        }
        return _ptr->data;
    }

    bool operator!() {
        return !_ptr;
    }

    operator bool() {
        return !!_ptr;
    }

    friend bool operator==(const $& a, nullptr_t)
    {
        return a._ptr == nullptr;
    }

    friend bool operator!=(const $& a, nullptr_t)
    {
        return a._ptr != nullptr;
    }

    friend bool operator==(nullptr_t, const $& a)
    {
        return a._ptr == nullptr;
    }

    friend bool operator!=(nullptr_t, const $& a)
    {
        return a._ptr != nullptr;
    }

    friend bool operator==(const $& a, const $& b)
    {
        return a._ptr == b._ptr;
    }

    friend bool operator==(const $& a, const $<T, !nullable>& b)
    {
        return a._ptr == b._ptr;
    }

    friend bool operator!=(const $& a, const $& b)
    {
        return a._ptr != b._ptr;
    }

    friend bool operator!=(const $& a, const $<T, !nullable>& b)
    {
        return a._ptr != b._ptr;
    }

};

#define DOLLAR_DEF(kind, Class) \
    typedef $<kind Class> Class##$; \
    typedef $<kind Class, true> Class##$$

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
class ArrayViewInner {
    Array<T> array;
    size_t offset;
    size_t length;
};

template <typename T>
class ArrayView : public $<ArrayViewInner<T>, false>
{
public:
    // the same API as Array, but operates on subset of original array
    // TODO: checks if view length is still valid and changes it if original array shrinked
};

DOLLAR_DEF(struct, Test1);

struct Test1
{
    int a;
    int b;
    int c;
};


int main(int argc, char *argv[]) {

    Test1$ not_null = Test1{1, 2, 3};
    Test1$ x;
    not_null->c++;
    x->c++;
    not_null = x;
    Test1$$ y;
    printf("%d\n", y == x);
    x = y;
    printf("%d", y == x);

    Array<int> a;

    printf("%d %d %d %d", -1, not_null->a, not_null->b, not_null->c);
    //Test1$$ nullable;

    #if 0

    // TODO:

    Array<int> a = {0,1,2,3,4,5,6,7,8};
    auto view = a[range(2, 5)]; // returns ArrayView {2,3,4}
    auto rev = a[range(5, 2, -1)]; // returns ArrayView {5,4,3}, but original array is copied and reordered

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


    #endif

    return 0;

}
