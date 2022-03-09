
class Range {
public:
    ssize_t from;
    ssize_t to;
    Range(ssize_t from, ssize_t to) : from(from), to(to) { }
    Range bound(ssize_t length) const { return Range(*this); }
};

struct RangeFull       {                           Range bound(ssize_t length) const { return Range(0, length); } };
struct RangeLeftBegin  { ssize_t to;               Range bound(ssize_t length) const { return Range(0, to); } };
struct RangeLeftEnd    { ssize_t to;               Range bound(ssize_t length) const { return Range(0, length - to); } };
struct RangeRightBegin { ssize_t from;             Range bound(ssize_t length) const { return Range(from, length); } };
struct RangeRightEnd   { ssize_t from;             Range bound(ssize_t length) const { return Range(length - from, length); } };
struct RangeBeginEnd   { ssize_t from; ssize_t to; Range bound(ssize_t length) const { return Range(from, length - to); } };
struct RangeEndBegin   { ssize_t from; ssize_t to; Range bound(ssize_t length) const { return Range(length - from, to); } };
struct RangeEndEnd     { ssize_t from; ssize_t to; Range bound(ssize_t length) const { return Range(length - from, length - to); } };

static const RangeFull R;

static inline RangeLeftBegin  operator|  (RangeFull, ssize_t to)            { return RangeLeftBegin{ .to = to }; }
static inline RangeLeftEnd    operator|| (RangeFull, ssize_t to)            { return RangeLeftEnd{ .to = to }; }
static inline RangeRightBegin operator|  (ssize_t from, RangeFull)          { return RangeRightBegin{ .from = from }; }
static inline RangeRightEnd   operator|| (ssize_t from, RangeFull)          { return RangeRightEnd{ .from = from }; }
static inline Range           operator|  (RangeRightBegin from, ssize_t to) { return Range(from.from, to); }
static inline RangeBeginEnd   operator|| (RangeRightBegin from, ssize_t to) { return RangeBeginEnd{ .from = from.from, .to = to }; }
static inline RangeEndBegin   operator|| (ssize_t from, RangeLeftBegin to)  { return RangeEndBegin{ .from = from, .to = to.to }; }
static inline RangeEndEnd     operator|| (RangeRightEnd from, ssize_t to)   { return RangeEndEnd{ .from = from.from, .to = to }; }

class RelaxedRange {
public:
    ssize_t from;
    ssize_t to;
    RelaxedRange(ssize_t from, ssize_t to) : from(from), to(to) { }
    RelaxedRange bound(ssize_t length) const { return RelaxedRange(*this); }
};

struct RelaxedRangeFull       {                           RelaxedRange bound(ssize_t length) const { return RelaxedRange(0, length); } };
struct RelaxedRangeLeftBegin  { ssize_t to;               RelaxedRange bound(ssize_t length) const { return RelaxedRange(0, to); } };
struct RelaxedRangeLeftEnd    { ssize_t to;               RelaxedRange bound(ssize_t length) const { return RelaxedRange(0, length - to); } };
struct RelaxedRangeRightBegin { ssize_t from;             RelaxedRange bound(ssize_t length) const { return RelaxedRange(from, length); } };
struct RelaxedRangeRightEnd   { ssize_t from;             RelaxedRange bound(ssize_t length) const { return RelaxedRange(length - from, length); } };
struct RelaxedRangeBeginEnd   { ssize_t from; ssize_t to; RelaxedRange bound(ssize_t length) const { return RelaxedRange(from, length - to); } };
struct RelaxedRangeEndBegin   { ssize_t from; ssize_t to; RelaxedRange bound(ssize_t length) const { return RelaxedRange(length - from, to); } };
struct RelaxedRangeEndEnd     { ssize_t from; ssize_t to; RelaxedRange bound(ssize_t length) const { return RelaxedRange(length - from, length - to); } };

static const RelaxedRangeFull RR;

static inline RelaxedRangeLeftBegin  operator|  (RelaxedRangeFull, ssize_t to)            { return RelaxedRangeLeftBegin{ .to = to }; }
static inline RelaxedRangeLeftEnd    operator|| (RelaxedRangeFull, ssize_t to)            { return RelaxedRangeLeftEnd{ .to = to }; }
static inline RelaxedRangeRightBegin operator|  (ssize_t from, RelaxedRangeFull)          { return RelaxedRangeRightBegin{ .from = from }; }
static inline RelaxedRangeRightEnd   operator|| (ssize_t from, RelaxedRangeFull)          { return RelaxedRangeRightEnd{ .from = from }; }
static inline RelaxedRange           operator|  (RelaxedRangeRightBegin from, ssize_t to) { return RelaxedRange(from.from, to); }
static inline RelaxedRangeBeginEnd   operator|| (RelaxedRangeRightBegin from, ssize_t to) { return RelaxedRangeBeginEnd{ .from = from.from, .to = to }; }
static inline RelaxedRangeEndBegin   operator|| (ssize_t from, RelaxedRangeLeftBegin to)  { return RelaxedRangeEndBegin{ .from = from, .to = to.to }; }
static inline RelaxedRangeEndEnd     operator|| (RelaxedRangeRightEnd from, ssize_t to)   { return RelaxedRangeEndEnd{ .from = from.from, .to = to }; }


/*
    Arr arr;

    auto e = arr[12];
    std::cout << e.from << ":" << e.to << "\n";

    e = arr[3 |R| 4];
    std::cout << e.from << ":" << e.to << "\n";

    e = arr[R|| 1];
    std::cout << e.from << ":" << e.to << "\n";

    e = arr(R|| 1);
    std::cout << e.from << ":" << e.to << "\n";

#define SHOW(x) do { std::cout << #x << "           " << typeid(decltype(x)).name() << "            "; auto a = (x).bound(100); std::cout << a.from << ":" << a.to << "\n"; } while(0)

    SHOW(R);
    SHOW(R| 12);
    SHOW(R|| 34);
    SHOW(56 |R);
    SHOW(56 ||R);
    SHOW(78 |R| 12);
    SHOW(78 |R|| 12);
    SHOW(78 ||R| 12);
    SHOW(78 ||R|| 12);*/

    /*
    auto view = arr[RR|| 12];

    auto before_last_or_last_if_one_element = arr[RR|| 2][0];

    auto last_element = arr[E| 1];

    arr(E| 0) = 12; // push to the end
    arr.push(12);
    arr.std();

    arr[R| 5].remove(); // remove first 5 elements
    arr[RR| 5].remove(); // remove first 5 elements or all if array is smaller than 5

    arr[0 ||R] = other_array; // append other_array to the end of arr

    Python   C++
    [:]      [R]         - full range
    [x:]     [x |R]      - all elements starting from x (inclusive)
    [:x]     [R| x]      - all elements before x (exclusive)
    [x:y]    [x |R| y]   - all elements starting from x (inclusive) and before y (exclusive)
    [-x:]    [x ||R]     - 
    [:-x]    [R|| x]
    [x:-y]   [x |R|| y]
    ...

    TODO: x |RR| y - RelaxedRange will never cause index out of bounds fault, but it will adjust to what is available.

    tab[3 |R] = 1;       // 3 | RangeFull -> RangeRightBegin
    tab[3 |R| 7] = 0;    // ..., RangeRightBegin | 7 -> RangeBeginBegin
    tab[R| 7] = 2;       // RangeFull | 7 -> RangeLeftBegin
    tab[3 |R|| 7] = 9;   // ..., RangeRightBegin || 7 -> RangeBeginEnd
    tab[3 ||R|| 1] = 8;
    tab[R|| 7] = 4;
    tab[R] = 9;
    */