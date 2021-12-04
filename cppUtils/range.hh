
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

class Arr {
    public:

    Range operator[](const Range& r) {
        return r;
    }

    Range operator[](ssize index) {
        return Range(index, index + 1);
    }

    template<class T>
    std::enable_if_t<std::is_class<T>::value, Range> operator[](const T& r) {
        return operator[](r.bound(100));
    }

    Range operator()(const Range& r) {
        return r;
    }

    Range operator()(ssize index) {
        return Range(index, index + 1);
    }

    template<class T>
    std::enable_if_t<std::is_class<T>::value, Range> operator()(const T& r) {
        return operator()(r.bound(100));
    }
};

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
    [:]      [R]
    [x:]     [x |R]
    [:x]     [R| x]
    [x:y]    [x |R| y]
    [-x:]    [x ||R]
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