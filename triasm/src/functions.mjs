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

import { ParserError } from './parser.mjs'
import { Block, BlockEnd, ExprCycleError } from './instructions.mjs'


class AsmFunctions {

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
        let instr = ctx.instr;
        if (instr.compiler.initialState) {
            ctx.invalid = true;
            return 0n;
        } else {
            if (instr.addr !== undefined) {
                return BigInt(instr.addr);
            } else {
                if (instr.estimatedAddr === undefined) {
                    instr.estimatedAddr = Math.max(instr.oldAddr, instr.compiler.addr);
                }
                return BigInt(Math.max(instr.estimatedAddr, instr.compiler.addr));
            }
        }
    }

    static func_line(ctx) {
        return BigInt(ctx.instr.lineNumber);
    }

    static func_iid(ctx) {
        return BigInt(ctx.instr.index);
    }

    static func_size(ctx, first, last) {
        let instructions = ctx.instr.compiler.instructions;
        if (ctx.instr.compiler.initialState) {
            let oldInvalid = ctx.invalid;
            ctx.invalid = false;
            first = Number(first(ctx));
            last = Number(last(ctx));
            if (ctx.invalid || first >= instructions.length || last >= instructions.length || first > last) {
                throw new ParserError(`${ctx.instr.lineNumber}: Invalid instruction ID used in an argument of the "size()" function!`);
            }
            ctx.invalid = oldInvalid;
            let size = 0;
            for (let i = first; i < last; i++) {
                let instr = instructions[i];
                if (instr instanceof Block) {
                    ctx.invalid = ctx.invalid || instr.discardable;
                } else if (instr instanceof BlockEnd) {
                    ctx.invalid = ctx.invalid || instr.block.discardable;
                } else if (instr._func_size_gettingSize) {
                    throw new ExprCycleError(`${ctx.instr.lineNumber}: Cycle in size() function evaluation!`);
                }
                instr._func_size_gettingSize = true;
                size += instr.getSize(ctx);
                delete instr._func_size_gettingSize;
            }
            return BigInt(size);
        } else {
            first = Number(first(ctx));
            last = Number(last(ctx));
            return AsmFunctions.func_addr({ instr: instructions[last] }) - AsmFunctions.func_addr({ instr: instructions[first] });
        }
    }

    static func_if(ctx, cond, ifTrue, ifFalse) {
        if (ctx.instr.compiler.initialState) {
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
        } else {
            if (cond(ctx)) {
                return ifTrue(ctx);
            } else {
                return ifFalse(ctx);
            }
        }
    }

};

export { AsmFunctions };
