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
import { TimePref } from '../common/timepref';
import { getWasmConf, WasmArgsMerge } from './args';
import { CodeOutput } from './codeOutput';
import { evaluateConstExpressions } from './constEvaluator';
import { FuncGenerator } from './genFunction';
import { GlobalsGenerator } from './genGlobal';
import { TablesGenerator } from './genTable';
import { LinkResolver } from './linkResolver';
import { /*moduleDebug,*/ ModuleStage } from './moduleDebug';
import { ModuleMerger } from './moduleMerger';
import { reduce } from './reducer';
import { skeleton } from './skeleton';
//import { reduce } from './reducer';
import { WasmParser } from './wasmParser';

function moduleDebug(...args: any[]): void { }

// Get configuration from command line and config file.

let t = new TimePref();
t.enabled = false;

t.start();
let conf = getWasmConf();
t.print('Load config');

// Parse main module

t.start();
let parser = new WasmParser();
let main = parser.parse(conf.args.input, 0);
t.print('Parse main');
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
    t.start();
    let mod = parser.parse(mergeModule.file, offsets);
    t.print(`Parse ${mergeModule.name}`);
    offsets = mod.logicalOffsets.end;
    moduleDebug(mod, ModuleStage.AfterParser, conf.args.output.withExtension(mergeModule.name + '.parsed.html'));
    t.start();
    merger.merge(mod, mergeModule.name);
    t.print(`Merge ${mergeModule.name}`);
}

moduleDebug(main, ModuleStage.AfterParser, conf.args.output.withExtension('merged.html'));

// Evaluate constant expressions.

t.start();
evaluateConstExpressions(main);
t.print('Constant expressions');

moduleDebug(main, ModuleStage.AfterParser, conf.args.output.withExtension('eval.html'));

// Resolve dependencies.

t.start();
let resolver = new LinkResolver(conf);
resolver.resolve(main);
t.print('Resolver');
moduleDebug(main, ModuleStage.AfterResolver, conf.args.output.withExtension('resolved.html'));

t.start();
reduce(main, conf);
t.print('Reducer');

moduleDebug(main, ModuleStage.AfterReducer, conf.args.output.withExtension('reduced.html'));

let funcGen = new FuncGenerator(main, conf);
let globalsGen = new GlobalsGenerator(main, conf);
let tablesGen = new TablesGenerator(main, conf);
let output = new CodeOutput();

//console.log(JSON.stringify(conf, null, 2));

t.start();
skeleton(main, funcGen, globalsGen, tablesGen, conf, output);
t.print('Generator');

new Path('temp/out.triasm').write(output.getOutput(false));


/*
try {
    t.start();
    let code = generator.generate(false);
    t.print('Function generator');
    console.log(code);
} catch (err) {
    console.log(generator.getOutput(false));
    throw err;
}

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
*/
