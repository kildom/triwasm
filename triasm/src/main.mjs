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

const EXPR_STATE_CREATE_DEPS = 0;
const EXPR_STATE_CONST_ASSIGN = 1;
const EXPR_STATE_CONST_EXPR = 2;
const EXPR_STATE_CALC_VALUE = 3;


class ExprNotConstError extends Error { };

class PostponeCalculation extends Error {
    constructor(dependence) {
        super();
        this.dependence = dependence;
    }
};

class Conf {
    constructor() {
        this.extI64 = false;
        this.extMem64 = false;
        this.extUnwind = true;
        this.extF32 = false;
        this.extF64 = false;
    }
};

const CODE_INSTR = (1 << 7);

class InstrBase {
    constructor(compiler, index, info, minimalSize) {
        this.compiler = compiler;
        this.index = index;
        this.info = info;
        this.minimalSize = minimalSize;
        this.lineNumber = compiler.lineNumber;
    }

    getSize() {
        return 0;
    }

    getMinimalSize() {
        return this.minimalSize;
    }
};

const ASSIGN_WAITING = 0;
const ASSIGN_CALCULATING = 1;
const ASSIGN_CONST = 2;
const ASSIGN_NON_CONST = 3;

class Block extends InstrBase {
    constructor(compiler, index, args, block) {
        super(compiler, index, null, 0);
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
    constructor(compiler, index, block) {
        super(compiler, index, null, 0);
        this.block = block;
    }
};


class EmptyInstr extends InstrBase {
    constructor(compiler, index) {
        super(compiler, index, null);
    }
};


class Assign extends InstrBase {
    constructor(compiler, index, value, block) {
        super(compiler, index, null);
        this.value = value;
        this.state = ASSIGN_WAITING;
        this.block = block;
    }
};

class SimpleCoreInstruction extends InstrBase {
    constructor(compiler, index, info, args, base) {
        super(compiler, index, info, 1 + args.length);
        this.args = args;
        this.endAddr = 0;
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
        return instr => f(instr, ...args);
    }

    static func_addr(instr) {
        return BigInt(instr.addr);
    }

    static func_line(instr) {
        return BigInt(instr.lineNumber);
    }

    static func_iid(instr) {
        return BigInt(instr.index);
    }

    static func_size(instr, first, last) {
        first = parseInt(first());
        last = parseInt(last());
        if (first >= BigInt(instr.compiler.instructions.length) || last >= BigInt(instr.compiler.instructions.length)) {
            throw new ParserError(`${instr.lineNumber}: Invalid instruction ID used in an argument of the "size()" function!`);
        }
        console.error(`TODO: size() function`);
        return 1n;
    }

};


class ParserOutput {

    parse(input, compiler, conf) {
        this.compiler = compiler;
        this.conf = conf;
        this.lineNumber = 1;
        this.instructions = [];
        this.discardableBlocks = [];
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

        parse(input, this);

        if (this.currentBlock !== null) {
            throw new ParserError(`${this.currentBlock.lineNumber}: Unfinished block!`);
        }
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
        let block;
        switch (id) {
            case INSTR._BEGIN:
                instr = new Block(this.compiler, index, args, this.currentBlock);
                if (instr.discardable) {
                    this.discardableBlocks.push(instr);
                }
                this.currentBlock = instr;
                break;

            case INSTR._END:
                if (this.currentBlock === null) {
                    throw new ParserError(`${this.lineNumber}: ".END" directive without matching ".BEGIN".`);
                }
                instr = new BlockEnd(this, index, this.currentBlock);
                this.currentBlock.end = instr;
                this.currentBlock = this.currentBlock.block;
                break;

            case INSTR._LOCAL:
                if (this.currentBlock === null) {
                    throw new ParserError(`${this.lineNumber}: ".LOCAL" outside a block.`);
                }
                if (args in this.currentBlock.locals) {
                    throw new ParserError(`${this.lineNumber}: ".LOCAL" variable already defined.`);
                }
                let name = `~LOCAL~${index}~${this.currentBlock.index}~${args}`;
                this.currentBlock.locals[args] = name;
                instr = new EmptyInstr(this.compiler, index);
                break;

            default:
                let Class = AsmFunctions.parserInstrClasses[info.instrClass];
                instr = new Class(this.compiler, index, info, args, base);
                break;
        }
        this.instructions.push(instr);
    }

    onParserLabel(name) {
        this.onParserAssign(name, this.onParserCallExpr('addr', []));
    }

    onParserAssign(name, value) {
        let realName = this.getRealName(name);
        let instr = new Assign(this.compiler, this.instructions.length, value, this.currentBlock);
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
            return instr => assignment.getValue();
        } else {
            let proxy = {
                lineNumber: this.lineNumber,
                name: realName,
                assignment: null,
            };
            this.assignProxies[realName] = proxy;
            return instr => proxy.assignment.getValue();
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
        return instr => value64;
    }

}


class Compiler {

    constructor() {
    }

    compile(input, conf) {
        let po = new ParserOutput();
        po.parse(input, this, conf);
        this.instructions = po.instructions;
        this.discardableBlocks = po.discardableBlocks;
        this.knownAddresses = false;
        //this.initialInstrLayout();
        this.createBlockDependencies();
    }

    createBlockDependencies()
    {
        /*let depsRoot = {
            deps: new Set()
        };
        this.currentBlock = depsRoot;
        for (let instr of this.instructions) {
            if ((instr instanceof Block) && instr.discardable == true) {
                this.stack.push(instr);
            }
            instr.collectDeps();
            if ((instr instanceof BlockEnd) && instr.block.discardable == true) {
                this.stack.pop();
            }
        }*/
    }


    initialInstrLayout() { // TODO: probably not needed
        this.knownAddresses = false;
        let addr = 0;
        for (let instr of this.instructions) {
            instr.addr = addr;
            let size;
            try {
                size = instr.getSize();
            } catch (ex) {
                if (ex instanceof ExprNotConstError) {
                    size = instr.getMinimalSize();
                } else {
                    throw ex;
                }
            }
            addr += size;
        }
    }

};


class Old {
    createBlockDependencies() {
        this.exprState = EXPR_STATE_CREATE_DEPS;
        let depsRoot = {
            deps: new Set()
        };
        do {
            this.depsUpdated = false;
            this.stack = [depsRoot];
            for (let instr of this.instructions) {
                if ((instr instanceof Block) && instr.discardable == true) {
                    this.stack.push(instr);
                }
                instr.collectDeps();
                if ((instr instanceof BlockEnd) && instr.block.discardable == true) {
                    this.stack.pop();
                }
            }
        } while (this.depsUpdated)
    }

    initialInstrLayout() {
        this.exprState = EXPR_STATE_CONST_EXPR;
        let addr = 0;
        for (let instr of this.instructions) {
            instr.addr = addr;
            let size = instr.getInitialSize();
            addr += size;
        }
    }

    initialAssignments() {
        for (let instr of this.instructions) {
            if (instr instanceof Assign) {
                this.vars[instr.name].value = instr.constValue;
            }
        }
    }

    evaluateConstAssignments() {
        let index = 0;
        let stack = [];
        do {
            let assignment = null;
            if (stack.length > 0) {
                assignment = stack.pop();
            } else {
                while (index < this.instructions.length) {
                    if ((this.instructions[index] instanceof Assign) && this.instructions[index].state == ASSIGN_WAITING) {
                        assignment = this.instructions[index];
                        index++;
                        break;
                    }
                    index++;
                }
            }
            if (assignment === null) {
                break;
            }
            assignment.state = ASSIGN_CALCULATING;
            try {
                assignment.constValue = assignment.value(assignment);
                assignment.state = ASSIGN_CONST;
            } catch (ex) {
                if (ex instanceof ExprNotConstError) {
                    assignment.state = ASSIGN_NON_CONST;
                } else if (ex instanceof PostponeCalculation) {
                    stack.push(assignment);
                    stack.push(ex.dependence);
                }
            }
        } while (true);
    }

    parse() {
        try {
            parse(this.input, this);
            if (this.stack.length > 0) {
                throw new ParserError(`${this.stack[0].lineNumber}: Unfinished block!`);
            }
        } catch (ex) {
            if (ex instanceof ParserError) {
                console.log(ex.message);
                return;
            } else {
                throw ex;
            }
        }
    }

    getVariable(instr, id) {
        if (!(id in this.vars)) {
            throw new ParserError(`${instr.lineNumber}: Variable "${id}" never assigned.`);
        }
        let variable = this.vars[id];
        switch (this.exprState) {
            case EXPR_STATE_CREATE_DEPS:
                let index = variable.assignments[variable.assignments.length - 1];
                for (let i of variable.assignments) {
                    if (i >= instr.index) {
                        break;
                    }
                    index = i;
                }
                let prevAssign = this.instructions[index];
                switch (prevAssign.state) {
                    case ASSIGN_WAITING:
                        throw new PostponeCalculation(prevAssign);
                    case ASSIGN_CALCULATING:
                        throw new ParserError(`${instr.lineNumber}: Expression dependency cycle. Other instruction on line ${prevAssign.lineNumber}.`);
                    case ASSIGN_CONST:
                        return prevAssign.constValue;
                    case ASSIGN_VARIABLE:
                        throw new ExprNotConstError();
                }
                break;
            case EXPR_STATE_CONST_EXPR:
                if (variable.value === null) {
                    throw new ExprNotConstError();
                }
                return variable.value;
            case EXPR_STATE_CALC_VALUE:
                if (variable.discarded) {
                    throw new ParserError(`${instr.lineNumber}: Variable "${id}" was assigned in a discarded block. Discarding blocks cannot depend on size of variable-size instructions!`);
                }
                return variable.value;
        }
        if (this.exprState == EXPR_STATE_CALC_VALUE) {
        } else if (instr.compiler.exprState == EXPR_STATE_CONST_ASSIGN) {
        } else if (instr.compiler.exprState == EXPR_STATE_CONST_EXPR) {
        } else {
            instr.deps[id] = true;
            return variable.value;
        }
    }

};

let conf = new Conf();
let c = new Compiler();

c.compile(`
.begin discardable
.local test
entry:
add test
test:
sub
mul line()
test = 12
.end
`, conf);
