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
    constructor(compiler, index, info) {
        this.compiler = compiler;
        this.info = info;
        this.index = index;
        this.lineNumber = compiler.lineNumber;
    }

    evalConst(value) {
        try {
            return value(this);
        } catch (ex) {
            if (ex instanceof ExprNotConstError) {
                return null;
            }
            throw ex;
        }
    }
};

const ASSIGN_WAITING = 0;
const ASSIGN_CALCULATING = 1;
const ASSIGN_CONST = 2;
const ASSIGN_NON_CONST = 3;

/* Passes:
    0. Parsing:
        - Create list of instructions
        - Create block objects
        - Create list of all variables (initialize to 0)
        - Redirect expressions to local variables
        - Create identifier to discardable block relation

Preparing and discarding blocks:
 X Create map of all assignment positions: variable.assignments = [ position1, position2, ... ]
 X Set assignment instructions state to ASSIGN_WAITING
 X Set state to EXPR_STATE_CONST_ASSIGN
 X Try to evaluate value of each assign instruction on stack (if non-empty) or from the list (if stack empty).
    X Before evaluating, set instruction state to ASSIGN_CALCULATING
    X Resolve identifiers to assign instruction before this or (if not exists) last assign instruction.
    X If reference assign is ASSIGN_WAITING, throws PostponeCalculation(nextAssign),
      so push current assign to stack and start evaluating ex.nextAssign
    X If reference assign is ASSIGN_NON_CONST, throws ExprNotConstError(), so sets current state also to ASSIGN_NON_CONST
    X If reference assign is ASSIGN_CONST, returns refAssign.constValue
    X If reference assign is ASSIGN_CALCULATING, throws CompilerError('...')
 X Set state to EXPR_STATE_CONST_EXPR
 X Ask each instruction for its minimal size, calculate and save their addresses.
 - Set state to EXPR_STATE_CREATE_DEPS
 - Create list of used identifiers for each instruction by evaluating their expressions
 - Repeat for entire list until no new dependencies are added
 - Create block dependency graph based on all expressions
 - Discard unused blocks - replace them with empty instructions or mark them as discarded
 - Mark variables from discarded blocks as unusable (using it will report error)
 - Set state to EXPR_STATE_CALC_VALUE
 - Execute each non-const assignment instruction (except discarded blocks)
 - Repeat until we get the same results
 - Generate bytecode for each instruction except discarded blocks
 - Repeat until we get the same bytecode
 - DONE
*/

class Block extends InstrBase {
    constructor(compiler, index, args) {
        super(compiler, index, null);
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
    getInitialSize() {
        return 0;
    }
    collectDeps() {
    }
};

class BlockEnd extends InstrBase {
    constructor(compiler, index, block) {
        super(compiler, index, null);
        this.block = block;
    }
    getInitialSize() {
        return 0;
    }
    collectDeps() {
    }
};


class EmptyInstr extends InstrBase {
    constructor(compiler, index) {
        super(compiler, index, null);
    }
    getInitialSize() {
        return 0;
    }
    collectDeps() {
    }
};


class Assign extends InstrBase {
    constructor(compiler, index, name, value) {
        super(compiler, index, null);
        this.name = name;
        this.value = value;
        this.state = ASSIGN_WAITING;
        this.constValue = null;
    }
    getInitialSize() {
        this.compiler.vars[this.name].value = this.constValue;
        return 0;
    }
    collectDeps() {
        this.value(this);
    }
};

class SimpleCoreInstruction extends InstrBase {
    constructor(compiler, index, info, args, base) {
        super(compiler, index, info);
        this.args = args;
        this.endAddr = 0;
    }
    getInitialSize() {
        if (this.args.length == 0) {
            return 1;
        }
        let value = this.evalConst(this.args[0]);
        if (value === null) {
            return 2;
        }
        return 1 + this.getImmediateSize(value);
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
    collectDeps() {
        if (this.args.length > 0) {
            this.args[0](this);
        }
    }
};

const parserInstrClasses = {
    sc: SimpleCoreInstruction,
};


class Compiler {

    constructor() {
    }

    compile(input, conf) {
        this.input = input;
        this.conf = conf;
        this.lineNumber = 1;
        this.instructions = [];
        this.discardableBlocks = [];
        this.stack = [];
        this.assignments = {};
        this.exprState = EXPR_STATE_CONST_ASSIGN;
        this.parserInstrConditions = {
            '-': true,
            unwind: conf.extUnwind,
            mem64: conf.extMem64,
            i64: conf.extI64,
            f32: conf.extF32,
            f64: conf.extF64,
            f32f64: conf.extF32 && conf.extF64,
        };
        this.parse();
        // this.evaluateConstAssignments();
        // this.initialAssignments();
        // this.initialInstrLayout();
        // this.createBlockDependencies();
    }

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

    // Parser interface
    onParserLine(lineNumber) {
        this.lineNumber = lineNumber;
    }

    onParserLabel(name) {
        this.onParserAssign(name, this.onParserCallExpr('addr', []));
    }

    getRealName(name) {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            if (name in this.stack[i].locals) {
                return this.stack[i].locals[name];
            }
        }
        return name;
    }

    onParserAssign(name, value) {
        let realName = this.getRealName(name);
        let instr = new Assign(this, this.instructions.length, name, value);
        for (let block of this.stack) {
            if (block.discardable) {
                instr.blocks.add(block);
            }
        }
        this.instructions.push(instr);
        let proxy;
        if (realName in this.assignProxies) {
            proxy = this.assignProxies[realName];
            if (proxy.assignment === null) {
                proxy.assignment = instr;
            } else {
                this.assignProxies[realName] = { assignment: instr }
            }
        } else {
            this.assignProxies[realName] = { assignment: instr }
        }
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
                instr = new Block(this, index, args);
                if (instr.discardable) {
                    this.discardableBlocks.push(instr);
                }
                this.stack.push(instr);
                break;

            case INSTR._END:
                if (this.stack.length == 0) {
                    throw new ParserError(`${this.lineNumber}: ".END" directive without matching ".BEGIN".`);
                }
                block = this.stack.pop();
                instr = new BlockEnd(this, index, block);
                block.end = instr;
                break;

            case INSTR._LOCAL:
                if (this.stack.length == 0) {
                    throw new ParserError(`${this.lineNumber}: ".LOCAL" outside a block.`);
                }
                block = this.stack[this.stack.length - 1];
                if (args in block.locals) {
                    throw new ParserError(`${this.lineNumber}: ".LOCAL" variable already defined.`);
                }
                let name = `~LOCAL~${index}~${block.index}~${args}`;
                block.locals[args] = name;
                instr = new EmptyInstr(this, index);
                break;

            default:
                let Class = parserInstrClasses[info.instrClass];
                instr = new Class(this, index, info, args, base);
                break;
        }
        this.instructions.push(instr);
    }

    onParserStartExpr() {
    }

    onParserIdExpr(id) {
        id = this.getRealName(id);
        return instr => this.getVariable(instr, id);
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

    onParserCallExpr(name, args) {
        switch (name) {
            case 'addr':
                if (args.length != 0) {
                    throw new ParserError(`${this.lineNumber}: Function "${name}": invalid number of arguments.`);
                }
                return exprCallAddr;
            case 'line':
                if (args.length != 0) {
                    throw new ParserError(`${this.lineNumber}: Function "${name}": invalid number of arguments.`);
                }
                return exprCallLine;
            case 'uid':
                if (args.length != 0) {
                    throw new ParserError(`${this.lineNumber}: Function "${name}": invalid number of arguments.`);
                }
                return exprCallUid;
            default:
                throw new ParserError(`${this.lineNumber}: Unknown function "${name}".`);
        }
    }

    onParserNumberExpr(valueStr) {
        let valueBig = BigInt(valueStr);
        let value64 = valueBig & 0xFFFFFFFFFFFFFFFFn;
        if (value64 != valueBig) {
            throw new ParserError(`${this.lineNumber}: Integer literal out of range!`);
        }
        return instr => value64;
    }

};

function exprCallAddr(instr) {
    switch (instr.compiler.exprState) {
        case EXPR_STATE_CREATE_DEPS:
        case EXPR_STATE_CALC_VALUE:
            return BigInt(instr.addr);
        case EXPR_STATE_CONST_ASSIGN:
        case EXPR_STATE_CONST_EXPR:
            throw new ExprNotConstError();
    }
}

function exprCallLine(instr) {
    return BigInt(instr.lineNumber);
}

function exprCallUid(instr) {
    return BigInt(instr.index);
}


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
