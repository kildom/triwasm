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
import { getWasmConf, WasmArgsMerge } from './args';
import { evaluateConstExpressions } from './constEvaluator';
import { FuncGenerator } from './genFunction';
import { GlobalsGenerator } from './genGlobal';
import { LinkResolver } from './linkResolver';
import { moduleDebug, ModuleStage } from './moduleDebug';
import { ModuleMerger } from './moduleMerger';
import { reduce } from './reducer';
//import { reduce } from './reducer';
import { WasmParser } from './wasmParser';

// Get configuration from command line and config file.

let conf = getWasmConf();

// Parse main module

let parser = new WasmParser();
let main = parser.parse(conf.args.input, 0);
moduleDebug(main, ModuleStage.AfterParser, conf.args.output.withExtension('main.parsed.html'));

// Merge triwasmlib, softfloatlib and any user provided modules to merge.

let mergeModules: WasmArgsMerge[] = [
    {
        name: '__triwasm__triwasmlib',
        file: Path.runtime.join('triwasmlib.wasm'),
        globalExports: false,
    },
    {
        name: '__triwasm__softfloatlib',
        file: Path.runtime.join('softfloatlib.wasm'),
        globalExports: false,
    },
    ...conf.args.merge,
];

let merger = new ModuleMerger(main);
let offsets = main.logicalOffsets.end;
for (let mergeModule of mergeModules) {
    let mod = parser.parse(mergeModule.file, offsets);
    offsets = mod.logicalOffsets.end;
    moduleDebug(mod, ModuleStage.AfterParser, conf.args.output.withExtension(mergeModule.name + '.parsed.html'));
    merger.merge(mod, mergeModule.name);
}

moduleDebug(main, ModuleStage.AfterParser, conf.args.output.withExtension('merged.html'));

// Evaluate constant expressions.

evaluateConstExpressions(main);

moduleDebug(main, ModuleStage.AfterParser, conf.args.output.withExtension('eval.html'));

// Resolve dependencies.

let resolver = new LinkResolver(conf);
resolver.resolve(main);
moduleDebug(main, ModuleStage.AfterResolver, conf.args.output.withExtension('resolved.html'));

reduce(main, conf);

moduleDebug(main, ModuleStage.AfterReducer, conf.args.output.withExtension('reduced.html'));

/*
let generator = new FuncGenerator(main, conf);
try {
    console.log(generator.generate(false));
} catch (err) {
    console.log(generator.getOutput(false));
    throw err;
}
*/

let globalsGenerator = new GlobalsGenerator(main, conf);
globalsGenerator.generate();

console.log('\n\n# ----------------------- placementConstInit ------------------------');
console.log(globalsGenerator.placementConstInit.getOutput(false));
console.log('\n\n# ----------------------- placementDynamicInit ------------------------');
console.log(globalsGenerator.placementDynamicInit.getOutput(false));
console.log('\n\n# ----------------------- placementProgram ------------------------');
console.log(globalsGenerator.placementProgram.getOutput(false));
console.log('\n\n# ----------------------- constInit ------------------------');
console.log(globalsGenerator.constInit.getOutput(false));
console.log('\n\n# ----------------------- dynamicInit ------------------------');
console.log(globalsGenerator.dynamicInit.getOutput(false));
