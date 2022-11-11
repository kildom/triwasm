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

/* TODO: Rename to InstrParser and:
 * It will parse only instructions and BASE. Arguments will be returned as a string.
 * The output object will be responsible for parsing arguments.
 * This will allow parsing expressions when instruction object is already created,
 * so ExprEval functions can have instruction in its closure (instead of context).
 * 
 * Reconsider renaming "output object" to "consumer".
 */

import { instrInfoByName, BASE, InstrInfo } from './instrInfo';
import { ExprParser, ExprParserError, ExprParserOutput } from './exprParser';

/* reLine decoding:
 *     #empty       # no group
 *     label:       # group 1+2
 *     assign = 123 # group 1+3
 *     instr 123    # group 1+4
 *     no_arg_instr # group 1
 */
const reLine = /^[ \t]*(?:([a-z_\$@\.][a-z_\$@\.0-9]*)[ \t]*(?:(:)[ \t]*|=[ \t]*([^\r\n# \t][^\r\n#]*)|[ \t]([^\r\n# \t:=][^\r\n#]*)|))?(?:#.*)?$/gmi;

/* reBaseReg groups:
 *     1: AMBn if AMBn
 *     2: POP if AMBn
 *     3: SP if SP
 *     4: POP if SP
 *     5: POP if just POP
 *     6: arg sign: '+', '-', or empty
 */
const reBaseReg = /^(?:\[\s*(AMB0|AMB1)\s*\]\s*(?:\+\s*\[\s*(POP)\s*\])?|\[\s*(SP)\s*\]\s*(?:\-\s*\[\s*(POP)\s*\])?|\[\s*(POP)\s*\])\s*(\+|-|$)\s*/i;


export class ParserError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ParserError";
    }
};


function parseBase(args: string): [BASE, string] {
    let m = args.match(reBaseReg);
    if (m === null) {
        return [BASE.ZERO, args];
    }
    args = args.substring(m[0].length).trim();
    if (args === '') {
        args = '0';
    } else if (m[6] === '-') {
        args = `0 - ${args}`;
    }
    let base: BASE;
    switch ((m[1] || m[3] || '').toUpperCase()) {
        case 'AMB0': base = BASE.AMB0; break;
        case 'AMB1': base = BASE.AMB1; break;
        case 'SP': base = BASE.SP; break;
        default: base = BASE.ZERO; break;
    }
    if (m[2] || m[4] || m[5]) {
        base |= BASE.POP;
    }
    return [base, args];
}


export interface ParserOutput extends ExprParserOutput {
    onParserLine(lineNumber: number): void;
    onParserLabel(name: string): void;
    onParserAssign(name: string, value: any): void;
    onParserInstr(id: number, args: any[] | string, base: BASE): void;
}


export function parse(input: string, outputObject: ParserOutput): void {
    let exprParser = new ExprParser(outputObject);
    let line = 1;
    let offset = 0;
    try {
        for (let m of input.matchAll(reLine)) {
            outputObject.onParserLine(line);
            if (input.substring(offset, m.index).trim() !== '') {
                throw new ParserError(`${line}: Syntax error!`);
            }
            offset = (m.index as number) + m[0].length;
            if (m[1] === undefined) {
                // skip comments and empty lines
            } else if (m[2] !== undefined) {
                outputObject.onParserLabel(m[1]);
            } else if (m[3] !== undefined) {
                let args = exprParser.parse(m[3]);
                if (args.length != 1) {
                    throw new ParserError(`${line}: Exactly one argument allowed!`);
                }
                outputObject.onParserAssign(m[1], args[0]);
            } else {
                let name = m[1].toUpperCase();
                let info = instrInfoByName[name];
                if (!info) {
                    throw new ParserError(`${line}: Invalid instruction name!`);
                }
                let args: any[] | string = m[4];
                let base = BASE.ZERO;
                if (args === undefined) {
                    if (info.args !== null) {
                        args = [];
                        if (info.args[0] > 0) {
                            throw new ParserError(`${line}: Invalid number of arguments!`);
                        }
                    } else {
                        args = '';
                    }
                } else if (info.args !== null) {
                    if (info.withBase) {
                        [base, args] = parseBase(args);
                    }
                    args = exprParser.parse(args);
                    if (args.length < info.args[0] || args.length > info.args[1]) {
                        throw new ParserError(`${line}: Invalid number of arguments!`);
                    }
                } else {
                    args = args.trim();
                }
                outputObject.onParserInstr(info.id, args, base);
            }
            line++;
        }
        if (input.substring(offset, input.length).trim() !== '') {
            throw new ParserError(`${line}: Syntax error!`);
        }
    } catch (ex) {
        if (ex instanceof ExprParserError) {
            throw new ParserError(`${line}: Expression parsing error: ${ex.message}`);
        }
        throw ex;
    }
}

