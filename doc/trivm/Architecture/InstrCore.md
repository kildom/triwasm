# Core instruction set

Core instruction set is aways available on triVM regadless of enabled extrensions.

## Binary operation instructions

Following instructions do operation on two 32-bit integers.
The result is 32-bit integer pushed into the stack.
   
Division and modullo instructions (`UDIV`, `UMOD`, `SDIV`, `SMOD`) will cause a [Division By Zero]() Fault if `value2` is zero.

|         | Encoding A                    | Encoding B, C, D      |
|---------|-------------------------------|-----------------------|
| Encoded |                               | `value2 := immediate` |
| Stack   | `… value1, value2 ⇒ … result` | `… value1 ⇒ … result` |
| Syntax  | `ADD`                         | `ADD constant`        |

 
| Opcode | Name | Operation Pseudo Code                                             |
|--------|------|-------------------------------------------------------------------|
| 0x02   | ADD  | `result := value1 + value2`                                       |
| 0x03   | SUB  | `result := value1 - value2`                                       |
| 0x04   | MUL  | `result := value1 * value2`                                       |
| 0x05   | AND  | `result := value1 & value2`                                       |
| 0x06   | OR   | `result := value1 \| value2`                                      |
| 0x07   | XOR  | `result := value1 ^ value2`                                       |
| 0x08   | UDIV | `result := value1 / value2` *(unsigned)*                          |
| 0x09   | SDIV | `result := value1 / value2` *(signed)*                            |
| 0x0A   | UMOD | `result := value1 % value2` *(unsigned)*                          |
| 0x0B   | SMOD | `result := value1 % value2` *(signed)*                            |
| 0x0C   | SHL  | `result := value1 << (value2 & 31)`                               |
| 0x0D   | USHR | `result := value1 >> (value2 & 31)` *(unsigned)*                  |
| 0x0E   | SSHR | `result := value1 >> (value2 & 31)` *(signed)*                    |
| 0x0F   | EXTS | `result := (value1 << (value2 & 31)) >> (value2 & 31)` *(signed)* |
| 0x10   | EQ   | `result := value1 == value2`                                      |
| 0x11   | ULT  | `result := value1 < value2` *(unsigned)*                          |
| 0x12   | SLT  | `result := value1 < value2` *(signed)*                            |
| 0x13   | UGT  | `result := value1 > value2` *(unsigned)*                          |
| 0x14   | SGT  | `result := value1 > value2` *(signed)*                            |


## Unary operation instructions

Following instructions do operation on one 32-bit integer.
The result is 32-bit integer pushed into the stack.

|         | Encoding A            | Encoding B, C, D      |
|---------|-----------------------|-----------------------|
| Encoded |                       | `value1 := immediate` |
| Stack   | `… value1 ⇒ … result` | `… ⇒ … result`        |
| Syntax  | `EQZ`                 | `EQZ constant`        |


| Opcode | Name | Operation Pseudo Code |
|--------|------|-----------------------|
| 0x15   | EQZ  | `result := !value1`   |
| 0x16   | NEG  | `result := -value1`   |

:::note

`NEG` instruction can be used to push constant value on the stack, for example `NEG -32` will push `32` to the stack.

:::


## BR

Following instruction do relative jump unconditionally.

|         | Encoding A     | Encoding B, C, D      |
|---------|----------------|-----------------------|
| Encoded |                | `value1 := immediate` |
| Stack   | `… value1 ⇒ …` | `… ⇒ …`               |
| Syntax  | `BR`           | `BR address`          |


| Opcode | Name | Operation Pseudo Code                                                   |
|--------|------|-------------------------------------------------------------------------|
| 0x17   | BR   | `PC := PC + value1`                                                     |
|        |      | where: `PC` points to beginning of the next instruction after this one. |
     
:::note

Absolute jump can be done with `WRITE PC` instruction.

:::


## BRT, BRF

Following instruction do relative jump depending on condition.

|         | Encoding A             | Encoding B, C, D      |
|---------|------------------------|-----------------------|
| Encoded |                        | `value2 := immediate` |
| Stack   | `… value1, value2 ⇒ …` | `… value1 ⇒ …`        |
| Syntax  | `BRT`                  | `BRT address`         |


| Opcode | Name | Operation Pseudo Code                                                   |
|--------|------|-------------------------------------------------------------------------|
| 0x00   | BRT  | `if (value1) PC := PC + value2`                                         |
| 0x01   | BRF  | `if (!value1) PC := PC + value2`                                        |
|        |      | where: `PC` points to beginning of the next instruction after this one. |

## CALL

Call a function.

|         | Encoding A        | Encoding B, C, D      |
|---------|-------------------|-----------------------|
| Encoded |                   | `value1 := immediate` |
| Stack   | `… value1 ⇒ … PC` | `… ⇒ … PC`            |
| Syntax  | `CALL`            | `CALL address`        |


| Opcode | Name | Operation Pseudo Code                                                   |
|--------|------|-------------------------------------------------------------------------|
| 0x19   | CALL | `push(PC); PC := PC + value1`                                           |
|        |      | where: `PC` points to beginning of the next instruction after this one. |

:::note

Call using absolute address can be done by substracting address by address of the next instruction after `CALL`:
```
...
SUB next_instr_after_call
CALL
next_instr_after_call:
...
```

:::

## HOST

Call a host function or return from VM to the host.

|         | Encoding A       | Encoding B, C, D      |
|---------|------------------|-----------------------|
| Encoded |                  | `value1 := immediate` |
| Stack   | `… value1 ⇒ ???` | `… ⇒ ???`             |
| Syntax  | `HOST`           | `HOST constant`       |

Content of the stack after this instruction depends on host function.

| Opcode | Name | Operation Pseudo Code                                                   |
|--------|------|-------------------------------------------------------------------------|
| 0x20   | HOST | If `value1 >= 1`, call host function.
|        |      | If `value1 == 0`, do nothing.
|        |      | If `value1 == -1`, return to host normally.
|        |      | If `value1 <= -2`, return to host with code.

## READ, WRITE

Read or write an integer from the memory.

READ and WRITE instructions can access 8-bit, 16-bit or 32-bit values. 64-bit values can be accessed if [Mem64]() extension is enabled.
When reading 8-bit or 16-bit integer, the instruction can optionally sign-extend it to 32-bit integer.

The address is calculated with the formula:
```
address = base_address + (P ? pop() : 0) + offset * alignment
```
where:
* `base_address` is one of:
  * zero (encoding `base = 0`)
  * SP register value (encoding `base = 1`)
  * AMB0 register value (encoding `base = 2`)
  * AMB1 register value (encoding `base = 3`)
* `P` bit is encoded in the instruction.
* `pop()` pops value from top of stack and returns it. For write operations, it is popped after write value.
* `offset` is encoded in the instruction.
* `alignment` is `1`, `2` or `4` depending on how many bytes are read/written.
  Exception are 64-bit operations in [Mem64]() extension. They are using `alignment=4`.

| Syntax | Encoding |
|--------|----------|
| `READ …` | `Q`, `R` (W=0) |
| `READ16 …` | `S` (W=0, B=0, S=0) |
| `READ16S …` | `S` (W=0, B=0, S=1) |
| `READ8 …` | `S` (W=0, B=1, S=0) |
| `READ8S …` | `S` (W=0, B=1, S=1) |
| `WRITE …` | `Q`, `R` (W=1) |
| `WRITE16 …` | `S` (W=1, B=0, S ignored) |
| `WRITE8 …` | `S` (W=1, B=1, S ignored) |


| Access bits | Encoding          | `width` | Extend to 32-bits | Syntax      |
|-------------|-------------------|---------|-------------------|-------------|
| 32          | Q and R (W=0)     | 4       | -                 | `READ …`    |
| 16          | S (W=0, B=0, S=0) | 2       | zero-extend       | `READ16 …`  |
| 16          | S (W=0, B=0, S=1) | 2       | sign-extend       | `READ16S …` |
| 8           | S (W=0, B=1, S=0) | 1       | zero-extend       | `READ8 …`   |
| 8           | S (W=0, B=1, S=1) | 1       | sign-extend       | `READ8S …`  |
| 32          | Q and R (W=1)     | 4       | -                 | `WRITE …`   |
| 16          | S (W=1, B=0, S ignored) | 2       | -                 | `WRITE16 …` |
| 8           | S (W=1, B=1, S ignored) | 1       | -                 | `WRITE8 …`  |

Memory address is calculated with the formula: `address := base_address + width * offset`, where:
* `offset` is encoded in instruction,
* `width` is a width of the access in bytes,
* `base_address` can be one of:

|                                    | Encoding | Syntax                         | Stack                   |
|------------------------------------|----------|--------------------------------|-------------------------|
| **Zero**                           | `base=0` | `WRITE offset`                 | `… value1 ⇒ …`          |
|                                    |          | `READ offset`                  | `… ⇒ … value1`          |
| **Stack pointer**                  | `base=1` | `WRITE [SP] + offset`          | `… value1 ⇒ …`          |
|                                    |          | `READ [SP] + offset`           | `… ⇒ … value1`          |
| **Pop value**                      | `base=2` | `WRITE [POP] + offset`         | `… offset2, value1 ⇒ …` |
|                                    |          | `READ [POP] + offset`          | `… offset2 ⇒ … value1`  |
| **AMB register value + pop value** | `base=3` | `WRITE [AMB] + [POP] + offset` | `… offset2, value1 ⇒ …` |
|                                    |          | `READ [AMB] + [POP] + offset`  | `… offset2 ⇒ … value1`  |


`offset` in the instruction syntax can be omitted if it is zero.
