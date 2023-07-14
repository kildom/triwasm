
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

#include "trivm.h"

#define MY_ASSERT(c, t, ...) do { if (!(c)) { fprintf(stderr, t, ##__VA_ARGS__); exit(2); }} while (0)

_Static_assert(sizeof(void*) == sizeof(uintptr_t), "Unsupported");

#if UINTPTR_MAX == 0xFFFFFFFF
#define PTR_SIZE 4
#elif UINTPTR_MAX == 0xFFFFFFFFFFFFFFFFu
#define PTR_SIZE 8
#else
#error Invalid pointer size
#endif

typedef union {
	uint64_t data;
	struct {
		#if PTR_SIZE == 4
		uint32_t _padding;
		#endif
		struct trivm_instance vm;
	};
} trivm_container;

static char **ext_files;
static int ext_files_count;

struct trivm_instance *read_vm(const char* file, struct trivm_instance *vm, uint64_t *data)
{
	FILE* f = fopen(file, "rb");
	MY_ASSERT(f != NULL, "Cannot open file '%s'\n", file);
	fseek(f, 0, SEEK_END);
	int size = ftell(f);
	MY_ASSERT(size >= 0, "Cannot access file '%s'\n", file);
	MY_ASSERT(size > sizeof(trivm_container), "Input file '%s' too small\n", file);
	fseek(f, 0, SEEK_SET);
	trivm_container *container;
	if (vm == NULL)
	{
		container = malloc(size);
		MY_ASSERT(container != NULL, "Out of memory\n");
	}
	else
	{
		container = (trivm_container *)((uint8_t *)vm - offsetof(trivm_container, vm));
		int current_size = offsetof(trivm_container, vm.ram) + vm->ram_size + vm->rom_size;
		MY_ASSERT(current_size == size, "Excepted different sizes in file '%s'\n", file);
	}
	vm = &container->vm;
	long n = fread(container, 1, size, f);
	fclose(f);
	MY_ASSERT(n == size, "Read error from file '%s'\n", file);
	uint32_t memory_size = offsetof(trivm_container, vm.ram) + vm->ram_size;
	MY_ASSERT(memory_size + vm->rom_size == size, "Invalid sizes in file '%s'\n", file);
	if (data)
	{
		*data = container->data;
	}
	vm->rom = &vm->ram[vm->ram_size];
	return vm;
}

void write_vm(const char* file, struct trivm_instance *vm, uint64_t data)
{
	trivm_container *container = (trivm_container *)((uint8_t *)vm - offsetof(trivm_container, vm));
	FILE* f = fopen(file, "wb");
	MY_ASSERT(f != NULL, "Cannot open file '%s' for writing", file);
	int size = offsetof(trivm_container, vm.ram) + vm->ram_size + vm->rom_size;
	uint8_t *tmp = vm->rom;
	container->data = data;
	int n = fwrite(container, 1, size, f);
	vm->rom = tmp;
	MY_ASSERT(n == size, "Write error to file '%s'", file);
	fclose(f);
}

struct trivm_instance *copy_vm(struct trivm_instance *vm)
{
	trivm_container *container = (trivm_container *)((uint8_t *)vm - offsetof(trivm_container, vm));
	int size = offsetof(trivm_container, vm.ram) + vm->ram_size + vm->rom_size;
	trivm_container *new_container = malloc(size);
	MY_ASSERT(new_container != NULL, "Out of memory\n");
	memcpy(new_container, container, size);
	new_container->vm.rom = &new_container->vm.ram[new_container->vm.ram_size];
	return &new_container->vm;
}

void free_vm(struct trivm_instance *vm)
{
	trivm_container *container = (trivm_container *)((uint8_t *)vm - offsetof(trivm_container, vm));
	free(container);
}

uint32_t my_ext(struct trivm_instance *vm, uint32_t id, uint32_t *params, uint32_t num_params)
{
	uint64_t result;
	MY_ASSERT(ext_files_count > 1, "More EXT calls than input files");
	struct trivm_instance *tmp = copy_vm(vm);
	read_vm(ext_files[0], vm, &result);
	write_vm(ext_files[0], tmp, id);
	free_vm(tmp);
	ext_files++;
	ext_files_count--;
	return result;
}

int main(int argc, char* argv[])
{
	uint64_t steps;
	uint64_t result;
	if (argc < 2)
	{
		fprintf(stderr, "usage: %s trivm_state_binary_file [ext_state [ext_state [...]]]\n", argv[0]);
		return 1;
	}
	ext_files_count = argc - 2;
	ext_files = &argv[2];
	struct trivm_instance *vm = read_vm(argv[1], NULL, &steps);
	result = trivm_run(vm, steps);
	write_vm(argv[1], vm, result);
	return 0;
}
