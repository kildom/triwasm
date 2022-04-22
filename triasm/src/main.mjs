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
};

/* Passes:
    0. Parsing:
        - Create list of instructions
        - Create block objects
        - Create list of all variables (initialize to 0)
        - Redirect expressions to local variables
        - Create identifier to discardable block relation

Preparing and discarding blocks:
 - Create map of all assignment positions: compiler.assignMap[variable_name] = [ position1, position2, ... ]
 - Set assignment instructions state to ASSIGN_WAITING
 - Set state to EXPR_STATE_CONST_ASSIGN
 - Try to evaluate value of each assign instruction on stack (if non-empty) or from the list (if stack empty).
    - Before evaluating, set instruction state to ASSIGN_CALCULATING
    - Resolve identifiers to assign instruction before this or (if not exists) last assign instruction.
    - If reference assign is ASSIGN_WAITING, throws PostponeCalculation(nextAssign),
      so push current assign to stack and start evaluating ex.nextAssign
    - If reference assign is ASSIGN_NON_CONST, throws ExprNotConstError(), so sets current state also to ASSIGN_NON_CONST
    - If reference assign is ASSIGN_CONST, returns refAssign.constValue
    - If reference assign is ASSIGN_CALCULATING, throws CompilerError('...')
 - Set state to EXPR_STATE_CONST_EXPR
 - Ask each instruction for its minimal size, calculate and save their addresses.
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
        super(compiler, index, null);
        this.block = block;
    }
};


class EmptyInstr extends InstrBase {
    constructor(compiler, index) {
        super(compiler, index, null);
    }
};


class Assign extends InstrBase {
    constructor(compiler, index, name, value) {
        super(compiler, index, null);
        this.name = name;
        this.value = value;
    }
};



class SimpleCoreInstruction extends InstrBase {
    constructor(compiler, index, info, args, base) {
        super(compiler, index, info);
        this.args = args;
        this.endAddr = 0;
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
        this.blocks = [];
        this.blockStack = [];
        this.vars = {};
        this.exprState = EXPR_STATE_CREATE_DEPS;
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
    }

    parse() {
        try {
            parse(this.input, this);
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
        for (let i = this.blockStack.length - 1; i >= 0; i--) {
            if (name in this.blockStack[i].locals) {
                return this.blockStack[i].locals[name];
            }
        }
        return name;
    }

    onParserAssign(name, value) {
        name = this.getRealName(name);
        let variable;
        if (name in this.vars) {
            variable = this.vars;
        } else {
            variable = { name, blocks: new Set() }
        }
        for (let block of this.blockStack) {
            if (block.discardable) {
                variable.blocks.add(block);
            }
        }
        let instr = new Assign(this, this.instructions.length, name, value);
        this.instructions.push(instr);
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
                this.blocks.push(instr);
                this.blockStack.push(instr);
                break;

            case INSTR._END:
                if (this.blockStack.length == 0) {
                    throw new ParserError(`${this.lineNumber}: ".END" directive without matching ".BEGIN".`); // TODO: Check at the end if blockStack is empty
                }
                block = this.blockStack.pop();
                instr = new BlockEnd(this, index, block);
                block.end = instr;
                break;

            case INSTR._LOCAL:
                if (this.blockStack.length == 0) {
                    throw new ParserError(`${this.lineNumber}: ".LOCAL" outside a block.`);
                }
                block = this.blockStack[this.blockStack.length - 1];
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
        if (this.exprState == EXPR_STATE_CALC_VALUE) {
            if (variable.discarded) {
                throw new ParserError(`${instr.lineNumber}: Variable "${id}" was assigned in a discarded block.`);
            }
            return variable.value;
        } else if (instr.compiler.exprState == EXPR_STATE_CONST_ASSIGN) {
            let map = this.assignMap[id];
            let index = map[map.length - 1];
            for (let i of map) {
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
                    return prevAssign.calculatedValue;
                case ASSIGN_VARIABLE:
                    throw new ExprNotConstError();
            }
        } else if (instr.compiler.exprState == EXPR_STATE_CONST_EXPR) {
            if (!variable.isConst) {
                throw new ExprNotConstError();
            }
            return variable.value;
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

};

function exprCallAddr(instr) {
    if (instr.compiler.exprState == EXPR_STATE_CALC_VALUE) {
        return instr.addr;
    } else if (instr.compiler.exprState != EXPR_STATE_CREATE_DEPS) {
        throw new ExprNotConstError();
    } else {
        return 1n;
    }
}

function exprCallLine(instr) {
    return instr.lineNumber;
}

function exprCallUid(instr) {
    return instr.index;
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
.end
`, conf);
