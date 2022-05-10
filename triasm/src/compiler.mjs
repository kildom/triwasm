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

import { instrInfoById, INSTR, BASE } from './instrInfo.mjs';
import { parse, ParserError } from './parser.mjs';
import { AsmFunctions } from './functions.mjs';
import {
    Block, BlockEnd, EmptyInstr, Assign, SimpleCoreInstruction, DataInstruction,
    AlignInstruction, AddrInstruction, RefInstruction, ReadSpInstruction,
    BranchInstruction, UnwindInstruction
} from './instructions.mjs'

const MAX_RERUNS = 50;

class ParserOutput {

    static parserInstrClasses = {
        sc: SimpleCoreInstruction,
        data: DataInstruction,
        '.REF': RefInstruction,
        'READSP': ReadSpInstruction,
    };

    parse(input, compiler, conf) {
        this.compiler = compiler;
        this.conf = conf;
        this.lineNumber = 1;
        this.instructions = [];
        this.blocks = [];
        this.assignProxies = {};
        this.currentBlock = null;
        this.parserInstrConditions = {
            '-': true,
            unwind: conf.extUnwind,
            mem64: conf.extMem64,
            i64: conf.extI64,
            f32: conf.extF32,
            f64: conf.extF64,
            f32f64: conf.extF32 && conf.extF64,
        };

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

    getRealName(name) {
        let block = this.currentBlock;
        while (block !== null) {
            if (name in block.locals) {
                return block.locals[name];
            }
            block = block.block;
        }
        return name;
    }

    onParserLine(lineNumber) {
        this.lineNumber = lineNumber;
    }

    onParserInstr(id, args, base) {
        let info = instrInfoById[id];
        if (!this.parserInstrConditions[info.condition]) {
            throw new ParserError(`${this.lineNumber}: Instruction is from a disabled extension.`);
        }
        let instr;
        let index = this.instructions.length;
        switch (id) {
            case INSTR._BEGIN:
                instr = new Block(this.compiler, this.lineNumber, index, args, this.currentBlock);
                this.blocks.push(instr);
                this.currentBlock = instr;
                break;

            case INSTR._END:
                if (this.currentBlock === this.rootBlock) {
                    throw new ParserError(`${this.lineNumber}: ".END" directive without matching ".BEGIN".`);
                }
                instr = new BlockEnd(this.compiler, this.lineNumber, index, this.currentBlock);
                this.currentBlock.end = instr;
                this.currentBlock = this.currentBlock.block;
                break;

            case INSTR._LOCAL:
                if (args in this.currentBlock.locals) {
                    throw new ParserError(`${this.lineNumber}: ".LOCAL" variable already defined.`);
                }
                let name = `~LOCAL~${index}~${this.currentBlock.index}~${args}`;
                this.currentBlock.locals[args] = name;
                instr = new EmptyInstr(this.compiler, this.lineNumber, index);
                break;

            case INSTR._ALIGN:
                instr = new AlignInstruction(this.compiler, this.lineNumber, index, info, args[0], this.onParserCallExpr('addr', []));
                break;

            case INSTR._ADDR:
                instr = new AddrInstruction(this.compiler, this.lineNumber, index, info, args[0], this.onParserCallExpr('addr', []));
                break;

            case INSTR.BRT:
            case INSTR.BRF:
            case INSTR.CALL:
            case INSTR.BR:
                if (args.length == 0) {
                    instr = new SimpleCoreInstruction(this.compiler, this.lineNumber, index, info, args, BASE.ZERO);
                } else {
                    instr = new BranchInstruction(this.compiler, this.lineNumber, index, info, args[0], this.onParserCallExpr('addr', []));
                }
                break;

            case INSTR.UNWIND:
                if (args.length == 0) {
                    instr = new SimpleCoreInstruction(this.compiler, this.lineNumber, index, info, args, BASE.ZERO);
                } else {
                    instr = new UnwindInstruction(this.compiler, this.lineNumber, index, info, args);
                }
                break;


            default:
                let Class = ParserOutput.parserInstrClasses[info.instrClass];
                if (!Class) {
                    Class = ParserOutput.parserInstrClasses[info.name];
                }
                instr = new Class(this.compiler, this.lineNumber, index, info, args, base);
                break;
        }
        this.instructions.push(instr);
    }

    onParserLabel(name) {
        this.onParserAssign(name, this.onParserCallExpr('addr', []));
    }

    onParserAssign(name, value) {
        let realName = this.getRealName(name);
        let instr = new Assign(this.compiler, this.lineNumber, this.instructions.length, value, this.currentBlock);
        this.instructions.push(instr);
        if (realName in this.assignProxies) {
            let proxy = this.assignProxies[realName];
            if (proxy.assignment === null) {
                proxy.assignment = instr;
            } else {
                this.assignProxies[realName] = { assignment: instr }
            }
        } else {
            this.assignProxies[realName] = { assignment: instr }
        }
    }

    onParserIdExpr(id) {
        let realName = this.getRealName(id);
        if (realName in this.assignProxies) {
            if (this.assignProxies[realName].assignment !== null) {
                let assignment = this.assignProxies[realName].assignment;
                return ctx => assignment.getValue(ctx);
            } else {
                let proxy = this.assignProxies[realName];
                return ctx => proxy.assignment.getValue(ctx);
            }
        } else {
            let proxy = {
                lineNumber: this.lineNumber,
                name: realName,
                assignment: null,
            };
            this.assignProxies[realName] = proxy;
            return ctx => proxy.assignment.getValue(ctx);
        }
    }

    onParserCallExpr(name, args) {
        return AsmFunctions.createExpr(name, args);
    }

    onParserNumberExpr(valueStr) {
        let valueBig = BigInt(valueStr);
        let value64 = valueBig & 0xFFFFFFFFFFFFFFFFn;
        if (value64 != valueBig) {
            throw new ParserError(`${this.lineNumber}: Integer literal out of range!`);
        }
        return ctx => value64;
    }

    onParserTernaryExpr(a, b, c) {
        return AsmFunctions.createExpr('if', [a, b, c]);
    }

    onParserOrExpr(a, b) {
        return this.onParserCallExpr('if', [a, a, b]);
    }
    onParserAndExpr(a, b) {
        return this.onParserCallExpr('if', [this.onParserNotExpr(a), a, b]);
    }
    onParserBitOrExpr(a, b) {
        return ctx => a(ctx) | b(ctx);
    }
    onParserBitXorExpr(a, b) {
        return ctx => a(ctx) ^ b(ctx);
    }
    onParserBitAndExpr(a, b) {
        return ctx => a(ctx) & b(ctx);
    }
    onParserEqExpr(a, b) {
        return ctx => a(ctx) == b(ctx) ? 1n : 0n;
    }
    onParserNeExpr(a, b) {
        return ctx => a(ctx) != b(ctx) ? 1n : 0n;
    }
    onParserLtExpr(a, b) {
        return ctx => a(ctx) < b(ctx) ? 1n : 0n;
    }
    onParserGtExpr(a, b) {
        return ctx => a(ctx) > b(ctx) ? 1n : 0n;
    }
    onParserLeExpr(a, b) {
        return ctx => a(ctx) <= b(ctx) ? 1n : 0n;
    }
    onParserGeExpr(a, b) {
        return ctx => a(ctx) >= b(ctx) ? 1n : 0n;
    }
    onParserShlExpr(a, b) {
        return ctx => (a(ctx) << b(ctx)) & 0xFFFFFFFFFFFFFFFFn;
    }
    onParserShrExpr(a, b) {
        return ctx => a(ctx) >> b(ctx);
    }
    onParserAddExpr(a, b) {
        return ctx => (a(ctx) + b(ctx)) & 0xFFFFFFFFFFFFFFFFn;
    }
    onParserSubExpr(a, b) {
        return ctx => (a(ctx) - b(ctx)) & 0xFFFFFFFFFFFFFFFFn;
    }
    onParserMulExpr(a, b) {
        return ctx => (a(ctx) * b(ctx)) & 0xFFFFFFFFFFFFFFFFn;
    }
    onParserDivExpr(a, b) {
        return ctx => a(ctx) / ctx.instr.compiler.checkDiv0(ctx, b);
    }
    onParserModExpr(a, b) {
        return ctx => a(ctx) % ctx.instr.compiler.checkDiv0(ctx, b);
    }
    onParserMinusExpr(a) {
        return ctx => -a(ctx) & 0xFFFFFFFFFFFFFFFFn;
    }
    onParserNotExpr(a) {
        return ctx => (a(ctx) == 0n) ? 1n : 0n;
    }
    onParserBitNotExpr(a) {
        return ctx => a(ctx) ^ 0xFFFFFFFFFFFFFFFFn;
    }

}


class Compiler {

    constructor() {
    }

    compile(input, conf) {
        this.initialState = true;
        let po = new ParserOutput();
        po.parse(input, this, conf);
        this.instructions = po.instructions;
        this.blocks = po.blocks;
        this.rootBlock = po.rootBlock;
        this.resolveBlockDependencies();
        this.initialAddresses();
        this.initialState = false;
        this.generateCode();
        return this.output.subarray(0, this.addr);
    }

    resolveBlockDependencies() {
        this.currentBlock = null;
        for (let instr of this.instructions) {
            if (instr instanceof Block) {
                this.currentBlock = instr;
            }
            instr.collectDeps(this.currentBlock.deps);
            if (instr instanceof BlockEnd) {
                this.currentBlock = this.currentBlock.block;
            }
        }
        let stack = [this.rootBlock];
        while (stack.length > 0) {
            let block = stack.pop();
            if (block.used) {
                continue;
            }
            block.used = true;
            for (let dep of block.deps) {
                let block = dep;
                while (block !== null && !block.used) {
                    stack.push(block);
                    block = block.block;
                }
            }
        }
    }

    reserveOutput(bytes) {
        if (this.addr + bytes > this.output.length) {
            let newSize = (this.addr + bytes) * 2;
            let newOutput = new Uint8Array(newSize);
            newOutput.set(this.output);
            this.output = newOutput;
        }
    }

    initialAddresses() {
        this.addr = 0;
        for (let index = 0; index < this.instructions.length; index++) {
            let instr = this.instructions[index];
            if ((instr instanceof Block) && instr.discardable && !instr.used) {
                index = instr.end.index;
                continue;
            }
            if (instr.estimatedAddr !== undefined && instr.estimatedAddr != this.addr) {
                rerun = true;
            }
            instr.addr = this.addr;
            let size = instr.getSize({ instr: this.rootBlock });
            this.addr += size;
            instr.endAddr = this.addr;
        }
    }

    generateCode() {
        this.output = new Uint8Array(8 * this.instructions.length);
        let rerun = true;
        let rerunCounter = 0;
        do {
            rerunCounter++;
            if (rerunCounter > MAX_RERUNS) {
                throw new ParserError('0: Maximum number of generating reruns reached!');
            }
            for (let instr of this.instructions) {
                instr.oldAddr = instr.addr;
                instr.addr = undefined;
                instr.estimatedAddr = undefined;
            }
            this.postPostponedError = null;
            this.addr = 0;
            rerun = false;
            for (let index = 0; index < this.instructions.length; index++) {
                let instr = this.instructions[index];
                if ((instr instanceof Block) && instr.discardable && !instr.used) {
                    index = instr.end.index;
                    continue;
                }
                if (instr.estimatedAddr !== undefined && instr.estimatedAddr != this.addr) {
                    rerun = true;
                }
                instr.addr = this.addr;
                this.reserveOutput(10);
                instr.generate(Math.max(0, instr.endAddr - instr.addr));
                instr.endAddr = this.addr;
            }
        } while (rerun);
        if (this.postPostponedError !== null) {
            throw this.postPostponedError;
        }
    }

    checkDiv0(ctx, expr) {
        let value;
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

};


export { Compiler };
