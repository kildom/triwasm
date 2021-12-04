#ifndef _DOLLAR_HH_
#define _DOLLAR_HH_

#include <stdint.h>
#include <stddef.h>
#include <utility>

#include "trace.hh"

#ifndef DBG
#define DBG(...) do { } while (0)
#endif

enum DollarRefType {
    DOLLAR_INSTANCE = 0,
    DOLLAR_NOT_NULL = 1,
    DOLLAR_NULLABLE = 2,
};

#define DOLLAR_TYPEDEF(Class) \
    typedef $<Class, DOLLAR_NOT_NULL> Class##$; \
    typedef $<Class, DOLLAR_INSTANCE> Class##$$; \
    typedef $<Class, DOLLAR_NULLABLE> Class##$N

#define DOLLAR_CLASS(Class) \
    typedef $<class Class, DOLLAR_NOT_NULL> Class##$; \
    typedef $<class Class, DOLLAR_INSTANCE> Class##$$; \
    typedef $<class Class, DOLLAR_NULLABLE> Class##$N

#define DOLLAR_STRUCT(Struct) \
    typedef $<struct Struct, DOLLAR_NOT_NULL> Struct##$; \
    typedef $<struct Struct, DOLLAR_INSTANCE> Struct##$$; \
    typedef $<struct Struct, DOLLAR_NULLABLE> Struct##$N

template<DollarRefType refType = DOLLAR_NOT_NULL>
class any$;

template<typename T, bool vd>
struct _$_Inner;

template<typename T>
struct _$_Inner<T, false> {
    size_t counter;
    T data;
    template<typename... Args>
    _$_Inner(Args&&... args) : counter(1), data(std::forward<Args>(args)...) { }
#ifdef DBG_NEW
    void* operator new(size_t size) {
        return DBG_NEW(size);
    }
    void operator delete(void* ptr) {
        DBG_DELETE(ptr);
    }
#endif
};

template<typename T>
struct _$_Inner<T, true> {
    size_t counter;
    T data;
    template<typename... Args>
    _$_Inner(Args&&... args) : counter(1), data(std::forward<Args>(args)...) { }
    virtual ~_$_Inner() { }
#ifdef DBG_NEW
    void* operator new(size_t size) {
        return DBG_NEW(size);
    }
    void operator delete(void* ptr) {
        DBG_DELETE(ptr);
    }
#endif
};

struct _DollarDummyClass { };

template <DollarRefType refType, class InstanceCls, class NotNullCls, class NullableCls>
struct _DollarRefTypeSelect;

template <class InstanceCls, class NotNullCls, class NullableCls>
struct _DollarRefTypeSelect<DOLLAR_INSTANCE, InstanceCls, NotNullCls, NullableCls> {
    typedef InstanceCls type;
};

template <class InstanceCls, class NotNullCls, class NullableCls>
struct _DollarRefTypeSelect<DOLLAR_NOT_NULL, InstanceCls, NotNullCls, NullableCls> {
    typedef NotNullCls type;
};

template <class InstanceCls, class NotNullCls, class NullableCls>
struct _DollarRefTypeSelect<DOLLAR_NULLABLE, InstanceCls, NotNullCls, NullableCls> {
    typedef NullableCls type;
};

template<typename T, bool def = std::is_default_constructible<T>::value>
struct _dollarDefaultCreate;

template<typename T>
struct _dollarDefaultCreate<T, false>
{
    typedef _$_Inner<T, std::has_virtual_destructor<T>::value> Inner;
    static Inner* create() {
        FATAL("Default constructible class needed for reference implicit initialization.");
        return nullptr;
    }
};

template<typename T>
struct _dollarDefaultCreate<T, true>
{
    typedef _$_Inner<T, std::has_virtual_destructor<T>::value> Inner;
    static Inner* create() {
        return new Inner();
    }
};

class _$_new_t { };

static _$_new_t new$;

template<typename T, DollarRefType refType>
class $ {
public:
    typedef T Type;
    typedef _$_Inner<T, std::has_virtual_destructor<T>::value> Inner;
    static const DollarRefType REF_TYPE = refType;
    mutable Inner *_ptr;

    $() : _ptr(nullptr) {
        DBG("$ ##constr(): %p->%p", this, _ptr);
    }

    $(_$_new_t) : _ptr(_dollarDefaultCreate<T>::create()) {
        DBG("$ ##constr(new$): %p->%p", this, _ptr);
    }

    template<DollarRefType refType2>
    void copyConstruct(const $<T, refType2> &a) {
        if (_ptr == nullptr) {
            if (refType == DOLLAR_INSTANCE) {
                FATAL("Assigning null to instance reference.");
            } else if (refType == DOLLAR_NOT_NULL) {
                FATAL("Assigning null to nonnull reference.");
            }
        } else {
            _ptr->counter++;
            DBG("$ ++ %p->%p   %d", this, _ptr, (int)_ptr->counter);
        }
    }

    $(const $ &a) : _ptr(a.getInner()) {
        DBG("$ ##constr(const $ &): %p->%p", this, _ptr);
        copyConstruct(a);
    }

    template<DollarRefType refType2>
    $(const $<T, refType2> &a) : _ptr(a.getInner()) {
        DBG("$ ##constr(const $ &): %p->%p", this, _ptr);
        copyConstruct(a);
    }

    template<DollarRefType refType2>
    void moveConstruct($<T, refType2> &&a) {
        a._ptr = nullptr;
        DBG("$ take %p->%p", &a, a._ptr);
        if (_ptr == nullptr && refType != refType2) {
            if (refType2 == DOLLAR_INSTANCE) {
                _ptr = _dollarDefaultCreate<T>::create();
                DBG("$ implicit init: %p->%p", this, _ptr);
            } else if (refType2 == DOLLAR_NOT_NULL) {
                FATAL("Accessing uninitialized nonnull reference.");
            } else if (refType == DOLLAR_INSTANCE) {
                FATAL("Constructing instance reference from null reference.");
            } else {
                FATAL("Constructing nonnull reference from null reference.");
            }
        }
    }

    $($ &&a) : _ptr(a._ptr) {
        DBG("$ ##constr($ &&) %p->%p", this, _ptr);
        moveConstruct(std::forward<$>(a));
    }

    template<DollarRefType refType2>
    $($<T, refType2> &&a) : _ptr(a._ptr) {
        DBG("$ ##constr($ &&) %p->%p", this, _ptr);
        moveConstruct(std::forward<$<T, refType2>>(a));
    }

    $(const T& a) : _ptr(new Inner(a)) {
        DBG("$ ##constr(const T &) %p->%p", this, _ptr);
        DBG("$ create %p->%p", this, _ptr);
    }

    $(T&& a) : _ptr(new Inner(std::move(a))) {
        DBG("$ ##constr(const T &) %p->%p", this, _ptr);
        DBG("$ create %p->%p", this, _ptr);
    }

    template<class T2, typename std::enable_if<std::is_same<T2, Inner>{}, bool>::type = true>
    $(T2* a) : _ptr(a) {
        DBG("$ ##constr(Inner *) %p->%p", this, _ptr);
    }

    void unref() {
        if (_ptr) {
            _ptr->counter--;
            DBG("$ -- %p->%p   %d", this, _ptr, (int)_ptr->counter);
            if (_ptr->counter == 0) {
                DBG("$ delete %p->%p", this, _ptr);
                delete _ptr;
            }
        }
    }

    ~$() {
        DBG("$ ##destr %p->%p", this, _ptr);
        unref();
    }

    $& operator=(_$_new_t) {
        DBG("$ ##assign(new$) %p->%p", this, _ptr);
        if (_ptr != nullptr && refType == DOLLAR_INSTANCE) {
            FATAL("Overriding instance reference.");
        }
        unref();
        _ptr = _dollarDefaultCreate<T>::create();
        return *this;
    }

    $& operator=(typename _DollarRefTypeSelect<refType, _DollarDummyClass, _DollarDummyClass, nullptr_t>::type) {
        DBG("$ ##assign(nullptr) %p->%p", this, _ptr);
        unref();
        _ptr = nullptr;
        return *this;
    }

    template<DollarRefType refType2>
    $& copyAssign(const $<T, refType2>& a) {
        DBG("$ ##assign(const $ &) %p->%p", this, _ptr);
        auto newPtr = a.getInner();
        DBG("$ newPtr %p", newPtr);

        if (_ptr != nullptr && _ptr != newPtr && refType == DOLLAR_INSTANCE) {
            FATAL("Overriding instance reference.");
        }

        if (newPtr == nullptr) {
            if (refType == DOLLAR_INSTANCE) {
                FATAL("Assigning null to instance reference.");
            } else if (refType == DOLLAR_NOT_NULL) {
                FATAL("Assigning null to nonnull reference.");
            }
        } else {
            newPtr->counter++;
            DBG("$ newPtr ++ %p->%p   %d", this, _ptr, (int)newPtr->counter);
        }

        unref();
        _ptr = newPtr;

        return *this;
    }

    $& operator=(const $& a) {
        return copyAssign(a);
    }

    template<DollarRefType refType2>
    $& operator=(const $<T, refType2>& a)
    {
        return copyAssign(a);
    }

    template<DollarRefType refType2>
    $& moveAssign($<T, refType2>&& a)
    {
        DBG("$ ##assign($ &&) %p->%p", this, _ptr);
        if (_ptr != nullptr && _ptr != a._ptr && refType == DOLLAR_INSTANCE) {
            FATAL("Overriding instance reference.");
        }
        unref();
        _ptr = a._ptr;
        a._ptr = nullptr;
        if (_ptr == nullptr && refType != refType2) {
            if (refType2 == DOLLAR_INSTANCE) {
                _ptr = _dollarDefaultCreate<T>::create();
                DBG("$ implicit init: %p->%p", this, _ptr);
            } else if (refType2 == DOLLAR_NOT_NULL) {
                FATAL("Accessing uninitialized nonnull reference.");
            } else if (refType == DOLLAR_INSTANCE) {
                FATAL("Assigning null reference to instance reference.");
            } else {
                FATAL("Assigning null reference to nonnull reference.");
            }
        }
        return *this;
    }

    $& operator=($&& a)
    {
        return moveAssign(std::forward<$>(a));
    }

    template<DollarRefType refType2>
    $& operator=($<T, refType2>&& a)
    {
        return moveAssign(std::forward<$<T, refType2>>(a));
    }

    $& operator=(const T& a) {
        if (_ptr != nullptr && refType == DOLLAR_INSTANCE) {
            FATAL("Overriding instance reference.");
        }
        unref();
        _ptr = new Inner(a);
        return *this;
    }

    $& operator=(T&& a) {
        if (_ptr != nullptr && refType == DOLLAR_INSTANCE) {
            FATAL("Overriding instance reference.");
        }
        unref();
        _ptr = new Inner(std::move(a));
        return *this;
    }

    T* operator->() const {
        if (_ptr == nullptr) {
            if (refType == DOLLAR_INSTANCE) {
                _ptr = _dollarDefaultCreate<T>::create();
                DBG("$ implicit init: %p->%p", this, _ptr);
            } else if (refType == DOLLAR_NOT_NULL) {
                FATAL("Dereferencing uninitialized nonnull reference.");
            } else {
                FATAL("Dereferencing null reference.");
            }
        }
        return &_ptr->data;
    }

    T& operator*() const {
        if (_ptr == nullptr) {
            if (refType == DOLLAR_INSTANCE) {
                _ptr = _dollarDefaultCreate<T>::create();
                DBG("$ implicit init: %p->%p", this, _ptr);
            } else if (refType == DOLLAR_NOT_NULL) {
                FATAL("Dereferencing uninitialized nonnull reference.");
            } else {
                FATAL("Dereferencing null reference.");
            }
        }
        return _ptr->data;
    }

    template<class T2, typename std::enable_if<std::is_same<T2, nullptr_t>{} && (refType == DOLLAR_NULLABLE), bool>::type = true>
    friend bool operator==(const $& a, T2)
    {
        return a._ptr == nullptr;
    }

    template<class T2, typename std::enable_if<std::is_same<T2, nullptr_t>{} && (refType == DOLLAR_NULLABLE), bool>::type = true>
    friend bool operator!=(const $& a, T2)
    {
        return a._ptr != nullptr;
    }

    template<class T2, typename std::enable_if<std::is_same<T2, nullptr_t>{} && (refType == DOLLAR_NULLABLE), bool>::type = true>
    friend bool operator==(T2, const $& a)
    {
        return a._ptr == nullptr;
    }

    template<class T2, typename std::enable_if<std::is_same<T2, nullptr_t>{} && (refType == DOLLAR_NULLABLE), bool>::type = true>
    friend bool operator!=(T2, const $& a)
    {
        return a._ptr != nullptr;
    }

    template<DollarRefType refType2>
    friend bool operator==(const $& a, const $<T, refType2>& b)
    {
        if (refType != DOLLAR_NULLABLE && a._ptr == nullptr) {
            return false;
        }
        if (refType2 != DOLLAR_NULLABLE && b._ptr == nullptr) {
            return false;
        }
        return a._ptr == b._ptr;
    }

    template<DollarRefType refType2>
    friend bool operator!=(const $& a, const $<T, refType2>& b)
    {
        if (refType != DOLLAR_NULLABLE && a._ptr == nullptr) {
            return true;
        }
        if (refType2 != DOLLAR_NULLABLE && b._ptr == nullptr) {
            return true;
        }
        return a._ptr != b._ptr;
    }

    template<typename... Args>
    static $ create(Args&&... args) {
        Inner *a = new Inner(std::forward<Args>(args)...);
        return $(a);
    }


    template<typename... Args>
    void createInplace(Args&&... args) {
        if (_ptr != nullptr && refType == DOLLAR_INSTANCE) {
            FATAL("Overriding instance reference.");
        }
        unref();
        _ptr = new Inner(std::forward<Args>(args)...);
    }

    template<typename T2>
    $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> cast() {
        typedef $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> RetType;
        if (_ptr == nullptr) {
            if (refType == DOLLAR_NULLABLE) {
                return RetType(nullptr);
            } else if (refType == DOLLAR_INSTANCE) {
                _ptr = _dollarDefaultCreate<T>::create();
                DBG("$ implicit init: %p->%p", this, _ptr);
            } else {
                FATAL("Accessing uninitialized nonnull reference.");
            }
        }
        return castCommon<T2>(&_ptr->data);
    }

    template<typename T2>
    $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> castUnsafe() {
        typedef $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> RetType;
        if (_ptr == nullptr) {
            if (refType == DOLLAR_NULLABLE) {
                return RetType(nullptr);
            } else if (refType == DOLLAR_INSTANCE) {
                _ptr = _dollarDefaultCreate<T>::create();
                DBG("$ implicit init: %p->%p", this, _ptr);
            } else {
                FATAL("Accessing uninitialized nonnull reference.");
            }
        }
        return castCommon<T2>((T2*)&_ptr->data);
    }

    template<typename T2>
    $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> castCommon(T2* p) {
        typedef $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> RetType;
        typedef _$_Inner<T2, std::has_virtual_destructor<T2>::value> Inner2;
        if ((void*)p != (void*)&_ptr->data) {
            FATAL("Casting to non-first parent.");
        }
        intptr_t offset = (u8*)&_ptr->data - (u8*)_ptr;
        Inner2* inner = (Inner2*)((u8*)p - offset);
        if ((void*)&inner->counter != (void*)&_ptr->counter) {
            FATAL("Unsupported platform or compiler.");
        }
        inner->counter++;
        return RetType(inner);
    }

    Inner* getInner() const
    {
        if (_ptr == nullptr) {
            if (refType == DOLLAR_INSTANCE) {
                _ptr = _dollarDefaultCreate<T>::create();
                DBG("$ implicit init: %p->%p", this, _ptr);
            } else if (refType == DOLLAR_NOT_NULL) {
                FATAL("Accessing uninitialized nonnull reference.");
            }
        }
        return _ptr;
    }

};

/*
struct anyInnerBase {
    char* typeId;
    virtual ~anyInnerBase() { }
};

template<typename T, bool vd>
struct _any$Inner : public anyInnerBase {
    $<T, DOLLAR_NULLABLE, vd> ptr;
    static char typeIdField;
};

template<typename T, bool vd>
char _any$Inner<T, vd>::typeIdField;


template<DollarRefType refType>
class any$ {
public:
    static const DollarRefType ptrRefType = refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL;
    typedef $<anyInnerBase, ptrRefType, true> PtrType;
    PtrType ptr;

    template<typename T, DollarRefType refType2, bool vd>
    any$ &operator=(const $<T, refType2, vd>& a)
    {
        *a;
        if (refType == DOLLAR_INSTANCE && ptr._ptr != nullptr) {
            FATAL("Overriding instance reference.");
        }
        if (refType != DOLLAR_NOT_NULL && a._ptr == nullptr) {
            FATAL("Assigning NULL to non-NULL reference type.");
        }
        if (ptr._ptr != nullptr && ptr._ptr->counter == 1 && ptr._ptr->data.typeId == &_any$Inner<T, vd>::typeIdField) {
            auto p = ptr.template cast<_any$Inner<T, vd>>();
            p->ptr = a;
        } else {
            auto p = $<_any$Inner<T, vd>, ptrRefType, true>::create();
            p->ptr = a; // TODO: put it into constructor
            p->typeId = &_any$Inner<T, vd>::typeIdField;
            ptr = p.template cast<anyInnerBase>();
        }
        return *this;
    }
    
    template<typename T, bool nullable, bool vd>
    static any$ get(const $<T, nullable, vd>& a) {
        auto p = $<_any$Inner<T, vd>, true, true>::create();
        p->ptr = a;
        p->typeId = &_any$Inner<T, vd>::typeIdField;
        return any${
            .ptr = p.template cast<anyInnerBase>()
        };
    }

    operator any$*()
    {
        return this;
    }
};

using any$$ = any$<DOLLAR_INSTANCE>;
using any$N = any$<DOLLAR_NULLABLE>;


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
*/

#endif /* _DOLLAR_HH_ */
