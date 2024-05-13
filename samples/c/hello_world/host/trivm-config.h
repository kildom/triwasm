#ifndef _TRIVM_CONFIG_H_
#define _TRIVM_CONFIG_H_

#define TRIVM_EXT_UNWIND 1
#define TRIVM_EXT_MEM64 1
#define TRIVM_EXT_INT64 0
#define TRIVM_EXT_FLOAT32 0
#define TRIVM_EXT_FLOAT64 1

#define TRIVM_STDLIB 1
#define TRIVM_ENABLE_ROM 1

#define TRIVM_ALL_FAULTS 1

#define TRIVM_MEM_SIZE_MAX 256
#define TRIVM_MEM_GROWABLE 0

#define TRIVM_PROGRAM_SIZE_MAX 1024

#define TRIVM_ENABLE_HOST_CALLBACKS 1

#define TRIVM_IMPORT_TABLE_GROWABLE 0
#define TRIVM_EXPORT_TABLE_GROWABLE 0

/* triVM interface:
 *
 * import function[1] void env.println(i32 text);
 * export function[1] i32 test(i32);
 *
 */


#endif /* _TRIVM_CONFIG_H_ */
