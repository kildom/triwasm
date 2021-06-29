#ifndef _GENERIC_STRING_HH_
#define _GENERIC_STRING_HH_

#include "Utils.hh"

template<typename T>
class GenericStringView;

template<typename T>
class GenericStringInner {
public:
    std::basic_string<T> v;

    template<typename... Args>
    GenericStringInner(Args&&... args) : v(std::forward<Args>(args)...) { }

    ssize length() {
        return (ssize)v.size();
    }

    void length(ssize l) {
        v.resize(l);
    }

    T* buffer() {
        return (T*)v.c_str();
    }

};

template<typename T>
class GenericString$ : public $<GenericStringInner<T>> {
public:

    typedef std::basic_string<T> basic_string;
    typedef T type;

    GenericString$() : $<GenericStringInner<T>>() { }
    GenericString$(nullptr_t) : $<GenericStringInner<T>>(nullptr) { }
    GenericString$(const GenericString$ &a) : $<GenericStringInner<T>>(a) { }
    GenericString$(GenericString$ &&a) : $<GenericStringInner<T>>(a) { }
    GenericString$(const GenericStringInner<T>& a) : $<GenericStringInner<T>>(a) { }
    GenericString$(typename $<GenericStringInner<T>>::Inner * a) : $<GenericStringInner<T>>(a) { }
    ~GenericString$() { }

    GenericString$& operator=(nullptr_t) {
        $<GenericStringInner<T>>::operator=(nullptr);
        return *this;
    }

    GenericString$& operator=(const GenericString$& a) {
        $<GenericStringInner<T>>::operator=(a);
        return *this;
    }

    GenericString$& operator=(GenericString$&& a) {
        $<GenericStringInner<T>>::operator=(a);
        return *this;
    }

    GenericString$& operator=(const GenericStringInner<T>& a) {
        $<GenericStringInner<T>>::operator=(a);
        return *this;
    }

    template<typename... Args>
    static GenericString$ create(Args&&... args) {
        typename $<GenericStringInner<T>>::Inner *a = new typename $<GenericStringInner<T>>::Inner(std::forward<Args>(args)...);
        a->counter = 1;
        return GenericString$(a);
    }

    T& operator[](ssize index) {
        if (index < 0 || (usize)index >= (*this)->v.size()) {
            FATAL("Index out of bounds");
        }
        return (*this)->v[index];
    }

    GenericStringView<T> operator[](const Range &range);
    GenericStringView<T> operator[](const BoundedRange &range);

    bool operator==(const char *a) {
        if ($<GenericStringInner<T>>::_ptr == nullptr) {
            return a == nullptr;
        } else if (a == nullptr) {
            return false;
        }
        return (*this)->v == a;
    }

    bool operator==(GenericString$ a) {
        if ((*this) == nullptr) {
            return a == nullptr;
        } else if (a == nullptr) {
            return false;
        }
        return (*this)->v == a->v;
    }

    auto begin() {
        return (*this)->v.begin();
    }

    auto end() {
        return (*this)->v.end();
    }

    GenericString$ operator+(const T* value) const {
        GenericString$ a;
        a->v = (*this)->v;
        a->v += value;
        return a;
    }

};


template<typename T>
class GenericStringView {
public:
    GenericString$<T> str;
    ssize begin;
    ssize end;
    GenericStringView(const GenericStringView& view, ssize begin, ssize end) : str(view.str), begin(begin), end(end) { }
    GenericStringView(GenericString$<T> str, ssize begin, ssize end) : str(str), begin(begin), end(end) { }

    ssize length() {
        update();
        return end - begin;
    }

    GenericStringView& operator=(const GenericString$<T>& src) {
        update();
        return *this;
    }

    GenericStringView& operator=(const GenericStringView& src) {
        update();
        return *this;
    }

    T& operator[](ssize index) {
        update();
        if (index < 0 || index >= end - begin) {
            FATAL("Index out of bounds");
        }
        return str[begin + index];
    }

    GenericStringView operator[](const Range &range) {
        return operator[](range.bound(end - begin));
    }

    GenericStringView operator[](const BoundedRange &range) {
        update();
        if (range.beginOffset < 0 || range.beginOffset > end - begin
            || range.endOffset < 0 || range.endOffset > end - begin) {
            FATAL("Index out of bounds");
        }
        return GenericStringView(*this, begin + range.beginOffset, begin + range.endOffset);
    }

private:
    void update() {
        auto length = str->length();
        if (end > length) {
            end = length;
            if (begin > length) {
                begin = length;
            }
        }
    }
};


template<typename T>
GenericStringView<T> GenericString$<T>::operator[](const Range &range) {
    return operator[](range.bound((*this)->v.size()));
}

template<typename T>
GenericStringView<T> GenericString$<T>::operator[](const BoundedRange &range) {
    if (range.beginOffset < 0 || (usize)range.beginOffset > (*this)->v.size()
        || range.endOffset < 0 || (usize)range.endOffset > (*this)->v.size()) {
        FATAL("Index out of bounds");
    }
    return GenericStringView<T>(*this, range.beginOffset, range.endOffset);
}

typedef GenericString$<u8> Bytes$;
typedef GenericString$<char> String$;


#endif /* _GENERIC_STRING_HH_ */
