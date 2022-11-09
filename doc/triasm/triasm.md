
# triASM

The assembler for triVM.

It is designed to serve following purposes:
 * To be an intermediate step between the triWASM and final bytecode.
 * To allow inlining triVM assembly into higher level languages, e.g. C++.
 * To allow writing the code that cannot be compiled with triWASM, e.g. startup code.
 * To allow testing of triVM without triWASM dependencies.

It was not designed for writing full-featured applications.

## Syntax

The assembly file is a text file. A single line is:
 * an instruction,
 * a directive,
 * an assignment,
 * a label.

### Instructions

The instructions are defined by the triVM instruction set.
They can have optional comma separated arguments.
Each argument is an [expression](#expressions).
Instruction name is case insensitive.

Example:
```
ADD my_value - 10
```

### Directives

The directives start with a `.`.
They control the behavior of the assembler.
They can have optional arguments which can be a comma-separated list of [expressions](#expressions) or a single identifier.
Directive name is case insensitive.

Example:
```
.DATA32 0x01234567, 0x89ABCDEF
```

### Assignments

The assignments are used to assign values to identifiers.
They starts with an identifier name followed by an equal sign `=` and an expression.

Example:
```
my_value = previous_value + 1
```

### Labels

The labels contains identifier name followed by a colon `:`.
They are used to assign address to the identifier.
You cannot put anything else after the colon in a single line.
As all identifiers, labels are also case sensitive.

Example:
```
my_function:
```

It works the same as assignment where right hand side is an `addr()` expression.
The example above is equivalent to:
```
my_function = addr()
```

### Comments

The comments are single line comments starting with a `#`.
They can be placed anywhere in the file.

Example:
```
is_prime_number: # Checks if the number is prime
```

## Expressions

The expressions syntax is based on C expressions.
The operators in the expression support only 64-bit unsigned integers.
Operations on signed integers can be done with dedicated functions that take unsigned integers,
convert them to signed integers, perform the operation and then convert the result back to unsigned integer.

### Operators

|Precedence|Operator                                      | Associativity   |
|----------|----------------------------------------------|-----------------|
|        0 | f(...)                                       | n/a             |
|        1 | +a &nbsp; -a &nbsp; !a &nbsp; ~a             | Right-to-left ← |
|        2 | a*b &nbsp; a/b &nbsp; a%b                    | Left-to-right → |
|        3 | a+b &nbsp; a-b                               | Left-to-right → |
|        4 | a&lt;&lt;b &nbsp; a>>b                       | Left-to-right → |
|        5 | a&lt;b &nbsp; a>b &nbsp; a&lt;=b &nbsp; a>=b | Left-to-right → |
|        6 | a==b &nbsp; a!=b                             | Left-to-right → |
|        7 | a&amp;b                                      | Left-to-right → |
|        8 | a^b                                          | Left-to-right → |
|        9 | a\|b                                         | Left-to-right → |
|       10 | a&amp;&amp;b                                 | Left-to-right → |
|       11 | a\|\|b                                       | Left-to-right → |
|       12 | a?b:c                                        | Right-to-left ← |

The operators that returns boolean result (`!`, `<`, `>`, `<=`, `>=`, `==`, `!=`) return 0 for false and 1 for true.
The operators that takes boolean operands (`!`, `?:`, `&&`, `||`) assumes that the operands are 0 for false and non-zero for true.

The `a&&b` operator returns zero if `a` is zero, otherwise returns the value of `b`.
The `a||b` operator returns `a` if `a` is non-zero, otherwise returns the value of `b`.

In shifting operators (`<<`, `>>`), if the shift amount is greater than 63, the result is zero.

In the ternary operator `a?b:c` and boolean operators `a||b`, `a&&b`, if the operand `a` is known during resolving the references, other operands may be never evaluated.
This have significant implications during discarding unused blocks.

### Literals

The only allowed type is 64-bit unsigned integer, so the literals are:
 * `0x` followed by a hexadecimal number,
 * `0o` followed by an octal number,
 * a decimal number.

Error will be reported if the literal is out of range.

### Functions

Only built-in functions can be used in expressions.

| Function | Arguments | Description |
|----------|-----------|-------------|
| vma | () | Returns the current VMA address. |
| pma | () | Returns the current PMA address. |
| pma2vma | (pma) | Convert PMA address to VMA address. |
| vma2pma | (vma) | Convert VMA address to PMA address. |
| line | () | Returns current source code line number. |
| iid | () | Returns current instruction unique identifier. |
| size | (first_iid, last_iid) | Returns size of bytecode generated after `first_iid` (inclusive) and before `last_iid` (exclusive). |
| if | (a, b, c) | Is an alias of `a?b:c` operator. |

## Addressing

The triASM tracks three addresses:
 * VMA - Virtual Memory Address.
   Tell the address in virtual memory which is the address space used by READ/WRITE instructions. This address it is also referred as simply address in this document.
 * PMA - Program Memory Address.
   Tell the address in program memory which is the address hold by be `PC` register.
   triVM maps it to VMA at offset 0 in single memory configuration or 0x80000000 in dual memory configuration.
   It is also an address at the output bytecode.

By default, both addresses are the same.
Relation between those addresses is constant and can be set up by the `.BASE` directive.

Following example tells the assembler that the bytecode starts at:
 * VMA = 0x80000000
 * PMA = 0x00000000
```
.BASE 0x80000000
```
