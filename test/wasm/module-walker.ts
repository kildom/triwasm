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

import { platform } from "../../tools/utils/platform";
import { BinaryInput } from "../../tools/wasm/binaryInput";
import { LinkResolver } from "../../tools/wasm/linkResolver";
import { ModuleDebug, ModuleStage } from "../../tools/wasm/moduleDebug";
import { ModuleMerger } from "../../tools/wasm/moduleMerger";
import { FunctionWalkerListener, walkFunctions, ExitInstrCtx } from "../../tools/wasm/moduleWalker";
import { OP } from "../../tools/wasm/opcodes";
import { Reducer } from "../../tools/wasm/reducer";
import { WasmBlock, WasmFunction, WasmInstr, WasmModule } from "../../tools/wasm/wasmModule";
import { WasmParser } from "../../tools/wasm/wasmParser";

//let p = new WasmParser("test/__old/test.wasm");
let p = new WasmParser();
let main = p.parse("test/__old/libbzip2-dec.wasm", 0);
let triwasmlib = p.parse("dist/data/lib/triwasmlib.wasm", main.logicalOffsets.end);
let softfloatlib = p.parse("dist/data/lib/softfloatlib.wasm", triwasmlib.logicalOffsets.end);

let m = new ModuleMerger(main);
m.merge(triwasmlib, '__triwasm__triwasmlib');
m.merge(softfloatlib, '__triwasm__softfloatlib');

let r = new LinkResolver();
r.resolve(main);

//new ModuleDebug(main, ModuleStage.AfterResolver).diagnose();

let red = new Reducer();
red.reduce(main);

//new ModuleDebug(main, ModuleStage.AfterReducer).diagnose();

let lastId = 0;
let map: Map<any, number> = new Map();

function id(x: any): string {
    if (typeof (x) === 'object' && x instanceof Array) {
        return x.map(v => id(v)).join(',');
    }
    if (map.has(x)) return map.get(x)!.toString();
    let r = lastId++;
    map.set(x, r);
    return r.toString();
}

let out:string[] = [];

let callbacks: FunctionWalkerListener<string, string, string, string> = {
    enterFunction(ctx) {
        out.push(`enter function ${id(ctx.func)} in ${id(ctx.module)} "${ctx.moduleData}"`);
        return id(ctx.func);
    },
    exitFunction(ctx) {
        out.push(`exit function ${id(ctx.func)}==${ctx.funcData} in ${id(ctx.module)} "${ctx.moduleData}"`);
    },
    enterBlock(ctx) {
        out.push(`enter block ${id(ctx.block)} ${id(ctx.blockStack)} ${ctx.blockDataStack.join(',')} ${id(ctx.func)} ${ctx.funcData} ${id(ctx.instrStack)} ${ctx.instrDataStack.join(',')} ${ctx.instrIndexStack.join(',')} ${id(ctx.module)} ${ctx.moduleData}`);
        return id(ctx.block);
    },
    exitBlock(ctx) {
        out.push(`exit block ${id(ctx.block)}==${ctx.blockData} ${id(ctx.blockStack)} ${ctx.blockDataStack.join(',')} ${id(ctx.func)} ${ctx.funcData} ${id(ctx.instrStack)} ${ctx.instrDataStack.join(',')} ${ctx.instrIndexStack.join(',')} ${id(ctx.module)} ${ctx.moduleData}`);
    },
    enterInstr(ctx) {
        out.push(`enter instr ${ctx.instr.opcode} ${id(ctx.instr)} ${id(ctx.block)}==${ctx.blockData} ${id(ctx.blockStack)} ${ctx.blockDataStack.join(',')} ${id(ctx.func)} ${ctx.funcData} ${id(ctx.instrStack)} ${ctx.instrDataStack.join(',')} ${ctx.instrIndexStack.join(',')} ${id(ctx.module)} ${ctx.moduleData}`);
        return id(ctx.instr);
    },
    exitInstr(ctx) {
        out.push(`exit instr ${ctx.instr.opcode} ${id(ctx.instr)}==${ctx.instrData} ${id(ctx.block)}==${ctx.blockData} ${id(ctx.blockStack)} ${ctx.blockDataStack.join(',')} ${id(ctx.func)} ${ctx.funcData} ${id(ctx.instrStack)} ${ctx.instrDataStack.join(',')} ${ctx.instrIndexStack.join(',')} ${id(ctx.module)} ${ctx.moduleData}`);
    },
};

out = [];
walkFunctions<string, string, string, string>(main, 'mod', callbacks);
let result1 = out.join('\n');

out = [];

function walkBlock(module: WasmModule, moduleData: string, func: WasmFunction, funcData: string, block: WasmBlock, blockStack: WasmBlock[], blockDataStack: string[], instrStack: WasmInstr[], instrDataStack: string[], instrIndexStack: number[]) {
    let blockData = callbacks.enterBlock({
        module,
        moduleData,
        func,
        funcData,
        block,
        blockStack,
        blockDataStack,
        instrStack,
        instrDataStack,
        instrIndexStack,
    });

    blockStack.push(block);
    blockDataStack.push(blockData);

    for (let instrIndex = 0; instrIndex < block.body.length; instrIndex++) {
        let instr = block.body[instrIndex];
        let instrData = callbacks.enterInstr({
            module,
            moduleData,
            func,
            funcData,
            block,
            blockData,
            blockStack,
            blockDataStack,
            instrStack,
            instrDataStack,
            instrIndexStack,
            instrIndex,
            instr,
        });

        if (instr.opcode == OP.BLOCK || instr.opcode == OP.LOOP || instr.opcode == OP.IF) {
            instrStack.push(instr);
            instrDataStack.push(instrData);
            instrIndexStack.push(instrIndex);
            walkBlock(module, moduleData, func, funcData, instr.block, blockStack, blockDataStack, instrStack, instrDataStack, instrIndexStack);
            instrIndexStack.pop();
            instrDataStack.pop();
            instrStack.pop();
        }
        
        callbacks.exitInstr!({
            module,
            moduleData,
            func,
            funcData,
            block,
            blockData,
            blockStack,
            blockDataStack,
            instrStack,
            instrDataStack,
            instrIndexStack,
            instrIndex,
            instrData,
            instr: block.body[instrIndex],
        });
    }

    blockDataStack.pop();
    blockStack.pop();

    callbacks.exitBlock!({
        module,
        moduleData,
        func,
        funcData,
        block,
        blockData,
        blockStack,
        blockDataStack,
        instrStack,
        instrDataStack,
        instrIndexStack,
    });
}

for (let func of main.functions) {
    let funcData = callbacks.enterFunction({
        func,
        module: main,
        moduleData: 'mod',
    });
    if (func.block) {
        walkBlock(main, 'mod', func, funcData, func.block, [], [], [], [], []);
    }
    callbacks.exitFunction!({
        func,
        funcData,
        module: main,
        moduleData: 'mod',
    });
}

let ok = result1 == out.join('\n');

console.log(ok);


