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

import { WasmEntity, WasmModule } from './wasmModule';


const TRIVM_THIS_MODULE_NAME = '__trivm_this_module__';


export class ModuleMerger {

    private counter = 0;

    public constructor(
        public mainModule: WasmModule
    ) {
        this.setExportedModuleName(mainModule, '__main__');
        this.orderAllEntities();
    }

    private resolveThisModule(module: WasmModule, name: string): void {
        let all = [...module.functions, ...module.tables, ...module.memories, ...module.globals];
        for (let entity of all) {
            if (entity.import && entity.import.module == TRIVM_THIS_MODULE_NAME) {
                entity.import.module = name;
            }
        }
    }

    private orderAllEntities() {
        this.orderEntities(this.mainModule.functions);
        this.orderEntities(this.mainModule.memories);
        this.orderEntities(this.mainModule.tables);
        this.orderEntities(this.mainModule.globals);
        for (let i = 0; i < this.mainModule.functions.length; i++) {
            this.mainModule.functions[i].name = `$_function_${i}`;
        }
    }

    private orderEntities(entities: WasmEntity[]) {
        for (let i = 0; i < entities.length; i++) {
            entities[i].index = i;
        }
    }

    private setExportedModuleName(module: WasmModule, name: string) {
        let all = [...module.functions, ...module.tables, ...module.memories, ...module.globals];
        for (let entity of all) {
            for (let exp of entity.exports) {
                exp.module = name;
            }
        }
        this.resolveThisModule(module, name);
    }

    public merge(module: WasmModule, name?: string) {
        let all = [...module.memories, ...module.data, ...module.tables, ...module.elements, ...module.globals];
        for (let entity of all) {
            entity.deleted = true; // TODO: add checks in other files if we are referencing deleted entities
        }
        this.setExportedModuleName(module, name || `__unnamed__module${this.counter}`);
        this.mainModule.functions.push(... module.functions);
        this.counter++;
        this.orderAllEntities();
    }

}
