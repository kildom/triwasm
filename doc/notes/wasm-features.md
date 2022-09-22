
https://webassembly.org/roadmap/

Feature | | Status
--------|-|-------
JS BigInt to Wasm i64 integration	| ⁿ/ₐ | C has int64_t/uint64_t that already covers it
Bulk memory operations | ✔️ | in initial version (calls trivmlib)
Multi-value | ✔️ | in initial version
Import & export of mutable globals | ✔️ | in initial version
Reference types | ✔️ | in initial version
Non-trapping float-to-int conversions | ✔️ | in initial version
Sign-extension operations | ✔️ | in initial version
Fixed-width SIMD | ⏳ | plan for the near future (calls trivmlib)
Exception handling | ⏳ | plan for the future
Extended constant expressions | ⏳ | plan for the future
Memory64 | ❌ | not planned (triVM is disigned for small applications)
Multiple memories | ⏳ | plan for the far future (triVM needs memory mapping extension)
Module Linking | ❌ | not planned (maybe some external tool will be able to link before compilation)
Relaxed SIMD | ⏳ | plan for the far future (calls trivmlib)
Tail calls | ⏳ | plan for the near future
Threads and atomics | ❌/⏳ | cannot be applyied to current version of triVM (more reseach needed in this field)
Type reflection | ❌/⏳ | unknown status (more reseach needed in this field)

