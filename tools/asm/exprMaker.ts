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

import { allowTemporaryNull } from "../common/common";
import { CompilerError } from "./errors";
import { ExprParser, ExprParserConsumer, ExprParserError } from "./exprParser";
import { AsmFunctions } from "./functions";
import { Assign, ExprContext, ExprEval, InstrBase } from "./instructions";


export type IdentifierProvider = (name: string) => { assignment: Assign | null };


export class ExprMaker implements ExprParserConsumer {

    private parser: ExprParser;
    private instr: InstrBase;

    constructor(private identifierProvider: IdentifierProvider) {
        this.parser = new ExprParser(this);
        this.instr = allowTemporaryNull as InstrBase;
    }

    public makeOptionalExpression(instr: InstrBase, arg: string): ExprEval | null {
        let res = this.makeExpressions(instr, arg);
        return res.length == 1 ? res[0] : null;
    }

    public makeSingleExpression(instr: InstrBase, arg: string): ExprEval {
        return this.makeExpressions(instr, arg)[0];
    }

    public makeExpressions(instr: InstrBase, args: string): ExprEval[] {
        this.instr = instr;
        let res: ExprEval[];
        try {
            res = this.parser.parse(args);
        } catch (ex) {
            if (ex instanceof ExprParserError) {
                throw new CompilerError(instr.lineNumber, `${ex.message}`);
            } else {
                throw ex;
            }
        }
        let info = instr.info;
        if (info.args === null) {
            throw new Error('Internal error');
        }
        if (res.length < info.args[0] || res.length > info.args[1]) {
            throw new CompilerError(instr.lineNumber, `Invalid number of arguments`);
        }
        return res;
    }

    onParserIdExpr(id: string): ExprEval {
        let proxy = this.identifierProvider(id);
        if (proxy.assignment !== null) {
            let assignment = proxy.assignment;
            return (ctx: ExprContext) => assignment.getValue(ctx);
        } else {
            return (ctx: ExprContext) => (proxy.assignment as Assign).getValue(ctx);
        }
    }

    onParserCallExpr(name: string, args: ExprEval[]): ExprEval {
        return AsmFunctions.createExpr(this.instr, name, args);
    }

    onParserNumberExpr(valueStr: string): ExprEval {
        let valueBig = BigInt(valueStr);
        let value64 = valueBig & 0xFFFFFFFFFFFFFFFFn;
        if (value64 != valueBig) {
            throw new CompilerError(this.instr.lineNumber, `Integer literal out of range!`);
        }
        return () => value64;
    }

    onParserTernaryExpr(a: ExprEval, b: ExprEval, c: ExprEval): ExprEval {
        return this.onParserCallExpr('if', [a, b, c]);
    }

    onParserOrExpr(a: ExprEval, b: ExprEval): ExprEval {
        return this.onParserCallExpr('if', [a, a, b]);
    }

    onParserAndExpr(a: ExprEval, b: ExprEval): ExprEval {
        return this.onParserCallExpr('if', [this.onParserNotExpr(a), a, b]);
    }

    onParserBitOrExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) | b(ctx);
    }

    onParserBitXorExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) ^ b(ctx);
    }

    onParserBitAndExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) & b(ctx);
    }

    onParserEqExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) == b(ctx) ? 1n : 0n;
    }

    onParserNeExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) != b(ctx) ? 1n : 0n;
    }

    onParserLtExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) < b(ctx) ? 1n : 0n;
    }

    onParserGtExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) > b(ctx) ? 1n : 0n;
    }

    onParserLeExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) <= b(ctx) ? 1n : 0n;
    }

    onParserGeExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) >= b(ctx) ? 1n : 0n;
    }

    onParserShlExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => (a(ctx) << b(ctx)) & 0xFFFFFFFFFFFFFFFFn;
    }

    onParserShrExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => a(ctx) >> b(ctx);
    }

    onParserAddExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => (a(ctx) + b(ctx)) & 0xFFFFFFFFFFFFFFFFn;
    }

    onParserSubExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => (a(ctx) - b(ctx)) & 0xFFFFFFFFFFFFFFFFn;
    }

    onParserMulExpr(a: ExprEval, b: ExprEval): ExprEval {
        return ctx => (a(ctx) * b(ctx)) & 0xFFFFFFFFFFFFFFFFn;
    }

    onParserDivExpr(a: ExprEval, b: ExprEval): ExprEval {
        let instr = this.instr as InstrBase;
        return ctx => a(ctx) / instr.compiler.checkDiv0(instr, ctx, b);
    }

    onParserModExpr(a: ExprEval, b: ExprEval): ExprEval {
        let instr = this.instr as InstrBase;
        return ctx => a(ctx) % instr.compiler.checkDiv0(instr, ctx, b);
    }

    onParserMinusExpr(a: ExprEval): ExprEval {
        return ctx => -a(ctx) & 0xFFFFFFFFFFFFFFFFn;
    }

    onParserNotExpr(a: ExprEval): ExprEval {
        return ctx => (a(ctx) == 0n) ? 1n : 0n;
    }

    onParserBitNotExpr(a: ExprEval): ExprEval {
        return ctx => a(ctx) ^ 0xFFFFFFFFFFFFFFFFn;
    }

};
