#ifndef _VECTOR_HH_
#define _VECTOR_HH_

#include "common.hh"
#include "RefCounter.hh"


template<class T>
class Vector : public RefCounter {

    REF_COUNTER_IMPL(Vector, RefCounter);

    struct Self : public RefCounter::Self
    {
        size_t size;
        size_t length;
        T* array;
    };

    void initialize() {
        self->size = 4;
        self->length = 0;
        self->array = new T[4];
    }

    void initialize(size_t length) {
        self->size = length > 4 ? length : 4;
        self->length = length;
        self->array = new T[self->size];
    }

    void finalize() {
        delete[] self->array;
    }
public:
    T& operator[](size_t index) {
        if (index > self->length)
            FATAL("Index out of bounds");
        return self->array[index];
    }

};


#endif /* _VECTOR_HH_ */
