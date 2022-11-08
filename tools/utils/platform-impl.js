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

const _triwasm_platform_impl =

/* ------------------------------------ Node.js ------------------------------------ */
(typeof(process) == 'object' && typeof(process.versions) == 'object' && typeof(process.versions.node) == 'string') ?
(function() {
    const platform = {};

    const fs = require('fs');

    platform.getArgv = function() {
        return process.argv.slice(2);
    };

    platform.exit = function(code) {
        process.exit(code || 0);
    };

    return platform;
})():

/* ------------------------------------ Deno ------------------------------------ */
(typeof(Deno) == 'object' && typeof(Deno.version) == 'object' && typeof(Deno.version.deno) == 'string') ?
(function() {
    const platform = {};

    platform.getArgv = function() {
        return Deno.args;
    };

    platform.exit = function(code) {
        Deno.exit(code || 0);
    };

    return platform;
})():

/* ------------------------------------ QuickJS ------------------------------------ */
(typeof(scriptArgs) == 'object' && typeof(os) == 'object' && typeof(std) == 'object' && typeof(os.S_IFIFO) == 'number') ?
(function() {
    const platform = {};

    platform.getArgv = function() {
        return scriptArgs.slice(1);
    };

    platform.exit = function(code) {
        std.exit(code || 0);
    };

    if (typeof(console.error) === 'undefined') {
        console.error = function(...args) {
            let str = args.map(x => x.toString()).join(' ');
            std.err.puts(str + '\n');
        }
    }

    return platform;
})():

/* ------------------------------------ Unknown platform ------------------------------------ */
(function() {
    throw new Error('Unknown platform');
})();

if (typeof(exports) === 'object') {
    exports._triwasm_platform_impl = _triwasm_platform_impl;
}
