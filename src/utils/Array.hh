#ifndef _ARRAY_HH_
#define _ARRAY_HH_

#include "Utils.hh"

template<typename T>
class ArrayView;

template<typename T>
class ArrayInner {
public:
    std::vector<T> v;

    template<typename... Args>
    ArrayInner(Args&&... args) : v(std::forward<Args>(args)...) { }

    ssize length() {
        return (ssize)v.size();
    }

    void length(ssize l) {
        v.resize(l);
    }

    void push(const T& x) {
        v.push_back(x);
    }

    void pushFront(const T& x) {
        v.insert(v.begin(), x);
    }

    T pop() {
        T x = v.back();
        v.pop_back();
        return x;
    }

    T& grow(ssize index) {
        if (index < 0) {
            FATAL("Index out of bounds");
        } else if ((usize)index >= v.size()) {
            v.resize(index + 1);
        }
        return v[index];
    }

};

template<typename T>
class Array$ : public $<ArrayInner<T>> {
public:

    Array$() : $<ArrayInner<T>>() { }
    Array$(nullptr_t) : $<ArrayInner<T>>(nullptr) { }
    Array$(const Array$ &a) : $<ArrayInner<T>>(a) { }
    Array$(Array$ &&a) : $<ArrayInner<T>>(a) { }
    Array$(const ArrayInner<T>& a) : $<ArrayInner<T>>(a) { }
    Array$(typename $<ArrayInner<T>>::Inner * a) : $<ArrayInner<T>>(a) { }
    Array$(_$_New$) : $<ArrayInner<T>>(_$_New$()) { }
    ~Array$() { }

    Array$(const std::initializer_list<T>& a) : $<ArrayInner<T>>(a) { }

    Array$& operator=(nullptr_t) {
        $<ArrayInner<T>>::operator=(nullptr);
        return *this;
    }

    Array$& operator=(const Array$& a) {
        $<ArrayInner<T>>::operator=(a);
        return *this;
    }

    Array$& operator=(Array$&& a) {
        $<ArrayInner<T>>::operator=(a);
        return *this;
    }

    Array$& operator=(const ArrayInner<T>& a) {
        $<ArrayInner<T>>::operator=(a);
        return *this;
    }

    Array$& operator=(const std::initializer_list<T>& a) {
        *this = Array$(a);
        return *this;
    }

    Array$& operator=(_$_New$) {
        this->createInplace();
        return *this;
    }

    template<typename... Args>
    static Array$ create(Args&&... args) {
        typename $<ArrayInner<T>>::Inner *a = new typename $<ArrayInner<T>>::Inner(std::forward<Args>(args)...);
        a->counter = 1;
        return Array$(a);
    }

    T& operator[](ssize index) const {
        if (index < 0 || (usize)index >= (*this)->v.size()) {
            FATAL("Index out of bounds");
        }
        return (*this)->v[index];
    }

    T& operator[](Range::EndOffset offset) const {
        return operator[]((*this)->v.size() - offset.offset);
    }

    Array$ operator+(Array$ a)
    {
        Array$ n;
        n->v.assign((*this)->v.begin(), (*this)->v.end());
        n->v.insert(n->v.end(), a->v.begin(), a->v.end());
        return n;
    }

    ArrayView<T> operator[](const Range &range) const;
    ArrayView<T> operator[](const BoundedRange &range) const;

    auto begin() {
        return (*this)->v.begin();
    }

    auto end() {
        return (*this)->v.end();
    }
};


template<typename T>
class ArrayView {
public:
    Array$<T> array;
    ssize begin;
    ssize end;
    ArrayView(const ArrayView& view, ssize begin, ssize end) : array(view.array), begin(begin), end(end) { }
    ArrayView(Array$<T> array, ssize begin, ssize end) : array(array), begin(begin), end(end) { }

    ssize length() {
        update();
        return end - begin;
    }

    ArrayView& operator=(const std::initializer_list<T>& src) {
        update();
        return *this;
    }

    ArrayView& operator=(const Array$<T>& src) {
        update();
        return *this;
    }

    ArrayView& operator=(const ArrayView& src) {
        update();
        return *this;
    }

    T& operator[](ssize index) const {
        update();
        if (index < 0 || index >= end - begin) {
            FATAL("Index out of bounds");
        }
        return array[begin + index];
    }

    ArrayView operator[](const Range &range) const {
        return operator[](range.bound(end - begin));
    }

    ArrayView operator[](const BoundedRange &range) const {
        update();
        if (range.beginOffset < 0 || range.beginOffset > end - begin
            || range.endOffset < 0 || range.endOffset > end - begin) {
            FATAL("Index out of bounds");
        }
        return ArrayView(*this, begin + range.beginOffset, begin + range.endOffset);
    }

private:
    void update() {
        auto length = array->length();
        if (end > length) {
            end = length;
            if (begin > length) {
                begin = length;
            }
        }
    }
};


template<typename T>
ArrayView<T> Array$<T>::operator[](const Range &range) const {
    return operator[](range.bound((*this)->v.size()));
}

template<typename T>
ArrayView<T> Array$<T>::operator[](const BoundedRange &range) const {
    if (range.beginOffset < 0 || (usize)range.beginOffset > (*this)->v.size()
        || range.endOffset < 0 || (usize)range.endOffset > (*this)->v.size()) {
        FATAL("Index out of bounds");
    }
    return ArrayView<T>(*this, range.beginOffset, range.endOffset);
}


#endif /* _ARRAY_HH_ */
