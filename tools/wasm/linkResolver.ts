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

import { Conf, ConfFunction, ConfInterfaceDirection } from '../conf/conf';
import { WasmFunctionKind, WasmModule } from './wasmModule';


export class LinkResolver {

    public constructor(
        public conf: Conf) { }

    public resolve(module: WasmModule) {
        this.resolveInternalLinks(module);
        this.resolveHostLinks(module);
    }

    private resolveHostLinks(module: WasmModule) {
        let hostFunctions = this.conf.functions;
        let doneExports = new Set<ConfFunction>();

        // Link functions to its host destination
        for (let func of module.functions) {
            if (func.kind == WasmFunctionKind.IMPORT) {
                for (let hostFunction of hostFunctions) {
                    if (hostFunction.direction == ConfInterfaceDirection.IMPORT && hostFunction.module === func.import?.module &&
                        hostFunction.name === func.import?.name) {
                        if (hostFunction.params.length !== func.type.params.length
                            || hostFunction.results.length !== func.type.results.length
                            || !hostFunction.params.every((p, i) => p.type === func.type.params[i])
                            || !hostFunction.results.every((p, i) => p.type === func.type.results[i])) {
                            throw new Error(`Mismatching parameters of import ${hostFunction.fullName}.`);
                        }
                        func.kind = WasmFunctionKind.HOST;
                        func.data = hostFunction.index.toString();
                        break;
                    }
                }
                if (func.kind == WasmFunctionKind.IMPORT) {
                    throw new Error(`Missing module import ${func.import?.module}.${func.import?.name}.`);
                }
            } else {
                for (let exp of func.exports) {
                    for (let hostFunction of hostFunctions) {
                        if (hostFunction.direction == ConfInterfaceDirection.EXPORT && hostFunction.name === exp.name) {
                            if (doneExports.has(hostFunction)) {
                                throw new Error(`Function exported two times as ${hostFunction.fullName}.`);
                            }
                            if (hostFunction.params.length !== func.type.params.length
                                || hostFunction.results.length !== func.type.results.length
                                || !hostFunction.params.every((p, i) => p.type === func.type.params[i])
                                || !hostFunction.results.every((p, i) => p.type === func.type.results[i])) {
                                throw new Error(`Mismatching parameters of export ${hostFunction.fullName}.`);
                            }
                            func.hostExportIndex = hostFunction.index;
                            doneExports.add(hostFunction);
                        }
                    }
                }
            }
        }

        // Check if all required exports have been satisfied
        for (let hostFunction of hostFunctions) {
            if (hostFunction.direction == ConfInterfaceDirection.EXPORT && !doneExports.has(hostFunction)) {
                throw new Error(`Unsatisfied export ${hostFunction.fullName}.`);
            }
        }
    }

    private resolveInternalLinks(module: WasmModule) {
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
                        throw new Error('Circular link.');
                    }
                    visited.add(dest);
                    dest = dest?.resolved;
                }
                func.resolved = dest;
            }
        }
    }

}

