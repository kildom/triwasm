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

import { instrInfoById, instrInfoByName, INSTR, BASE } from './instrInfo.mjs';
import { ExprParser, ExprParserError } from './exprParser.mjs';
import { parse, ParserError } from './parser.mjs'

class ExprCycleError extends Error { };

class Conf {
    constructor() {
        this.extI64 = false;
        this.extMem64 = false;
        this.extUnwind = true;
        this.extF32 = false;
        this.extF64 = false;
    }
};


class InstrBase {
    constructor(compiler, lineNumber, index, info, minimalSize) {
        this.compiler = compiler;
        this.lineNumber = lineNumber;
        this.index = index;
        this.info = info;
        this.minimalSize = minimalSize;
        this.addr = 0;
    }

    getSize() {
        return 0;
    }

    getMinimalSize() {
        return this.minimalSize;
    }

    collectDeps() {
    }
};


class Block extends InstrBase {
    constructor(compiler, lineNumber, index, args, block) {
        super(compiler, lineNumber, index, null, 0);
        this.block = block;
        this.discardable = false;
        this.end = null;
        this.locals = {};
        this.deps = new Set();
        switch (args.toUpperCase()) {
            case 'DISCARDABLE':
                this.discardable = true;
                break;
            case '':
                // nothing to do
                break;
            default:
                throw new ParserError(`${this.lineNumber}: Unknown type of block.`);
        }
    }
};


class BlockEnd extends InstrBase {
    constructor(compiler, lineNumber, index, block) {
        super(compiler, lineNumber, index, null, 0);
        this.block = block;
    }
};


class EmptyInstr extends InstrBase {
    constructor(compiler, lineNumber, index) {
        super(compiler, lineNumber, index, null);
    }
};


class Assign extends InstrBase {
    constructor(compiler, lineNumber, index, value, block) {
        super(compiler, lineNumber, index, null);
        this.value = value;
        this.block = block;
        this.ctx = null;
    }
    collectDeps(deps) {
        this.calculate(true);
        for (let b of this.ctx.deps) {
            deps.add(b);
        }
    }
    getValue(ctx) {
        this.calculate(ctx.deps);
        ctx.invalid = ctx.invalid || this.ctx.invalid;
        if (ctx.deps) {
            ctx.deps.add(this.block);
        }
        return this.ctx.value;
    }
    calculate(useDeps) {
        if (this.ctx === null) {
            if (this.calculating) {
                throw new ExprCycleError(`${this.lineNumber}: Cycle in assignment evaluation! Cycle in the line numbers:`);
            }
            this.ctx = { instr: this };
            if (useDeps) {
                this.ctx.deps = new Set();
            }
            try {
                this.calculating = true;
                this.ctx.value = this.value(this.ctx);
                this.calculating = false;
            } catch (ex) {
                if (ex instanceof ExprCycleError) {
                    throw new ExprCycleError(ex.message + ' ' + this.lineNumber);
                }
                throw ex;
            }
        }
    }
};

function mergeExprCtx(dst, src) {
    dst.invalid = dst.invalid || src.invalid;
    if (dst.deps && src.deps) {
        for (let b of src.deps) {
            dst.deps.add(b);
        }
    }
}

class SimpleCoreInstruction extends InstrBase {
    constructor(compiler, lineNumber, index, info, args, base) {
        super(compiler, lineNumber, index, info, 1 + args.length);
        this.arg = args.length > 0 ? args[0] : null;
        this.endAddr = 0;
    }
    collectDeps(deps) {
        if (this.arg !== null) {
            this.arg({ instr: this, deps: deps });
        }
    }
    getSize(ctx) {
        if (this.arg !== null) {
            let thisCtx = { instr: this };
            let argValue = this.arg(thisCtx);
            mergeExprCtx(ctx, thisCtx);
            return 1 + this.getImmediateSize(argValue);
        } else {
            return 1;
        }
    }
    getImmediateSize(value) {
        value = Number(value & 0xFFFFFFFFn);
        if (value <= 0x7F || value >= 0xFFFFFF80) {
            return 1;
        } else if (value <= 0x7FFF || value >= 0xFFFF8000) {
            return 2;
        } else {
            return 4;
        }
    }
};


class AsmFunctions {

    static parserInstrClasses = {
        sc: SimpleCoreInstruction,
    };

    static createExpr(name, args, lineNumber) {
        let f = AsmFunctions[`func_${name}`];
        let a = AsmFunctions[`args_${name}`];
        if (f === undefined) {
            throw new ParserError(`${lineNumber}: Unknown function "${name}()"!`);
        }
        if (a === undefined) {
            a = [f.length - 1, f.length - 1];
        }
        if (args.length < a[0] || args.length > a[1]) {
            throw new ParserError(`${lineNumber}: Invalid number of arguments for function "${name}()"!`);
        }
        return this.createFunction(f, args);
    }

    static createFunction(f, args) {
        return ctx => f(ctx, ...args);
    }

    static func_addr(ctx) {
        ctx.invalid = true;
        return BigInt(ctx.instr.addr);
    }

    static func_line(ctx) {
        return BigInt(ctx.instr.lineNumber);
    }

    static func_iid(ctx) {
        return BigInt(ctx.instr.index);
    }

    static func_size(ctx, first, last) {
        first = parseInt(first());
        last = parseInt(last());
        let instructions = ctx.instr.compiler.instructions;
        if (first >= instructions.length || last > instructions.length || first > last) {
            throw new ParserError(`${ctx.instr.lineNumber}: Invalid instruction ID used in an argument of the "size()" function!`);
        }
        let size = 0;
        for (let i = first; i < last; i++) {
            let instr = instructions[i];
            if (instr instanceof Block) {
                ctx.invalid = ctx.invalid || instr.discardable;
            } else if (instr instanceof BlockEnd) {
                ctx.invalid = ctx.invalid || instr.block.discardable;
            }
            size += instr.getSize(ctx);
        }
        return BigInt(size);
    }

    static func_if(ctx, cond, ifTrue, ifFalse) {
        let oldInvalid = ctx.invalid;
        ctx.invalid = false;
        let valCond = cond(ctx);
        let invalid = ctx.invalid;
        ctx.invalid = invalid || oldInvalid;
        if (!invalid) {
            if (valCond != 0n) {
                return ifTrue(ctx);
            } else {
                return ifFalse(ctx);
            }
        } else {
            let trueVal = ifTrue(ctx);
            let falseVal = ifFalse(ctx);
            return (valCond != 0n) ? trueVal : falseVal;
        }
    }

};


class ParserOutput {

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

            default:
                let Class = AsmFunctions.parserInstrClasses[info.instrClass];
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

    onParserStartExpr() {
    }

    onParserIdExpr(id) {
        let realName = this.getRealName(id);
        if (realName in this.assignProxies) {
            let assignment = this.assignProxies[realName].assignment;
            return ctx => assignment.getValue(ctx);
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

}


class Compiler {

    constructor() {
    }

    compile(input, conf) {
        let po = new ParserOutput();
        po.parse(input, this, conf);
        this.instructions = po.instructions;
        this.blocks = po.blocks;
        this.rootBlock = po.rootBlock;
        this.resolveBlockDependencies();
        this.generateCode();
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

    generateCode() {
        for (let instr of this.instructions) {
            instr.endAddr = 0;
        }
        this.output = new Uint8Array(8 * this.instructions.length);
        do {
            for (let instr of this.instructions) {
                instr.estimatedAddr = undefined;
            }
            this.addr = 0;
            let rerun = false;
            for (let index = 0; index < this.instructions.length; index++) {
                let instr = this.instructions[index];
                if ((instr instanceof Block) && instr.discardable && !instr.used) {
                    index = instr.end.index;
                    continue;
                }
                if (instr.estimatedAddr !== undefined && instr.estimatedAddr != instr.addr) {
                    rerun = true;
                }
                instr.addr = this.addr;
                instr.generate();
                instr.endAddr = this.addr;
            }
        } while (rerun);
    }

};


let conf = new Conf();
let c = new Compiler();

c.compile(`
mul entry
.begin discardable
.local test
entry:
add test
test:
test_not_local:
sub
mul line()
test = 12
.end
.begin discardable
opt:
udiv 12 ? test_not_local : entry
.end
mul test_not_local ? 0 : opt
`, conf);
