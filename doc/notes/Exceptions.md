

```sh

BLOCK
read32 exceptionStackTop
neg -(exceptionHandler458)
readsp
write32 exceptionStackTop
# OR: neg -(exceptionHandler458)
#     call pushExceptionHandler

# ... 
# try block
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

# separate bytecode chunk (e.g. at the end of function)
exceptionHandler458:
neg -(finallyHandler458)
call pushExceptionHandler

# ...
# catch block
# ...

br exitBlock458

```
