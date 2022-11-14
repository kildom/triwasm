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

import { Block, BlockEnd, PlaceInstruction, InstrBase, ExprEval, ExprContext } from './instructions';
import { allowTemporaryNull, ObjMarker } from '../utils/common';
import { InstrMaker } from './instrMaker';
import { ExprMaker } from './exprMaker';
import { CompilerError } from './errors';

const MAX_RERUNS = 50;

export interface EnabledExtensions {
    unwind?: boolean;
    mem64?: boolean;
    i64?: boolean;
    f32?: boolean;
    f64?: boolean;
};

export const KNOWN_EXTENSIONS = [
    'unwind',
    'mem64',
    'i64',
    'f32',
    'f64',
];


export class Compiler {

    public preparation = true;
    public instructions: InstrBase[] = [];
    public rootBlock: Block;
    public pma: number = 0;
    public pmaBase: number = 0;
    public output: Uint8Array = new Uint8Array(65536);
    public extensions: EnabledExtensions = {};

    constructor() {
        this.rootBlock = allowTemporaryNull as Block;
    }

    compile(input: string) {
        this.preparation = true;
        let instrMaker: InstrMaker;
        let exprMaker = new ExprMaker((...args) => instrMaker.getIdentifier(...args));
        instrMaker = new InstrMaker(this, exprMaker);
        instrMaker.parse(input);
        this.instructions = instrMaker.getInstructions();
        this.rootBlock = instrMaker.getRootBlock();
        this.extensions = instrMaker.getExtensions();
        this.moveBlocks();
        this.resolveBlockDependencies();
        this.initialAddresses();
        /*this.preparation = false;
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
                currentBlock = instr.block.parent as Block;
            } else if (instr instanceof PlaceInstruction) {
                let bucket = buckets.get(instr.name);
                buckets.set(instr.name, null);
                if (bucket === null) {
                    throw new CompilerError(instr.lineNumber, `Movable blocks "${instr.name}" already placed!`);
                } else if (bucket) {
                    this.instructions.splice(index + 1, 0, ...bucket);
                }
            }
        }

        // Check if all buckets were placed
        for (let [key, bucket] of buckets) {
            if (bucket !== null && bucket.length > 0) {
                throw new CompilerError(bucket[0].lineNumber, `Movable block "${key}" is not placed anywhere.`);
            }
        }
    }

    resolveBlockDependencies() {
        let used = new ObjMarker('_func_resolveBlockDependencies_used');
        // Collect dependencies of each block
        let currentBlock: Block = this.rootBlock as Block;
        let ctx = new ExprContext();
        for (let instr of this.instructions) {
            if (instr instanceof Block) {
                currentBlock = instr;
            }
            ctx.deps = currentBlock.deps;
            instr.collectDeps(ctx);
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
        let ctx = new ExprContext();
        for (let index = 0; index < this.instructions.length; index++) {
            let instr = this.instructions[index];
            if ((instr instanceof Block) && instr.discarded) {
                index = instr.end!.index;
                continue;
            }
            instr.pma = this.pma;
            let size = instr.getSize(ctx);
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
                throw new CompilerError(0, 'Maximum number of generating reruns reached!');
            }
            for (let instr of this.instructions) {
                instr.pmaOld = instr.pma as number;
                instr.pma = undefined;
                instr.pmaEstimated = undefined;
            }
            //this.postPostponedError = null;
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
        //if (this.postPostponedError !== null) {
        //    throw this.postPostponedError;
        //}
    }

    reserveOutput(bytes: number) {
        if (this.pma + bytes > this.output.length) {
            let newSize = (this.pma + bytes) * 2;
            let newOutput = new Uint8Array(newSize);
            newOutput.set(this.output);
            this.output = newOutput;
        }
    }

    checkDiv0(instr: InstrBase, ctx: ExprContext, expr: ExprEval) {
        let value: bigint;
        if (this.preparation) {
            let ctx2 = ctx.shallowClone({ mutable: false });
            value = expr(ctx2);
            ctx2.shallowMergeToParent();
            if (value == 0n) {
                if (ctx2.mutable) {
                    return 1n;
                } else {
                    throw new CompilerError(instr.lineNumber, `Division by zero!`);
                }
            }
        } else {
            value = expr(ctx);
            if (value == 0n) {
                //TODO: this.generator.postponedError(new CompilerError(instr.lineNumber, `Division by zero!`));
                return 1n;
            }
        }
        return value;
    }

    /*
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
    }*/

};
