


## List of faults

Fault is triggered before executing an instruction that starts less than
5 bytes (maximum instruction size) before end of program memory.
 * code - unused
 * pc -   address where the invalid instruction starts

`#define TRIVM_FAULT_BYTECODE_BOUNDARY 0`

Fault is triggered during executing an invalid instruction. `arg1` was read
from program memory or popped from stack before triggering the fault.
Nothing is pushed or written to the memory during executing of invalid
instruction.
 * code - first byte of the instruction
 * pc -   address after the invalid instruction

`#define TRIVM_FAULT_INVALID_INSTRUCTION 1`

Fault is triggered after failed write to protected program memory.
 * code - write address
 * pc -   address after the invalid instruction

`#define TRIVM_FAULT_WRITE_PROTECTED 2`

Fault is triggered before executing an instruction when the stack size is
not smaller than the limit. Stack size limit is increased by 8 words to
allow a handler to use the stack again.
 * code - stack pointer address
 * pc -   address to the instruction with invalid stack size

`#define TRIVM_FAULT_STACK_OVERFLOW 3`

Fault is triggered before executing an instruction when the stack pointer
plus two words (maximum instruction pop size) is bigger that memory size.
Stack pointer is reset to its default value to allow a handler to use the
stack again.
 * code - stack pointer address
 * pc -   address to the instruction with invalid stack size

`#define TRIVM_FAULT_STACK_UNDERFLOW 4`

Fault is triggered after write instruction that cases the stack pointer
to be unaligned. Stack pointer is set to the previous value to allow
a handler to use the stack again. Other bytes affected by this instruction
are not reverted to the previous state.
 * code - unaligned stack pointer
 * pc -   address after the write instruction

`#define TRIVM_FAULT_STACK_UNALIGNED 5`

Fault is triggered during the read or write instruction out of memory.
Except is raised in the middle of the instruction execution, so instruction
code is read from the program memory, address is popped from stack if needed,
but final push or pop is not executed.
 * code - invalid address
 * pc -   address after the instruction

`#define TRIVM_FAULT_OUT_OF_MEMORY_BOUNDARY 6`

Fault is triggered after the division by zero instruction. The instruction is
executed, but division by 1 is done instead.
 * code - divident
 * pc -   address after the instruction

`#define TRIVM_FAULT_DIVISION_BY_ZERO 7`

Fault is triggered after the signed division of -0x80000000
(or -0x8000000000000000 in case of 64-bit division) by -1. The instruction is
executed, but division by 1 is done instead.
 * code - unused
 * pc -   address after the instruction

`#define TRIVM_FAULT_DIVISION_OVERFLOW 8`
