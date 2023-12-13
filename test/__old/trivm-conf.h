

#define TRIVM_MEM_SIZE 65536

/* triVM interface:
 *
 * import function[0] void env.bzInternalError(i32 message);
 *
 * export function[0] i32 bzBuffToBuffDecompress(i32 dest, i32 destLen, i32 source, i32 sourceLen, i32 small, i32 verbosity);
 * export function[1] i32 bzDecompress(i32 ctx);
 * export function[2] i32 bzDecompressEnd(i32 ctx);
 */
