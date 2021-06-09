#ifndef _DOLLAR_HH_
#define _DOLLAR_HH_

#include "common.hh"

#define DOLLAR_TYPEDEF(Class) \
    typedef $<Class> Class##$; \
    typedef $<Class, true> Class##$$

#define DOLLAR_CLASS(Class) \
    typedef $<class Class> Class##$; \
    typedef $<class Class, true> Class##$$

#define DOLLAR_STRUCT(Struct) \
    typedef $<struct Struct> Struct##$; \
    typedef $<struct Struct, true> Struct##$$

template<typename T, bool virtualDestructor>
struct _$_Inner;

template<typename T>
struct _$_Inner<T, false> {
    size_t counter;
    T data;
    template<typename... Args>
    _$_Inner(Args&&... args) : data(std::forward<Args>(args)...) { }
};

template<typename T>
struct _$_Inner<T, true> {
    size_t counter;
    T data;
    template<typename... Args>
    _$_Inner(Args&&... args) : data(std::forward<Args>(args)...) { }
    virtual ~_$_Inner() { }
};

template<class Inner, bool nullable2>
struct _$_DefaultInnerCreator;

template<class Inner>
struct _$_DefaultInnerCreator<Inner, true>
{
    static Inner* createInner() {
        return NULL;
    }
};

template<class Inner>
struct _$_DefaultInnerCreator<Inner, false>
{
    static Inner* createInner() {
        return new Inner();
    }
};

template<typename T, bool nullable = false>
class $ {
public:
    typedef _$_Inner<T, std::has_virtual_destructor<T>::value> Inner;
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

    $(const T& a) : _ptr(new Inner(a)) {
        _ptr->counter = 1;
     }

    $(Inner* a) : _ptr(a) { }

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
        _ptr = new Inner(a);
        _ptr->counter = 1;
        return *this;
    }

    T* operator->() {
        if (!_ptr) {
            if (!nullable) {
                _ptr = _$_DefaultInnerCreator<Inner, nullable>::createInner();
                _ptr->counter = 1;
            } else
                ASSERT("Dereferencing nullptr");
        }
        return &_ptr->data;
    }

    T& operator*() {
        if (!_ptr) {
            if (!nullable) {
                _ptr = _$_DefaultInnerCreator<Inner, nullable>::createInner();
                _ptr->counter = 1;
            } else
                ASSERT("Dereferencing nullptr");
        }
        return _ptr->data;
    }

    bool operator!() {
        return !_ptr;
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

    template<typename... Args>
    static $ create(Args&&... args) {
        Inner *a = new Inner(std::forward<Args>(args)...);
        a->counter = 1;
        return $(a);
    }

    bool assertNotNull() {
        if (!_ptr && nullable) {
            ASSERT("Expecting not nullptr");
        }
    }

    template<typename T2>
    $<T2> cast() {
        typedef _$_Inner<T2, std::has_virtual_destructor<T2>::value> Inner2;
        T2* p = &_ptr->data;
        if ((void*)p != (void*)&_ptr->data) {
            FATAL("Only cast to first parent is allowed");
        }
        ssize offset = (u8*)&_ptr->data - (u8*)_ptr;
        Inner2* inner = (Inner2*)((u8*)p - offset);
        if ((void*)&inner->counter != (void*)&_ptr->counter) {
            FATAL("Some unconventional platform or compiler");
        }
        inner->counter++;
        return $<T2>(inner);
    }

};


#endif /* _DOLLAR_HH_ */
