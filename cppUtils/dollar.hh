#ifndef _DOLLAR_HH_
#define _DOLLAR_HH_

#include <stdint.h>
#include <stddef.h>
#include <utility>

#include "trace.hh"

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
};

template<typename T>
struct _$_Inner<T, true> {
    size_t counter;
    T data;
    template<typename... Args>
    _$_Inner(Args&&... args) : counter(1), data(std::forward<Args>(args)...) { }
    virtual ~_$_Inner() { }
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

template<typename T, DollarRefType refType>
class $ {
public:
    typedef _$_Inner<T, std::has_virtual_destructor<T>::value> Inner;
    mutable Inner *_ptr;
    $() : _ptr(nullptr) { }

    $(const $<T, DOLLAR_INSTANCE> &a) : _ptr(a._ptr) {
        /*           a$$ null   |    a$$ ptr
         * this$$      null     |      copy
         * this$      create    |      copy
         * this$N     create    |      copy
         */
        if (_ptr == nullptr) {
            if (refType == DOLLAR_INSTANCE) {
                return;
            } else {
                a._ptr = new Inner();
                _ptr = a._ptr;
            }
        }
        _ptr->counter++;
    }

    $(const $<T, DOLLAR_NOT_NULL> &a) : _ptr(a._ptr) {
        /*          a$ null    |     a$ ptr
         * this$$   !access    |   copy
         * this$    null       |   copy
         * this$N   !acc       |   copy
         */
        if (_ptr == nullptr) {
            if (refType == DOLLAR_NOT_NULL) {
                return;
            } else {
                FATAL("Accessing non-NULL reference type that contains NULL value.");
            }
        }
        _ptr->counter++;
    }

    $(const $<T, DOLLAR_NULLABLE> &a) : _ptr(a._ptr) {
        /*          a$N null   |     a$N ptr
         * this$$   !nnull     |   copy
         * this$    !nnull     |   copy
         * this$N   null       |   copy
         */
        if (_ptr == nullptr) {
            if (refType == DOLLAR_NULLABLE) {
                return;
            } else {
                FATAL("Assigning NULL to non-NULL reference type.");
            }
        }
        _ptr->counter++;
    }

    $($<T, DOLLAR_INSTANCE> &&a) : _ptr(a._ptr) {
        /*           a$$ null   |    a$$ ptr
         * this$$      null     |      move
         * this$      create    |      move
         * this$N     create    |      move
         */
        a._ptr = nullptr;
        if (_ptr == nullptr && refType != DOLLAR_INSTANCE) {
            _ptr = new Inner();
        }
    }

    $($<T, DOLLAR_NOT_NULL> &&a) : _ptr(a._ptr) {
        /*           a$ null    |     a$ ptr
         * this$$    !access    |   move
         * this$     null       |   move
         * this$N    !acc       |   move
         */
        a._ptr = nullptr;
        if (_ptr == nullptr && refType != DOLLAR_NOT_NULL) {
            FATAL("Accessing non-NULL reference type that contains NULL value.");
        }
    }

    $($<T, DOLLAR_NULLABLE> &&a) : _ptr(a._ptr) {
        /*          a$N null   |     a$N ptr
         * this$$   !nnull     |   move
         * this$    !nnull     |   move
         * this$N   null       |   move
         */
        a._ptr = nullptr;
        if (_ptr == nullptr && refType != DOLLAR_NULLABLE) {
            FATAL("Assigning NULL to non-NULL reference type.");
        }
    }

    $(const T& a) : _ptr(new Inner(a)) { }

    template<class T2, typename std::enable_if<std::is_same<T2, Inner>{}, bool>::type = true>
    // enable_if<> does not allow convertion from different types (e.g. nullptr_t)
    $(T2* a) : _ptr(a) { }

    ~$() {
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
    }

    $& operator=(typename _DollarRefTypeSelect<refType, _DollarDummyClass, _DollarDummyClass, nullptr_t>::type) {
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = nullptr;
        return *this;
    }

    $& operator=(const $<T, DOLLAR_INSTANCE>& a) {
        /*               a$$ null   |    a$$ ptr
         * this$$ null     null     |      copy
         * this$$ ptr    !!override |  !!override if != else copy
         * this$  null    create    |      copy
         * this$  ptr     create    |      copy
         * this$N null    create    |      copy
         * this$N ptr     create    |      copy
         */
        if (refType == DOLLAR_INSTANCE) {
            if (_ptr == nullptr) {
                if (a._ptr == nullptr) {
                    return *this;
                }
            } else {
                if (a._ptr != _ptr) {
                    FATAL("Overriding instance reference.");
                }
            }
        }
        if (a._ptr == nullptr) {
            a._ptr = new Inner();
        }
        auto old_ptr = _ptr;
        _ptr = a._ptr;
        _ptr->counter++;
        if (old_ptr && (--old_ptr->counter) == 0)
            delete old_ptr;
        return *this;
    }

    $& operator=(const $<T, DOLLAR_NOT_NULL>& a) {
        /*               a$ null    |     a$ ptr
         * this$$ null   !access    |   copy
         * this$$ ptr    !override  |   !override if != else copy
         * this$  null   null       |   copy
         * this$  ptr    !acc       |   copy
         * this$N null   !acc       |   copy
         * this$N ptr    !acc       |   copy
         */
        if (_ptr != nullptr && a._ptr != _ptr && refType == DOLLAR_INSTANCE) {
            FATAL("Overriding instance reference.");
        }
        if (a._ptr == nullptr) {
            if (_ptr == nullptr && refType == DOLLAR_NOT_NULL) {
                return *this;
            } else {
                FATAL("Accessing non-NULL reference type that contains NULL value.");
            }
        }
        auto old_ptr = _ptr;
        _ptr = a._ptr;
        _ptr->counter++;
        if (old_ptr && (--old_ptr->counter) == 0)
            delete old_ptr;
        return *this;
    }

    $& operator=(const $<T, DOLLAR_NULLABLE>& a) {
        /*               a$N null   |     a$N ptr
         * this$$ null   !nnull     |   copy
         * this$$ ptr    !override  |   !override if != else copy
         * this$  null   !nnull     |   copy
         * this$  ptr    !nnull     |   copy
         * this$N null   copy       |   copy
         * this$N ptr    copy       |   copy
         */
        if (_ptr != nullptr && a._ptr != _ptr && refType == DOLLAR_INSTANCE) {
            FATAL("Overriding instance reference.");
        }
        if (a._ptr == nullptr && refType != DOLLAR_NULLABLE) {
            FATAL("Assigning NULL to non-NULL reference type.");
        }
        auto old_ptr = _ptr;
        _ptr = a._ptr;
        if (_ptr != nullptr || refType != DOLLAR_NULLABLE)
            _ptr->counter++;
        if (old_ptr && (--old_ptr->counter) == 0)
            delete old_ptr;
        return *this;
    }

    $& operator=($<T, DOLLAR_INSTANCE>&& a) {
        /*               a$$ null   |    a$$ ptr
         * this$$ null     null     |      move
         * this$$ ptr    !!override |  !!override if != else move
         * this$  null    create    |      move
         * this$  ptr     create    |      move
         * this$N null    create    |      move
         * this$N ptr     create    |      move
         */
        if (refType == DOLLAR_INSTANCE) {
            if (_ptr == nullptr) {
                if (a._ptr == nullptr) {
                    return *this;
                }
            } else {
                if (a._ptr != _ptr) {
                    FATAL("Overriding instance reference.");
                }
            }
        }
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = a._ptr;
        a._ptr = nullptr;
        if (_ptr == nullptr) {
            _ptr = new Inner();
        }
        return *this;
    }

    $& operator=($<T, DOLLAR_NOT_NULL>&& a) {
        /*               a$ null    |     a$ ptr
         * this$$ null   !access    |   move
         * this$$ ptr    !override  |   !override if != else move
         * this$  null   null       |   move
         * this$  ptr    !acc       |   move
         * this$N null   !acc       |   move
         * this$N ptr    !acc       |   move
         */
        if (_ptr != nullptr && a._ptr != _ptr && refType == DOLLAR_INSTANCE) {
            FATAL("Overriding instance reference.");
        }
        if (a._ptr == nullptr) {
            if (_ptr == nullptr && refType == DOLLAR_NOT_NULL) {
                return *this;
            } else {
                FATAL("Accessing non-NULL reference type that contains NULL value.");
            }
        }
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = a._ptr;
        a._ptr = nullptr;
        return *this;
    }

    $& operator=($<T, DOLLAR_NULLABLE>&& a) {
        /*               a$N null   |     a$N ptr
         * this$$ null   !nnull     |   move
         * this$$ ptr    !override  |   !override if != else move
         * this$  null   !nnull     |   move
         * this$  ptr    !nnull     |   move
         * this$N null   move       |   move
         * this$N ptr    move       |   move
         */
        if (_ptr != nullptr && a._ptr != _ptr && refType == DOLLAR_INSTANCE) {
            FATAL("Overriding instance reference.");
        }
        if (a._ptr == nullptr && refType != DOLLAR_NULLABLE) {
            FATAL("Assigning NULL to non-NULL reference type.");
        }
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = a._ptr;
        a._ptr = nullptr;
        return *this;
    }

    $& operator=(const T& a) {
        if (_ptr != nullptr && refType == DOLLAR_INSTANCE) {
            FATAL("Overriding instance reference.");
        }
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = new Inner(a);
        return *this;
    }

    T* operator->() const {
        if (_ptr == nullptr) {
            if (refType == DOLLAR_INSTANCE) {
                _ptr = new Inner();
            } else if (refType == DOLLAR_NOT_NULL) {
                FATAL("Dereferencing uninitialized nonnull dollar reference.");
            } else {
                FATAL("Dereferencing null nullable dollar reference.");
            }
        }
        return &_ptr->data;
    }

    T& operator*() const {
        if (_ptr == nullptr) {
            if (refType == DOLLAR_INSTANCE) {
                _ptr = new Inner();
            } else if (refType == DOLLAR_NOT_NULL) {
                FATAL("Dereferencing uninitialized nonnull dollar reference.");
            } else {
                FATAL("Dereferencing null nullable dollar reference.");
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
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = new Inner(std::forward<Args>(args)...);
    }

    template<typename T2>
    $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> _castCommon(T2* p) {
        typedef $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> RetType;
        typedef _$_Inner<T2, std::has_virtual_destructor<T2>::value> Inner2;
        if ((void*)p != (void*)&_ptr->data) {
            FATAL("Only cast to first parent is allowed");
        }
        intptr_t offset = (u8*)&_ptr->data - (u8*)_ptr;
        Inner2* inner = (Inner2*)((u8*)p - offset);
        if ((void*)&inner->counter != (void*)&_ptr->counter) {
            FATAL("Some unconventional platform or compiler");
        }
        inner->counter++;
        return RetType(inner);
    }

    template<typename T2>
    $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> cast() {
        typedef $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> RetType;
        if (_ptr == nullptr) {
            if (refType == DOLLAR_NULLABLE) {
                return RetType(nullptr);
            } else if (refType == DOLLAR_NULLABLE) {
                _ptr = new Inner();
            } else {
                FATAL("Accessing non-NULL reference type that contains NULL value.");
            }
        }
        return _castCommon<T2>(&_ptr->data);
    }

    template<typename T2>
    $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> castUnsafe() {
        typedef $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> RetType;
        if (_ptr == nullptr) {
            if (refType == DOLLAR_NULLABLE) {
                return RetType(nullptr);
            } else if (refType == DOLLAR_NULLABLE) {
                _ptr = new Inner();
            } else {
                FATAL("Accessing non-NULL reference type that contains NULL value.");
            }
        }
        return _castCommon<T2>((T2*)&_ptr->data);
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
