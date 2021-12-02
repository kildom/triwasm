
#define DOLLAR_TYPEDEF(Class, ...) \
    typedef $<Class, ##__VA_ARGS__> Class##$

#define DOLLAR_CLASS(Class, ...) \
    typedef $<class Class, ##__VA_ARGS__> Class##$

#define DOLLAR_STRUCT(Struct, ...) \
    typedef $<struct Struct, ##__VA_ARGS__> Struct##$

class any$;

template<typename T, bool vd>
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

template<typename T, bool vd = false>
class $ {
public:
    typedef _$_Inner<T, vd> Inner;
    mutable Inner *_ptr;

    $() : _ptr(nullptr) {
    }

    $(const $ &a) {
        if (a._ptr == nullptr) {
            a._ptr = new Inner();
            a._ptr->counter = 1;
        }
        _ptr = a._ptr;
        _ptr->counter++;
    }

    $($ &&a) : _ptr(a._ptr) {
        a._ptr = nullptr;
    }

    $(const T& a) : _ptr(new Inner(a)) {
        _ptr->counter = 1;
     }

    $(Inner* a) : _ptr(a) { }

    $(const any$& a);

    ~$() {
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
    }

    $& operator=(const $& a) {
        if (_ptr == a._ptr) {
            return *this;
        }
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        if (a._ptr == nullptr) {
            a._ptr = new Inner();
            a._ptr->counter = 1;
        }
        _ptr = a._ptr;
        _ptr->counter++;
        return *this;
    }

    $& operator=($&& a) {
        if (_ptr == a._ptr) {
            return *this;
        }
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

    $& operator=(const any$& a);

    T* operator->() const {
        if (!_ptr) {
            _ptr = new Inner();
            _ptr->counter = 1;
        }
        return &_ptr->data;
    }

    T& operator*() {
        if (!_ptr) {
            _ptr = new Inner();
            _ptr->counter = 1;
        }
        return _ptr->data;
    }

    friend bool operator==(const $& a, const $& b)
    {
        return (a._ptr == b._ptr) && (a._ptr != nullptr);
    }

    friend bool operator!=(const $& a, const $& b)
    {
        return (a._ptr != b._ptr) || (a._ptr == nullptr);
    }

    template<typename... Args>
    void operator()(Args&&... args) {
        if (_ptr && (--_ptr->counter) == 0)
            delete _ptr;
        _ptr = new Inner(std::forward<Args>(args)...);
        _ptr->counter = 1;
    }

    template<typename... Args>
    static $ create(Args&&... args) {
        Inner *a = new Inner(std::forward<Args>(args)...);
        a->counter = 1;
        return $(a);
    }

    template<typename T2>
    $<T2, std::has_virtual_destructor<T2>::value> cast() {
        typedef _$_Inner<T2, std::has_virtual_destructor<T2>::value> Inner2;
        T2* p = &_ptr->data;
        if ((void*)p != (void*)&_ptr->data) {
            FATAL("Only cast to first parent is allowed");
        }
        intptr_t offset = (u8*)&_ptr->data - (u8*)_ptr;
        Inner2* inner = (Inner2*)((u8*)p - offset);
        if ((void*)&inner->counter != (void*)&_ptr->counter) {
            FATAL("Some unconventional platform or compiler");
        }
        inner->counter++;
        return $<T2, std::has_virtual_destructor<T2>::value>(inner);
    }

    template<typename T2>
    $<T2, std::has_virtual_destructor<T2>::value> castUnsafe() {
        typedef _$_Inner<T2, std::has_virtual_destructor<T2>::value> Inner2;
        T2* p = (T2*)&_ptr->data;
        if ((void*)p != (void*)&_ptr->data) {
            FATAL("Only cast to first parent is allowed");
        }
        intptr_t offset = (u8*)&_ptr->data - (u8*)_ptr;
        Inner2* inner = (Inner2*)((u8*)p - offset);
        if ((void*)&inner->counter != (void*)&_ptr->counter) {
            FATAL("Some unconventional platform or compiler");
        }
        inner->counter++;
        return $<T2, std::has_virtual_destructor<T2>::value>(inner);
    }

    bool operator!() const {
        return _ptr == nullptr;
    }

    any$ operator~() const;

};

struct _anyInnerBase {
    void* typeId;
    _anyInnerBase(void* typeId) : typeId(typeId) { }
    virtual ~_anyInnerBase() { }
};

template<typename T, bool vd>
struct _any$Inner : public _anyInnerBase {
    $<T, vd> ptr;
    _any$Inner(const $<T, vd>& a, void* typeId) : _anyInnerBase(typeId), ptr(a) { }
    static int typeIdField;
};

template<typename T, bool vd>
int _any$Inner<T, vd>::typeIdField;

class any$ {
public:
    $<_anyInnerBase, true> ptr;

    any$() {}

    template<typename T, bool vd>
    any$(const $<T, vd>& a, void* typeId)
    {
        ptr = $<_any$Inner<T, vd>, true>::create(a, typeId).template cast<_anyInnerBase>();
    }

    template<typename T, bool vd>
    any$ &operator=(const $<T, vd>& a)
    {
        ptr = $<_any$Inner<T, vd>, true>::create(a, (void*)&_any$Inner<T, vd>::typeIdField).template cast<_anyInnerBase>();
        return *this;
    }
    /*
    template<typename T, bool vd>
    static any$ get(const $<T, vd>& a) {
        auto p = $<_any$Inner<T, vd>, true>::create();
        p->ptr = a;
        p->typeId = &_any$Inner<T, vd>::typeIdField;
        return any${
            .ptr = p.template cast<_anyInnerBase>()
        };
    }

    operator any$*()
    {
        return this;
    }*/
};
/*
template<typename T, bool vd>
$<T, vd>::$(any$ * anyPtr) {
    auto &any = *anyPtr;
    if (any.ptr == nullptr) {
        _ptr = nullptr;
        operator()();
        auto p = $<_any$Inner<T, vd>, true>::create();
        p->ptr = *this;
        p->typeId = &_any$Inner<T, vd>::typeIdField;
        any.ptr = p.template cast<_anyInnerBase>();
    } else if (any.ptr->typeId == &_any$Inner<T, vd>::typeIdField) {
        auto p = any.ptr.castUnsafe<_any$Inner<T, vd>>();
        _ptr = p->ptr._ptr;
        if (_ptr)
            _ptr->counter++;
    } else {
        FATAL("Expected different type");
    }
}
*/


template<typename T, bool vd>
$<T, vd>::$(const any$& a)
{
    if (!a.ptr) {
    } else if (a.ptr->typeId == &_any$Inner<T, vd>::typeIdField) {
    } else {
        FATAL("Expected different type");
    }
}

template<typename T, bool vd>
any$ $<T, vd>::operator~() const
{
    return any$(*this, (void*)&_any$Inner<T, vd>::typeIdField);
}


#endif /* _DOLLAR_HH_ */
