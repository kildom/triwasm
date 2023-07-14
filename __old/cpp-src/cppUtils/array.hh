#ifndef _ARRAY_HH_
#define _ARRAY_HH_

#include <vector>

#include "trace.hh"
#include "types.hh"
#include "dollar.hh"
#include "range.hh"

template<typename T>
using Array = std::vector<T>;

template<typename T>
class ArrayView;

template<typename T, DollarRefType refType = DOLLAR_NOT_NULL>
class Array$ : public $<std::vector<T>, refType> {
public:
    using $<std::vector<T>, refType>::$;
    using $<std::vector<T>, refType>::operator=;

    template<DollarRefType refType2>
    Array$(const $<std::vector<T>, refType2> &a) : $<std::vector<T>, refType>(a) { }

    template<DollarRefType refType2>
    Array$($<std::vector<T>, refType2> &&a) : $<std::vector<T>, refType>(a) { }

    template<DollarRefType refType2>
    void operator=(const $<std::vector<T>, refType2> &a) { $<std::vector<T>, refType>::operator=(a); }

    template<DollarRefType refType2>
    void operator=($<std::vector<T>, refType2> &&a) { $<std::vector<T>, refType>::operator=(a); }

    template<class UnboundedRange>
    std::enable_if_t<std::is_class<UnboundedRange>::value, ArrayView<T>> operator[](const UnboundedRange& r) {
        return operator[](r.bound((*this)->size()));
    }

    template<class UnboundedRange>
    std::enable_if_t<std::is_class<UnboundedRange>::value, ArrayView<T>> operator()(const UnboundedRange& r) {
        return operator()(r.bound((*this)->size()));
    }

    T& operator[](ssize index) {
        if (index < 0 || index >= (ssize)(*this)->size()) {
            FATAL("Index out of bounds.");
        }
        return (**this)[index];
    }

    T& operator()(ssize index) {
        if (index < 0) {
            FATAL("Index out of bounds.");
        }
        if (index >= (ssize)(*this)->size()) {
            (*this)->resize(index + 1);
        }
        return (**this)[index];
    }

    ArrayView<T> operator[](const Range& r) {
        if (r.to < r.from || r.from < 0 || r.to > (ssize)(*this)->size()) {
            FATAL("Invalid range.");
        }
        return ArrayView<T>{
            .array = *this,
            .from = r.from,
            .to = r.to,
        };
    }

    ArrayView<T> operator()(const Range& r) {
        if (r.to < r.from || r.from < 0) {
            FATAL("Invalid range.");
        }
        if (r.to > (ssize)(*this)->size()) {
            (*this)->resize(r.to);
        }
        return ArrayView<T>{
            .array = *this,
            .from = r.from,
            .to = r.to,
        };
    }

    ArrayView<T> operator[](const RelaxedRange& r) {
        ssize from = r.from;
        ssize to = r.to;
        ssize size = (*this)->size();
        if (from < 0) {
            from = 0;
        }
        if (to < from) {
            to = from;
        }
        if (to > size) {
            to = size;
            if (from > size) {
                from = size;
            }
        }
        return ArrayView<T>{
            .array = *this,
            .from = from,
            .to = to,
        };
    }

    ArrayView<T> operator()(const RelaxedRange& r) {
        ssize from = r.from;
        ssize to = r.to;
        ssize size = (*this)->size();
        if (from < 0) {
            from = 0;
        }
        if (to < from) {
            to = from;
        }
        if (to > size) {
            (*this)->resize(to);
        }
        return ArrayView<T>{
            .array = *this,
            .from = from,
            .to = to,
        };
    }

    void clear() {
        (*this)->clear();
    }

    ssize length() const {
        return (*this)->size();
    }

    template <typename T2 = T, std::enable_if_t<std::is_default_constructible<T2>::value, bool> = true>
    void length(ssize newLength, char _x = 0) {
        if (newLength < 0) {
            FATAL("Invalid length.");
        }
        (*this)->resize(newLength);
    }

    template <typename T2 = T, std::enable_if_t<!std::is_default_constructible<T2>::value, bool> = true>
    void length(ssize newLength, long _x = 0) {
        if (newLength < 0) {
            FATAL("Invalid length.");
        } else if (newLength > (ssize)(*this)->size()) {
            FATAL("Cannot construct non-default-constructible elements.");
        }
        (*this)->erase((*this)->begin() + newLength, (*this)->end());
    }

    auto& back(ssize index) {
        return operator[]((ssize)(*this)->size() - index - 1);
    }

    auto& back() {
        if ((*this)->empty()) {
            FATAL("Cannot get value from empty array.");
        }
        return (*this)->back();
    }

    auto pop() {
        if ((*this)->empty()) {
            FATAL("Cannot pop from empty array.");
        }
        auto last = (*this)->back();
        (*this)->pop_back();
        return last;
    }

    void pop(ssize count) {
        length((ssize)(*this)->size() - count);
    }

    void push(const T& value) {
        (*this)->push_back(value);
    }

    bool empty() {
        return (*this)->empty();
    }

    auto operator()() {
        struct Wrapper {
            Array$& arr;
            void operator=(const T& item) {
                arr->push_back(item);
            }
        };
        return Wrapper{ .arr = *this };
    }

    auto begin() const {
        return (*this)->begin();
    }

    auto end() const {
        return (*this)->end();
    }

    auto reverseIterate() {
        struct Wrapper {
            Array$ arr;
            auto begin() {
                return arr->rbegin();
            }
            auto end() {
                return arr->rend();
            }
        };
        return Wrapper{ .arr = *this };
    }

    auto indexIterate() {
        struct Wrapper {
            struct Iterator {
                ssize index;
                bool operator!=(const Iterator& b) const { return index != b.index; }
                void operator++() { index++; }
                ssize operator*() { return index; }
            };
            ssize length;
            auto begin() { return Iterator{ .index = 0 }; }
            auto end() { return Iterator{ .index = length }; }
        };
        return Wrapper{ .length = (ssize)(*this)->size() };
    }
};

template<typename T>
class ArrayView {
public:
    typedef Array<T> Type;
    Array$<T> array;
    ssize from;
    ssize to;

    std::vector<T>& checkRange() const
    {
        if (to > array.length()) {
            FATAL("Outdated range");
        }
        return *array;
    }

    template<class UnboundedRange>
    std::enable_if_t<std::is_class<UnboundedRange>::value, ArrayView> operator[](const UnboundedRange& r) {
        return operator[](r.bound((*this)->size()));
    }

    template<class UnboundedRange>
    std::enable_if_t<std::is_class<UnboundedRange>::value, ArrayView> operator()(const UnboundedRange& r) {
        return operator()(r.bound((*this)->size()));
    }

    T& operator[](ssize index) {
        auto& v = checkRange();
        index += from;
        if (index < from || index >= to) {
            FATAL("Index out of bounds.");
        }
        return v[index];
    }

    T& operator()(ssize index) {
        auto& v = checkRange();
        index += from;
        if (index < from) {
            FATAL("Index out of bounds.");
        }
        if (index >= to) {
            length(index + 1 - from);
        }
        return v[index];
    }

    ArrayView operator[](const Range& r) {
        ssize absFrom = r.from + from;
        ssize absTo = r.to + from;
        if (absTo < absFrom || absFrom < from || absTo > to) {
            FATAL("Invalid range.");
        }
        return ArrayView{
            .array = array,
            .from = absFrom,
            .to = absTo,
        };
    }

    ArrayView operator()(const Range& r) {
        ssize absFrom = r.from + from;
        ssize absTo = r.to + from;
        if (absTo < absFrom || absFrom < from) {
            FATAL("Invalid range.");
        }
        if (absTo > to) {
            length(absTo - from);
        }
        return ArrayView{
            .array = array,
            .from = absFrom,
            .to = absTo,
        };
    }

    ArrayView<T> operator[](const RelaxedRange& r) {
        ssize absFrom = r.from + from;
        ssize absTo = r.to + from;
        if (absFrom < from) {
            absFrom = from;
        }
        if (absTo < absFrom) {
            absTo = absFrom;
        }
        if (absTo > to) {
            absTo = to;
            if (absFrom > to) {
                absFrom = to;
            }
        }
        return ArrayView<T>{
            .array = array,
            .from = absFrom,
            .to = absTo,
        };
    }

    ArrayView<T> operator()(const RelaxedRange& r) {
        ssize absFrom = r.from;
        ssize absTo = r.to;
        if (absFrom < from) {
            absFrom = from;
        }
        if (absTo < absFrom) {
            absTo = absFrom;
        }
        if (absTo > to) {
            length(absTo - from);
        }
        return ArrayView<T>{
            .array = array,
            .from = absFrom,
            .to = absTo,
        };
    }

    void clear() {
        auto& v = checkRange();
        v.erase(v.begin() + from, v.begin() + to);
        to = from;
    }

    ssize length() {
        return to - from;
    }

    void length(ssize newLength) {
        if (newLength < 0) {
            FATAL("Invalid length.");
        }
        auto& v = checkRange();
        ssize oldLength = to - from;
        if (newLength <= oldLength) {
            v.erase(v.begin() + from + newLength, v.begin() + to);
        } else {
            v.insert(v.begin() + to, newLength - oldLength, T());
        }
        to = from + newLength;
    }

    auto& back(ssize index) {
        return operator[](to - index - 1);
    }

    bool empty() {
        return to <= from;
    }

    auto operator()() {
        struct Wrapper {
            ArrayView& view;
            void operator=(const T& item) {
                auto& v = view.checkRange();
                v.insert(v.begin() + view.to, item);
                view.to++;
            }
        };
        return Wrapper{ .view = *this };
    }

    auto begin() const {
        auto& v = checkRange();
        return v.begin() + from;
    }

    auto end() const {
        auto& v = checkRange();
        return v.begin() + to;
    }

    auto reverseIterate() {
        struct Wrapper {
            typename std::vector<T>::reverse_iterator rbegin;
            typename std::vector<T>::reverse_iterator rend;
            auto& begin() {
                return rbegin;
            }
            auto& end() {
                return rend;
            }
        };
        auto& v = checkRange();
        return Wrapper{ .rbegin = v.rbegin() + (v.size() - to), .rend = v.rbegin() + (v.size() - from) };
    }

    auto indexIterate() {
        struct Wrapper {
            struct Iterator {
                ssize index;
                bool operator!=(const Iterator& b) const { return index != b.index; }
                void operator++() { index++; }
                ssize operator*() { return index; }
            };
            ssize length;
            auto begin() { return Iterator{ .index = 0 }; }
            auto end() { return Iterator{ .index = length }; }
        };
        return Wrapper{ .length = (ssize)(*this)->size() };
    }

    void operator=(const ArrayView& src) {
        copyArray(src.checkRange(), src.from, src.to);
    }

    void operator=(Array$<T> src) {
        copyArray(*src, 0, src.length());
    }

    void copyArray(const std::vector<T>& src, ssize srcFrom, ssize srcTo)
    {
        std::vector<T>& v = checkRange();
        ssize size = to - from;
        ssize srcSize = srcTo - srcFrom;
        if (&v == &src)
        {
            ssize minSize = std::min(size, srcSize);
            if (from == srcFrom) {
                // Nothing to copy - already in place
            } else if (from < srcFrom) {
                std::copy(v.cbegin() + srcFrom, v.cbegin() + srcFrom + minSize, v.begin() + from);
            } else {
                std::copy(v.crend() - srcFrom - minSize, v.crend() - srcFrom, v.rend() - from - minSize);
            }

            if (size >= srcSize) {
                v.erase(v.begin() + from + srcSize, v.begin() + to);
            } else {
                FATAL("TODO: implement");
            }
        }
        else
        {
            if (size < srcSize)
            {
                std::copy(src.cbegin() + srcFrom, src.cbegin() + srcFrom + size, v.begin() + from);
                v.insert(v.begin() + to, src.cbegin() + srcFrom + size, src.cbegin() + srcFrom + srcSize);
            }
            else
            {
                std::copy(src.cbegin() + srcFrom, src.cbegin() + srcFrom + srcSize, v.begin() + from);
                v.erase(v.begin() + from + srcSize, v.begin() + to);
            }
        }
    }

};

template<typename T>
using Array$$ = Array$<T, DOLLAR_INSTANCE>;

template<typename T>
using Array$N = Array$<T, DOLLAR_NULLABLE>;

#endif // _ARRAY_HH_
