/*!
 * Copyright (c) 2023 Dominik Kilian <kontakt@dominik.cc>
 *
 * This program is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this
 * program. If not, see <https://www.gnu.org/licenses/>.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { platform } from "../utils/platform";
import { BinaryInput } from "./binaryInput";
import { LinkResolver } from "./linkResolver";
import { ModuleMerger } from "./moduleMerger";
import { Reducer } from "./reducer";
import { WasmParser } from "./wasmParser";

//let p = new WasmParser("test/__old/test.wasm");
let p = new WasmParser();
let main = p.parse("test/__old/libbzip2-dec.wasm");
let triwasmlib = p.parse("dist/data/lib/triwasmlib.wasm");
let softfloatlib = p.parse("dist/data/lib/softfloatlib.wasm");

let m = new ModuleMerger(main);
m.merge(triwasmlib, '__triwasm__triwasmlib');
m.merge(softfloatlib, '__triwasm__softfloatlib');

let r = new LinkResolver();
r.resolve(main);

let red = new Reducer();
red.reduce(main);
