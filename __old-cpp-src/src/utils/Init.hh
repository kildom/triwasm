#ifndef _INIT_HH_
#define _INIT_HH_

#include "Utils.hh"


template<class T, T init>
class Init {
public:
    T value;
    Init() : value(init) {}
    Init(const T x) : value(x) {}
    Init(T&& x) : value(std::move(x)) {}
    Init(const Init& x) : value(x.value) {}
    Init(Init&& x) : value(std::move(x.value)) {}

    Init& operator=(const T x) { value = x; }
    Init& operator=(T&& x) { value = std::move(x); }
    Init& operator=(const Init& x) { value = x.value; }
    Init& operator=(Init&& x) { value = std::move(x.value); }

    operator T() {
        return value;
    }
};


#endif /* _INIT_HH_ */
