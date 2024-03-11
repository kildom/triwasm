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

import { Block, BlockEnd, PlaceInstruction, InstrBase, ExprEval, ExprContext } from './instructions';
import { ObjMarker } from '../common/common';
import { InstrMaker } from './instrMaker';
import { ExprMaker } from './exprMaker';
import { CompilerError } from './errors';
import { BytecodeGenerator } from './generator';
import { EnabledExtensions } from './instrInfo';

const MAX_RERUNS = 50;
const MAX_INSTR_SIZE = 32;


export class Compiler {

    public generator: BytecodeGenerator = new BytecodeGenerator();
    public preparation = true;
    public instructions: InstrBase[] = [];
    public rootBlock!: Block;
    public pmaBase: number = 0;
    public extensions: EnabledExtensions = {};

    compile(input: string) {
        // Parse input and make internal data structures from the input
        this.preparation = true;
        let instrMaker: InstrMaker;
        let exprMaker = new ExprMaker((name: string) => instrMaker.getIdentifier(name));
        instrMaker = new InstrMaker(this, this.generator, exprMaker);
        instrMaker.parse(input);
        this.instructions = instrMaker.getInstructions();
        this.rootBlock = instrMaker.getRootBlock();
        this.extensions = instrMaker.getExtensions();
        // Prepare blocks
        this.moveBlocks();
        this.resolveBlockDependencies();
        // Prepare initial instruction addresses
        this.initialAddresses();
        // Generate and return actual bytecode
        this.preparation = false;
        this.generateCode();
        return this.generator.result();
    }

    moveBlocks() {
        // Place movable blocks into buckets
        let stackTop: InstrBase[] = [];
        // TODO: Map should replace Object-based maps with keys from user input (as it was done here).
        let buckets: Map<string, InstrBase[] | null> = new Map();
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
        let pma = 0;
        let ctx = new ExprContext();
        for (let index = 0; index < this.instructions.length; index++) {
            let instr = this.instructions[index];
            if ((instr instanceof Block) && instr.discarded) {
                index = instr.end!.index;
                continue;
            }
            instr.pma.current = pma;
            let size = instr.getSize(ctx);
            pma += size;
            instr.pma.end = pma;
        }
        this.generator.reset();
        this.generator.reserve(2 * pma);
    }

    generateCode() {
        let rerun = true;
        let rerunCounter = 0;
        do {
            rerunCounter++;
            if (rerunCounter > MAX_RERUNS) {
                throw new CompilerError(0, 'Maximum number of generating reruns reached!');
            }
            for (let instr of this.instructions) {
                instr.pma.old = instr.pma.current as number;
                instr.pma.current = undefined;
                instr.pma.estimated = undefined;
            }
            this.generator.reset();
            rerun = false;
            for (let index = 0; index < this.instructions.length; index++) {
                let instr = this.instructions[index];
                if ((instr instanceof Block) && instr.discarded) {
                    index = instr.end.index;
                    continue;
                }
                if (instr.pma.estimated !== undefined && instr.pma.estimated != this.generator.pma) {
                    rerun = true;
                }
                instr.pma.current = this.generator.pma;
                this.generator.reserve(MAX_INSTR_SIZE);
                instr.generate(Math.max(0, instr.pma.end - instr.pma.current));
                instr.pma.end = this.generator.pma;
            }
        } while (rerun);
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
                    throw new CompilerError(instr.lineNumber, 'Division by zero!');
                }
            }
        } else {
            value = expr(ctx);
            if (value == 0n) {
                this.generator.error(new CompilerError(instr.lineNumber, 'Division by zero!'));
                return 1n;
            }
        }
        return value;
    }

}
