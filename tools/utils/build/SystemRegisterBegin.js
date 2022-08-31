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


const System = (function () {
    const System = {};
    const modules = {};
    function execModule(module) {
        if (module.__executed__) {
            return;
        }
        module.__executed__ = true;
        for (let dep of module.__deps__) {
            if (dep in modules) {
                execModule(modules[dep]);
            }
        }
        module.__execute__();
        delete module.__execute__;
    }
    System.register = function (name, deps, declare) {
        let module = {
            __deps__: deps,
            __declare__: declare,
            __executed__: false,
        };
        module.__exports__ = function (name, value) {
            module[name] = value;
        };
        modules[name] = module;
    };
    System.__execute__ = function () {
        for (let name in modules) {
            let module = modules[name];
            let { setters, execute } = module.__declare__(module.__exports__);
            delete module.__declare__;
            module.__setters__ = setters;
            module.__execute__ = execute;
        }
        for (let name in modules) {
            let module = modules[name];
            for (let i = 0; i < module.__deps__.length; i++) {
                let dep = module.__deps__[i];
                if (dep in modules) {
                    module.__setters__[i](modules[dep]);
                } else {
                    module.__setters__[i](require(dep));
                }
            }
            delete module.__setters__;
        }
        console.log(modules);
        for (let module of Object.values(modules).reverse()) {
            execModule(module);
        }
    };
    return System;
})();
