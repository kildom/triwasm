
#include "common.hh"

class _RefCounterInternalConstr_ {};

#define self ((Self*)ptr)
#define REF_COUNTER_IMPL(Class, Base)                 \
    public:                                           \
    template<typename... Args>                        \
    static Class create(Args&&... args)               \
    {                                                 \
        return Class(_RefCounterInternalConstr_(), std::forward<Args>(args)...); \
    }                                                 \
    Class() : Base() { }                              \
    Class(const Class& a) : Base(a) { }               \
    Class(Class&& a) : Base(a) { }                    \
    ~Class() {                                        \
        if (self) {                                   \
            if ((--self->counter) == 0) {             \
                finalize();                           \
                delete self;                          \
            }                                         \
            ptr = nullptr;                            \
        }                                             \
    }                                                 \
    Class& operator=(nullptr_t) {                     \
        if (self && (--self->counter) == 0) {         \
            finalize();                               \
            delete self;                              \
        }                                             \
        ptr = nullptr;                                \
        return *this;                                 \
    }                                                 \
    Class& operator=(const Class& a) {                \
        if (self && (--self->counter) == 0) {         \
            finalize();                               \
            delete self;                              \
        }                                             \
        if ((ptr = a.ptr))                            \
            self->counter++;                          \
        return *this;                                 \
    }                                                 \
    Class& operator=(Class&& a) {                     \
        if (self && (--self->counter) == 0) {         \
            finalize();                               \
            delete self;                              \
        }                                             \
        ptr = a.ptr;                                  \
        a.ptr = nullptr;                              \
        return *this;                                 \
    }                                                 \
    private:                                          \
    template<typename... Args>                        \
    Class(_RefCounterInternalConstr_, Args&&... args) : Base() {             \
        initialize(std::forward<Args>(args)...);      \
    }                                                 \
    void initializeSelf(void* newSelf) { \
        ptr = self; \
        self->counter = 1; \
    }

// TODO: macro for defining method that returns a references directly from self object 

class RefCounter {
protected:
    void *ptr;

    struct Self {
        size_t counter;
    };

public:
    RefCounter() {
        ptr = nullptr;
    }

    RefCounter(const RefCounter& a) {
        ptr = a.ptr;
        if (ptr) {
            self->counter++;
        }
    }

    RefCounter(RefCounter&& a) {
        ptr = a.ptr;
        a.ptr = nullptr;
    }

    virtual ~RefCounter() {
        TRACE();
        if (ptr) {
            FATAL("Internal error: executed unreachable code.");
        }
    }

    bool operator!() {
        return !ptr;
    }

    operator bool() {
        return !!ptr;
    }

    void assertNotNull()
    {
        if (!ptr)
            FATAL("Expecting not null pointer");
    }

    friend bool operator==(const RefCounter& a, nullptr_t)
    {
        return a.ptr == nullptr;
    }

    friend bool operator!=(const RefCounter& a, nullptr_t)
    {
        return a.ptr != nullptr;
    }

    friend bool operator==(nullptr_t, const RefCounter& a)
    {
        return a.ptr == nullptr;
    }

    friend bool operator!=(nullptr_t, const RefCounter& a)
    {
        return a.ptr != nullptr;
    }

    friend bool operator==(const RefCounter& a, const RefCounter& b)
    {
        return a.ptr == b.ptr;
    }

    friend bool operator!=(const RefCounter& a, const RefCounter& b)
    {
        return a.ptr != b.ptr;
    }

};
