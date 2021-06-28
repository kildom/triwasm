#ifndef _RANGE_HH_
#define _RANGE_HH_

#include "Utils.hh"

class BoundedRange {
public:

    struct Iterator {
        ssize i;
        ssize operator*() {
            return i;
        }
        ssize operator++() {
            i++;
            return i;
        }
        bool operator!=(Iterator other) {
            return i != other.i;
        }
    };

    ssize beginOffset;
    ssize endOffset;
    BoundedRange(ssize begin, ssize end) : beginOffset(begin), endOffset(end) { fixRanges(); }

    void fixRanges() {
        if (beginOffset > endOffset) {
            endOffset = beginOffset;
        }
    }

    Iterator begin() {
        return Iterator{beginOffset};
    }

    Iterator end() {
        return Iterator{endOffset};
    }

};

class Range {
public:

    struct EndOffset {
        ssize offset;
        EndOffset(ssize offset) : offset(offset) { }
    };

    struct EndType {
        EndOffset operator-(ssize offset) {
            return EndOffset(offset);
        }
    };

    ssize beginOffset;
    ssize endOffset;
    bool beginFromEnd;
    bool endFromEnd;
    Range(const BoundedRange& r) : beginOffset(r.beginOffset), endOffset(r.endOffset), beginFromEnd(false), endFromEnd(false) { }
    Range() : beginOffset(0), endOffset(0), beginFromEnd(false), endFromEnd(true) { }
    explicit Range(ssize begin) : beginOffset(begin), endOffset(0), beginFromEnd(false), endFromEnd(true) { }
    Range(EndOffset begin) : beginOffset(begin.offset), endOffset(0), beginFromEnd(true), endFromEnd(true) { }
    Range(ssize begin, ssize end) : beginOffset(begin), endOffset(end), beginFromEnd(false), endFromEnd(false) { fixRanges(); }
    Range(ssize begin, EndOffset end) : beginOffset(begin), endOffset(end.offset), beginFromEnd(false), endFromEnd(true) { }
    Range(EndOffset begin, ssize end) : beginOffset(begin.offset), endOffset(end), beginFromEnd(true), endFromEnd(false) { }
    Range(EndOffset begin, EndOffset end) : beginOffset(begin.offset), endOffset(end.offset), beginFromEnd(true), endFromEnd(true) { }

    void fixRanges() {
        if (beginOffset > endOffset) {
            endOffset = beginOffset;
        }
    }

    BoundedRange::Iterator begin() {
        if (beginFromEnd)
            ASSERT("Cannot take iterator from unbounded range");
        return BoundedRange::Iterator{beginOffset};
    }

    BoundedRange::Iterator end() {
        if (endFromEnd)
            ASSERT("Cannot take iterator from unbounded range");
        return BoundedRange::Iterator{endOffset};
    }

    BoundedRange bound(ssize length) const {
        return BoundedRange(
            beginFromEnd ? length - beginOffset : beginOffset,
            endFromEnd ? length - endOffset : endOffset);
    }

};

__attribute__((used))
static Range::EndType RangeEnd;

#endif /* _RANGE_HH_ */
