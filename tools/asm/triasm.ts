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


import { Compiler } from './compiler';
import { platform } from '../common/platform';
import { getAsmArgs } from './args';


function main() {
    const args = getAsmArgs();
    let input: string;
    try {
        input = args.input.readString();
    } catch (ex) {
        console.log(`Cannot read "${args.input}" file: ${ex}`);
        platform.exit(1);
        return;
    }
    let compiler = new Compiler();
    let output = compiler.compile(input);
    args.output.write(output);
}

platform.main(main);
