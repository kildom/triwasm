import { platform } from "../utils/platform";
import { BinaryInput } from "./binaryInput";
import { WasmParser } from "./wasmParser";

//let p = new WasmParser("test/__old/test.wasm");
let p = new WasmParser("test/__old/libbzip2-dec.wasm");
p.parse();

