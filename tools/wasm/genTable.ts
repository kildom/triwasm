import { exhaustiveCheck } from '../common/common';
import { Conf, ConfExtensions } from '../conf/conf';
import { WasmArgs, WasmConf, WasmFaults } from './args';
import { CodeOutput } from './codeOutput';
import { FuncGenerator } from './genFunction';
import { ElementKind, GlobalKind, NumberType, RefType, VectorType, WasmElement, WasmFunctionKind, WasmGlobal, WasmModule, WasmTable, valueTypeWords } from './wasmModule';


enum TableKind {
    DELETED,
    CONST,    /// All elements are constant and statically initialized, placed in program memory.
    FIXED,    /// Fixed size table, with mutable elements
    GROWABLE, /// Growable
}

function getOffset(element: WasmElement): number {
    let value = element.offset?.constValue;
    if (value === undefined) {
        return 1000000000;
    } else if (typeof value === 'number') {
        return value;
    } else if (typeof value === 'bigint') {
        return Number(value);
    } else if (typeof value === 'string') {
        // TODOv2: This can be caused by invalid WASM module file, so handle this error correctly.
        throw new Error('Unexpected type for the offset value.');
    } else {
        exhaustiveCheck(value);
        return 0;
    }
}


export class TablesGenerator {
    // Configuration
    args: WasmArgs;
    faults: WasmFaults;
    vmConf: Conf;
    extensions: ConfExtensions;

    // Outputs
    dataMemory = new CodeOutput();
    programMemory = new CodeOutput();
    initTable = new CodeOutput();
    dynamicInit = new CodeOutput();

    funcGenerator: FuncGenerator;
    dynamicInitSet = new Set<WasmTable>();
    elementsMap = new Map<WasmTable | null, WasmElement[]>();

    constructor(
        public module: WasmModule,
        public conf: WasmConf,
    ) {
        this.args = conf.args;
        this.faults = conf.faults;
        this.vmConf = conf.vmConf;
        this.extensions = conf.vmConf.extensions;
        this.funcGenerator = new FuncGenerator(this.module, this.conf);
    }

    public getKind(table: WasmTable): TableKind {
        let dynamic = this.dynamicInitSet.has(table);
        if (table.deleted) {
            return TableKind.DELETED;
        } else if (!dynamic && !table.growable && !table.mutable) {
            return TableKind.CONST;
        } else if (!table.growable) {
            return TableKind.FIXED;
        } else {
            return TableKind.GROWABLE;
        }
    }

    public generate(): void {
        this.dataMemory.initOutput();
        this.initTable.initOutput();
        this.dynamicInit.initOutput();

        for (let element of this.module.elements) {
            // Create mapping table and elements
            let table = element.table || null;
            if (!this.elementsMap.has(table)) {
                this.elementsMap.set(table, [element]);
            } else {
                this.elementsMap.get(table)!.push(element);
            }
            // Determine which table has dynamic initialization
            if (element.kind === ElementKind.ACTIVE && !element.deleted && element.table) {
                if (element.offset?.constValue === undefined) {
                    this.dynamicInitSet.add(element.table);
                } else {
                    for (let item of element.items) {
                        if (item.constValue === undefined) {
                            this.dynamicInitSet.add(element.table);
                            break;
                        }
                    }
                }
            }
        }

        // Sort elements by offset
        for (let [, elements] of this.elementsMap) {
            elements.sort((a, b) => getOffset(a) - getOffset(b));
        }

        let lengthBits = this.conf.smallDataModel ? 16 : 32;

        // Program memory tables
        for (let table of this.module.tables.filter(t => this.getKind(t) === TableKind.CONST)) {
            let elementBits = table.type === RefType.FUNCREF && this.conf.smallProgramModel ? 16 : 32;
            let initValue = table.type === RefType.FUNCREF ? '$_trigger_null_call' : '0';
            let length = table.limits.min;
            let elements = this.elementsMap.get(table) || [];
            for (let element of elements) {
                length = Math.max(length, getOffset(element) + element.items.length);
            }
            let tableItems: string[] = new Array(length);
            tableItems.fill(initValue);
            for (let element of elements) {
                let offset = getOffset(element);
                for (let i = 0; i < element.items.length; i++) {
                    tableItems[offset + i] = element.items[i].constValue!.toString();
                }
            }
            this.programMemory.output([
                '.begin discardable',
                `$_table_${table.index} = vma()`,
                `.data${lengthBits} ${length}`,
                `.data${elementBits} ${tableItems.join(', ')}`,
                '.end']);
        }

        for (let table of this.module.tables.filter(t => this.getKind(t) === TableKind.GROWABLE)) {
            // TODOv2: put table pointers
            throw new Error('Not implemented');
        }

        for (let table of this.module.tables.filter(t => this.getKind(t) === TableKind.FIXED)) {
            // TODOv1: put fixed tables
            throw new Error('Not implemented');
        }

        for (let table of this.module.tables.filter(t => this.getKind(t) === TableKind.GROWABLE)) {
            // TODOv2: put growable tables
            throw new Error('Not implemented');
        }

        for (let element of this.module.elements.filter(t => t.kind === ElementKind.PASSIVE)) {
            // TODOv2: implement passive table elements
            throw new Error('Not implemented');
        }
    }
}
