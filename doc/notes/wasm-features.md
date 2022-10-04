https://github.com/WebAssembly/proposals


### Finished Proposals

| Proposal                                                             | Status           |
| -------------------------------------------------------------------- | ---------------- |
| [Import/Export of Mutable Globals][import_export_of_mutable_globals] | ✔️ in initial version        |
| [Non-trapping float-to-int conversions][non-trapping_float-to-int_conversions] | ✔️ in initial version        |
| [Sign-extension operators][sign-extension_operators]                           | ✔️ in initial version         |
| [Multi-value][multi-value]                                                     | ✔️ in initial version  |
| [JavaScript BigInt to WebAssembly i64 integration][javascript_bigint_to_webassembly_i64_integration] | ⁿ/ₐ |
| [Reference Types][reference_types]                                             | ✔️ in initial version |
| [Bulk memory operations][bulk_memory_operations]                               | ✔️ in initial version        |
| [Fixed-width SIMD][fixed-width_simd]                                           | ⏳ plan for the near future (calls trivmlib) |


### Phase 5 - The Feature is Standardized (WG)

_These proposals have not yet been merged to the spec. Merged proposals are listed in [Finished Proposals](finished-proposals.md)._

| Proposal                                                   | Status        |
| -----------------------------------------------------------| --------------- |

### Phase 4 - Standardize the Feature (WG)

| Proposal                                                   | Status        |
| -----------------------------------------------------------| --------------- |

### Phase 3 - Implementation Phase (CG + WG)

| Proposal                                                   | Status                  |
| -----------------------------------------------------------| ------------------------- |
| [Tail call][tail_call]                                     | ⏳ plan for the near future         |
| [Multiple memories][multi-memory]                          | ⏳ plan for the future          |
| [Custom Annotation Syntax in the Text Format][annotations] | ⁿ/ₐ          |
| [Memory64][memory64]                                       | ❌ not planned (triVM is disigned for small applications) |
| [Exception handling][exception_handling]                   | ⏳ plan for the future                |
| [Web Content Security Policy][content-security-policy]     | ⁿ/ₐ            |
| [Branch Hinting][branch-hinting]                           | ⏳ plan for the near future (hints will be ignored because they are not benefitial in triVM) |
| [Extended Constant Expressions][extended-const]            | ⏳ plan for the future                 |
| [Relaxed SIMD][relaxed-simd]                               | ⏳ plan for the near future (calls trivmlib)  |

### Phase 2 - Proposed Spec Text Available (CG + WG)

| Proposal                                                       | Status                     |
| ---------------------------------------------------------------| -----------------------------|
| [Threads][threads]                                             | ❌ not planned, but stubs may be implemented in the future |
| [ECMAScript module integration][ecmascript_module_integration] | ⁿ/ₐ      |
| [Type Reflection for WebAssembly JavaScript API][js-types]     | ⁿ/ₐ            |
| [Typed Function References][function_references]               | ⏳ plan for the future             |
| [Relaxed dead code validation][relaxed-dead-code-validation]   | ⏳ plan for the future    |
| [Numeric Values in WAT Data Segments][numeric-values-in-wat]   | ⁿ/ₐ                 |
| [Instrument and Tracing Technology][instrument-tracing]        | ❌ not planned, but stubs may be implemented in the future            |
| [Garbage collection][garbage_collection]                       | ⏳ plan for the future             |
| [JS Promise Integration][js-promise-integration]               | ⁿ/ₐ |

### Phase 1 - Feature Proposal (CG)

| Proposal                                               | Status                     |
| ------------------------------------------------------ | -------------------------- |
| [Type Imports][type-imports]                           | ⏳ plan for the far future |
| [Component Model][component-model]                     | ⏳ plan for the far future |
| [WebAssembly C and C++ API][wasm_c_api]                | ⁿ/ₐ   |
| [Feature Detection][feature_detection]                 | ⏳ plan for the far future |
| [Extended Name Section][extended-name-section]         | ⁿ/ₐ |
| [Flexible Vectors][flexible-vectors]                   | ⏳ plan for the far future (calls trivmlib)  |
| [Call Tags][call-tags]                                 | ⏳ plan for the far future   |
| [Stack Switching][stack-switching]                     | ⏳ plan for the far future   |
| [Constant Time][constant-time]                         | ❌ not planned, but in future can be mapped to non-constant time instructions |
| [JS Customization for GC Objects][gc-js-customization] | ⁿ/ₐ   |
| [Memory control][memory-control]                       | ⏳ plan for the far future  |
| [Reference-Typed Strings][stringref]                   | ⏳ plan for the far future  |


### Phase 0 - Pre-Proposal (CG)

| Proposal                                                    | Status                         |
| ----------------------------------------------------------- | -------------------------------- |
| [Funclets: Flexible Intraprocedural Control Flow][funclets] | ⏳ plan for the far future |

## Implementation status

Roadmap is available on https://webassembly.org/roadmap/

## Contributing new proposals

Please see [Contributing to WebAssembly](https://github.com/WebAssembly/design/blob/main/Contributing.md) for the most up-to-date information on contributing proposals to standard.

[import_export_of_mutable_globals]: https://github.com/WebAssembly/mutable-global
[non-trapping_float-to-int_conversions]: https://github.com/WebAssembly/nontrapping-float-to-int-conversions
[sign-extension_operators]: https://github.com/WebAssembly/sign-extension-ops
[multi-value]: https://github.com/WebAssembly/multi-value
[javascript_bigint_to_webassembly_i64_integration]: https://github.com/WebAssembly/JS-BigInt-integration
[reference_types]: https://github.com/WebAssembly/reference-types
[bulk_memory_operations]: https://github.com/WebAssembly/bulk-memory-operations
[fixed-width_simd]: https://github.com/webassembly/simd
[wg-06-06]: https://github.com/WebAssembly/meetings/blob/main/main/2018/WG-06-06.md#discussion-on-status-of-the-working-draft
[WG-03-11]: https://github.com/WebAssembly/meetings/blob/main/main/2020/WG-03-11.md
[WG-06-09]: https://lists.w3.org/Archives/Public/public-webassembly/2020Jun/0000.html
[WG-02-10-2021]: https://github.com/WebAssembly/meetings/blob/main/main/2021/WG-02-10.md
[WG-07-14-2021]: https://github.com/WebAssembly/meetings/blob/main/main/2021/WG-07-14.md
[annotations]: https://github.com/WebAssembly/annotations
[ecmascript_module_integration]: https://github.com/WebAssembly/esm-integration
[exception_handling]: https://github.com/WebAssembly/exception-handling
[feature_detection]: https://github.com/WebAssembly/feature-detection
[function_references]: https://github.com/WebAssembly/function-references
[type-imports]: https://github.com/WebAssembly/proposal-type-imports
[garbage_collection]: https://github.com/WebAssembly/gc
[component-model]: https://github.com/WebAssembly/component-model
[multi-memory]: https://github.com/WebAssembly/multi-memory
[tail_call]: https://github.com/WebAssembly/tail-call
[threads]: https://github.com/webassembly/threads
[js-types]: https://github.com/WebAssembly/js-types
[wasm_c_api]: https://github.com/WebAssembly/wasm-c-api
[content-security-policy]: https://github.com/WebAssembly/content-security-policy
[webassembly_specification]: https://github.com/WebAssembly/spec
[funclets]: https://github.com/WebAssembly/funclets
[extended-name-section]: https://github.com/WebAssembly/extended-name-section
[constant-time]: https://github.com/WebAssembly/constant-time
[memory64]: https://github.com/WebAssembly/memory64
[flexible-vectors]: https://github.com/WebAssembly/flexible-vectors
[numeric-values-in-wat]: https://github.com/WebAssembly/wat-numeric-values
[instrument-tracing]: https://github.com/WebAssembly/instrument-tracing
[call-tags]: https://github.com/WebAssembly/call-tags
[relaxed-dead-code-validation]: https://github.com/WebAssembly/relaxed-dead-code-validation
[branch-hinting]: https://github.com/WebAssembly/branch-hinting
[extended-const]: https://github.com/WebAssembly/extended-const
[relaxed-simd]: https://github.com/WebAssembly/relaxed-simd
[stack-switching]: https://github.com/WebAssembly/stack-switching
[js-promise-integration]: https://github.com/WebAssembly/js-promise-integration
[gc-js-customization]: https://github.com/WebAssembly/gc-js-customization
[memory-control]: https://github.com/WebAssembly/memory-control
[stringref]: https://github.com/WebAssembly/stringref
