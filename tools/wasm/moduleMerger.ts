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

import { ModuleKind, WasmEntity, WasmFunction, WasmModule } from "./wasmModule";


export class ModuleMerger {

    public constructor(
        public mainModule: WasmModule
    ) {
        this.setExportedModuleName(mainModule, '__main__');
    }

    private setExportedModuleName(module: WasmModule, name: string) {
        let all = [...module.functions, ...module.tables, ...module.memories, ...module.globals];
        for (let entity of all) {
            for (let exp of entity.exports) {
                exp.module = name;
            }
        }
    }

    public merge(module: WasmModule, name: string) {
        let all = [...module.memories, ...module.data, ...module.tables, ...module.elements, ...module.globals];
        for (let entity of all) {
            entity.deleted = true;
        }
        this.setExportedModuleName(module, name);
        this.mainModule.functions.push(... module.functions);
    }

}
