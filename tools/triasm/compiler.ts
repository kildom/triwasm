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

import { instrInfoById, INSTR, BASE } from './instrInfo';
import { parse, ParserError } from './parser';
import { AsmFunctions } from './functions';
import {
    Block, BlockEnd, EmptyInstr, Assign, SimpleCoreInstruction, DataInstruction,
    AlignInstruction, AddrInstruction, RefInstruction, ReadSpInstruction,
    BranchInstruction, UnwindInstruction, ReadWriteInstruction, PlaceInstruction, InstrBase, ExprEval, ExprContext, BaseInstruction
} from './instructions'
import { ObjMarker } from '../utils/common';

const MAX_RERUNS = 50;

interface AssignProxy {
    assignment: Assign | null;
    lineNumber: number;
}

const KNOWN_EXTENSIONS = [
    'UNWIND',
    'MEM64',
    'I64',
    'F32',
    'F64',
];

// TODO: This class should be renamed and moved to a different file
class ParserOutput {

    static parserInstrClasses: { [k: string]: any } = {
        sc: SimpleCoreInstruction,
        rw: ReadWriteInstruction,
        data: DataInstruction,
        READSP: ReadSpInstruction,
        '.REF': RefInstruction,
        '.PLACE': PlaceInstruction,
        '.BASE': BaseInstruction,
    };

    private lineNumber = 1;
    public instructions: InstrBase[] = [];
    public blocks: Block[] = [];
    public rootBlock: Block;
    private assignProxies: { [k: string]: AssignProxy } = {};
    public extensions: { [k: string]: boolean } = {};
    private currentBlock: Block;

    constructor(private compiler: Compiler) {
        this.rootBlock = new Block(this.compiler, 0, 0, '', null);
        this.currentBlock = this.rootBlock;
    }

    public parse(input: string) {
        this.rootBlock = new Block(this.compiler, 0, 0, '', null);
        this.blocks.push(this.rootBlock);
        this.currentBlock = this.rootBlock;
        this.instructions.push(this.rootBlock);

        parse(input, this);

        if (this.currentBlock !== this.rootBlock) {
            throw new ParserError(`${this.currentBlock.lineNumber}: Unfinished block!`);
        }

        this.rootBlock.end = new BlockEnd(this.compiler, this.lineNumber, this.instructions.length, this.rootBlock);
        this.instructions.push(this.rootBlock.end);

        for (let [name, proxy] of Object.entries(this.assignProxies)) {
            if (proxy.assignment === null) {
                throw new ParserError(`${proxy.lineNumber}: Undefined variable "${name}"!`);
            }
        }
    }

    getRealName(name: string): string {
        let block: Block | null = this.currentBlock;
        while (block !== null) {
            if (name in block.locals) {
                return block.locals[name];
            }
            block = block.parent;
        }
        return name;
    }

    onParserLine(lineNumber: number): void {
        this.lineNumber = lineNumber;
    }

    onParserInstr(id: number, args: ExprEval[] | string, base: BASE): void {
        let info = instrInfoById[id];
        for (let ext of info.condition) {
            if (!this.extensions[ext]) {
                throw new ParserError(`${this.lineNumber}: Instruction belongs to disabled extension "${ext}".`);
            }
        }
        let instr: InstrBase;
        let index = this.instructions.length;
        switch (id) {
            case INSTR._EXT:
                for (let extName of (args as string).toUpperCase().split(/\s*,\s*/)) {
                    if (KNOWN_EXTENSIONS.indexOf(extName) < 0) {
                        throw new ParserError(`${this.lineNumber}: Unknown extension "${extName}".`);
                    }
                    this.extensions[extName] = true;
                }
                instr = new EmptyInstr(this.compiler, this.lineNumber, index);
                break;

            case INSTR._BEGIN:
                instr = new Block(this.compiler, this.lineNumber, index, args as string, this.currentBlock);
                this.blocks.push(instr as Block);
                this.currentBlock = instr as Block;
                break;

            case INSTR._END:
                if (this.currentBlock === this.rootBlock) {
                    throw new ParserError(`${this.lineNumber}: ".END" directive without matching ".BEGIN".`);
                }
                instr = new BlockEnd(this.compiler, this.lineNumber, index, this.currentBlock);
                this.currentBlock.end = instr;
                this.currentBlock = this.currentBlock.parent as Block;
                break;

            case INSTR._LOCAL:
                if ((args as string) in this.currentBlock.locals) {
                    throw new ParserError(`${this.lineNumber}: ".LOCAL" variable already defined.`);
                }
                let name = `~LOCAL~${index}~${this.currentBlock.index}~${args}`;
                this.currentBlock.locals[args as string] = name;
                instr = new EmptyInstr(this.compiler, this.lineNumber, index);
                break;

            case INSTR._ALIGN:
                instr = new AlignInstruction(this.compiler, this.lineNumber, index, info, args[0] as ExprEval, this.onParserCallExpr('vma', []));
                break;

            case INSTR._ADDR:
                instr = new AddrInstruction(this.compiler, this.lineNumber, index, info, args[0] as ExprEval, this.onParserCallExpr('vma', []));
                break;

            case INSTR.BRT:
            case INSTR.BRF:
            case INSTR.CALL:
            case INSTR.BR:
                if (args.length == 0) {
                    instr = new SimpleCoreInstruction(this.compiler, this.lineNumber, index, info, args as ExprEval[], BASE.ZERO);
                } else {
                    instr = new BranchInstruction(this.compiler, this.lineNumber, index, info, args[0] as ExprEval, this.onParserCallExpr('vma', []));
                }
                break;

            case INSTR.UNWIND:
                if (args.length == 0) {
                    instr = new SimpleCoreInstruction(this.compiler, this.lineNumber, index, info, args as ExprEval[], BASE.ZERO);
                } else {
                    instr = new UnwindInstruction(this.compiler, this.lineNumber, index, info, args as ExprEval[]);
                }
                break;

            default:
                // TODO: Instruction constructor should parse arguments using method from this class, e.g.
                // let args = compiler.outputObject.parseExpr(this, args);
                // OR: let args = compiler.parseExpr(this, args);
                // The method will set "this" as current instruction and all new ExprEval functions will
                // have instruction in its closure.
                let Class = ParserOutput.parserInstrClasses[info.instrClass];
                if (!Class) {
                    Class = ParserOutput.parserInstrClasses[info.name];
                }
                instr = new Class(this.compiler, this.lineNumber, index, info, args, base);
                break;
        }
        this.instructions.push(instr);
    }

    onParserLabel(name: string): void {
        this.onParserAssign(name, this.onParserCallExpr('vma', []));
    }

    onParserAssign(name: string, value: any): void {
        let realName = this.getRealName(name);
        let instr = new Assign(this.compiler, this.lineNumber, this.instructions.length, value, this.currentBlock);
        this.instructions.push(instr);
        if (realName in this.assignProxies) {
            let proxy = this.assignProxies[realName];
            if (proxy.assignment === null) {
                proxy.assignment = instr;
            } else {
                this.assignProxies[realName] = { assignment: instr, lineNumber: this.lineNumber }
            }
        } else {
            this.assignProxies[realName] = { assignment: instr, lineNumber: this.lineNumber }
        }
    }

    onParserIdExpr(id: string): ExprEval {
        let realName = this.getRealName(id);
        if (!(realName in this.assignProxies)) {
            let proxy: AssignProxy = {
                assignment: null,
                lineNumber: this.lineNumber,
            };
            this.assignProxies[realName] = proxy;
        }
        if (this.assignProxies[realName].assignment !== null) {
            let assignment = this.assignProxies[realName].assignment;
            return ctx => assignment!.getValue(ctx);
        } else {
            let proxy = this.assignProxies[realName];
            return ctx => proxy.assignment!.getValue(ctx);
        }
    }

    onParserCallExpr(name: string, args: ExprEval[]): ExprEval {
        return AsmFunctions.createExpr(name, args, this.lineNumber);
    }

    onParserNumberExpr(valueStr: string): ExprEval {
        let valueBig = BigInt(valueStr);
        let value64 = valueBig & 0xFFFFFFFFFFFFFFFFn;
        if (value64 != valueBig) {
            throw new ParserError(`${this.lineNumber}: Integer literal out of range!`);
        }
        return () => value64;
    }

    onParserTernaryExpr(a: ExprEval, b: ExprEval, c: ExprEval): ExprEval {
        return AsmFunctions.createExpr('if', [a, b, c], this.lineNumber);
    }

    onParserOrExpr(a: ExprEval, b: ExprEval): ExprEval {
        return this.onParserCallExpr('if', [a, a, b]);
    }
    onParserAndExpr(a: ExprEval, b: ExprEval): ExprEval {
        return this.onParserCallExpr('if', [this.onParserNotExpr(a), a, b]);
    }
    onParserBitOrExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) | b(ctx);
    }
    onParserBitXorExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) ^ b(ctx);
    }
    onParserBitAndExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) & b(ctx);
    }
    onParserEqExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) == b(ctx) ? 1n : 0n;
    }
    onParserNeExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) != b(ctx) ? 1n : 0n;
    }
    onParserLtExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) < b(ctx) ? 1n : 0n;
    }
    onParserGtExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) > b(ctx) ? 1n : 0n;
    }
    onParserLeExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) <= b(ctx) ? 1n : 0n;
    }
    onParserGeExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) >= b(ctx) ? 1n : 0n;
    }
    onParserShlExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => (a(ctx) << b(ctx)) & 0xFFFFFFFFFFFFFFFFn;
    }
    onParserShrExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) >> b(ctx);
    }
    onParserAddExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => (a(ctx) + b(ctx)) & 0xFFFFFFFFFFFFFFFFn;
    }
    onParserSubExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => (a(ctx) - b(ctx)) & 0xFFFFFFFFFFFFFFFFn;
    }
    onParserMulExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => (a(ctx) * b(ctx)) & 0xFFFFFFFFFFFFFFFFn;
    }
    onParserDivExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) / ctx.instr.compiler.checkDiv0(ctx, b);
    }
    onParserModExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) % ctx.instr.compiler.checkDiv0(ctx, b);
    }
    onParserMinusExpr(a: ExprEval): ExprEval {
        return ctx => -a(ctx) & 0xFFFFFFFFFFFFFFFFn;
    }
    onParserNotExpr(a: ExprEval): ExprEval {
        return ctx => (a(ctx) == 0n) ? 1n : 0n;
    }
    onParserBitNotExpr(a: ExprEval): ExprEval {
        return ctx => a(ctx) ^ 0xFFFFFFFFFFFFFFFFn;
    }

}


export class Compiler {

    public initialState = true;
    public instructions: InstrBase[] = [];
    public rootBlock: Block | null = null;
    public pma: number = 0;
    public pmaBase: number = 0;
    public output: Uint8Array = new Uint8Array(65536);
    public postPostponedError: Error | null = null;
    public extensions: { [k: string]: boolean } = {};

    constructor() {
    }

    compile(input: string) {
        this.initialState = true;
        let po = new ParserOutput(this);
        po.parse(input);
        this.instructions = po.instructions;
        this.rootBlock = po.rootBlock;
        this.extensions = po.extensions;
        this.moveBlocks();
        this.resolveBlockDependencies();
        /*this.initialAddresses();
        this.initialState = false;
        this.generateCode();
        return this.output.subarray(0, this.addr);*/
    }

    moveBlocks() {
        // Place movable blocks into buckets
        let stackTop: InstrBase[] = [];
        let buckets: Map<string, InstrBase[] | null> = new Map(); // TODO: Map should replace Object-based maps with keys from user input (as it was done here).
        let stack: InstrBase[][] = [];
        for (let instr of this.instructions) {
            if ((instr instanceof Block) && instr.moveTo !== null) {
                let name = instr.moveTo;
                stack.push(stackTop);
                if (!buckets.has(name)) {
                    stackTop = [];
                    buckets.set(name, stackTop);
                } else {
                    stackTop = buckets.get(name) as InstrBase[];
                }
            }
            stackTop.push(instr);
            if ((instr instanceof BlockEnd) && instr.block.moveTo !== null) {
                stackTop = stack.pop() as InstrBase[];
            }
        }

        // Walk over each instruction and move instructions after ".place" from associated bucket.
        // Also, update indexes and block parents.
        this.instructions = stackTop;
        let currentBlock = this.rootBlock;
        for (let index = 0; index < this.instructions.length; index++) {
            let instr = this.instructions[index];
            instr.index = index;
            if (instr instanceof Block) {
                instr.parent = currentBlock;
                currentBlock = instr;
            } else if (instr instanceof BlockEnd) {
                currentBlock = instr.block.parent;
            } else if (instr instanceof PlaceInstruction) {
                let bucket = buckets.get(instr.name);
                buckets.set(instr.name, null);
                if (bucket === null) {
                    throw new ParserError(`${instr.lineNumber}: Movable blocks "${instr.name}" already placed!`);
                } else if (bucket) {
                    this.instructions.splice(index + 1, 0, ...bucket);
                }
            }
        }

        // Check if all buckets were placed
        for (let [key, bucket] of buckets) {
            if (bucket !== null && bucket.length > 0) {
                throw new ParserError(`${bucket[0].lineNumber}: Movable block "${key}" is not placed anywhere.`);
            }
        }
    }

    resolveBlockDependencies() {
        let used = new ObjMarker('_func_resolveBlockDependencies_used');
        // Collect dependencies of each block
        let currentBlock: Block = this.rootBlock as Block;
        for (let instr of this.instructions) {
            if (instr instanceof Block) {
                currentBlock = instr;
            }
            instr.collectDeps(currentBlock.deps);
            if (instr instanceof BlockEnd) {
                currentBlock = currentBlock.parent as Block;
            }
        }
        // Starting from root, mark all dependencies as used
        let stack = [this.rootBlock];
        while (stack.length > 0) {
            let block = stack.pop() as Block;
            if (used.is(block)) {
                continue;
            }
            used.set(block);
            block.discarded = false;
            for (let dep of block.deps) {
                let parent: Block | null = dep;
                while (parent !== null && !used.is(parent)) {
                    stack.push(parent);
                    parent = parent.parent;
                }
            }
        }
    }

    initialAddresses() {
        this.pma = 0;
        for (let index = 0; index < this.instructions.length; index++) {
            let instr = this.instructions[index];
            if ((instr instanceof Block) && instr.discarded) {
                index = instr.end!.index;
                continue;
            }
            instr.pma = this.pma;
            let size = instr.getSize({ instr });
            this.pma += size;
            instr.pmaEnd = this.pma;
        }
    }

    generateCode() {
        this.reserveOutput(8 * this.instructions.length);
        let rerun = true;
        let rerunCounter = 0;
        do {
            rerunCounter++;
            if (rerunCounter > MAX_RERUNS) {
                throw new ParserError('0: Maximum number of generating reruns reached!');
            }
            for (let instr of this.instructions) {
                instr.pmaOld = instr.pma as number;
                instr.pma = undefined;
                instr.pmaEstimated = undefined;
            }
            this.postPostponedError = null;
            this.pma = 0;
            rerun = false;
            for (let index = 0; index < this.instructions.length; index++) {
                let instr = this.instructions[index];
                if ((instr instanceof Block) && instr.discarded) {
                    index = instr.end!.index;
                    continue;
                }
                if (instr.pmaEstimated !== undefined && instr.pmaEstimated != this.pma) {
                    rerun = true;
                }
                instr.pma = this.pma;
                this.reserveOutput(10);
                instr.generate(Math.max(0, instr.pmaEnd - instr.pma));
                instr.pmaEnd = this.pma;
            }
        } while (rerun);
        if (this.postPostponedError !== null) {
            throw this.postPostponedError;
        }
    }

    reserveOutput(bytes: number) {
        if (this.pma + bytes > this.output.length) {
            let newSize = (this.pma + bytes) * 2;
            let newOutput = new Uint8Array(newSize);
            newOutput.set(this.output);
            this.output = newOutput;
        }
    }

    checkDiv0(ctx: ExprContext, expr: ExprEval) {
        let value: bigint;
        if (this.initialState) {
            let oldInvalid = ctx.invalid;
            ctx.invalid = false;
            value = expr(ctx);
            let invalid = ctx.invalid;
            ctx.invalid = invalid || oldInvalid;
            if (value == 0n) {
                if (invalid) {
                    return 1n;
                } else {
                    throw new ParserError(`${ctx.instr.lineNumber}: Division by zero!`);
                }
            }
        } else {
            value = expr(ctx);
            if (value == 0n) {
                this.postPostponedError = new ParserError(`${ctx.instr.lineNumber}: Division by zero!`);
                return 1n;
            }
        }
        return value;
    }

    generate8(data: number) {
        this.output[this.pma++] = data & 0xFF;
    }

    generate16(data: number) {
        this.output[this.pma++] = data & 0xFF;
        this.output[this.pma++] = (data >> 8) & 0xFF;
    }

    generate32(data: number) {
        this.output[this.pma++] = data & 0xFF;
        this.output[this.pma++] = (data >> 8) & 0xFF;
        this.output[this.pma++] = (data >> 16) & 0xFF;
        this.output[this.pma++] = (data >> 24) & 0xFF;
    }

    generate64(data: bigint) {
        this.output[this.pma++] = Number(data & 0xFFn);
        this.output[this.pma++] = Number((data >> 8n) & 0xFFn);
        this.output[this.pma++] = Number((data >> 16n) & 0xFFn);
        this.output[this.pma++] = Number((data >> 24n) & 0xFFn);
        this.output[this.pma++] = Number((data >> 32n) & 0xFFn);
        this.output[this.pma++] = Number((data >> 40n) & 0xFFn);
        this.output[this.pma++] = Number((data >> 48n) & 0xFFn);
        this.output[this.pma++] = Number((data >> 64n) & 0xFFn);
    }

};
