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


export class Template {

    private func: Function;

    constructor(text: string) {
        let source = `
            let __r = "";
            function print(x) {
                __r += x;
            }
            with (__arg || {}) {
                %>${text}<%
            }
            return __r;`;
        source = source.replace(/%>([\s\S]*?)<%(=)?/g, (_, literal: string, isPrint?: string) => {
            return '; __r += ' + JSON.stringify(literal) + ';\n' + (isPrint ? '__r += ' : '');
        });
        this.func = new Function('__arg', source);
    }

    public render(arg?: any) {
        return this.func(arg);
    }

    public dump() {
        console.log(this.func.toString());
    }
}
