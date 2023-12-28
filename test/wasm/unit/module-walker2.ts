
import * as fs from 'node:fs';
import { Path } from '../../../tools/common/path';
import { walkFunctions, WalkFunctionListener, WalkResult } from '../../../tools/wasm/moduleWalker2';
import { OP } from '../../../tools/wasm/opcodes';
import { WasmBlock, WasmFunction, WasmInstr, WasmModule } from '../../../tools/wasm/wasmModule';
import { WasmParser } from '../../../tools/wasm/wasmParser';

const CTX_KEYS: string[] = [
    'func',
    'funcData',
    'block',
    'blockData',
    'blockStack',
    'blockDataStack',
    'instr',
    'instrData',
    'instrIndex',
    'instrStack',
    'instrDataStack',
    'instrIndexStack',
];

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

function dumpValue(val: any): string {
    if (typeof (val) !== 'object') {
        return JSON.stringify(val);
    } else if (val instanceof Array) {
        return '[' + val
            .map(x => dumpValue(x))
            .join(', ') + ']';
    } else {
        return id(val);
    }
}

function dumpObject(obj: { [key: string]: any; }): string {
    return Object.entries(obj)
        .filter(x => x[1] !== undefined)
        .filter(x => CTX_KEYS.indexOf(x[0]) !== -1)
        .map(x => x[0])
        .sort()
        .map(x => `${x}:${dumpValue(obj[x])}`)
        .join(', ');
}

interface OptionsParams {
    enterFunctionSkipSiblingEvery?: number;
    enterFunctionSkipChildrenEvery?: number;
    enterInstrSkipSiblingEvery?: number;
    enterInstrSkipChildrenEvery?: number;
    enterBlockSkipChildrenEvery?: number;
    exitFunctionSkipSiblingEvery?: number;
    exitInstrSkipSiblingEvery?: number;
}

class Options implements OptionsParams {

    enterFunctionSkipSiblingEvery: number = 2000000000;
    enterFunctionSkipChildrenEvery: number = 2000000000;
    enterInstrSkipSiblingEvery: number = 2000000000;
    enterInstrSkipChildrenEvery: number = 2000000000;
    enterBlockSkipChildrenEvery: number = 2000000000;
    exitFunctionSkipSiblingEvery: number = 2000000000;
    exitInstrSkipSiblingEvery: number = 2000000000;

    enterFunctionCounter: number = 0;
    exitFunctionCounter: number = 0;
    enterBlockCounter: number = 0;
    enterInstrCounter: number = 0;
    exitInstrCounter: number = 0;

    constructor(params: OptionsParams) {
        if (params.enterFunctionSkipSiblingEvery)
            this.enterFunctionSkipSiblingEvery = params.enterFunctionSkipSiblingEvery;
        if (params.enterFunctionSkipChildrenEvery)
            this.enterFunctionSkipChildrenEvery = params.enterFunctionSkipChildrenEvery;
        if (params.enterInstrSkipSiblingEvery)
            this.enterInstrSkipSiblingEvery = params.enterInstrSkipSiblingEvery;
        if (params.enterInstrSkipChildrenEvery)
            this.enterInstrSkipChildrenEvery = params.enterInstrSkipChildrenEvery;
        if (params.enterBlockSkipChildrenEvery)
            this.enterBlockSkipChildrenEvery = params.enterBlockSkipChildrenEvery;
        if (params.exitFunctionSkipSiblingEvery)
            this.exitFunctionSkipSiblingEvery = params.exitFunctionSkipSiblingEvery;
        if (params.exitInstrSkipSiblingEvery)
            this.exitInstrSkipSiblingEvery = params.exitInstrSkipSiblingEvery;
    }

    enterFunction(): WalkResult {
        this.enterFunctionCounter++;
        if (this.enterFunctionCounter % this.enterFunctionSkipChildrenEvery === 0) {
            return WalkResult.SKIP_CHILDREN;
        }
        if (this.enterFunctionCounter % this.enterFunctionSkipSiblingEvery === 0) {
            return WalkResult.SKIP_SIBLINGS;
        }
        return WalkResult.CONTINUE;
    }
    exitFunction(): WalkResult.CONTINUE | WalkResult.SKIP_SIBLINGS {
        this.exitFunctionCounter++;
        if (this.exitFunctionCounter % this.exitFunctionSkipSiblingEvery === 0) {
            return WalkResult.SKIP_SIBLINGS;
        }
        return WalkResult.CONTINUE;
    }
    enterBlock(): WalkResult.CONTINUE | WalkResult.SKIP_CHILDREN {
        this.enterBlockCounter++;
        if (this.enterBlockCounter % this.enterBlockSkipChildrenEvery === 0) {
            return WalkResult.SKIP_CHILDREN;
        }
        return WalkResult.CONTINUE;
    }
    enterInstr(): WalkResult {
        this.enterInstrCounter++;
        if (this.enterInstrCounter % this.enterInstrSkipChildrenEvery === 0) {
            return WalkResult.SKIP_CHILDREN;
        }
        if (this.enterInstrCounter % this.enterInstrSkipSiblingEvery === 0) {
            return WalkResult.SKIP_SIBLINGS;
        }
        return WalkResult.CONTINUE;
    }
    exitInstr(): WalkResult.CONTINUE | WalkResult.SKIP_SIBLINGS {
        this.exitInstrCounter++;
        if (this.exitInstrCounter % this.exitInstrSkipSiblingEvery === 0) {
            return WalkResult.SKIP_SIBLINGS;
        }
        return WalkResult.CONTINUE;
    }
}

function walkRecursiveBlock(out: string[], options: Options, module: WasmModule, func: WasmFunction, block: WasmBlock,
    blockStack: WasmBlock[], blockInstrIndex: number, instrIndexStack: number[]
): void {
    out.push('enterBlock ' + dumpObject({
        module,
        func,
        funcData: id(func),
        block,
        blockData: undefined,
        blockStack,
        blockDataStack: blockStack.map(x => id(x)),
        instr: block.parentInstruction,
        instrData: id(block.parentInstruction),
        instrIndex: blockInstrIndex,
        instrStack: blockStack.map(x => x.parentInstruction),
        instrDataStack: blockStack.map(x => id(x.parentInstruction)),
        instrIndexStack,
    }));
    let res = options.enterBlock();
    if (res === WalkResult.CONTINUE) {
        for (let i = 0; i < block.body.length; i++) {
            let instr = block.body[i];
            out.push('enterInstr ' + dumpObject({
                module,
                func,
                funcData: id(func),
                block,
                blockData: id(block),
                blockStack: [...blockStack, block],
                blockDataStack: [...blockStack, block].map(x => id(x)),
                instr,
                instrData: undefined,
                instrIndex: i,
                instrStack: [...blockStack, block].map(x => x.parentInstruction),
                instrDataStack: [...blockStack, block].map(x => id(x.parentInstruction)),
                instrIndexStack: [...instrIndexStack, blockInstrIndex],
            }));
            let res = options.enterInstr();
            if (res === WalkResult.SKIP_SIBLINGS) break;
            if (res === WalkResult.CONTINUE &&
                (instr.opcode === OP.BLOCK || instr.opcode === OP.LOOP || instr.opcode === OP.IF)) {
                walkRecursiveBlock(out, options, module, func, instr.block, [...blockStack, block], i,
                    [...instrIndexStack, blockInstrIndex]);
            }
            out.push('exitInstr ' + dumpObject({
                module,
                func,
                funcData: id(func),
                block,
                blockData: id(block),
                blockStack: [...blockStack, block],
                blockDataStack: [...blockStack, block].map(x => id(x)),
                instr,
                instrData: id(instr),
                instrIndex: i,
                instrStack: [...blockStack, block].map(x => x.parentInstruction),
                instrDataStack: [...blockStack, block].map(x => id(x.parentInstruction)),
                instrIndexStack: [...instrIndexStack, blockInstrIndex],
            }));
            res = options.exitInstr();
            if (res === WalkResult.SKIP_SIBLINGS) break;
        }
    }
    out.push('exitBlock ' + dumpObject({
        module,
        func,
        funcData: id(func),
        block,
        blockData: id(block),
        blockStack,
        blockDataStack: blockStack.map(x => id(x)),
        instr: block.parentInstruction,
        instrData: id(block.parentInstruction),
        instrIndex: blockInstrIndex,
        instrStack: blockStack.map(x => x.parentInstruction),
        instrDataStack: blockStack.map(x => id(x.parentInstruction)),
        instrIndexStack,
    }));
}

function walkRecursive(out: string[], options: Options, module: WasmModule) {
    for (let func of module.functions) {
        out.push('enterFunction ' + dumpObject({
            module,
            func,
            funcData: undefined,
            block: undefined,
            blockData: undefined,
            blockStack: [],
            blockDataStack: [],
            instr: func.block?.parentInstruction,
            instrData: undefined,
            instrIndex: 0,
            instrStack: [],
            instrDataStack: [],
            instrIndexStack: [],
        }));
        let res = options.enterFunction();
        if (res === WalkResult.SKIP_SIBLINGS) break;
        if (func.block && res === WalkResult.CONTINUE) {
            walkRecursiveBlock(out, options, module, func, func.block, [], 0, []);
        }
        out.push('exitFunction ' + dumpObject({
            module,
            func,
            funcData: id(func),
            block: undefined,
            blockData: undefined,
            blockStack: [],
            blockDataStack: [],
            instr: func.block?.parentInstruction,
            instrData: id(func.block?.parentInstruction),
            instrIndex: 0,
            instrStack: [],
            instrDataStack: [],
            instrIndexStack: [],
        }));
        res = options.exitFunction();
        if (res === WalkResult.SKIP_SIBLINGS) break;
    }
}

type FunctionData = string;
type BlockData = string;
type InstrData = string;

function assert(cond: any) {
    if (!cond) throw new Error('assert');
}

class TestWalker implements WalkFunctionListener<FunctionData, BlockData, InstrData> {

    out: string[] = [];

    func!: WasmFunction;           // Current function
    funcData?: FunctionData;      // Current function data
    block?: WasmBlock;            // Current block or a block that we are entering
    blockData?: BlockData;        // Current block data
    blockStack!: WasmBlock[];      // Stack of parent blocks, not including entering or exiting block,
    blockDataStack!: BlockData[];  // Stack of parent block's data
    instr?: WasmInstr;            // Current instruction
    instrData?: InstrData;        // Current instruction data
    instrIndex?: number;          // Current instruction index within containing block
    instrStack!: WasmInstr[];      // Stack of parent block instructions (not including function body)
    instrDataStack!: InstrData[];  // Stack of data associated with with elements of instrStack
    instrIndexStack!: number[];    // Stack of parent block instructions indexes within theirs parent blocks

    constructor(public options: Options, public module: WasmModule) { }

    test() {
        walkFunctions(this);
    }

    enterFunction(ctx: any) {
        assert(this === ctx);
        this.out.push('enterFunction ' + dumpObject(ctx));
        this.funcData = id(this.func);
        this.instrData = id(this.func.block?.parentInstruction);
        return this.options.enterFunction();
    }
    exitFunction(ctx: any) {
        assert(this === ctx);
        this.out.push('exitFunction ' + dumpObject(ctx));
        return this.options.exitFunction();
    }
    enterBlock(ctx: any) {
        assert(this === ctx);
        this.out.push('enterBlock ' + dumpObject(ctx));
        this.blockData = id(this.block);
        return this.options.enterBlock();
    }
    exitBlock(ctx: any) {
        assert(this === ctx);
        this.out.push('exitBlock ' + dumpObject(ctx));
    }
    enterInstr(ctx: any) {
        assert(this === ctx);
        this.out.push('enterInstr ' + dumpObject(ctx));
        this.instrData = id(this.instr);
        return this.options.enterInstr();
    }
    exitInstr(ctx: any) {
        assert(this === ctx);
        this.out.push('exitInstr ' + dumpObject(ctx));
        return this.options.exitInstr();
    }
}

function test(params: OptionsParams) {
    let parser = new WasmParser();
    let path = new Path('../../__old/libbzip2-dec.wasm');
    let main = parser.parse(path, 0);
    let out: string[] = [];

    walkRecursive(out, new Options(params), main);
    let out1 = out.join('\n');

    let w = new TestWalker(new Options(params), main);
    w.test();
    let out2 = w.out.join('\n');

    console.log(out1 === out2);
    if (out1 !== out2) {
        fs.writeFileSync('out1.txt', out1);
        fs.writeFileSync('out2.txt', out2);
    }
    assert(out1 === out2);
}

test({});
test({
    enterInstrSkipSiblingEvery: 40,
    enterInstrSkipChildrenEvery: 3,
});
test({
    exitInstrSkipSiblingEvery: 40,
});
test({
    enterBlockSkipChildrenEvery: 4,
});
test({
    enterFunctionSkipChildrenEvery: 4,
});
test({
    enterFunctionSkipSiblingEvery: 4,
});
test({
    exitFunctionSkipSiblingEvery: 6,
});
