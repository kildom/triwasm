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


import { Compiler } from './compiler';
import { ArgsParser } from '../utils/argparse';
import { platform } from '../utils/platform';

const usage = `
Usage: triasm [options] <input>

Compile triASM source code into triVM bytecode.

<input>
        The input triASM source code.

-o <file>
--output[1]=<file>
        Put output to this file.

--version:!version
        Print tool version.

--help:!help
        Print this help text.
`;

const filters = {
    version: () => {
        console.log('TODO: version'); // TODO: print version
        console.log('JavaScript runtime: ' + platform.info());
        platform.exit(0);
    }
};


class TriAsmArgs {
    public output: string = '';
    public input: string = '';
    constructor() {
        ArgsParser.parse(usage, this, filters);
    }
}

function main() {
    let args = new TriAsmArgs();
    let input:string;
    try {
        input = platform.readFile(args.input);
    } catch (ex) {
        console.log(`Cannot read "${args.input}" file: ${ex}`);
        platform.exit(1);
        return;
    }
    let c = new Compiler();
    let output = c.compile(input);
    platform.writeFile(args.output, output);
}

main();
