# Instructions

triVM has variable length instruction encoding.

## Encoding

triVM has variable length instruction encoding.
Instruction encoding was designed to balance the instruction size
and complexity of decoding it.

Various types of encoding are named using letters from A to S.
Following diagrams shows each of the encoding type.

![Encoding](img/Encoding.drawio.svg)

Where:

* `op code` - the instruction code. The encodings use three different set of opcodes:
  * *unwind* and *core* instructions (encoding A and B),
  * *float32* instructions (encoding C and D),
  * *float32* and *int64* instructions (encoding E to G).
* `size` - the size of the following immediate value:
  * 0 - 32 bits,
  * 1 - 16 bits,
  * 2 - 8 bits,
* `immediate` - the instruction immediate value.
  Immediate values are encoded in little endian byte order.
  Immediate values are always sign-extended to target integer size before executing the instruction.
* `LR` (long result) - if set, both words of the 64-bit result are pushed into the stack. If not, just lower
  32 bits are pushed.
* `L0`, `L1` (long argument 0/1) - if set, two words of of specified argument are popped from the stack.
  If not, lower 32 bits are popped and remaining are sign-extended. For one-argument operations, the `L0` bit is ignored.
  The `LR`, `L0`, `L1` bits cannot be all zeros in a single instruction.
* `offset` - the offset added to (or subtracted from) the address. The offset is multiplied by the memory access width
  (1, 2, or 4) with exception of 64-bit access which is multiplied by 4. Offset is encoded in big endian order.
* `W` (write) - set for `WRITE` operations, cleared for `READ` operations.
* `B` (base) - the register containing base address, `MAB0` or `MAB1` if `B` is one bit long, all `MAB` registers otherwise.
* `P` (pop) - pop offset from the stack and add it to the address. For write operations, the offset is popped before
  the value.
* `H` (half-word) - if set, do 16-bit read write operation, 8-bit otherwise.
* `S` (sign-extended) - if set, sign-extended the read value to 32-bits.

> TODO: Split encoding diagram and add specific encoding image for each instruction.

## Instruction set summary

### [Core]() instruction set

|   Name     | Operation
|------------|----------
|             **Binary operations**
| [ADD]()    | result = value1 + value2
| [SUB]()    | result = value1 - value2
| [MUL]()    | result = value1 * value2
| [AND]()    | result = value1 & value2
| [OR]()     | result = value1 \| value2
| [XOR]()    | result = value1 ^ value2
| [UDIV]()   | result = value1 / value2 *(unsigned)*
| [SDIV]()   | result = value1 / value2 *(signed)*
| [UMOD]()   | result = value1 % value2 *(unsigned)*
| [SMOD]()   | result = value1 % value2 *(signed)*
| [SHL]()    | result = value1 << (value2 & 31)
| [USHR]()   | result = value1 >> (value2 & 31) *(unsigned)*
| [SSHR]()   | result = value1 >> (value2 & 31) *(signed)*
| [EXTS]()   | result = (value1 << (value2 & 31)) >> (value2 & 31) *(signed)*
| [EQ]()     | result = value1 == value2
| [ULT]()    | result = value1 < value2 *(unsigned)*
| [SLT]()    | result = value1 < value2 *(signed)*
|             **Unary operations**
| [EQZ]()    | result = !value1
| [NEG]()    | result = -value1
|             **Branch**
| [BR]()     | Branch unconditionally
| [BRT]()    | Branch if true
| [BRF]()    | Branch if false
| [CALL]()   | Call a function
|             **Host interface**
| [HOST]()   | Call host functions
| [HRET]()   | Return to host
|             **Memory access**
| [READ]()   | Read value from memory
| [WRITE]()  | Write value to memory


### [Unwind]() extension

|   Name     | Operation
|------------|----------
| [UNWIND]() | Unwind the stack

### [Mem64]() extension

|   Name     | Operation
|------------|----------
| [READ64]()   | Read 64-bit value from memory
| [WRITE64]()  | Write 64-bit value to memory

### [Int64]() extension

|   Name     | Operation
|------------|----------
|             **Binary operations**
| [ADD64]()    | result = value1 + value2
| [SUB64]()    | result = value1 - value2
| [MUL64]()    | result = value1 * value2
| ...          | ...

### [Float32]() extension

|   Name     | Operation
|------------|----------
| [ADDF]()   | result = value1 + value2
| [CONVF]()** | ...
| ...        |

\* - available if Int64 extension is also enabled  
\*\* - available if Float64 extension is also enabled

### [Float64]() extension

|   Name     | Operation
|------------|----------
| [ADDD]()   | result = value1 + value2
| [CONVD]()** | ...
| ...        |

\* - available if Int64 extension is also enabled  
\*\* - available if Float32 extension is also enabled


## Binary operation instructions

Performs operation on two values and pushes the result back into the stack.

Division and modullo instructions can raise an [Division By Zero]() VM Fault.

* **Encoding A**
  | | Stack |
  |-|-------|
  | | `...` `value1` `value2` |
  |⤷| `...` `result` |

* **Encoding B**
  | | Stack | Immediate |
  |-|-------|-----------|
  | | `...` `value1` | `value2` |
  |⤷| `...` `result` |

Opcode | Name | Operation Pseudo Code
-------|------|----------
0x02 |   ADD    | `result = value1 + value2`
0x03 |   SUB    | `result = value1 - value2`
0x04 |   MUL    | `result = value1 * value2`
0x05 |   AND    | `result = value1 & value2`
0x06 |   OR     | `result = value1 \| value2`
0x07 |   XOR    | `result = value1 ^ value2`
0x08 |   UDIV   | `result = value1 / value2` *(unsigned)*
0x09 |   SDIV   | `result = value1 / value2` *(signed)*
0x0A |   UMOD   | `result = value1 % value2` *(unsigned)*
0x0B |   SMOD   | `result = value1 % value2` *(signed)*
0x0C |   SHL    | `result = value1 << (value2 & 31)`
0x0D |   USHR   | `result = value1 >> (value2 & 31)` *(unsigned)*
0x0E |   SSHR   | `result = value1 >> (value2 & 31)` *(signed)*
0x0F |   EXTS   | `result = (value1 << (value2 & 31)) >> (value2 & 31)` *(signed)*
0x10 |   EQ     | `result = value1 == value2`
0x11 |   ULT    | `result = value1 < value2` *(unsigned)*
0x12 |   SLT    | `result = value1 < value2` *(signed)*

## Unary operation instructions

Perform operation on one value and pushes the result back into the stack.

* **Encoding A**
  | | Stack |
  |-|-------|
  | | `...` `value` |
  |⤷| `...` `result` |

* **Encoding B**
  | | Stack | Immediate |
  |-|-------|-----------|
  | | `...` | `value` |
  |⤷| `...` `result` |
  
Opcode | Name | Operation Pseudo Code
-------|------|----------
0x13 |   EQZ    | `result = !value`
0x14 |   NEG    | `result = -value`

## Branch instructions

**BRT, BRF**

Do conditional relative branch.

* **Encoding A**
  | | Stack |
  |-|-------|
  | | `...` `condition` `address` |
  |⤷| `...` |

* **Encoding B**
  | | Stack | Immediate |
  |-|-------|-----------|
  | | `...` `condition` | `address` |
  |⤷| `...` |

Opcode | Name | Operation Pseudo Code
-------|------|----------
0xXX |   BRT    | `if (condition) PC += address`
0xXX |   BRF    | `if (!condition) PC += address`

**BR**

Do unconditional relative branch.

* **Encoding A**
  | | Stack |
  |-|-------|
  | | `...` `address` |
  |⤷| `...` |

* **Encoding B**
  | | Stack | Immediate |
  |-|-------|-----------|
  | | `...` | `address` |
  |⤷| `...` |

Opcode | Name | Operation Pseudo Code
-------|------|----------
0xXX |   BR    | `PC += address`

**CALL**

Do unconditional relative branch and push return address into the stack.

* **Encoding A**
  | | Stack |
  |-|-------|
  | | `...` `address` |
  |⤷| `...` `return_address` |

* **Encoding B**
  | | Stack | Immediate |
  |-|-------|-----------|
  | | `...` | `address` |
  |⤷| `...` `return_address` |


Opcode | Name | Operation Pseudo Code
-------|------|----------
0xXX |   CALL    | `return_address = PC, PC += address`

**HOST**

Depending on input value, call host routine or inform host that the guest routine has finished.

* **Encoding A**
  | | Stack |
  |-|-------|
  | | `...` *`(values dependent on routine parameters)`* `index` |
  |⤷| `...` *`(values dependent on routine results)`* |

* **Encoding B**
  | | Stack | Immediate |
  |-|-------|-----------|
  | | `...` *`(values dependent on routine parameters)`* | `index` |
  |⤷| `...` *`(values dependent on routine results)`* |


Opcode | Name |
-------|------
0xXX |   CALL    

Operation Pseudo Code:
```
if (index == 0xFFFFFFFF):
   inform host that guest routine has finished
else:
   call external native function with specified index
```

## Memory access instructions

### READ offset
```
... →
..., result
```
* Encoding Q: `result = 32-bit integer from address: 4 * offset`
* Encoding R: `result = 32-bit integer from address: 4 * sign extended offset`

### READ [SP] + offset
```
... →
..., result
```
* Encoding Q and R: `result = 32-bit integer from address: SP + 4 * offset`

### READ [POP] + offset
```
..., popped_address →
..., result
```
* Encoding Q and R: `result = 32-bit integer from address: popped_address + 4 * offset`

### READ\[B|H|SB|SH] \[IMP] + \[POP] + offset
```
..., popped_address →
..., result
```
* Encoding Q and R: `result = 32-bit integer from address: IMP popped_address + 4 * offset`

Instruction | Encoding | Base | B | S |Address | Operation
------------|--|----|---|---|----|----------
READB \[POP] + offset | S | 2 | 1 | 0 | popped_address + offset | read 8-bit integer
READB \[IMP] + \[POP] + offset | S | 3 | 1 | 0 | IMP register + popped_address + offset  | read 8-bit integer
READSB \[POP] + offset | S | 2 | 1 | 1 | popped_address + offset | read 8-bit integer and sign extend it to 32 bits
READSB \[IMP] + \[POP] + offset | S | 3 | 1 | 1 | IMP register + popped_address + offset  | read 8-bit integer and sign extend it to 32 bits
READH \[POP] + offset | S | 2 | 0 | 0 | popped_address + offset | read 16-bit integer
READH \[IMP] + \[POP] + offset | S | 3 | 0 | 0 | IMP register + popped_address + offset  | read 16-bit integer
READSH \[POP] + offset | S | 2 | 0 | 1 | popped_address + offset | read 16-bit integer and sign extend it to 32 bits
READSH \[IMP] + \[POP] + offset | S | 3 | 0 | 1 | IMP register + popped_address + offset  | read 16-bit integer and sign extend it to 32 bits




