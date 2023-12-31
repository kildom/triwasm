import { exhaustiveCheck } from '../common/common';
import { Conf, ConfExtensions } from '../conf/conf';
import { WasmArgs, WasmConf, WasmFaults } from './args';
import { CodeOutput } from './codeOutput';
import { FuncGenerator } from './genFunction';
import { DataKind, ElementKind, GlobalKind, NumberType, RefType, VectorType, WasmData, WasmElement, WasmFunctionKind, WasmGlobal, WasmModule, WasmTable, valueTypeWords } from './wasmModule';

const WASM_MEM_PAGE_SIZE = 65536;

enum DataLocation {
    DELETED, /// Data was deleted, do not use it
    ACTIVE,  /// In memory initialization table
    PASSIVE, /// In program memory
    DYNAMIC, /// Non-const offset - in program memory, copied to data memory on startup.
}

function getLocation(data: WasmData): DataLocation {
    if (data.deleted) {
        return DataLocation.DELETED;
    } else if (data.kind === DataKind.PASSIVE) {
        return DataLocation.PASSIVE;
    } else if (data.offset?.constValue === undefined
        || (typeof data.offset.constValue !== 'number' && typeof data.offset.constValue !== 'bigint')) {
        return DataLocation.DYNAMIC;
    } else {
        return DataLocation.ACTIVE;
    }
}


export class MemoryGenerator {
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
    sph: string = '';
    gspl: string = '';
    gsph: string = '';
    amb0: string = '';

    wasmBase: number = 0;

    funcGenerator: FuncGenerator;

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

    public generate(): void {
        this.dataMemory.initOutput();
        this.programMemory.initOutput();
        this.initTable.initOutput();
        this.dynamicInit.initOutput();

        let stackSize = this.args.vmStackSize;
        if (stackSize === 'shared') {
            throw new Error('Not implemented'); // TODOv1: Implement shared stack area
        }

        let arr = this.module.memories.filter(m => !m.deleted);
        let minWasmSize: number;
        if (arr.length > 1) {
            throw new Error('Multiple memories not implemented.');
        } else if (arr.length === 1) {
            minWasmSize = arr[0].limits.min * WASM_MEM_PAGE_SIZE;
        } else {
            minWasmSize = 0;
        }

        let globalBase = this.args.globalBase;
        let totalSize = this.vmConf.memory.min;

        this.wasmBase = stackSize - globalBase;

        if (this.wasmBase + minWasmSize > totalSize) {
            throw new Error(`Data exceeds VM memory size. Required ${this.wasmBase + minWasmSize}, available ${totalSize}`);
        }

        this.sph = `${stackSize - 4} - $_fault_handler_stack_size`;
        this.gspl = '0';
        this.gsph = '0xFFFFFFFF';
        this.amb0 = '0x' + (BigInt(this.wasmBase) & 0xFFFFFFFFn).toString(16);

        let activeBegin = 0x80000000;
        let activeEnd = 0;

        for (let data of this.module.data.filter(d => getLocation(d) === DataLocation.ACTIVE)) {
            let offset = Number(data.offset?.constValue);
            activeBegin = Math.min(activeBegin, offset);
            activeEnd = Math.max(activeEnd, offset + data.content.length);
        }

        if (activeEnd > activeBegin) {
            let activeSize = activeEnd - activeBegin;
            let buffer = new Uint8Array(activeSize);
            for (let data of this.module.data.filter(d => getLocation(d) === DataLocation.ACTIVE)) {
                let offset = Number(data.offset?.constValue);
                buffer.set(data.content, offset - activeBegin);
            }
            let activeBeginVma = stackSize - this.wasmBase + activeBegin;
            let firstBlockSkip = ` + (${activeBeginVma} - $_vm_stack_start)`;
            let skipTotal = 0;
            let index = 0;
            let part = new Uint8Array(255);
            let partLength = 0;
            while (index < buffer.length) {
                if (partLength === part.length || (buffer[index] === 0
                    && (index + 1 >= buffer.length || buffer[index + 1] === 0)
                    && (index + 2 >= buffer.length || buffer[index + 2] === 0)
                    /*&& (index + 3 >= buffer.length || buffer[index + 3] === 0)*/)) {
                    if (partLength > 0) {
                        skipTotal = this.outputBlock(part, partLength, skipTotal, firstBlockSkip);
                        partLength = 0;
                        firstBlockSkip = '';
                    }
                    while (index < buffer.length && buffer[index] === 0) {
                        skipTotal++;
                        index++;
                    }
                } else {
                    part[partLength++] = buffer[index++];
                }
            }
            if (partLength > 0) {
                skipTotal = this.outputBlock(part, partLength, skipTotal, firstBlockSkip);
            }
        }

        for (let data of this.module.data.filter(d => getLocation(d) === DataLocation.PASSIVE)) {
            this.programMemory.output([
                '.begin discardable',
                `$_data_${data.index} = vma()`,
                `$_data_${data.index}_size = ${data.content.length}`,
                `.data8 ${data.content.join(', ')}`,
                '.end']);
        }

        for (let data of this.module.data.filter(d => getLocation(d) === DataLocation.DYNAMIC)) {
            throw new Error('Not implemented');
        }

    }

    outputBlock(part: Uint8Array, partLength: number, skipTotal: number, firstBlockSkip: string) {
        let zeros = 0;
        while (partLength > 1 && part[partLength - 1] === 0) {
            zeros++;
            partLength--;
        }
        let dataJoined = partLength > 0 ? ', ' + part.slice(0, partLength).join(', ') : '';
        this.initTable.output(
            (skipTotal > 253 || firstBlockSkip ? `.data8 255\n.data32 ${skipTotal}${
                firstBlockSkip}\n.data8 ` : `.data8 ${skipTotal}, `) +
            `${partLength}${dataJoined}`);
        return zeros;
    }
}


// Calculate WASM memory location
// Place active and passive data
// Calculate stack limits (both vm and guest)
