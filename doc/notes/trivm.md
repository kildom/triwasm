## Features NOT available for 0.0.1 version:
* Memory grow
  * with Wasm instructions (64K granuality) - instructions will compile and work, but they will not allow memory grow.
  * with imported function (any granuality)
* More than one memory
* Most of the globals features:
  * not supported: import, immutable, non-const initialization
  * ignored: export
* Most of the tables features:
  * not supported: grow, import, read/write, non-const element initialization, non-const offset in the initialization, more than one table, types different than `funcref`, passive initialization.
  * ignored: export
* Some of data section features: passive initialization, non-const offset initialization
* Instructions operating on `funcref` or `externref`.
* Vector instructions
* Tail call
* Any feature that is not adopted into core specification yet.
* Most of the optimizations except:
  * triWasm: Putting literal into instruction
  * triAsm: Garbage collection of the dead code, multipass instruction size optimization
* Depending on functionality, instructions and other features will compile in different way:
  * into subs, e.g. memory grow
  * into trap with warning message, e.g. global export
  * with compilation error, passive initialization
* Callbacks to the host (expect defined as the import).
* Resource manager on the host.

## Features NOT planned to be implemented at all:
* Wasm64
* Module linking - this should be done by external tool, triWasm will get already linked module.
* Importing/exporting by name.
* Memory import/export. The memory will always work the same.
* Table import. It will always work the same as table export.

## General
* Reconsider using LR (Link Register) instead of pushing return address on stack
  * Simple functions that does not call any other (or uses only tail call) will be simpler
  * Return will be two byte operation `READ LR; WRITE PC`
  * But, `UNWIND` instruction can be extended to do return - one bit of argument may indicate that
  * `UNWIND` emulation can be executed in two ways (return bit is not needed in argument):
    * `call unwind` - will do unwind and return here, so LR must be saved before
    * `jump unwind` - will do unwind and return to LR address
  * It does not have significant impact on normal WASM functions, but can be benefitial in two cases:
    * During optimization, reusing parts of code will be simpler and smaller, because stack will not be touched after the call
    * Emulation written in triASM can be more size-optimized
  * For stack return address:
    ```
    wasm_function_not_calling_anything:
    wasm_function_calling_something_including_calling_optimized_common_parts:
    ...
    READ [SP] - N     PUSH calc_unwind(X, Y)
    UNWIND_RET X, Y   READ [SP] - N
                      JUMP __triwasmlib__unwind
    
    optimized_common_part:
    WRITE TMP0
    ... using tmp0 is forbidden here
    READ TMP0
    WRITE PC
    ```
  * For LR return address:
    ```
    wasm_function_not_calling_anything:
    ...
    UNWIND_RET X, Y   PUSH calc_unwind(X, Y)
                      JUMP __triwasmlib__unwind

    wasm_function_calling_something_including_calling_optimized_common_parts:
    READ LR           READ LR
    ...
    READ [SP] - N     PUSH calc_unwind(X, Y)
    WRITE LR          READ [SP] - N
    UNWIND_RET X, Y   JUMP __triwasmlib__unwind

    optimized_common_part:
    ... using tmp0 is allowed here
    READ LR
    WRITE PC
    ```
* Reconsider extending `UNWIND` instruction to allow returning to address on top of stack.
  * One bit in `keep` parameter will indicate `return` operation,
  * e.g. `UNWIND_RET 1, 1` will pop return address from stack, then keep 1 word on stack, then remove 1 word below it and then set PC:=return address.
  * above example will be encoded as following bits `iiii iiii   r kkk ssss` == `iiii iiii   1 001 0001`
  * `UNWIND` without arguments will first pop argument from stack and later pop return address (if needed).
* Allow two methods of calling host functions:
  * Call a function from HOST instruction. The host call stack will be: host caller -> vm core -> host callee function
  * Exit VM with information what host function to execute. Usefull for e.g. asynchronous functions:
    ```
    trivm_run(vm, LIMIT);
    if (trivm_host_call(vm) == MY_HOST_ASYNC_FUNC) {
        my_host_async_func(vm, callback_that_starts_vm_again);
    }
    ...
    ```
* Add READ/WRITE POP+LMP+offset protection
  * When they are optimized to READ/WRTIE offset, protection must be done by the compiler
  * two additional register LMB, LME - linear memory begin, linear memory end
* If exact initial data size is unknown, µVM startup should check this size and ask for more if wasm requires more and it is possible.
* In future, when debugger will be implemented, in debug mode there should be many `return_to_native` addresses.
  Each address corresponse to return address table that holds actual return address. Each neasted export call use next address.
  With this full call stack recovery can be done including native calls.
  `func3 => return_to_native2==return_table_item2 => func2 => return_to_native1==return_table_item1 ==> func1 ==> return_to_native_root`
  call stack is:
  `func3, native, func2, native, func1`
* To provide callbacks from guest to host (configurable):
  * triVM must contains guest-inaccessible table (*host callback table*) containing:
    * pointer to triVM compatible callback, e.g. `void (*callback)(trivm_ctx* ctx)`
    * first auxilary poiter, e.g. for pointer to actual host implementation
    * second auxilary pointer, e.g. for pointer to user data/context
  * references in WASM tables will contains pointer to guest functions or nageted index in host callback table.
  * triVM must provide host API to add and remove callbacks.
  * ducumentation must cleary states that not removing outdated callback (e.g. with deallocated context) is VERY dengerous.
  * it is up to the embedder how to handle access to WASM table from host
  * guest before trying to call a callback, first, checks if higest bit is set
    * if yes, calls dedicated import function (e.g. id=-2), which calls a host callback
    * if no, calls guest funcition
  * It can be devided into more generic parts:
    * Core: dedicated import function (e.g. id=-2) and highest bit flag check in guest
    * Host resource manager: can store callbacks, but also other resources that have to be access in managed way
    * Host callbacks: implements dedicated import function that uses *host resource manager* to store callbacks, additional API for adding/removing callbacks.

## triASM
* With optimization disabled, one pass is executed. Instructions with variable length will assume worst case.
  Instruction that parameter can be calculated and it is const are not variable length,
  e.g. jumps back - jump offset can be calculated, because label address is already known and it will not change.
* With optimization enabled, first pass assumes best case instruction size. It it cannot be fullfilled, next pass is executed with new addresses.
  To avoid infinit loops, instruction end address cannot be smaller than in previous pass.

## Memory reservation *done by the compiler*
* Fixed size:
  * wasm memory grow instructions
    * assume minimal µVM stack
    * allocate usable linear memory just after minimal stack
    * move the end of usable linear memory forward to nearest 64K boundary
    * if upper limit in wasm file is given:
      * if bigger: notify the user that the memory may grow beyond the limit
      * if smaller: move the usable linear memory
    * grow the stack
  * non-wasm memory grow functions
    * assume minimal µVM stack
    * allocate usable linear memory just after minimal stack
    * if upper limit in wasm file is given:
      * if bigger: notify the user that the memory may grow beyond the limit
      * if smaller: move the usable linear memory and grow µVM stack
* Growable
  * wasm memory grow instructions
    * assume minimal µVM stack
    * allocate usable linear memory just after minimal stack
    * move the end of usable linear memory forward to nearest 64K boundary
    * if upper limit in wasm file is given:
      * if bigger than host upper limit: notify the user that the memory may grow beyond the limit
      * if smaller than host initial: move the usable linear memory
    * grow the stack
  * non-wasm memory grow functions
    * assume minimal µVM stack
    * allocate usable linear memory just after minimal stack
    * if upper limit in wasm file is given:
      * if bigger than host upper limit: notify the user that the memory may grow beyond the limit
      * if smaller than host initial: move the usable linear memory and grow µVM stack

## On-line GUI application for µVM configuration

https://gist.github.com/kildom/a741a4e16925ddf0ce14d66dff65caae

* µVM version: `  1.0.0 |v|`
* Extensions:
  * 64-bit integer operations: `(o  )`
  * Single precision floating point operations: `(o  )`
  * Double precision floating point operations: `(o  )`
  * Memory grow ability: `(o  )`
* Data memory size: `[  128K ]` (if no grow ext)
* Data memory limits: (if grow ext)
  * Initial size: `[    ]`
  * Maximum size: `[ 1G ]`
* Code memory:
  * [X] Unlimited
  * [ ] Maximum: `[      ]`
* µVM exceptions:
  * Stack overflow `(o  )`
  * Stack underflow `(o  )`
  * Undefined instruction `(o  )`
  * Stack unaligned `(o  )`
  * Memory access `(o  )`
  * Read only memory `(o  )`
  * Division by zero `(o  )`
  * Auxilary stack overflow `(o  )`
  * Auxilary stack underflow `(o  )`
  * Floating point exceptions `(o  )`
  * Invalid linear memory access `(o  )`
* Imported functions
  | ID | Module | Name | Parameters |
  |----|--------|------|------------|
  | 0  |        |      |            |
* Imported globals
  | ID | Module | Name | Type       |
  |----|--------|------|------------|
  | 0  |        |      |            |
* Exported functions
  | ID | Name | Parameters |
  |----|------|------------|
  | 0  |      |            |
* Exported globals
  | ID | Name | Type       |
  |----|------|------------|
  | 0  |      |            |
* µVM-wasm compiler options:
  * µVM minimum stack size: `[     1K ]`
  * Host scratchpad area size: `[    0 ]`
  * Wasm keep-out area size: `[     1K ]`      (equal `--global-base` in clang)
  * Use non-wasm memory grow functions `(o  )`   (they allow grow granualiti smaller than 64KB)
* Additional files generation:
  * [X] µVM configuration header file
  * [X] Embedding helper files for host
  * [X] µVM amalgamation source code
  * [ ] C import/export helper files for guest
  * [ ] clang and uvmwasm build command templates
    * C stack size: `[      32K ]`
  * [ ] AssemblyScript and uvmwasm build command templates

# Embedding ideas
```c


typedef struct {
    uint32_t size;
    uint32_t buffer;
} compute_prams_t;

typedef struct {
   uint32_t value;
} compute_results_t;

int empty() {
    return uvm_call(uvm, ID_EMPTY, UVM_INDEFINITELY);
}

int simple(int *result, int param) {
    int *params = uvm_stack_push(uvm, sizeof(int));
    if (params == NULL)
        return -1;
    *params = param;
    int *results = uvm_call(uvm, ID_SIMPLE, UVM_INDEFINITELY, sizeof(int), sizeof(int));
    if (results == NULL)
        return -1;
    *result = *results;
    return r;
}

bool with_buffer(uvm_instance_t* uvm, uint32_t* result, uint8_t* buffer, uint32_t size) {
    int r = -1;
    uint32_t vm_ptr_buffer = uvm_pass_buffer(uvm, buffer, size); // on uvm stack, on scratchpad, on heap (using guest functions) or untouched if already in uvm memory
    if (vm_ptr_buffer == 0)
        return -1;
    compute_prams_t *params = uvm_stack_push(sizeof(compute_prams_t));
    if (params == NULL)
        goto release_buffer_end_exit;
    params->buffer = vm_ptr_buffer;
    params->size = size;
    uint32_t *results = uvm_call(uvm, ID_COMPUTE, UVM_INDEFINITELY, sizeof(compute_prams_t), sizeof(uint32_t));
    if (results == NULL)
        goto release_buffer_end_exit;
    result = *results;
    r = 0;
release_buffer_end_exit:
    uvm_release_buffer(uvm, vm_ptr_buffer, buffer, size);
    return r;
}

```

```c


/*
primirive:
    [u]int64|32|16|8
    double|float
    char
    wchar
    long long

structure (alignment=wasm32 by default):
    fields...
    optional varibalbe size array at the end

array:
    type
    length:
        const
        from a different field
        from a formula
        from input parameter (vm exports only)
        null terminated
            or some different value
            or some field in the structure
            or double null

pointer:
    type
    is null allowed
*/

struct malloc_on_vm_params {
    uint32_t size;
};

struct malloc_on_vm_result {
    uint32_t result;
};

bool malloc_on_vm(trivm* vm, uint32_t size, void** result) {
    const char* text = (const char*)TRIVM_HOST_PTR(vm, params->text);
    params->text = TRIVM_GUEST_PTR(vm, text);
    struct malloc_on_vm_params* params = (struct malloc_on_vm_params*)trivm_if_alloc_stack(sizeof(struct malloc_on_vm_params));
    if (params == NULL) {
        return false;
    }
    params->size = size;
    trivm_call(vm, TRIVM_EXPORT_MALLOC, MALLOC_ON_VM_STEPS);
    struct malloc_on_vm_result* result = (struct malloc_on_vm_result*)trivm_if_sp_get(vm, message_params_desc);
    if (result == NULL) {
        return false;
    }
    trivm_if_pointer_get(vm, result->result, malloc_on_vm_result_desc, size);
    trivm_stack_pop(vm, sizeof(struct malloc_on_vm_result));
exit_func:
    return ptr;
}

void message(const char* text) {
    puts(text);
}

struct message_params {
    uint32_t text;
};

uint8_t message_params_desc[] = { 0x23, 0x38, 0x00 };
uint8_t string_desc[] = { 0xF9, 0x00 };

void host_message(trivm* vm) {
    struct message_params* params = (struct message_params*)trivm_if_sp_get(vm, message_params_desc);
    message(
        (const char*)trivm_if_pointer_get(vm, params->text, string_desc)
    );
}

void host(trivm* vm, int id) {
    switch (id) {
    case 0:
        host_message(vm);
        break;
    default:
        trivm_fault_set(vm, TRIVM_FAULT_INVALID_HOST_CALL, id);
    }
}


```

# JavaScript support idea

[![](doc/triJS.svg)](https://kildom.github.io/drawio/#doc/triJS.drawio)

# Simple bytecode idea for guest to client data validation

But still user must call special functions to get host pointers from guest pointers, so maybe such bytecode is pointless.

On the other hand, special functions converting host pointers from guest pointers may take this kind of bytecode, but simpler to validate area pointed by this pointer.

```c
/*


end
skip                          u16
array_const_size              u16
call                    u4    i16
array_call        u4    i16   u16
array             u4    i16
array_null_term   u2    u16   u16
array_param_size  u1    u4    i16
pop_ptr           u1    u4    i16


char[!]* text
    use_ptr 0
    array
        null_marker_with_break 1
        skip 1
        end

char[num]* text, u16 num
    pop_ptr
        array_param_size 2 @ 0
        buffer 1
        end
    skip 2

struct Item {
    u64 value;
    struct Item* next;
};

Item* first
    push_ptr_nullable
        array
            next_item:
            skip 8
            null_marker_with_break 4
            use_ptr 0
            jump next_item
        end



end           index = return_address ? return_address : index (pop frame)
end_ptr       index = ...;  ptr = return_ptr; (pop_frame)
end_array     if (last) index = return_address ? return_address : index (pop frame) else index = continue_address
    -
skip
null_marker
null_marker_with_break
use_ptr
use_ptr_nullable
buffer
const                              --6
    value = 0...                   [2] + 0/8/16

array_param_size                   --4
    value = +-0...                 [2] + 0/8/16

call
jump                               --4
    call = address                 [2] + 0/8/16

array
push_ptr
push_ptr_nullable                  --4
    call = address                 [2] + 0/8/16


*/

struct CallFrame {
    u16 return_address;
    u16 continue_address;
    union {
        u32 prev_ptr;
        u32 count;
    };
};

u32 ptr_stack[10];
u32 *ptr_stack_top;
u32 ptr_stack_size;
u32 prev_value;
CallFrame* frame;
ArrayFrame* array;

void exec(u8 code) {
    i32 value = (i32)code << 29;
    int unshift = 29;
    if (code & 0x08) {
        value ^= read_code() << 22;
        unshift = 22;
        if (value & (1 << 29)) {
            value ^= read_code() << 14;
            unshift = 14;
        }
    }
    value >>= unshift;
    frame[1]->return_address = value ? index : 0;

    if (end) {
        index = frame->return_address ? frame->return_address : index;
        frame--;
    }

    if (end_ptr) {
        index = frame->return_address ? frame->return_address : index;
        ptr = frame->prev_ptr;
        frame--;
    }

    if (null_marker) {
        if (is_zero(ptr, value)) {
            frame->count = 1;
        }
    }

    if (end_array) {
        frame->count--;
        if (frame->count == 0) {
            index = frame->return_address ? frame->return_address : index;
            frame--;
        } else {
            index = frame->continue_address;
        }
    }

    if (skip) {
        ptr += value;
    }

    if (jump) {
        index += value;
    }

    if (call) {
        frame[1]->prev_ptr = 0;
        frame++;
    }

    if (end) {

    }

    if (array) {
        frame[1]->prev_ptr = 0;
        frame++;
        array[1]->repeat_address = index + value;
        array[1]->count = prev_value;
        array[1]->frame = frame;
        array++;
    }
    if (end || frame->count == 0) {
        // TODO:
    }

    // TODO: check if ptr is still valid (also at the beginning)
}
```
