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

import { Compiler, EnabledExtensions, KNOWN_EXTENSIONS } from "./compiler";
import { CompilerError } from "./errors";
import { ExprMaker } from "./exprMaker";
import { BytecodeGenerator } from "./generator";
import { BASE, INSTR, instrInfoById } from "./instrInfo";
import { instrParse } from "./instrParser";
import {
    AddrInstruction,
    AlignInstruction,
    Assign, BaseInstruction, Block, BlockEnd, BranchInstruction, DataInstruction, InstrBase,
    InstrParams,
    PlaceInstruction, ReadSpInstruction, ReadWriteInstruction, RefInstruction,
    SimpleCoreInstruction,
    UnwindInstruction
} from "./instructions";


interface AssignProxy {
    assignment: Assign | null;
    lineNumber: number;
};

export class InstrMaker {

    private static parserInstrClasses: { [k: string]: any } = {
        'sc': SimpleCoreInstruction,
        'rw': ReadWriteInstruction,
        'data': DataInstruction,
        'br': BranchInstruction,
        'READSP': ReadSpInstruction,
        '.REF': RefInstruction,
        '.PLACE': PlaceInstruction,
        '.BASE': BaseInstruction,
        '.ALIGN': AlignInstruction,
        '.VMA': AddrInstruction,
        '.PMA': AddrInstruction,
    };

    private instructions: InstrBase[] = [];
    private blocks: Block[] = [];
    private rootBlock: Block;
    private assignProxies: { [k: string]: AssignProxy } = {};
    private extensions: EnabledExtensions = {};
    private currentBlock: Block;
    private params: InstrParams;

    constructor(public compiler: Compiler, private generator: BytecodeGenerator, private exprMaker: ExprMaker) {
        this.params = new InstrParams(compiler, generator, 0, 1, instrInfoById[INSTR._BEGIN], exprMaker);
        this.rootBlock = new Block(this.params, '', null);
        this.currentBlock = this.rootBlock;
        this.blocks.push(this.rootBlock);
        this.instructions.push(this.rootBlock);
    }

    public getInstructions(): InstrBase[] {
        return this.instructions;
    }

    public getBlocks(): Block[] {
        return this.blocks;
    }

    public getRootBlock(): Block {
        return this.rootBlock;
    }

    public getExtensions(): EnabledExtensions {
        return this.extensions;
    }

    public parse(input: string) {

        // Parse each instruction consuming the results
        instrParse(input, this);

        // Check if all blocks were finished
        if (this.currentBlock !== this.rootBlock) {
            throw new CompilerError(this.currentBlock.lineNumber, `Unfinished block!`);
        }

        // Finish root block
        this.params.lineNumber++;
        this.params.index = this.instructions.length;
        this.params.info = instrInfoById[INSTR._END];
        this.rootBlock.end = new BlockEnd(this.params, this.rootBlock);
        this.instructions.push(this.rootBlock.end);

        // Check if all referenced variables were assigned
        for (let [name, proxy] of Object.entries(this.assignProxies)) {
            if (proxy.assignment === null) {
                throw new CompilerError(proxy.lineNumber, `Undefined variable "${name}"!`);
            }
        }
    }

    getVariableRealName(name: string): string {
        // Go down on block stack to find local with this name
        let block: Block | null = this.currentBlock;
        while (block !== null) {
            if (name in block.locals) {
                return block.locals[name];
            }
            block = block.parent;
        }
        // Return unchanged name if it is not local
        return name;
    }

    onParserLine(lineNumber: number): void {
        this.params.lineNumber = lineNumber;
    }

    onParserInstr(id: number, args: string, base: BASE): void {
        let info = instrInfoById[id];
        for (let ext of info.condition) {
            if (!(this.extensions as any)[ext]) {
                throw new CompilerError(this.params.lineNumber, `Instruction belongs to disabled extension "${ext}".`);
            }
        }
        this.params.index = this.instructions.length;
        this.params.info = info;
        let instr: InstrBase | null = null;
        switch (id) {
            case INSTR._EXT:
                for (let extName of args.toLowerCase().split(/\s*,\s*/)) {
                    if (KNOWN_EXTENSIONS.indexOf(extName) < 0) {
                        throw new CompilerError(this.params.lineNumber, `Unknown extension "${extName}".`);
                    }
                    (this.extensions as any)[extName] = true;
                }
                break;

            case INSTR._BEGIN:
                this.currentBlock = new Block(this.params, args, this.currentBlock);
                instr = this.currentBlock;
                this.blocks.push(this.currentBlock);
                break;

            case INSTR._END:
                if (this.currentBlock === this.rootBlock) {
                    throw new CompilerError(this.params.lineNumber, `".END" directive without matching ".BEGIN".`);
                }
                this.currentBlock.end = new BlockEnd(this.params, this.currentBlock);
                instr = this.currentBlock.end;
                this.currentBlock = this.currentBlock.parent as Block;
                break;

            case INSTR._LOCAL:
                if ((args as string) in this.currentBlock.locals) {
                    throw new CompilerError(this.params.lineNumber, `".LOCAL" variable already defined.`);
                }
                let name = `~LOCAL~${this.params.index}~${this.currentBlock.index}~${args}`;
                this.currentBlock.locals[args] = name;
                break;

            case INSTR.UNWIND:
                if (args == '') {
                    instr = new SimpleCoreInstruction(this.params, args);
                } else {
                    instr = new UnwindInstruction(this.params, args);
                }
                break;

            default:
                let Class = InstrMaker.parserInstrClasses[info.instrClass];
                if (!Class) {
                    Class = InstrMaker.parserInstrClasses[info.name];
                }
                instr = new Class(this.params, args, base);
                break;
        }
        if (instr !== null) {
            this.instructions.push(instr);
        }
    }

    onParserLabel(name: string): void {
        this.onParserAssign(name, 'vma()');
    }

    onParserAssign(name: string, value: string): void {
        let realName = this.getVariableRealName(name);
        this.params.index = this.instructions.length;
        this.params.info = instrInfoById[INSTR._ASSIGN];
        let instr = new Assign(this.params, value, this.currentBlock);
        this.instructions.push(instr);
        if (realName in this.assignProxies) {
            let proxy = this.assignProxies[realName];
            if (proxy.assignment === null) {
                proxy.assignment = instr;
            } else {
                this.assignProxies[realName] = { assignment: instr, lineNumber: this.params.lineNumber };
            }
        } else {
            this.assignProxies[realName] = { assignment: instr, lineNumber: this.params.lineNumber };
        }
    }

    getIdentifier(name: string): AssignProxy {
        let realName = this.getVariableRealName(name);
        if (!(realName in this.assignProxies)) {
            let proxy: AssignProxy = {
                assignment: null,
                lineNumber: this.params.lineNumber,
            };
            this.assignProxies[realName] = proxy;
        }
        return this.assignProxies[realName];
    }

}
