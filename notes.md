
* Add µVM extensions:
  * External memory:
    * User can provide list of buffers (pointer and size) that virtual machine can access
    * List is valid only during specific function call
    * It is mapped to the beginning of a linear memory (unused part)
    * it is less safer than copying data to linear memory, so it should not be recommended
    * it it useful for passing large buffers that will take too much space in the linear memory
    * only READ/WRITE instructions can access external memory, stack cannot be there
    * Memory will be fragmented: | normal memory | allocable space for external memory | linear memory |
    * it is compiler independent, so this option is not needed to generate the bytecode.
  * int64-partial:
    * int32 instructions uses additional register as a carry to perform faster int64 operations
  * int64-full:
    * full int64 instruction set
  * float
  * double
