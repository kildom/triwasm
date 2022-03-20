#ifndef _RANGE_HH_
#define _RANGE_HH_

#include "types.hh"

class Range {
public:
    ssize from;
    ssize to;
    Range(ssize from, ssize to) : from(from), to(to) { }
    Range bound(ssize length) const { return Range(*this); }
};

struct RangeFull       {                       Range bound(ssize length) const { return Range(0, length); } };
struct RangeLeftBegin  { ssize to;             Range bound(ssize length) const { return Range(0, to); } };
struct RangeLeftEnd    { ssize to;             Range bound(ssize length) const { return Range(0, length - to); } };
struct RangeRightBegin { ssize from;           Range bound(ssize length) const { return Range(from, length); } };
struct RangeRightEnd   { ssize from;           Range bound(ssize length) const { return Range(length - from, length); } };
struct RangeBeginEnd   { ssize from; ssize to; Range bound(ssize length) const { return Range(from, length - to); } };
struct RangeEndBegin   { ssize from; ssize to; Range bound(ssize length) const { return Range(length - from, to); } };
struct RangeEndEnd     { ssize from; ssize to; Range bound(ssize length) const { return Range(length - from, length - to); } };

static const RangeFull R;

static inline RangeLeftBegin  operator|  (RangeFull, ssize to)            { return RangeLeftBegin{ .to = to }; }
static inline RangeLeftEnd    operator|| (RangeFull, ssize to)            { return RangeLeftEnd{ .to = to }; }
static inline RangeRightBegin operator|  (ssize from, RangeFull)          { return RangeRightBegin{ .from = from }; }
static inline RangeRightEnd   operator|| (ssize from, RangeFull)          { return RangeRightEnd{ .from = from }; }
static inline Range           operator|  (RangeRightBegin from, ssize to) { return Range(from.from, to); }
static inline RangeBeginEnd   operator|| (RangeRightBegin from, ssize to) { return RangeBeginEnd{ .from = from.from, .to = to }; }
static inline RangeEndBegin   operator|| (ssize from, RangeLeftBegin to)  { return RangeEndBegin{ .from = from, .to = to.to }; }
static inline RangeEndEnd     operator|| (RangeRightEnd from, ssize to)   { return RangeEndEnd{ .from = from.from, .to = to }; }

class RelaxedRange {
public:
    ssize from;
    ssize to;
    RelaxedRange(ssize from, ssize to) : from(from), to(to) { }
    RelaxedRange bound(ssize length) const { return RelaxedRange(*this); }
};

struct RelaxedRangeFull       {                       RelaxedRange bound(ssize length) const { return RelaxedRange(0, length); } };
struct RelaxedRangeLeftBegin  { ssize to;             RelaxedRange bound(ssize length) const { return RelaxedRange(0, to); } };
struct RelaxedRangeLeftEnd    { ssize to;             RelaxedRange bound(ssize length) const { return RelaxedRange(0, length - to); } };
struct RelaxedRangeRightBegin { ssize from;           RelaxedRange bound(ssize length) const { return RelaxedRange(from, length); } };
struct RelaxedRangeRightEnd   { ssize from;           RelaxedRange bound(ssize length) const { return RelaxedRange(length - from, length); } };
struct RelaxedRangeBeginEnd   { ssize from; ssize to; RelaxedRange bound(ssize length) const { return RelaxedRange(from, length - to); } };
struct RelaxedRangeEndBegin   { ssize from; ssize to; RelaxedRange bound(ssize length) const { return RelaxedRange(length - from, to); } };
struct RelaxedRangeEndEnd     { ssize from; ssize to; RelaxedRange bound(ssize length) const { return RelaxedRange(length - from, length - to); } };

static const RelaxedRangeFull RR;

static inline RelaxedRangeLeftBegin  operator|  (RelaxedRangeFull, ssize to)            { return RelaxedRangeLeftBegin{ .to = to }; }
static inline RelaxedRangeLeftEnd    operator|| (RelaxedRangeFull, ssize to)            { return RelaxedRangeLeftEnd{ .to = to }; }
static inline RelaxedRangeRightBegin operator|  (ssize from, RelaxedRangeFull)          { return RelaxedRangeRightBegin{ .from = from }; }
static inline RelaxedRangeRightEnd   operator|| (ssize from, RelaxedRangeFull)          { return RelaxedRangeRightEnd{ .from = from }; }
static inline RelaxedRange           operator|  (RelaxedRangeRightBegin from, ssize to) { return RelaxedRange(from.from, to); }
static inline RelaxedRangeBeginEnd   operator|| (RelaxedRangeRightBegin from, ssize to) { return RelaxedRangeBeginEnd{ .from = from.from, .to = to }; }
static inline RelaxedRangeEndBegin   operator|| (ssize from, RelaxedRangeLeftBegin to)  { return RelaxedRangeEndBegin{ .from = from, .to = to.to }; }
static inline RelaxedRangeEndEnd     operator|| (RelaxedRangeRightEnd from, ssize to)   { return RelaxedRangeEndEnd{ .from = from.from, .to = to }; }

#endif
