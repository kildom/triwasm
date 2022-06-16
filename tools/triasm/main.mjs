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

import { Compiler } from './compiler.mjs';

import * as fs from 'fs';


class Conf {
    constructor() {
        this.extI64 = false;
        this.extMem64 = false;
        this.extUnwind = true;
        this.extF32 = false;
        this.extF64 = false;
    }
};


let conf = new Conf();
let c = new Compiler();

let src = fs.readFileSync('_test.triasm', { encoding: 'utf-8' });
let b = c.compile(src, conf);
fs.writeFileSync('_test.tvmb', b);
