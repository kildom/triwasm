#ifndef _STRING_HH_
#define _STRING_HH_

#include <string>

#include "trace.hh"
#include "types.hh"
#include "dollar.hh"
#include "range.hh"


template<typename T = char, DollarRefType refType = DOLLAR_NOT_NULL>
class GenericRegEx$ : public $<std::basic_regex<T>, refType> {
};

template<typename T = char>
using String = std::basic_string<T>;

template<typename T = char>
class StringView;

template<typename T = char, DollarRefType refType = DOLLAR_NOT_NULL>
class GenericString$ : public $<std::basic_string<T>, refType> {
public:
    using $<std::basic_string<T>, refType>::$;
    using $<std::basic_string<T>, refType>::operator=;

    GenericString$(const T* a) : $<std::basic_string<T>, refType>() {
        DBG("String ## constr(const T* a)");
        $<std::basic_string<T>, refType>::createInplace(a);
    }

    GenericString$(const T* a, ssize length) : $<std::basic_string<T>, refType>() {
        DBG("String ## constr(const T*, ssize)");
        if (length < 0) {
            FATAL("Negative string length.");
        }
        $<std::basic_string<T>, refType>::createInplace(a, (std::size_t)length);
    }

    void operator=(const T* a) {
        DBG("String ## =(const T* a)");
        $<std::basic_string<T>, refType>::createInplace(a);
    }

    template<DollarRefType refType2>
    GenericString$(const $<std::basic_string<T>, refType2> &a) : $<std::basic_string<T>, refType>(a) { DBG("## GenericString$(const T* a)");  }

    template<DollarRefType refType2>
    GenericString$($<std::basic_string<T>, refType2> &&a) : $<std::basic_string<T>, refType>(a) { }

    template<DollarRefType refType2>
    void operator=(const $<std::basic_string<T>, refType2> &a) { $<std::basic_string<T>, refType>::operator=(a); }

    template<DollarRefType refType2>
    void operator=($<std::basic_string<T>, refType2> &&a) { $<std::basic_string<T>, refType>::operator=(a); }

    template<class UnboundedRange>
    std::enable_if_t<std::is_class<UnboundedRange>::value, StringView<T>> operator[](const UnboundedRange& r) {
        return operator[](r.bound((*this)->size()));
    }

    template<class UnboundedRange>
    std::enable_if_t<std::is_class<UnboundedRange>::value, StringView<T>> operator()(const UnboundedRange& r) {
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

    StringView<T> operator[](const Range& r) {
        if (r.to < r.from || r.from < 0 || r.to > (ssize)(*this)->size()) {
            FATAL("Invalid range.");
        }
        return StringView<T>{
            .string = *this,
            .from = r.from,
            .to = r.to,
        };
    }

    StringView<T> operator()(const Range& r) {
        if (r.to < r.from || r.from < 0) {
            FATAL("Invalid range.");
        }
        if (r.to > (ssize)(*this)->size()) {
            (*this)->resize(r.to);
        }
        return StringView<T>{
            .string = *this,
            .from = r.from,
            .to = r.to,
        };
    }

    StringView<T> operator[](const RelaxedRange& r) {
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
        return StringView<T>{
            .string = *this,
            .from = from,
            .to = to,
        };
    }

    StringView<T> operator()(const RelaxedRange& r) {
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
        return StringView<T>{
            .string = *this,
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
            FATAL("Cannot get value from empty string.");
        }
        return (*this)->back();
    }

    auto pop() {
        if ((*this)->empty()) {
            FATAL("Cannot pop from empty string.");
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
            GenericString$& str;
            void operator=(const T& item) {
                str->push_back(item);
            }
        };
        return Wrapper{ .str = *this };
    }

    auto begin() const {
        return (*this)->begin();
    }

    auto end() const {
        return (*this)->end();
    }

    auto reverseIterate() {
        struct Wrapper {
            GenericString$ str;
            auto begin() {
                return str->rbegin();
            }
            auto end() {
                return str->rend();
            }
        };
        return Wrapper{ .str = *this };
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
class StringView {
public:
    typedef String<T> Type;
    GenericString$<T> string;
    ssize from;
    ssize to;

    std::basic_string<T>& checkRange() const
    {
        if (to > string.length()) {
            FATAL("Outdated range");
        }
        return *string;
    }

    template<class UnboundedRange>
    std::enable_if_t<std::is_class<UnboundedRange>::value, StringView> operator[](const UnboundedRange& r) {
        return operator[](r.bound((*this)->size()));
    }

    template<class UnboundedRange>
    std::enable_if_t<std::is_class<UnboundedRange>::value, StringView> operator()(const UnboundedRange& r) {
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

    StringView operator[](const Range& r) {
        ssize absFrom = r.from + from;
        ssize absTo = r.to + from;
        if (absTo < absFrom || absFrom < from || absTo > to) {
            FATAL("Invalid range.");
        }
        return StringView{
            .string = string,
            .from = absFrom,
            .to = absTo,
        };
    }

    StringView operator()(const Range& r) {
        ssize absFrom = r.from + from;
        ssize absTo = r.to + from;
        if (absTo < absFrom || absFrom < from) {
            FATAL("Invalid range.");
        }
        if (absTo > to) {
            length(absTo - from);
        }
        return StringView{
            .string = string,
            .from = absFrom,
            .to = absTo,
        };
    }

    StringView<T> operator[](const RelaxedRange& r) {
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
        return StringView<T>{
            .string = string,
            .from = absFrom,
            .to = absTo,
        };
    }

    StringView<T> operator()(const RelaxedRange& r) {
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
        return StringView<T>{
            .string = string,
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
            StringView& view;
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
            typename std::basic_string<T>::reverse_iterator rbegin;
            typename std::basic_string<T>::reverse_iterator rend;
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
        return Wrapper{ .view = (ssize)(*this)->size() };
    }

    void operator=(const StringView& src) {
        copyString(src.checkRange(), src.from, src.to);
    }

    void operator=(GenericString$<T> src) {
        copyString(*src, 0, src.length());
    }

    void copyString(const std::basic_string<T>& src, ssize srcFrom, ssize srcTo)
    {
        std::basic_string<T>& v = checkRange();
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
using GenericString$$ = GenericString$<T, DOLLAR_INSTANCE>;

template<typename T>
using GenericString$N = GenericString$<T, DOLLAR_NULLABLE>;

using String$ = GenericString$<char, DOLLAR_NOT_NULL>;
using String$$ = GenericString$<char, DOLLAR_INSTANCE>;
using String$N = GenericString$<char, DOLLAR_NULLABLE>;
using Bytes$ = GenericString$<u8, DOLLAR_NOT_NULL>;
using Bytes$$ = GenericString$<u8, DOLLAR_INSTANCE>;
using Bytes$N = GenericString$<u8, DOLLAR_NULLABLE>;

using RegEx$ = GenericRegEx$<char, DOLLAR_NOT_NULL>;
using RegEx$$ = GenericRegEx$<char, DOLLAR_INSTANCE>;
using RegEx$N = GenericRegEx$<char, DOLLAR_NULLABLE>;
using BytesRegEx$ = GenericRegEx$<char, DOLLAR_NOT_NULL>;
using BytesRegEx$$ = GenericRegEx$<char, DOLLAR_INSTANCE>;
using BytesRegEx$N = GenericRegEx$<char, DOLLAR_NULLABLE>;

String$ operator ""_S(const char* text, std::size_t length)
{
    return String$(text, (ssize)length);
}

Bytes$ operator ""_B(const char* text, std::size_t length)
{
    return Bytes$((const u8*)text, (ssize)length);
}
/*
RegEx$ operator ""_R(const char* text, std::size_t length)
{
    return RegEx$(std::string(text, (ssize)length));
}

RegEx$ operator ""_Ri(const char* text, std::size_t length)
{
    return RegEx$(std::string(text, (ssize)length), RegEx$::IGNORE_CASE);
}

RegEx$ operator ""_Ro(const char* text, std::size_t length)
{
    return RegEx$(std::string(text, (ssize)length), RegEx$::OPTIMIZE);
}

RegEx$ operator ""_Rio(const char* text, std::size_t length)
{
    return RegEx$(std::string(text, (ssize)length), RegEx$::IGNORE_CASE | RegEx$::OPTIMIZE);
}
*/
#endif // _STRING_HH_
