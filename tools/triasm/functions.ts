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

import { ExprContext, ExprEval, InstrBase } from './instructions'
import { ObjMarker } from '../utils/common';
import { CompilerError } from './errors';

type FuncEval = (instr: InstrBase, ctx: ExprContext, ...args: ExprEval[]) => bigint;

const gettingSize = new ObjMarker('_func_size_gettingSize');

export class AsmFunctions {

    static createExpr(instr: InstrBase, name: string, args: ExprEval[]) {
        let map = AsmFunctions as { [k: string]: any };
        let f = map[`func_${name}`] as (FuncEval | undefined);
        let a = map[`args_${name}`] as ([number, number] | undefined);
        if (f === undefined) {
            throw new CompilerError(instr.lineNumber, `Unknown function "${name}()"!`);
        }
        if (a === undefined) {
            a = [f.length - 2, f.length - 2];
        }
        if (args.length < a[0] || args.length > a[1]) {
            throw new CompilerError(instr.lineNumber, `Invalid number of arguments for function "${name}()"!`);
        }
        return AsmFunctions.createFunction(f, instr as InstrBase, args);
    }

    static createFunction(f: FuncEval, instr: InstrBase, args: ExprEval[]): ExprEval {
        return ctx => f(instr, ctx, ...args);
    }

    static func_vma(instr: InstrBase, ctx: ExprContext): bigint {
        return AsmFunctions.func_pma(instr, ctx) + BigInt(instr.compiler.pmaBase);
    }

    static func_pma(instr: InstrBase, ctx: ExprContext): bigint {
        if (instr.compiler.preparation) {
            ctx.mutable = true;
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

    static func_vma2pma(instr: InstrBase, ctx: ExprContext, vma: ExprEval): bigint {
        return vma(ctx) - BigInt(instr.compiler.pmaBase);
    }

    static func_pma2vma(instr: InstrBase, ctx: ExprContext, pma: ExprEval): bigint {
        return pma(ctx) + BigInt(instr.compiler.pmaBase);
    }

    static func_line(instr: InstrBase, ctx: ExprContext): bigint {
        return BigInt(instr.lineNumber);
    }

    static func_iid(instr: InstrBase, ctx: ExprContext): bigint {
        return BigInt(instr.index);
    }

    static func_size(instr: InstrBase, ctx: ExprContext, first: ExprEval, last: ExprEval): bigint {
        /*
        TODO: This function should be replaced by block_size(), e.g.:
        .BLOCK
        my_block_size = bock_size();
        ...
        .END
        ...
        ADD my_block_size

        Function will:
         * go back to ".BEGIN" instruction skipping ".END/.BEGIN" of sub blocks
            * OR: if it is inside Assign instruction, we can jump to ".BEGIN" at once
         * in initial state: do something similar to current solution
         * in generation state: It will create two ExprEval pma() functions associated
           with ".BEGIN/.END" instructions. Size is difference of their return values.
            * Creation of ExprEval pma() can be optimized, so it will created once.
        */
        /*let instructions = instr.compiler.instructions;
        if (instr.compiler.preparation) {
            let oldInvalid = ctx.invalid;
            ctx.invalid = false;
            let firstValue = Number(first(ctx));
            let lastValue = Number(last(ctx));
            if (ctx.invalid || firstValue >= instructions.length || lastValue >= instructions.length || firstValue > lastValue) {
                throw new CompilerError(instr.lineNumber, `Invalid instruction ID used in an argument of the "size()" function!`);
            }
            ctx.invalid = oldInvalid;
            let size = 0;
            for (let i = firstValue; i < lastValue; i++) {
                let instr = instructions[i];
                if (instr instanceof Block) {
                    ctx.invalid = ctx.invalid || instr.discarded; // TODO: check if it is valid
                } else if (instr instanceof BlockEnd) {
                    ctx.invalid = ctx.invalid || instr.block.discarded; // TODO: check if it is valid
                } else if (gettingSize.is(instr)) {
                    throw new ExprCycleError(`${instr.lineNumber}: Cycle in size() function evaluation!`);
                }
                gettingSize.set(instr);
                size += instr.getSize(ctx);
                gettingSize.clear(instr);
            }
            return BigInt(size);
        } else {
            let firstValue = Number(first(ctx));
            let lastValue = Number(last(ctx));
            let ctx2 = new ExprContext();
            return AsmFunctions.func_pma(instructions[lastValue], ctx2) - AsmFunctions.func_pma(instructions[firstValue], ctx2);
        }*/
        return 0n;
    }

    static func_if(instr: InstrBase, ctx: ExprContext, cond: ExprEval, ifTrue: ExprEval, ifFalse: ExprEval): bigint {
        if (instr.compiler.preparation) {
            let ctx2 = ctx.shallowClone({mutable: false});
            let valCond = cond(ctx2);
            ctx2.shallowMergeToParent();
            if (ctx2.mutable) {
                let trueVal = ifTrue(ctx);
                let falseVal = ifFalse(ctx);
                return (valCond != 0n) ? trueVal : falseVal;
            } else if (valCond != 0n) {
                return ifTrue(ctx);
            } else {
                return ifFalse(ctx);
            }
        } else if (cond(ctx)) {
            return ifTrue(ctx);
        } else {
            return ifFalse(ctx);
        }
    }

    /*func_unwind_arg(ctx: ExprContext): bigint {
        let argValue = this.args[0](ctx);
        if (this.args.length > 1) {
            let keep = argValue;
            let reduce = this.args[1](ctx);
            if (reduce <= 15n && keep <= 7n) {
                return (keep << 4n) | reduce;
            } else if (reduce <= 15n && keep <= 15n) {
                return (keep << 4n) | reduce | 0xFFFFFF00n;
            } else if (reduce <= 255n && keep <= 127n) {
                return (keep << 8n) | reduce;
            } else if (reduce <= 255n && keep <= 255n) {
                return (keep << 8n) | reduce | 0xFFFF0000n;
            } else if (reduce <= 65535n && keep <= 65535n) {
                return (keep << 16n) | reduce;
            } else {
                //this.generator.postponedError(new CompilerError(this.lineNumber, `Too many words to unwind!`));
                return 0n;
            }
        } else {
            return argValue;
        }
    }*/
};
