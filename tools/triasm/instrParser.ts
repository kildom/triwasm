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

import { CompilerError } from './errors';
import { instrInfoByName, BASE } from './instrInfo';


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


export interface InstrParserConsumer {
    onParserLine(lineNumber: number): void;
    onParserLabel(name: string): void;
    onParserAssign(name: string, value: string): void;
    onParserInstr(id: number, args: string, base: BASE): void;
}


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


export function instrParse(input: string, consumer: InstrParserConsumer): void {
    let line = 1;
    let offset = 0;
    for (let m of input.matchAll(reLine)) {
        consumer.onParserLine(line);
        if (input.substring(offset, m.index).trim() !== '') {
            throw new CompilerError(line, `Syntax error!`);
        }
        offset = (m.index as number) + m[0].length;
        if (m[1] === undefined) {
            // skip comments and empty lines
        } else if (m[2] !== undefined) {
            consumer.onParserLabel(m[1]);
        } else if (m[3] !== undefined) {
            consumer.onParserAssign(m[1], m[3]);
        } else {
            let name = m[1].toUpperCase();
            let info = instrInfoByName[name];
            if (!info) {
                throw new CompilerError(line, `Invalid instruction name!`);
            }
            let args: string | undefined = m[4];
            let base = BASE.ZERO;
            if (args === undefined) {
                args = '';
            } else if (info.withBase) {
                [base, args] = parseBase(args);
            }
            args = args.trim();
            consumer.onParserInstr(info.id, args, base);
        }
        line++;
    }
    if (input.substring(offset, input.length).trim() !== '') {
        throw new CompilerError(line, `Syntax error!`);
    }
}

