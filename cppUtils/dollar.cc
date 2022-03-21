
#include "dollar.hh"

#ifndef SKIP_PLATFORM_CHECKUPS

namespace _dollar_checkups {
    struct Simple { int _x; };
    struct Polymorphic { virtual void _f1() { } };
    struct PolymorphicChild : public Simple { virtual void _f2() { } };
    static _$_Inner<Simple> A;
    static _$_Inner<Polymorphic> B;
    static _$_Inner<PolymorphicChild> C;
    static struct Init {
        template<int virtFuncNo, bool virtDestr, class Parent>
        struct Test;

        template<class Parent>
        struct Test<0, false, Parent> : public Parent {
            typedef Parent P; int _x;
        };

        template<class Parent>
        struct Test<0, true, Parent> : public Parent {
            typedef Parent P; int _x;
            virtual ~Test() { };
        };

        template<class Parent>
        struct Test<1, false, Parent> : public Parent {
            typedef Parent P; int _x;
            virtual void _f1() { };
        };

        template<class Parent>
        struct Test<1, true, Parent> : public Parent {
            typedef Parent P; int _x;
            virtual void _f2() { }; virtual ~Test() { };
        };

        template<class Parent>
        struct Test<2, false, Parent> : public Parent {
            typedef Parent P; int _x;
            virtual void _f3() { }; virtual void _f4() { };
        };

        template<class Parent>
        struct Test<2, true, Parent> : public Parent {
            typedef Parent P; int _x;
            virtual void _f5() { }; virtual void _f6() { }; virtual ~Test() { };
        };


        template<class T1, class T2>
        bool ptrNotEq(T1* a, T2* b) {
            return (u8*)(void*)a != (u8*)(void*)b;
        }

        template<class T>
        void test() {
            typedef typename T::P Parent;
            _$_Inner<T> inst;
            _$_Inner<Parent>* parent = (_$_Inner<Parent>*)(u8*)(void*)&inst;
            if (ptrNotEq(&inst, parent)
                || ptrNotEq(&inst.counter, &parent->counter)
                || ptrNotEq(&inst.typeInfo.typeId, &parent->typeInfo.typeId)) {
                FATAL("Unsupported platform or compiler.");
            }
            if (ptrNotEq(&parent->data, (Parent*)&inst.data)) {
                FATAL("Unsupported platform or compiler or invalid _DOLLAR_POLYMORPHIC_PLACE_HOLDER definitions.");
            }
        }

        template<class T>
        void testWithParent() {
            test<Test<0, false, T>>();
            test<Test<1, false, T>>();
            test<Test<2, false, T>>();
            test<Test<0, true, T>>();
            test<Test<1, true, T>>();
            test<Test<2, true, T>>();
        }

        template<class T>
        void testWithParent2() {
            testWithParent<T>();
            testWithParent<Test<0, false, T>>();
            testWithParent<Test<1, false, T>>();
            testWithParent<Test<2, false, T>>();
            testWithParent<Test<0, true, T>>();
            testWithParent<Test<1, true, T>>();
            testWithParent<Test<2, true, T>>();
        }

        Init() {
            testWithParent2<_DollarEmptyClass>();
            testWithParent2<Test<0, false, _DollarEmptyClass>>();
            testWithParent2<Test<1, false, _DollarEmptyClass>>();
            testWithParent2<Test<2, false, _DollarEmptyClass>>();
            testWithParent2<Test<0, true, _DollarEmptyClass>>();
            testWithParent2<Test<1, true, _DollarEmptyClass>>();
            testWithParent2<Test<2, true, _DollarEmptyClass>>();
        }
    } checksOnInit;
};

#endif // SKIP_PLATFORM_CHECKUPS
