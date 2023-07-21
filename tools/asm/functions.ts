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

import { Assign, Block, BlockEnd, ExprContext, ExprEval, InstrBase } from './instructions';
import { ObjMarker } from '../common/common';
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
            if (instr.pma.current === undefined) {
                if (instr.pma.estimated === undefined) {
                    instr.pma.estimated = Math.max(instr.pma.old, instr.generator.pma);
                }
                return BigInt(Math.max(instr.pma.estimated, instr.generator.pma));
            } else {
                return BigInt(instr.pma.current);
            }
        }
    }

    static func_vma2pma(instr: InstrBase, ctx: ExprContext, vma: ExprEval): bigint {
        return vma(ctx) - BigInt(instr.compiler.pmaBase);
    }

    static func_pma2vma(instr: InstrBase, ctx: ExprContext, pma: ExprEval): bigint {
        return pma(ctx) + BigInt(instr.compiler.pmaBase);
    }

    static func_line(instr: InstrBase/*, ctx: ExprContext*/): bigint {
        return BigInt(instr.lineNumber);
    }

    static func_iid(instr: InstrBase/*, ctx: ExprContext*/): bigint {
        return BigInt(instr.index);
    }

    static func_block_size(instr: InstrBase, ctx: ExprContext): bigint {

        let block: Block | null = null;
        if (instr instanceof Assign) {
            block = instr.block;
        } else {
            let blockStack = 0;
            for (let index = instr.index; index >= 0; index--) {
                let inner = instr.compiler.instructions[index];
                if (inner instanceof Block) {
                    if (blockStack == 0) {
                        block = inner;
                        break;
                    } else {
                        blockStack--;
                    }
                } else if (inner instanceof BlockEnd) {
                    blockStack++;
                }
            }
        }

        if (block === null) {
            throw new CompilerError(instr.lineNumber, 'Internal error');
        }

        if (instr.compiler.preparation) {
            let size = 0;
            for (let index = block.index; index <= block.end.index; index++) {
                let inner = instr.compiler.instructions[index];
                if (inner instanceof Block) {
                    ctx.mutable = ctx.mutable || inner.discarded;
                }
                if (gettingSize.is(inner)) {
                    ctx.mutable = true;
                } else {
                    gettingSize.set(inner);
                    size += inner.getSize(ctx);
                    gettingSize.clear(inner);
                }
            }
            return BigInt(size);
        } else {
            return this.func_pma(block.end, ctx) - this.func_pma(block, ctx);
        }
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

}
