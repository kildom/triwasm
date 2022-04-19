#ifndef _DOLLAR_HH_
#define _DOLLAR_HH_

#include <utility>
#include <cstddef>

#include "trace.hh"
#include "types.hh"


#ifndef DBG
#define DBG(...) do { } while (0)
#endif

#define _DOLLAR_POLYMORPHIC_PLACE_HOLDER_USED 1
#define _DOLLAR_POLYMORPHIC_PLACE_HOLDER_SIZE (sizeof(void*))

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

struct _DollarTypeIdList {
    _DollarTypeIdList *parent;
    bool polymorphic;
};

template<typename T>
struct _DollarTypeIdHelper {
    static _DollarTypeIdList typeIdEntry;
    static uintptr_t getId() {
        return (uintptr_t)&typeIdEntry;
    }
    static bool isChildOf(uintptr_t id) {
        return isBaseOf(&typeIdEntry, (_DollarTypeIdList*)id);
    }
    static bool isBaseOf(uintptr_t id) {
        return isBaseOf((_DollarTypeIdList*)id, &typeIdEntry);
    }

private:
    static bool isBaseOf(_DollarTypeIdList* derived, _DollarTypeIdList* base) {
        do {
            if (base == derived) {
                return true;
            }
            derived = derived->parent;
        } while (derived != nullptr);
        return false;
    }
};

struct DollarDummyBaseClass { };


template<typename T>
_DollarTypeIdList _DollarTypeIdHelper<T>::typeIdEntry = {
    .parent = std::is_same<T, DollarDummyBaseClass>::value ? nullptr : &_DollarTypeIdHelper<DollarDummyBaseClass>::typeIdEntry,
    .polymorphic = std::is_polymorphic<T>::value,
};

#define _DOLLAR_INHERIT3(Base, Derived, cnt, line) \
    static struct _Auto_init_##cnt##_##line { \
        _Auto_init_##cnt##_##line() { \
            _DollarTypeIdHelper<Derived>::typeIdEntry.parent = &_DollarTypeIdHelper<Base>::typeIdEntry; \
            if (!std::is_base_of<Base, Derived>::value) { \
                FATAL(#Base " is not base of " #Derived "."); \
            } \
        } \
    } _auto_init_##cnt##_##line;
#define _DOLLAR_INHERIT2(Base, Derived, cnt, line) _DOLLAR_INHERIT3(Base, Derived, cnt, line)
#define DOLLAR_INHERIT(Base, Derived) _DOLLAR_INHERIT2(Base, Derived, __COUNTER__, __LINE__)

#if _DOLLAR_POLYMORPHIC_PLACE_HOLDER_USED

template<typename T, bool polymophic>
struct _$_InnerTypeInfo;

template<typename T>
struct _$_InnerTypeInfo<T, false> {
    uintptr_t typeId;
    uint8_t polymophicPlaceHolder[_DOLLAR_POLYMORPHIC_PLACE_HOLDER_SIZE];
    _$_InnerTypeInfo() : typeId(_DollarTypeIdHelper<T>::getId()) {}
};

template<typename T>
struct _$_InnerTypeInfo<T, true> {
    uintptr_t typeId;
    _$_InnerTypeInfo() : typeId(_DollarTypeIdHelper<T>::getId()) {}
};

#else

template<typename T, bool polymophic>
struct _$_InnerTypeInfo {
    uintptr_t typeId;
    _$_InnerTypeInfo() : typeId(_DollarTypeIdHelper<T>::getId()) {}
};

#endif

struct _$_InnerBase {
    ssize counter;
    _$_InnerBase() : counter(1) { }
    virtual ~_$_InnerBase() { }
#ifdef DBG_NEW
    void* operator new(usize size) {
        return DBG_NEW(size);
    }
    void operator delete(void* ptr) {
        DBG_DELETE(ptr);
    }
#endif
};

template<typename T>
struct _$_Inner : public _$_InnerBase {
    _$_InnerTypeInfo<T, std::is_polymorphic<T>::value> typeInfo;
    T data;
    template<typename... Args>
    _$_Inner(Args&&... args) : data(std::forward<Args>(args)...) { }
};

struct _DollarEmptyClass { int _x; };

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
struct _dollarDefaultCreate; // TODO: move internal definition to separate namespace instead of _ prefix

template<typename T>
struct _dollarDefaultCreate<T, false>
{
    typedef _$_Inner<T> Inner;
    static Inner* create() {
        FATAL("Default constructible class needed for reference implicit initialization.");
        return nullptr;
    }
};

template<typename T>
struct _dollarDefaultCreate<T, true>
{
    typedef _$_Inner<T> Inner;
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
    typedef _$_Inner<T> Inner;
    static const DollarRefType REF_TYPE = refType;
    mutable _$_InnerBase *_ptr;

    $() : _ptr(nullptr) {
        DBG("$ ##constr(): %p->%p", this, _ptr);
    }

    $(typename _DollarRefTypeSelect<refType, _DollarEmptyClass, _DollarEmptyClass, nullptr_t>::type) : _ptr(nullptr) {
        DBG("$ ##constr(nullptr): %p->%p", this, _ptr);
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
            if (_ptr->counter > 0) {
                _ptr->counter--;
                DBG("$ -- %p->%p   %d", this, _ptr, (int)_ptr->counter);
                if (_ptr->counter == 0) {
                    DBG("$ delete %p->%p", this, _ptr);
                    delete _ptr;
                    _ptr = nullptr;
                }
            } else {
                FATAL("Memory corruption. Reference counter below zero.");
            }
        }
    }

    ~$() {
        DBG("$ ##destr %p->%p", this, _ptr);
        unref();
    }

    void operator=(_$_new_t) {
        DBG("$ ##assign(new$) %p->%p", this, _ptr);
        if (_ptr != nullptr && refType == DOLLAR_INSTANCE) {
            FATAL("Overriding instance reference.");
        }
        unref();
        _ptr = _dollarDefaultCreate<T>::create();
    }

    void operator=(typename _DollarRefTypeSelect<refType, _DollarEmptyClass, _DollarEmptyClass, nullptr_t>::type) {
        DBG("$ ##assign(nullptr) %p->%p", this, _ptr);
        unref();
        _ptr = nullptr;
    }

    template<DollarRefType refType2>
    void copyAssign(const $<T, refType2>& a) {
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
    }

    void operator=(const $& a) {
        copyAssign(a);
    }

    template<DollarRefType refType2>
    void operator=(const $<T, refType2>& a)
    {
        copyAssign(a);
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
        return &((Inner*)_ptr)->data;
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
        return ((Inner*)_ptr)->data;
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

    template <typename ToType, bool unsafe>
    struct _CastCondUnsafe;

    template <typename ToType>
    struct _CastCondUnsafe<ToType, false> {
        template <typename FromType>
        static ToType* cast(FromType* p) {
            return p;
        }
    };

    template <typename ToType>
    struct _CastCondUnsafe<ToType, true> {
        template <typename FromType>
        static ToType* cast(FromType* p) {
            return (ToType*)p;
        }
    };

    template <typename T2, bool convertible>
    struct _CastMethodSelect;

    template <typename T2>
    struct _CastMethodSelect<T2, false> {
        static $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> cast($* src) {
            return src->_dynamicCast<T2>();
        }
    };

    template <typename T2>
    struct _CastMethodSelect<T2, true> {
        static $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> cast($* src) {
            return src->_staticCast<T2>();
        }
    };

    template<typename T2>
    $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> cast() {
        return _CastMethodSelect<T2, std::is_convertible<T, T2>::value>::cast(this);
    }

    template<typename T2, bool unsafe = false>
    $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> _staticCast() {
        typedef $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> RetType;
        typedef _$_Inner<T2> Inner2;

        if (_ptr == nullptr) {
            if (refType == DOLLAR_NULLABLE) {
                return RetType();
            } else if (refType == DOLLAR_INSTANCE) {
                _ptr = _dollarDefaultCreate<T>::create();
                DBG("$ implicit init: %p->%p", this, _ptr);
            } else {
                FATAL("Accessing uninitialized nonnull reference.");
            }
        }
        
        T2* p = _CastCondUnsafe<T2, unsafe>::cast(&((Inner*)_ptr)->data);

        intptr_t offset = (u8*)&((Inner*)_ptr)->data - (u8*)_ptr;
        Inner2* inner = (Inner2*)((u8*)p - offset);
        if ((void*)&inner->counter != (void*)&_ptr->counter) {
            FATAL("Casting to non-first parent or unsupported platform or compiler.");
        }
        inner->counter++;
        return RetType(inner);
    }

    template<typename T2>
    bool canCast() {
        uintptr_t id;
        if (_ptr == nullptr) {
            id = _DollarTypeIdHelper<T>::getId();
        } else {
            id = ((Inner*)_ptr)->typeInfo.typeId;
        }
        return _DollarTypeIdHelper<T2>::isBaseOf(id);
    }

    template<typename T2>
    $<T2, refType == DOLLAR_NULLABLE ? DOLLAR_NULLABLE : DOLLAR_NOT_NULL> _dynamicCast() {
        if (!canCast<T2>()) {
            FATAL("Cannot do dynamic casting.");
        }
        return _staticCast<T2, true>();
    }

    $<DollarDummyBaseClass, refType> any() {
        return _staticCast<DollarDummyBaseClass, true>();
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
        return (Inner*)_ptr;
    }

    void* exportOpaquePtr() const
    {
        if (_ptr == nullptr) {
            if (refType == DOLLAR_INSTANCE) {
                _ptr = _dollarDefaultCreate<T>::create();
                DBG("$ implicit init: %p->%p", this, _ptr);
            } else if (refType == DOLLAR_NOT_NULL) {
                FATAL("Dereferencing uninitialized nonnull reference.");
            }
        } else {
            _ptr->counter++;
        }
        return (void*)_ptr;
    }

    static $ importOpaquePtr(void* ptr, bool own)
    {
        if (ptr == nullptr) {
            if (refType != DOLLAR_NULLABLE) {
                FATAL("Importing null raw pointer to not nullable reference.");
            }
        } else {
            auto id = ((Inner*)ptr)->typeInfo.typeId;
            if (!_DollarTypeIdHelper<T>::isBaseOf(id)) {
                FATAL("Importing raw pointer from invalid type.");
            }
            if (!own) {
                ((Inner*)ptr)->counter++;
            }
        }
        return $((Inner*)ptr);
    }

};

typedef $<DollarDummyBaseClass, DOLLAR_NOT_NULL> any$;
typedef $<DollarDummyBaseClass, DOLLAR_NULLABLE> any$N;

#endif // _DOLLAR_HH_
