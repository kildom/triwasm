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

import { ParserError } from './parser'
import { Block, BlockEnd, ExprContext, ExprCycleError, ExprEval } from './instructions'

type FuncEval = (ctx: ExprContext, ...args: ExprEval[]) => bigint;

export class AsmFunctions {

    static createExpr(name: string, args: ExprEval[], lineNumber: number) {
        let map = AsmFunctions as { [k: string]: any };
        let f = map[`func_${name}`] as (FuncEval | undefined);
        let a = map[`args_${name}`] as ([number, number] | undefined);
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

    static createFunction(f: FuncEval, args: ExprEval[]): ExprEval {
        return ctx => f(ctx, ...args);
    }

    static func_vma(ctx: ExprContext) {
        return this.func_pma(ctx) + BigInt(ctx.instr.compiler.pmaBase);
    }

    static func_pma(ctx: ExprContext) {
        let instr = ctx.instr;
        if (instr.compiler.initialState) {
            ctx.invalid = true;
            return 0n;
        } else {
            if (instr.pma === undefined) {
                if (instr.pmaEstimated === undefined) {
                    instr.pmaEstimated = Math.max(instr.pmaOld, instr.compiler.pma);
                }
                return BigInt(Math.max(instr.pmaEstimated, instr.compiler.pma));
            } else {
                return BigInt(instr.pma);
            }
        }
    }

    static func_vma2pma(ctx: ExprContext, vma: ExprEval) {
        return vma(ctx) - BigInt(ctx.instr.compiler.pmaBase);
    }

    static func_pma2vma(ctx: ExprContext, pma: ExprEval) {
        return pma(ctx) + BigInt(ctx.instr.compiler.pmaBase);
    }

    static func_line(ctx: ExprContext) {
        return BigInt(ctx.instr.lineNumber);
    }

    static func_iid(ctx: ExprContext) {
        return BigInt(ctx.instr.index);
    }

    static func_size(ctx: ExprContext, first: ExprEval, last: ExprEval) {
        let gettingSizeSymbol = Symbol.for('_func_size_gettingSize');
        let instructions = ctx.instr.compiler.instructions;
        if (ctx.instr.compiler.initialState) {
            let oldInvalid = ctx.invalid;
            ctx.invalid = false;
            let firstValue = Number(first(ctx));
            let lastValue = Number(last(ctx));
            if (ctx.invalid || firstValue >= instructions.length || lastValue >= instructions.length || firstValue > lastValue) {
                throw new ParserError(`${ctx.instr.lineNumber}: Invalid instruction ID used in an argument of the "size()" function!`);
            }
            ctx.invalid = oldInvalid;
            let size = 0;
            for (let i = firstValue; i < lastValue; i++) {
                let instr = instructions[i];
                if (instr instanceof Block) {
                    ctx.invalid = ctx.invalid || instr.discardable;
                } else if (instr instanceof BlockEnd) {
                    ctx.invalid = ctx.invalid || instr.block.discardable;
                } else if ((instr as any)[gettingSizeSymbol]) {
                    throw new ExprCycleError(`${ctx.instr.lineNumber}: Cycle in size() function evaluation!`);
                }
                (instr as any)[gettingSizeSymbol] = true;
                size += instr.getSize(ctx);
                delete (instr as any)[gettingSizeSymbol];
            }
            return BigInt(size);
        } else {
            let firstValue = Number(first(ctx));
            let lastValue = Number(last(ctx));
            return AsmFunctions.func_pma({ instr: instructions[lastValue] }) - AsmFunctions.func_pma({ instr: instructions[firstValue] });
        }
    }

    static func_if(ctx: ExprContext, cond: ExprEval, ifTrue: ExprEval, ifFalse: ExprEval) {
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
