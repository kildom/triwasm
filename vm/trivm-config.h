#ifndef _TRIVM_CONFIG_H_
#define _TRIVM_CONFIG_H_

#define TRIVM_EXT_UNWIND 1
#define TRIVM_EXT_MEM64 1
#define TRIVM_EXT_INT64 0
#define TRIVM_EXT_FLOAT32 0
#define TRIVM_EXT_FLOAT64 1

#define TRIVM_ENABLE_STDLIB 1
#define TRIVM_ENABLE_ROM 1

#define TRIVM_ENABLE_ALL_FAULTS 1

#define TRIVM_MEM_SIZE_MAX 256
#define TRIVM_MEM_GROWABLE 0

#define TRIVM_PROGRAM_SIZE_MAX 1024

#define TRIVM_ENABLE_HOST_CALLBACKS 1

#define TRIVM_IMPORT_TABLE_GROW 0
#define TRIVM_EXPORT_TABLE_GROW 0

/* triVM interface:
 *      export function[0] void startup();
 *      export function[1] i32 main(i32 argc, i32 argv);
 *      export table[2] funcref funcs; # This is a comment
 *
 *      import function[0] void env.puts(i32 text, i32 length);
 *      import function[1] i32 env.input(i32 buffer, i32 size);
 *      import table[2] externref env.refs;
 *
 *      export global[0] i32 env.some_global;
 * 
 * import function[2990] regcall ( i32 ,  i32  )  env.table_get(i32 op, i32 index);
 * export function[9] regcall () table_set(i32 opet, i32 index, i32 value);
 * import function[8] regcall (i32 err , i32 size) env.table_size(i32 opize);
 * export function[7] regcall i32 table_grow(i32 oprow, i32 new_length, i32 fill_value);
 */


#define TRIWASM_ENTRY_FUNCTION startup

/*  import/export table[2] funcref funcs;
 *      import/export function[2] regcall (i32, i32) table_get(i32 op=0=get, i32 index);
 *      import/export function[2] regcall i32 table_set(i32 op=1=set, i32 index, i32 value);
 *      import/export function[2] regcall (i32, i32) table_size(i32 op=2=size);
 *      import/export function[2] regcall i32 table_grow(i32 op=3=grow, i32 new_length, i32 fill_value);
 */

#endif /* _TRIVM_CONFIG_H_ */
