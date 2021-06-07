
#include "Vector.hh"

int main(int argc, char *argv[]) {

    Vector<int> empty;
    if (empty == nullptr) {
    }
    Vector<Function> list = a.list; // TODO: rename Vector to Array

    //Vector::grow(i) will create new elements (with default constructor) if needed
    list.grow(i).createIfNull(); // will create a new object if reference is null (passing parameters to contructor)
    list.grow(i).create(); // will create a new object always, it will override old reference value
    list.grow(i).createNew(); // will create a new object if null, else it will FAIL()

    return 0;

}
