#ifndef _STRING_HH_
#define _STRING_HH_

#include <string>
#include <regex>

#include "trace.hh"
#include "types.hh"
#include "dollar.hh"
#include "range.hh"
#include "array.hh"

template<typename T = char, DollarRefType refType = DOLLAR_NOT_NULL>
class GenericString$;

template<typename T>
class GenericRegExMatch {
    std::match_results<typename std::basic_string<T>::const_iterator> results;
    GenericString$<T> string;
};

template<typename T>
using GenericRegExMatch$ = $<GenericRegExMatch<T>, DOLLAR_NOT_NULL>;

template<typename T>
using GenericRegExMatch$$ = $<GenericRegExMatch<T>, DOLLAR_INSTANCE>;

template<typename T>
using GenericRegExMatch$N = $<GenericRegExMatch<T>, DOLLAR_NULLABLE>;


template<typename T = char, DollarRefType refType = DOLLAR_NOT_NULL>
class GenericRegEx$ : public $<std::basic_regex<T>, refType> {
private:
    struct CacheKey {
        ssize ptr;
        ssize length;
        bool operator<(const CacheKey& b) const {
            if (ptr < b.ptr) return true;
            if (ptr > b.ptr) return false;
            return length < b.length;
        }
    };
    static std::map<CacheKey, GenericRegEx$> cache;
    static constexpr std::regex_constants::syntax_option_type toStdFlags(int flags) {
        auto result = std::regex_constants::ECMAScript;
        if (flags & IGNORE_CASE) result |= std::regex_constants::icase;
        if (flags & OPTIMIZE) result |= std::regex_constants::optimize;
        return result;
    }
public:
    static const int IGNORE_CASE = 1;
    static const int OPTIMIZE = 2;

    using $<std::basic_regex<T>, refType>::$;
    using $<std::basic_regex<T>, refType>::operator=;

    GenericRegEx$(GenericString$<T> text, int flags = 0) : $<std::basic_regex<T>, refType>() {
        DBG("RegEx ## constr(String$)");
        $<std::basic_regex<T>, refType>::createInplace(*text, toStdFlags(flags));
    }

    GenericRegEx$(const T* text, ssize length, int flags) : $<std::basic_regex<T>, refType>() {
        DBG("RegEx ## constr(T*, ssize, flags)");
        if (length < 0) {
            FATAL("Invalid length");
        }
        $<std::basic_regex<T>, refType>::createInplace(text, text + length, toStdFlags(flags));
    }

    static GenericRegEx$ getLiteralCached(const char* text, ssize length, bool ignore_case) {
        CacheKey key = CacheKey { .ptr = (ssize)(const void*)text, .length = ignore_case ? -length : length };
        if (cache.count(key) > 0) {
            return cache[key];
        }
        GenericRegEx$ value;
        value.createInplace(text, text + length, std::regex_constants::ECMAScript
                | std::regex_constants::optimize
                | (ignore_case ? std::regex_constants::icase : std::regex_constants::optimize));
        cache[key] = value;
        return value;
    }

    static void clearLiteralCache() {
        cache.clear();
    }
};

template<typename T, DollarRefType refType>
std::map<typename GenericRegEx$<T, refType>::CacheKey, GenericRegEx$<T, refType>> GenericRegEx$<T, refType>::cache;

template<typename T = char>
using String = std::basic_string<T>;

template<typename T = char>
class GenericStringView;

template<typename T, DollarRefType refType>
class GenericString$ : public $<std::basic_string<T>, refType> {
public:
    using $<std::basic_string<T>, refType>::$;
    using $<std::basic_string<T>, refType>::operator=;

    GenericString$(const GenericStringView<T> &a) : $<std::basic_string<T>, refType>() {
        DBG("String ## constr(GenericStringView<T> a)");
        auto& v = a.checkRange();
        $<std::basic_string<T>, refType>::createInplace(v.c_str() + a.from, a.to - a.from);
    }

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
    std::enable_if_t<std::is_class<UnboundedRange>::value, GenericStringView<T>> operator[](const UnboundedRange& r) {
        return operator[](r.bound((*this)->size()));
    }

    template<class UnboundedRange>
    std::enable_if_t<std::is_class<UnboundedRange>::value, GenericStringView<T>> operator()(const UnboundedRange& r) {
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

    GenericStringView<T> operator[](const Range& r) {
        if (r.to < r.from || r.from < 0 || r.to > (ssize)(*this)->size()) {
            FATAL("Invalid range.");
        }
        return GenericStringView<T>{
            .string = *this,
            .from = r.from,
            .to = r.to,
        };
    }

    GenericStringView<T> operator()(const Range& r) {
        if (r.to < r.from || r.from < 0) {
            FATAL("Invalid range.");
        }
        if (r.to > (ssize)(*this)->size()) {
            (*this)->resize(r.to);
        }
        return GenericStringView<T>{
            .string = *this,
            .from = r.from,
            .to = r.to,
        };
    }

    GenericStringView<T> operator[](const RelaxedRange& r) {
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
        return GenericStringView<T>{
            .string = *this,
            .from = from,
            .to = to,
        };
    }

    GenericStringView<T> operator()(const RelaxedRange& r) {
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
        return GenericStringView<T>{
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

    int _compare(const GenericStringView<T>& b) const {
        auto& bv = b.checkRange();
        auto len = length();
        auto blen = b.to - b.from;
        auto mlen = std::min(len, blen);
        auto res = std::memcmp((*this)->c_str(), bv->c_str() + b.from, mlen); // TODO: This will work only for char and bytes
        if (res == 0) {
            if (len < blen) {
                return -1;
            } else if (len > blen) {
                return 1;
            }
        }
        return res;
    }

    int _compare(const GenericString$<T, DOLLAR_NULLABLE>& b) const {
        auto len = length();
        auto blen = b.length();
        auto mlen = std::min(len, blen);
        auto res = std::memcmp((*this)->c_str(), b->c_str(), mlen);
        if (res == 0) {
            if (len < blen) {
                return -1;
            } else if (len > blen) {
                return 1;
            }
        }
        return res;
    }

    int _compare(const char* b) const {
        auto len = length();
        ssize blen = strlen(b);
        auto mlen = std::min(len, blen);
        auto res = std::memcmp((*this)->c_str(), b, mlen);
        if (res == 0) {
            if (len < blen) {
                return -1;
            } else if (len > blen) {
                return 1;
            }
        }
        return res;
    }

    template<typename T2> bool operator==(T2& b) const { return _compare(b) == 0; } // TODO: Can be optimized for "==" instead of using _compare()
    template<typename T2> bool operator!=(T2& b) const { return _compare(b) != 0; } //
    template<typename T2> bool operator<(T2& b) const { return _compare(b) < 0; }
    template<typename T2> bool operator>(T2& b) const { return _compare(b) > 0; }
    template<typename T2> bool operator<=(T2& b) const { return _compare(b) <= 0; }
    template<typename T2> bool operator>=(T2& b) const { return _compare(b) >= 0; }

    void operator+=(T c) {
        (**this) += c;
    }

    void operator+=(const T* str) {
        (**this) += str;
    }

    void operator+=(const GenericString$& str) {
        (**this) += *str;
    }

    ssize count(T c) const {
        ssize result = 0;
        auto it = (*this)->cbegin();
        for (auto last = (*this)->cend(); it != last; ++it) {
            if (c == *it) {
                result++;
            }
        }
        return result;
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

    Array$N<GenericStringView<T>> copyMatchedGroups(
            const std::match_results<typename std::basic_string<T>::const_iterator>& matchResults,
            bool withPrefixSuffix)
    {
        if (matchResults.empty()) {
            return nullptr;
        } else {
            auto begin = (*this)->cbegin();
            ssize notMatchedValue = (*this)->size() + 1;
            Array$<GenericStringView<T>> result;
            ssize groupCount = matchResults.size();
            result.createInplace(groupCount + (withPrefixSuffix ? 2 : 0));
            ssize i = 0;
            while (i < groupCount) {
                auto& group = matchResults[i];
                auto& item = result[i];
                item.string = *this;
                if (group.matched) {
                    item.from = group.first - begin;
                    item.to = group.second - begin;
                } else {
                    item.from = 0;
                    item.to = notMatchedValue;
                }
                i++;
            }
            if (withPrefixSuffix) {
                auto& prefix = matchResults.prefix();
                auto& item1 = result[i++];
                item1.string = *this;
                item1.from = prefix.first - begin;
                item1.to = prefix.second - begin;
                auto& suffix = matchResults.suffix();
                auto& item2 = result[i++];
                item2.string = *this;
                item2.from = suffix.first - begin;
                item2.to = suffix.second - begin;
            }
            return result;
        }
    }

    Array$N<GenericStringView<T>> match(GenericRegEx$<T> pattern) {
        std::match_results<typename std::basic_string<T>::const_iterator> matchResults;
        std::regex_match(**this, matchResults, *pattern);
        return copyMatchedGroups(matchResults, false);
    }

    bool isMatch(GenericRegEx$<T> pattern) {
        return std::regex_match(**this, *pattern);
    }

    Array$N<GenericStringView<T>> search(GenericRegEx$<T> pattern) {
        std::match_results<typename std::basic_string<T>::const_iterator> matchResults;
        std::regex_search(**this, matchResults, *pattern);
        return copyMatchedGroups(matchResults, true);
    }

    bool isSearch(GenericRegEx$<T> pattern) {
        return std::regex_search(**this, *pattern);
    }

    Array$<Array$<GenericStringView<T>>> searchAll(GenericRegEx$<T> pattern) {
        Array$$<Array$<GenericStringView<T>>> result;
        std::regex_iterator<typename std::basic_string<T>::const_iterator> it((*this)->begin(), (*this)->end(), *pattern);
        for (decltype(it) last; it != last; ++it) {
            result() = copyMatchedGroups(*it, true);
        }
        return result;
    }

    GenericString$<T> replace(GenericRegEx$<T> pattern, GenericString$<T> format, bool matchAll = true, bool outputAll = true) {
        GenericString$<T, DOLLAR_INSTANCE> result;
        auto ins = back_inserter(*result);
        auto flags = std::regex_constants::match_default;
        if (!matchAll) {
            flags |= std::regex_constants::format_first_only;
        }
        if (!outputAll) {
            flags |= std::regex_constants::format_no_copy;
        }
        std::regex_replace(ins, (*this)->begin(), (*this)->end(), *pattern, *format, flags);
        return result;
    }

};

template<typename T>
class GenericStringView {
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

    bool valid() const
    {
        return to <= string.length();
    }

    template<class UnboundedRange>
    std::enable_if_t<std::is_class<UnboundedRange>::value, GenericStringView> operator[](const UnboundedRange& r) {
        return operator[](r.bound((*this)->size()));
    }

    template<class UnboundedRange>
    std::enable_if_t<std::is_class<UnboundedRange>::value, GenericStringView> operator()(const UnboundedRange& r) {
        return operator()(r.bound((*this)->size()));
    }

    T& operator[](ssize index) const {
        auto& v = checkRange();
        index += from;
        if (index < from || index >= to) {
            FATAL("Index out of bounds.");
        }
        return v[index];
    }

    T& operator()(ssize index) const {
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

    GenericStringView operator[](const Range& r) {
        ssize absFrom = r.from + from;
        ssize absTo = r.to + from;
        if (absTo < absFrom || absFrom < from || absTo > to) {
            FATAL("Invalid range.");
        }
        return GenericStringView{
            .string = string,
            .from = absFrom,
            .to = absTo,
        };
    }

    GenericStringView operator()(const Range& r) {
        ssize absFrom = r.from + from;
        ssize absTo = r.to + from;
        if (absTo < absFrom || absFrom < from) {
            FATAL("Invalid range.");
        }
        if (absTo > to) {
            length(absTo - from);
        }
        return GenericStringView{
            .string = string,
            .from = absFrom,
            .to = absTo,
        };
    }

    GenericStringView<T> operator[](const RelaxedRange& r) {
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
        return GenericStringView<T>{
            .string = string,
            .from = absFrom,
            .to = absTo,
        };
    }

    GenericStringView<T> operator()(const RelaxedRange& r) {
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
        return GenericStringView<T>{
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
            GenericStringView& view;
            void operator=(const T& item) {
                auto& v = view.checkRange();
                v.insert(v.begin() + view.to, item);
                view.to++;
            }
        };
        return Wrapper{ .view = *this };
    }

    int _compare(const GenericStringView& b) const {
        auto& v = checkRange();
        auto& bv = b.checkRange();
        auto len = to - from;
        auto blen = b.to - b.from;
        auto mlen = std::min(len, blen);
        auto res = std::memcmp(v.c_str() + from, bv->c_str() + b.from, mlen); // TODO: This will work only for char and bytes
        if (res == 0) {
            if (len < blen) {
                return -1;
            } else if (len > blen) {
                return 1;
            }
        }
        return res;
    }

    int _compare(const GenericString$<T, DOLLAR_NULLABLE>& b) const {
        auto& v = checkRange();
        auto len = to - from;
        auto blen = b.length();
        auto mlen = std::min(len, blen);
        auto res = std::memcmp(v.c_str() + from, b->c_str(), mlen);
        if (res == 0) {
            if (len < blen) {
                return -1;
            } else if (len > blen) {
                return 1;
            }
        }
        return res;
    }

    int _compare(const char* b) const {
        auto& v = checkRange();
        auto len = to - from;
        ssize blen = strlen(b);
        auto mlen = std::min(len, blen);
        auto res = std::memcmp(v.c_str() + from, b, mlen);
        if (res == 0) {
            if (len < blen) {
                return -1;
            } else if (len > blen) {
                return 1;
            }
        }
        return res;
    }

    template<typename T2> bool operator==(T2& b) const { return _compare(b) == 0; } // TODO: Can be optimized for "==" instead of using _compare()
    template<typename T2> bool operator!=(T2& b) const { return _compare(b) != 0; } //
    template<typename T2> bool operator<(T2& b) const { return _compare(b) < 0; }
    template<typename T2> bool operator>(T2& b) const { return _compare(b) > 0; }
    template<typename T2> bool operator<=(T2& b) const { return _compare(b) <= 0; }
    template<typename T2> bool operator>=(T2& b) const { return _compare(b) >= 0; }

    ssize count(T c) const {
        auto& v = checkRange();
        ssize result = 0;
        auto it = v.cbegin() + from;
        for (auto last = it + to; it != last; ++it) {
            if (c == *it) {
                result++;
            }
        }
        return result;
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

    void operator=(const GenericStringView& src) {
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

    Array$N<GenericStringView<T>> match(GenericRegEx$<T> pattern) {
        auto& v = checkRange();
        std::match_results<typename std::basic_string<T>::const_iterator> matchResults;
        std::regex_match(v.cbegin() + from, v.cbegin() + to, matchResults, *pattern);
        return string.copyMatchedGroups(matchResults, false);
    }

    bool isMatch(GenericRegEx$<T> pattern) {
        auto& v = checkRange();
        return std::regex_match(v.cbegin() + from, v.cbegin() + to, *pattern);
    }

    Array$N<GenericStringView<T>> search(GenericRegEx$<T> pattern) {
        auto& v = checkRange();
        std::match_results<typename std::basic_string<T>::const_iterator> matchResults;
        std::regex_search(v.cbegin() + from, v.cbegin() + to, matchResults, *pattern);
        return string.copyMatchedGroups(matchResults, true);
    }

    bool isSearch(GenericRegEx$<T> pattern) {
        auto& v = checkRange();
        return std::regex_search(v.cbegin() + from, v.cbegin() + to, *pattern);
    }

    Array$<Array$<GenericStringView<T>>> searchAll(GenericRegEx$<T> pattern) {
        auto& v = checkRange();
        Array$$<Array$<GenericStringView<T>>> result;
        std::regex_iterator<typename std::basic_string<T>::const_iterator> it(v.begin() + from, v.begin() + to, *pattern);
        for (decltype(it) last; it != last; ++it) {
            result() = copyMatchedGroups(*it, true);
        }
        return result;
    }

    GenericString$<T> replace(GenericRegEx$<T> pattern, GenericString$<T> format, bool matchAll = true, bool outputAll = true) {
        auto& v = checkRange();
        GenericString$<T, DOLLAR_INSTANCE> result;
        auto ins = back_inserter(*result);
        auto flags = std::regex_constants::match_default;
        if (!matchAll) {
            flags |= std::regex_constants::format_first_only;
        }
        if (!outputAll) {
            flags |= std::regex_constants::format_no_copy;
        }
        std::regex_replace(ins, v.begin() + from, v.begin() + to, *pattern, *format, flags);
        return result;
    }
};

template<typename T>
using GenericString$$ = GenericString$<T, DOLLAR_INSTANCE>;

template<typename T>
using GenericString$N = GenericString$<T, DOLLAR_NULLABLE>;

using String$ = GenericString$<char, DOLLAR_NOT_NULL>;
using String$$ = GenericString$<char, DOLLAR_INSTANCE>;
using String$N = GenericString$<char, DOLLAR_NULLABLE>;
using StringView = GenericStringView<char>;
using Bytes$ = GenericString$<u8, DOLLAR_NOT_NULL>;
using Bytes$$ = GenericString$<u8, DOLLAR_INSTANCE>;
using Bytes$N = GenericString$<u8, DOLLAR_NULLABLE>;
using BytesView = GenericStringView<u8>;

using RegEx$ = GenericRegEx$<char, DOLLAR_NOT_NULL>;
using RegEx$$ = GenericRegEx$<char, DOLLAR_INSTANCE>;
using RegEx$N = GenericRegEx$<char, DOLLAR_NULLABLE>;
using BytesRegEx$ = GenericRegEx$<char, DOLLAR_NOT_NULL>;
using BytesRegEx$$ = GenericRegEx$<char, DOLLAR_INSTANCE>;
using BytesRegEx$N = GenericRegEx$<char, DOLLAR_NULLABLE>;

static inline String$ operator ""_S(const char* text, std::size_t length)
{
    return String$(text, (ssize)length);
}

static inline Bytes$ operator ""_B(const char* text, std::size_t length)
{
    return Bytes$((const u8*)text, (ssize)length);
}

static inline RegEx$ operator ""_R(const char* text, std::size_t length)
{
    return RegEx$::getLiteralCached(text, (ssize)length, false);
}

static inline RegEx$ operator ""_Ri(const char* text, std::size_t length)
{
    return RegEx$::getLiteralCached(text, (ssize)length, true);
}

#endif // _STRING_HH_
