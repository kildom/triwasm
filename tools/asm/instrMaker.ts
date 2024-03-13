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

import { dict } from '../common/common';
import { Compiler } from './compiler';
import { CompilerError } from './errors';
import { ExprMaker } from './exprMaker';
import { BASE, EnabledExtensions, INSTR, KNOWN_EXTENSIONS, instrInfoById } from './instrInfo';
import { InstrParserConsumer, instrParse } from './instrParser';
import {
    AddrInstruction,
    AlignInstruction,
    AssertInstruction,
    Assign, BaseInstruction, Block, BlockEnd, BranchInstruction, DataInstruction, FillInstruction, InstrBase,
    InstrParams,
    MTableInstruction,
    PlaceInstruction, MemInstruction, RefInstruction,
    SimpleCoreInstruction,
    SimpleExt32Instruction,
    SimpleExt64Instruction,
    UnwindInstruction,
    StackInstruction
} from './instructions';


interface AssignProxy {
    assignment: Assign | null;
    lineNumber: number;
}

export class InstrMaker implements InstrParserConsumer {

    private static parserInstrClasses: { [k: string]: any; } = {
        SimpleCoreInstruction: SimpleCoreInstruction,
        BranchInstruction: BranchInstruction,
        SimpleExt32Instruction: SimpleExt32Instruction,
        SimpleExt64Instruction: SimpleExt64Instruction,
        DataInstruction: DataInstruction,
        FillInstruction: FillInstruction,
        AddrInstruction: AddrInstruction,
        AlignInstruction: AlignInstruction,
        RefInstruction: RefInstruction,
        PlaceInstruction: PlaceInstruction,
        BaseInstruction: BaseInstruction,
        MTableInstruction: MTableInstruction,
        AssertInstruction: AssertInstruction,
        MemInstruction: MemInstruction,
        StackInstruction: StackInstruction,
    };

    private instructions: InstrBase[] = [];
    private rootBlock: Block;
    private assignProxies = dict<AssignProxy>();
    private extensions: EnabledExtensions = {};
    private currentBlock: Block;
    private params: InstrParams;

    constructor(public compiler: Compiler, private exprMaker: ExprMaker) {
        this.params = new InstrParams(compiler, 0, 0, instrInfoById[INSTR._BEGIN], exprMaker);
        this.rootBlock = new Block(this.params, '', null);
        this.currentBlock = this.rootBlock;
        this.instructions.push(this.rootBlock);
    }

    public getInstructions(): InstrBase[] {
        return this.instructions;
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
            throw new CompilerError(this.currentBlock.lineNumber, 'Unfinished block!');
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

    onParserInstr(lineNumber: number, id: number, args: string, base: BASE): void {
        let info = instrInfoById[id];
        this.params.lineNumber = lineNumber;
        this.params.index = this.instructions.length;
        this.params.info = info;
        if (!info.condition(this.extensions)) {
            throw new CompilerError(this.params.lineNumber, `Instruction ${info.name} belongs to disabled extension.`);
        }
        let instr: InstrBase | undefined = undefined;

        switch (id) {
        // ---- Instructions required special handling - begin - generated with help of script ----

        case INSTR.UNWIND:
        case INSTR.UNWINDRET:
            if (args == '') {
                instr = new SimpleCoreInstruction(this.params, args);
            } else {
                instr = new UnwindInstruction(this.params, args);
            }
            break;

        case INSTR._LOCAL:
            for (let local of args.split(/\s*,\s*/)) {
                if (local in this.currentBlock.locals) {
                    throw new CompilerError(this.params.lineNumber, '".LOCAL" variable already defined.');
                }
                let name = `~LOCAL~${this.params.index}~${this.currentBlock.index}~${local}`;
                this.currentBlock.locals[local] = name;
            }
            break;

        case INSTR._PRAGMA:
            // TODOv1: Pragma instruction
            break;

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
            break;

        case INSTR._END:
        case INSTR._ELSE:
        case INSTR._ENDIF:
            this.params.info = instrInfoById[INSTR._END];
            if (this.currentBlock === this.rootBlock) {
                throw new CompilerError(this.params.lineNumber, `"${this.params.info.name}" directive without beginning.`);
            }
            this.currentBlock.end = new BlockEnd(this.params, this.currentBlock);
            instr = this.currentBlock.end;
            this.currentBlock = this.currentBlock.parent as Block;
            if (id === INSTR._ELSE || id === INSTR._ENDIF) {
                let uid = (instr as BlockEnd).block.index - 1;
                this.instructions.push(instr);
                instr = undefined;
                if (id === INSTR._ELSE) {
                    // .BEGIN discardable
                    this.params.info = instrInfoById[INSTR._BEGIN];
                    this.params.index = this.instructions.length;
                    this.currentBlock = new Block(this.params, 'discardable', this.currentBlock);
                    this.instructions.push(this.currentBlock);
                }
                // BlockElse:
                this.onParserLabel(lineNumber, `__9s6SshMfvUS6_BlockElse_${uid}`);
            }
            break;

        case INSTR._IF: {
            let uid = this.params.index;
            // .REF force_const(..) ? BlockThen : BlockElse
            this.params.info = instrInfoById[INSTR._REF];
            let ref = new RefInstruction(this.params,
                `force_const(${args}) ? __9s6SshMfvUS6_BlockThen_${uid} : __9s6SshMfvUS6_BlockElse_${uid}`);
            this.instructions.push(ref);
            // .BEGIN discardable
            this.params.info = instrInfoById[INSTR._BEGIN];
            this.params.index++;
            this.currentBlock = new Block(this.params, 'discardable', this.currentBlock);
            this.instructions.push(this.currentBlock);
            // BlockThen:
            this.onParserLabel(lineNumber, `__9s6SshMfvUS6_BlockThen_${uid}`);
            break;
        }

        // ---- Instructions required special handling - end - generated with help of script ----

        default: {
            let Class = InstrMaker.parserInstrClasses[info.instrClass];
            if (!Class) {
                throw new Error('Internal error.');
            }
            instr = new Class(this.params, args, base);
            break;
        }
        }

        if (instr) {
            this.instructions.push(instr);
        }
    }

    onParserLabel(lineNumber: number, name: string): void {
        this.onParserAssign(lineNumber, name, 'vma()');
    }

    onParserAssign(lineNumber: number, name: string, value: string): void {
        let realName = this.getVariableRealName(name);
        this.params.index = this.instructions.length;
        this.params.info = instrInfoById[INSTR._ASSIGN];
        this.params.lineNumber = lineNumber;
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
