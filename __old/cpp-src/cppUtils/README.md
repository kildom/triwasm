# Dollar Reference

Special kind of reference that makes code more secure by:
- removing access to unallocated data (using refrence counting)
- executing fault handler or allocating new object during access to NULL reference

There are three types of references:
- `...$$` Instance reference
- `...$` Not-null reference
- `...$N` Nullable reference

## Instance Dollar Reference

Implements lazy initialization of the object.
This reference can alwas be accessed and it does not reference any object, it creates one with a default constructor.

Use cases:
- Globals
- Struct or class fields that normally will contains instance of the object

## Not-null Dollar Reference

Reference that when once initialized, it will remain not-null reference.
After initialization access to reference object is always safe, because it referece existing object.
Before initialization access will call fault handler.

Use cases:
- Not-null parameters
- Not-null references in class/struct fields

## Nullable Dollar Reference

Reference that may contain null reference and this value has special meaning, e.g. reference object is not needed or does not exists.

Use cases:
- Nullable parameters
- Nullable references in class/struct fields

## Dollar Reference summary

|  | `$$` | `$`  | `$N` |
|--|----|--|--|
| State after creation | Uninitialized | Uninitialized | NULL reference |
| Access on uninitialized/NULL state | Default constructor executed | Fault | Fault |
| Assign of NULL reference | Fault | Fault | OK |
| Assign of Not-NULL reference | OK on Uninitialized state<br>Fault otherwise | OK | OK |


# Range

...
# Array$\<T>

Array of elements of type `T`.
Build on top of `std::vector<T>`.
Provides more safety access because of index checks on each access.

## Accessing elements

Two operators allows access to specific element:
* `[]` - normal array operator. Causes `FAIL` if index is out of bounds.
* `()` - array access operator that is able to add new elements if they does not exists. Causes `FAIL` if index is negative.

```c++
Array$$<int> arr1;
std::cout << arr1[0] // FAIL - index out of bounds
std::cout << arr1(0) // OK - it will add new element (using default constructor) and print it

Array$$<int> arr2;
arr2[0] = 1; // FAIL - index out of bounds
arr2(0) = 1; // OK - array size will be increased
arr2(arr2.length()) = 99; // OK - this will add new element at the end
arr2() = 99; // OK - this is shortcut of above expression
```
