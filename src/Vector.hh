#ifndef _VECTOR_HH_
#define _VECTOR_HH_

#include <vector>

#include "common.hh"
#include "RefCounter.hh"


template<class T>
class Vector : public RefCounter {

    REF_COUNTER_IMPL(Vector, RefCounter);

    struct Self : public RefCounter::Self
    {
        template<typename... Args>
        Self(Args&&... args) : v(std::forward<Args>(args)...) { }
        std::vector<T> v;
    };

    template<typename... Args>
    void initialize(Args&&... args) {
        initializeSelf(new Self(std::forward<Args>(args)...));
    }

    void finalize() {
    }

public:
    T& operator[](size_t index) {
        if (!self || index >= self->v.size())
            FATAL("Index out of bounds");
        return self->v[index];
    }

    T& grow(size_t index) {
        if (!self || index >= self->v.size())
            self->v.resize(index + 1);
        return self->v[index];
    }

    size_t length() {
        if (!self)
            return 0;
        return self->v.size();
    }

    void setLength(size_t length)
    {
        if (!self) {
            create(length);
        } else {
            self->v.resize(length);
        }
    }

};


#endif /* _VECTOR_HH_ */
