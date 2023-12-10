/*
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

import { Path } from '../common/path';
import { generate } from './generator';
import { LinkResolver } from './linkResolver';
import { moduleDebug, ModuleStage } from './moduleDebug';
import { ModuleMerger } from './moduleMerger';
import { reduce } from './reducer';
import { WasmParser } from './wasmParser';

//let p = new WasmParser("test/__old/test.wasm");
let p = new WasmParser();
let main = p.parse('test/__old/libbzip2-dec.wasm', 0);

moduleDebug(main, ModuleStage.AfterParser, new Path('dump.html'));

let triwasmlib = p.parse(Path.runtime.join('triwasmlib.wasm').toString(), main.logicalOffsets.end);
let softfloatlib = p.parse(Path.runtime.join('softfloatlib.wasm').toString(), triwasmlib.logicalOffsets.end);

moduleDebug(main, ModuleStage.AfterParser, new Path('dump.html'));
moduleDebug(triwasmlib, ModuleStage.AfterParser, new Path('triwasmlib.html'));
moduleDebug(softfloatlib, ModuleStage.AfterParser, new Path('softfloatlib.html'));

let m = new ModuleMerger(main);
m.merge(triwasmlib, '__triwasm__triwasmlib');
m.merge(softfloatlib, '__triwasm__softfloatlib');

moduleDebug(main, ModuleStage.AfterParser, new Path('merged.html'));

let r = new LinkResolver();
r.resolve(main);

moduleDebug(main, ModuleStage.AfterResolver, new Path('resolved.html'));

/*

//new ModuleDebug(main, ModuleStage.AfterResolver).diagnose();

reduce(main);

new ModuleDebug(main, ModuleStage.AfterReducer).diagnose();

generate(main);
*/