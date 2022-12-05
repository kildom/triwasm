
#include <stdint.h>
#include <memory.h>
#include <malloc.h>
#include <stdbool.h>

/////////////////////////// C

static const uint8_t validators[] = {
#define ASSEMBLY_SCRIPT_STRING_VALIDATOR 0
	0x34, 0x23, 0x89,
#define MESSAGE_ARGS_VALIDATOR 3
	0x89, 0x34, 0x23,
};

typedef struct {
	uint32_t size;
	uint16_t value[1];
} assembly_script_string;

typedef struct {
	uint32_t text;
} message_args;

void message() {

	message_args* args = tri_args_get(MESSAGE_ARGS_VALIDATOR);
	assembly_script_string* text = tri_ptr_get(args->text, ASSEMBLY_SCRIPT_STRING_VALIDATOR);

	uint16_t* copy = malloc(text->size + 2);
	memcpy(copy, text->value, text->size);
	copy[text->size / 2] = 0;
	printf("%ws\n", copy);

}

/////////////////////////// C++

#include <string>
#include <iostream>

template<class T> class _TriValidatorHelper {
};

template<> class _TriValidatorHelper<AssemblyScriptString> {
	static const uint32_t validator = ASSEMBLY_SCRIPT_STRING_VALIDATOR;
};

template<> class _TriValidatorHelper<MessageArgs> {
	static const uint32_t validator = MESSAGE_ARGS_VALIDATOR;
};

template<class T> class TriRef {
public:
	uint32_t index;
	T* get() { return (T*)tri_ptr_get(index, _TriValidatorHelper<T>::validator); }
};

class AssemblyScriptString {
public:
	uint32_t size;
	char16_t value[1];
	static AssemblyScriptString* alloc(TriVM& vm, const std::u16string& source) {
		auto size = source->size() * sizeof(char16_t);
		AssemblyScriptString* result = vm.exports.allocString(source->size()).get();
		if (result == nullptr || result->size != size) {
			return nullptr;
		}
		memcpy(result->value, source.c_str(), size);
		vm.exports.pin();
		return result;
	}
	operator std::u16string() {
		return std::u16string(value, size);
	}
};

class MessageArgs {
public:
	TriRef<AssemblyScriptString> text;
};

void messageCpp(MessageArgs& args) {
	auto* text = args.text.get(); // get text field once to avoid multiple pointer validations
	if (text != nullptr) {
		std::cout << std::u16string(*text) << std::endl;
	}
};

struct MessageArgs {
	uint32_t index;
	TriRef<AssemblyScriptString> result;
};

int argc;
const char *argv[];

void getArgv(MessageArgs& args) {
	args.result.set(nullptr);
	if (args.index >= argc) {
		return;
	}
	const char *value = argv[args.index];
	auto length = strlen(value);
	auto buffer = AssemblyScriptString::alloc(vm, length);
	if (!buffer || buffer->size != 2 * length) {
		puts("Fatal error: out of VM memory!");
		return;
	}
	convertFromUTF8(buffer->value, value, length);
	args.result.set(buffer);
}

/*

Validation bytecode capabilities:
 1) Move pointer backwards - validate header of data 
 2) Return pointer different than in guest - to include e.g. data header 
 3) Return end pointer - to allow array traveling or setting stack pointer to include result
 4) Convert pointer to gest index
 5) Support arrays:
   6) null-terminated
   7) Field null-terminated
   8) With count (variable size) and optional offset or align
 9) Checks alignment in structure fields and arrays
10) Support unions

Possible instructions:

align X - check if pointer is aligned
move X - move pointer forward (or backward if X < 0) checking if entire jump area is valid
store S - store current pointer in slot S
load S - load pointer from slot S
readN
add X
sub X
mul X
div X


Examples:

AssemblyScriptString:
	move -4 (1)
	store 0 (2)
	read32[a+] 1   // [a] checks alignment, [+] - moves pointer after read value
	move @1
	align 2

C string:
	array item_size=1, end_value=0, end_offset=0, end_size=1

	ptr - 4, ptr + read32(ptr)


TriVM minimalists instance:

AssemblyScriptString:		PTR
	READ32 [SP] - 0		PTR PTR
	SUB 4			PTR PTR-4
	READ32 [SP] - 0		PTR PTR-4 PTR-4
	READ32			PTR PTR-4 SIZE
	READ32 [SP] - 8		PTR PTR-4 SIZE PTR
	ADD			PTR PTR-4 END

AssemblyScriptString:		PTR
	READ32 [AMB1]		PTR PTR
	SUB 4			PTR PTR-4
	CALL -4			PTR SIZE
	ADD			END

C string:
	READ32 [AMB1]		PTR CUR
	begin:
	CALL -1			PTR CUR BYTE
	READ [SP] - 4
	ADD 1
	WRITE [SP] - 8
	BRT begin		PTR END

JUMP X
JUMP X * slot_value
SET_OUTPUT
READ slot_value = SIZE bytes
BRT/F slot

Encoding:
	size: N
	read: 1
	mul: 1
	ptr: 1

101	READ X
000	BRF X
001	BRT X
010	SET_OUTPUT
011	END
ALIGN

0000 JUMP+ N
0001 JUMP- N
0010 JUMP+* N
0011 JUMP-* N
0100 BRT+ N
0101 BRT- N
0110 BRF+ N
0111 BRF- N
1000 READ N
1010 SET_OUT
1011 END


AssemblyScriptString
	JUMP -4
	SET_OUTPUT
	READ 4
	JUMP 2 * value

C string:
	begin:
	READ 1
	BRT begin

Cases:
 * simple structure: alignment, beginning offset, ending offset, return offset
 * null-terminated array with header: alignment, beginning offset, return offset, array start offset, item size, null size, null offset, ending offset
 * sized array: alignment, beginning offset, return offset, array start offset, item size, length offset, length size, length to bytes formula,

|      V   ^    |

|     V     ^   |    |    |    | N  |        |

|     V     ^  SSSS |    |    |    |    |

*/


#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>

#if 0

uint8_t* getPtr(uint8_t *ptr, uint8_t *begin, uint8_t *end, uint8_t code[]) {
    uint8_t* result = ptr;
    uint32_t temp = 0;
    uint8_t *pc = &code[0];
    if ((uintptr_t)(*pc++) & (uintptr_t)ptr) {
        return NULL;
    }
    do {
        uint8_t byte;
        uint32_t op = 0;
        do {
            byte = *pc++;
            op <<= 8;
            op ^= (uint32_t)byte;
        } while (byte & 0x80);
        uint32_t value = op >> 4;
        if (op & (1 << 3)) {
            if (op & (1 << 2)) {
                if (op & (1 << 1)) {
                    if (temp && 33 - (int)__builtin_clz(value) - (int)__builtin_clz(temp) >= 0) {
                        return 0;
                    }
                    value *= temp;
                }
                if (op & (1 << 0)) {              // JUMP [mul] +
                    if (value > end - ptr) {
                        return 0;
                    }
                    ptr += value;
                } else {                          // JUMP [mul] -
                    if (value > ptr - begin) {
                        return 0;
                    }
                    ptr -= value;
                }
            } else { // BRT/F +/-
                if ((bool)temp == (bool)(op & (1 << 0))) {
                    pc += value - (op & (1 << 1)) * value;
                }
            }
        } else {
            if (op & (1 << 1)) { // READ
                int bit = 0;
                temp = 0;
                while (bit < 8 * value) {
                    if (ptr >= end) {
                        return 0;
                    }
                    temp |= (*ptr++) << bit;
                    bit += 8;
                }
            } else {
                if (op & (1 << 0)) { // OUTPUT
                    result = ptr;
                } else { // END
                    return result;
                }
            }
        }
    } while (1);
}

#else


typedef uint8_t* (*CheckPtrCallback)(uint8_t *ptr, uint8_t *begin, uint8_t *end, uintptr_t data);

struct Validator {
    union {
        struct {
            uint8_t align;
            uint8_t back_offset;
            uint16_t size;
        };
        CheckPtrCallback callback;
        uintptr_t data;
    };
};

static inline bool validatePtr(uint8_t *ptr, uint8_t *begin, uint8_t *end) {
    return ptr >= begin && ptr <= end;
}


static uint8_t* checkPtr(uint8_t *ptr, uint8_t *begin, uint8_t *end, struct Validator *validator) {
    if (validator->align & (uintptr_t)ptr & 0x1F) {
        return NULL;
    }
    uint8_t* prev = ptr - validator->back_offset;
    if (!validatePtr(prev, begin, end)) {
        return NULL;
    }
    uint8_t* next = ptr + validator->size;
    if (!validatePtr(next, begin, end)) {
        return NULL;
    }
    if (validator->align & 0x80) {
        return validator[1].callback(prev, begin, end, validator[2].data);
    } else {
        return prev;
    }
}


static uint8_t* checkCString(uint8_t *ptr, uint8_t *begin, uint8_t *end, uintptr_t data) {
    uint8_t *cur = ptr;
    while (*cur++) {
        if (cur >= end) {
            return NULL;
        }
    }
    return ptr;
}


static uint8_t* checkASBuffer(uint8_t *ptr, uint8_t *begin, uint8_t *end, uintptr_t data) {
    uint32_t size = *(uint32_t*)ptr + 4;
    uint8_t *data_end = ptr + size;
    if ((size & 1) || size >= 0x80000000 || !validatePtr(data_end, begin, end)) {
        return NULL;
    } else {
        return ptr;
    }
}

typedef struct tri_vm {
    uint8_t* prog_mem;
    uint32_t prog_size;
    uint8_t* data_mem;
    uint32_t data_size;
} tri_vm;

struct Validator validators[] = {
#define VALIDATOR_C_STRING 0
    {
        .align = 0x80,
        .back_offset = 0,
        .size = 1,
    },
    {
        .callback = checkCString,
    },
#define VALIDATOR_AS_STRING 2
    {
        .align = 0x83,
        .back_offset = 4,
        .size = 0,
    },
    {
        .callback = checkASBuffer,
    },
#define VALIDATOR_MY_CLASS 4
    {
        .align = 0x03,
        .back_offset = 0,
        .size = 124,
    },
};

void* getPtr(tri_vm* vm, uint32_t index, int validator) { // TODO: bool readOnly: it will fail if readOnly==false and pointer points to program memory
    uint8_t *begin;
    uint32_t size;
    if (index & 0x80000000) {
        begin = vm->prog_mem;
        size = vm->prog_size;
    } else {
        begin = vm->data_mem;
        size = vm->data_size;
    }
    return checkPtr(begin + index, begin, begin + size, &validators[validator]);
}


#endif

////////////////////////////////////////////////////// IDEA FOR CONFIGURATION FILE

/* triVM core configuration */

#define TRIVM_EXT_MEM64 1
#define TRIVM_EXT_I64 1
#define TRIVM_FAULT_STACK_OVERFLOW 1
#define TRIVM_FAULT_STACK_UNDERFLOW 1

/* triVM interface description */
#if 0 // OR inside a comment

/*
 * This is subset of TypeScript, so it can be parsed to AST with existing libraries.
 * Other option is to create TypeScript-like IDL, but not fully TypeScript compatible and use own parser.
 * Benefits of own parser:
 *   simpler function declaration: `@id(3) export declare function ...` => `export(3)`
 *   more intuitive pointer syntax `[ASString]` => `*ASString`
 *   inlined sub-structures and unions
 *   `union` keyword instead of `@union` decorator
 *   simpler unnamed unions and structures
*/
module("env");

@id(MESSAGE_ID)
declare function message(text: [ASString]): void;

@align("packed")
@validator("checkASBuffer")
class ASString {
	size: u32;
	@target
	data: u16[];
};

@id(MESSAGEC_ID)
declare function messageC(text: [CString]): void;

@validator("checkCString")
type CString = u8[];

@id(3)
export declare function main(argc: u32, argv: []): u32;

@storageType(u32)
enum MessageType {
    MESSAGE_TYPE_NONE = 0,
    MESSAGE_TYPE_STR = 1,
    MESSAGE_TYPE_INT = 1,
    MESSAGE_TYPE_COMPLEX = 1,
};

class WithUnnamedUnion {
    type: MessageType;
    @unnamed
    _: MessageUnion;
};

class WithNamedUnion {
    type: MessageType;
    content: MessageUnion;
};

@union
class MessageUnion {
    text: [CString];
    intValue: i32;
    complexValue: Complex;
}

class Complex {
    real: f32;
    imaginary: f32;
}

#endif
