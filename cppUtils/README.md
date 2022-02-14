# cppUtils

## Dollar Reference

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
