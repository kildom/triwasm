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

import { WasmFunctionKind, WasmModule } from "./wasmModule";


export class LinkResolver {

    public resolve(module: WasmModule) {
        // Create map of all exported functions
        for (let func of module.functions) {
            for (let exp of func.exports) {
                if (!module.exported.has(exp.module)) {
                    module.exported.set(exp.module, new Map());
                }
                module.exported.get(exp.module)!.set(exp.name, func);
            }
        }

        // Link functions to its destination if exists
        for (let func of module.functions) {
            if (func.kind == WasmFunctionKind.IMPORT) {
                let dest = module.exported.get(func.import!.module)?.get(func.import!.name);
                if (dest) {
                    func.kind = WasmFunctionKind.LINK;
                    func.resolved = dest;
                }
            }
        }

        // Follow nested links to make all links flat and detect circular dependencies
        for (let func of module.functions) {
            if (func.kind == WasmFunctionKind.LINK) {
                let visited = new Set([func]);
                let dest = func.resolved;
                while (dest?.kind === WasmFunctionKind.LINK) {
                    if (visited.has(dest)) {
                        throw new Error("Circular link.");
                    }
                    visited.add(dest);
                    dest = dest?.resolved;
                }
                func.resolved = dest;
            }
        }
    }

}

