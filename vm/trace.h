
#include <stdio.h>
#include <malloc.h>
#include <string.h>

static int trace_ind_size = 0;
static const char* trace_ind() {
	static char* result = NULL;
	static int current = 0;
	if (result == NULL) {
		result = strdup("");
	}
	if (current != trace_ind_size) {
		free(result);
		result = malloc(4 * trace_ind_size + 1);
		memset(result, ' ', 4 * trace_ind_size);
		result[4 * trace_ind_size] = 0;
	}
	return result;
}

#define TRACE(text, ...) printf("%s" text "\n", trace_ind(), ##__VA_ARGS__)
#define TRACE_IF(cond, text, ...) do { if (cond) { printf("%s" text "\n", trace_ind(), ##__VA_ARGS__); } } while (0)
#define TRACE_BEGIN(text, ...) do { printf("%s" text "\n", trace_ind(), ##__VA_ARGS__); trace_ind_size++; } while (0)
#define TRACE_END() do { trace_ind_size--; } while (0)
