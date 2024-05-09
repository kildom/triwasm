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

/* ws = cre.ignoreCase`
    repeat [ \t]
`*/

interface ReLineGroups {
    name?: string;
    label?: string;
    assign?: string;
    args?: string;
}

/* cre.ignoreCase.sticky`
    begin-of-line
    ${ws}
    optional {
        name: {
            [a-z_$@.]
            repeat [a-z_$@.0-9]
        }
        {
            ${ws}
            label: ":"
        } or {
            ${ws}
            "="
            assign: repeat not [\r\n#]
        } or {
            [ \t]
            args: repeat not [\r\n#]
        } or {
            // no arguments
        }
    }
    ${ws}
    optional {
        "#"
        repeat not term
    }
    (optional \r, \n) or \r or end-of-text
`*/
const reLine = /(?<=[\r\n\u2028\u2029]|^)[ \t]*(?:(?<name>[a-z_$@.][a-z_$@.0-9]*)(?:[ \t]*(?<label>:)|[ \t]*=(?<assign>[^\r\n#]*)|[ \t](?<args>[^\r\n#]*)|))?[ \t]*(?:#[^\r\n\u2028\u2029]*)?(?:\r?\n|\r|$)/isuy;

interface ReBaseRegGroups {
    all: string;
    mab?: string;
    mabPop?: string;
    pop?: string;
    popMab?: string;
    sign?: string;
}

/* cre.ignoreCase`
    begin-of-text
    all: {
        ${ws}
        {
            "[", ${ws}, "MAB", mab: [0-3], ${ws}, "]"
            optional (${ws}, "+", ${ws}, "[", ${ws}, mabPop: "POP", ${ws}, "]")
        } or {
            "[", ${ws}, pop: "POP", ${ws}, "]"
            optional (${ws}, "+", ${ws}, "[", ${ws}, "MAB", popMab: [0-3], ${ws}, "]")
        }
        ${ws}
        optional sign: [+-]
        ${ws}
    }
`*/
const reBaseReg = /^(?<all>[ \t]*(?:\[[ \t]*MAB(?<mab>[0-3])[ \t]*\](?:[ \t]*\+[ \t]*\[[ \t]*(?<mabPop>POP)[ \t]*\])?|\[[ \t]*(?<pop>POP)[ \t]*\](?:[ \t]*\+[ \t]*\[[ \t]*MAB(?<popMab>[0-3])[ \t]*\])?)[ \t]*(?<sign>[+-])?[ \t]*)/isu;


export interface InstrParserConsumer {
    onParserLabel(line: number, name: string): void;
    onParserAssign(line: number, name: string, value: string): void;
    onParserInstr(line: number, id: number, args: string, base: BASE): void;
}


function parseBase(args: string): [BASE, string] {
    let groups = args.match(reBaseReg)?.groups as ReBaseRegGroups | undefined;
    if (!groups) {
        return [BASE.MAB0, args];
    }
    args = args.substring(groups.all.length).trim();
    if (args === '') {
        args = '0';
    } else if (groups.sign === '-') {
        args = `0 - ${args}`;
    }
    let base: BASE;
    switch (groups.mab || groups.popMab) {
    default:
    case '0':
        base = BASE.MAB0;
        break;
    case '1':
        base = BASE.MAB1;
        break;
    case '2':
        base = BASE.MAB2;
        break;
    case '3':
        base = BASE.MAB3;
        break;
    }
    if (groups.pop || groups.mabPop) {
        base |= BASE.POP;
    }
    return [base, args];
}


export function instrParse(input: string, consumer: InstrParserConsumer): void {
    let line = 1;
    let re = new RegExp(reLine);
    let groups: ReLineGroups | undefined;
    while (re.lastIndex < input.length && (groups = re.exec(input)?.groups as ReLineGroups | undefined)) {
        if (!groups.name) {
            // skip empty lines
        } else {
            if (groups.label !== undefined) {
                consumer.onParserLabel(line, groups.name);
            } else if (groups.assign !== undefined) {
                if (!groups.assign.trim()) {
                    throw new CompilerError(line, 'Assigned value is empty.');
                }
                consumer.onParserAssign(line, groups.name, groups.assign.trim());
            } else {
                let name = groups.name.toUpperCase();
                let info = instrInfoByName[name];
                if (!info) {
                    throw new CompilerError(line, `Invalid instruction name "${name}"!`);
                }
                let args: string | undefined = groups.args?.trim() || '';
                let base = BASE.MAB0;
                if (info.instrOptions.withBase) {
                    [base, args] = parseBase(args);
                    args = args.trim();
                }
                consumer.onParserInstr(line, info.id, args, base);
            }
        }
        line++;
    }
    if (re.lastIndex != input.length) {
        throw new CompilerError(line, 'Syntax error!');
    }
}

