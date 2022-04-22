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


/*
parse(`
read8s [SP] - 

`, {
    onParserLabel: (l, n) => console.log(`${l} LABEL ${n}`),
    onParserAssign: (l, n, v) => console.log(`${l} ASSIGN ${n} = ${v}`),
    onParserInstr: (l, n, a, b) => console.log(`${l} INSTR ${n} ${a === undefined ? '{/}' : a}   BASE: ${b}`),
    onParserNumberExpr: (value) => { return 'NUMBER:' + value; },
    onParserIdExpr: (name) => { return 'ID:' + name; },
    onParserOrExpr: (a, b) => { return `(${a} || ${b})`; },
    onParserAndExpr: (a, b) => { return `(${a} && ${b})`; },
    onParserBitOrExpr: (a, b) => { return `(${a} | ${b})`; },
    onParserBitAndExpr: (a, b) => { return `(${a} & ${b})`; },
    onParserBitXorExpr: (a, b) => { return `(${a} ^ ${b})`; },
    onParserEqExpr: (a, b) => { return `(${a} == ${b})`; },
    onParserNeExpr: (a, b) => { return `(${a} != ${b})`; },
    onParserLtExpr: (a, b) => { return `(${a} < ${b})`; },
    onParserGtExpr: (a, b) => { return `(${a} > ${b})`; },
    onParserLeExpr: (a, b) => { return `(${a} <= ${b})`; },
    onParserGeExpr: (a, b) => { return `(${a} >= ${b})`; },
    onParserAddExpr: (a, b) => { return `(${a} + ${b})`; },
    onParserSubExpr: (a, b) => { return `(${a} - ${b})`; },
    onParserMulExpr: (a, b) => { return `(${a} * ${b})`; },
    onParserDivExpr: (a, b) => { return `(${a} / ${b})`; },
    onParserModExpr: (a, b) => { return `(${a} % ${b})`; },
    onParserMinusExpr: (a) => { return `(-${a})`; },
    onParserCallExpr: (id, args) => { return `CALL:${id}(${args})`; },
});



console.log(instrInfoById);
console.log(instrInfoByName);
console.log(INSTR);
console.log(BASE);
*/

