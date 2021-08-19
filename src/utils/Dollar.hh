#ifndef _DOLLAR_HH_
#define _DOLLAR_HH_

#include "Utils.hh"

#define DOLLAR_TYPEDEF(Class, ...) \
    typedef $<Class, false, ##__VA_ARGS__> Class##$; \
    typedef $<Class, true, ##__VA_ARGS__> Class##$$ // TODO: Reconsider keeping just one variant: nullable only

#define DOLLAR_CLASS(Class, ...) \
    typedef $<class Class, false, ##__VA_ARGS__> Class##$; \
    typedef $<class Class, true, ##__VA_ARGS__> Class##$$

#define DOLLAR_STRUCT(Struct, ...) \
    typedef $<struct Struct, false, ##__VA_ARGS__> Struct##$; \
    typedef $<struct Struct, true, ##__VA_ARGS__> Struct##$$

class any$;

class _$_New$ { };

static const _$_New$ new$;

template<typename T, bool vd>
struct _$_Inner;

template<typename T>
struct _$_Inner<T, false> {
    size_t counter;
    T data;
    template<typename... Args>
    _$_Inner(Args&&... args) : data(std::forward<Args>(args)...) {
    }
    /*~_$_Inner() {
        printf("DELETE: %p\n", &data);
    }*/
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

template<typename T, bool nullable = false, bool vd = false>
class $ {
public:
    typedef _$_Inner<T, vd> Inner;
    mutable Inner *_ptr;

    $() : _ptr(nullptr) {
    }

    $(nullptr_t) : _ptr(nullptr) { }

    $(const $ &a) : _ptr(a._ptr) {
        if (_ptr)
            _ptr->counter++;
    }

    $(const $<T, !nullable, vd> &a) : _ptr(a._ptr) {
        if (_ptr)
            _ptr->counter++;
    }

    $($ &&a) : _ptr(a._ptr) {
        a._ptr = nullptr;
    }

    $($<T, !nullable, vd> &&a) : _ptr(a._ptr) {
        a._ptr = nullptr;
    }

    $(const T& a) : _ptr(new Inner(a)) {
        _ptr->counter = 1;
     }

    $(Inner* a) : _ptr(a) { }

    $(_$_New$) : _ptr(new Inner()) {
        _ptr->counter = 1;
    }

    $(any$* anyPtr);

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

    $& operator=(const $<T, !nullable, vd>& a) {
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

    $& operator=($<T, !nullable, vd>&& a) {
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

    $& operator=(_$_New$) {
        createInplace();
        return *this;
    }

    T* operator->() const {
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

    friend bool operator==(const $& a, const $<T, !nullable, vd>& b)
    {
        return a._ptr == b._ptr;
    }

    friend bool operator!=(const $& a, const $& b)
    {
        return a._ptr != b._ptr;
    }

    friend bool operator!=(const $& a, const $<T, !nullable, vd>& b)
    {
        return a._ptr != b._ptr;
    }

    template<typename... Args>
    static $ create(Args&&... args) {
        Inner *a = new Inner(std::forward<Args>(args)...);
        a->counter = 1;
        return $(a);
    }

    template<typename... Args>
    void createInplace(Args&&... args) {
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = new Inner(std::forward<Args>(args)...);
        _ptr->counter = 1;
    }

    bool assertNotNull() {
        if (!_ptr && nullable) {
            ASSERT("Expecting not nullptr");
        }
    }

    template<typename T2>
    $<T2, nullable, std::has_virtual_destructor<T2>::value> cast() {
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
        return $<T2, nullable, std::has_virtual_destructor<T2>::value>(inner);
    }

    template<typename T2>
    $<T2, nullable, std::has_virtual_destructor<T2>::value> castUnsafe() {
        typedef _$_Inner<T2, std::has_virtual_destructor<T2>::value> Inner2;
        T2* p = (T2*)&_ptr->data;
        if ((void*)p != (void*)&_ptr->data) {
            FATAL("Only cast to first parent is allowed");
        }
        ssize offset = (u8*)&_ptr->data - (u8*)_ptr;
        Inner2* inner = (Inner2*)((u8*)p - offset);
        if ((void*)&inner->counter != (void*)&_ptr->counter) {
            FATAL("Some unconventional platform or compiler");
        }
        inner->counter++;
        return $<T2, nullable, std::has_virtual_destructor<T2>::value>(inner);
    }

};

template<typename T>
using $$ = $<T, true>;

struct anyInnerBase {
    void* typeId;
    virtual ~anyInnerBase() { }
};

class any$ {
public:
    $<anyInnerBase, true, true> ptr;
    operator any$*()
    {
        return this;
    }
};

template<typename T, bool vd>
struct _any$Inner : public anyInnerBase {
    $<T, true, vd> ptr;
    static int typeIdField;
};

template<typename T, bool vd>
int _any$Inner<T, vd>::typeIdField;

template<typename T, bool nullable, bool vd>
$<T, nullable, vd>::$(any$ * anyPtr) {
    auto &any = *anyPtr;
    if (any.ptr == nullptr) {
        _ptr = nullptr;
        if (!nullable) {
            createInplace();
            auto p = $<_any$Inner<T, vd>, true, true>::create();
            p->ptr = *this;
            p->typeId = &_any$Inner<T, vd>::typeIdField;
            any.ptr = p.template cast<anyInnerBase>();
        }
    } else if (any.ptr->typeId == &_any$Inner<T, vd>::typeIdField) {
        auto p = any.ptr.castUnsafe<_any$Inner<T, vd>>();
        _ptr = p->ptr._ptr;
        if (_ptr)
            _ptr->counter++;
    } else {
        ASSERT("Expected different type");
    }
}

#endif /* _DOLLAR_HH_ */
