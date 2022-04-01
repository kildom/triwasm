

### Syntax:

```

ADD SUB MUL ...
  INSTR
  INSTR expression     (except READSP)
  
WRITE WRITE8 WRITE16 WRITE64 READ READ8 READ8S READ16 READ16S READ64
  INSTR expression_with_base

expression_with_base: something like: expression + [SP|AMB0|AMB1] - expression  + [POP] + expression

expression:
  value types:
    64-bit unsigned integer
  operators: + - / * ... most of C++ operators
    all operators are unsigned by default
    to use signed or float operators are replaced by functions
  functions:
    unwind_imm(keep, remove) - create minimal unwind parameter
    signed_to_float, unsigned_to_float, float_to_signed, float_to_unsigned
    signed_lt, signed_gt, signed_le ....
    float_add, float_sub, ...

directives:
  .begin .end - discardable block
  .data32 .data16 .data8 .data64 .dataf32 .dataf64 exp, exp, exp, ...
  .addr exp - force specific address
  .align exp - force alignment
  .ref exp - reference label(s) (e.g. to prevent from discarding block)
  .trampoline exp - generate JUMP trampoline to specific address,
  .minimal_table
  .annotation "key:value" !!! special case - string literal

assign:
  label:
  identifier = exp

```
