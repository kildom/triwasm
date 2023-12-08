

```sh

.BEGIN
read32 exceptionStackTop
neg -(exceptionHandler458)
readsp
write32 exceptionStackTop
# OR: neg -(exceptionHandler458 - retaddr458)
#     call pushExceptionHandler
#     retaddr458:

# ... 
# try block
# ...

# before unwinding stack containing exeption handler frame:
call popExceptionHandlers3 # it will pop three exception handlers from handlers stack
unwind 2, 13

# ...

neg 0 # no exception on entry to finnaly
finallyHandler458:

# ...
# final block
# ...

brf exitBlock458
call throwException
exitBlock458:

# exit from block

# ...

# separate bytecode chunk (e.g. at the end of function or begin)
exceptionHandler458:
neg -(finallyHandler458 - retaddrFinally458)
call pushExceptionHandler
retaddrFinally458:

# ...
# catch block
# ...

br exitBlock458

```
