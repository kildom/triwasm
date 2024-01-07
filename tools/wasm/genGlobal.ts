import { exhaustiveCheck } from '../common/common';
import { Conf, ConfExtensions } from '../conf/conf';
import { WasmArgs, WasmConf, WasmFaults } from './args';
import { CodeOutput } from './codeOutput';
import { FuncGenerator } from './genFunction';
import { GlobalKind, NumberType, RefType, VectorType, WasmFunctionKind, WasmGlobal, WasmModule, valueTypeWords } from './wasmModule';


enum GlobalLocation {
    DELETED,
    PROGRAM,
    INTERFACE, // TODOv2: handle import/export globals
    STATIC_INIT,
    DYNAMIC_INIT,
    GSP, // TODOv2: implement guest stack pointer handling
}

export class GlobalsGenerator {
    // Configuration
    args: WasmArgs;
    faults: WasmFaults;
    vmConf: Conf;
    extensions: ConfExtensions;

    // Outputs
    dataMemory = new CodeOutput();
    programMemory = new CodeOutput();
    dynamicInit = new CodeOutput();

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

    public getLocation(global: WasmGlobal): GlobalLocation {
        let internal = (global.exports.length === 0 && global.import === undefined);
        let dynamicInit = global.expr && global.expr.constValue === undefined;
        if (global.deleted) {
            return GlobalLocation.DELETED;
        } else if (internal && global.kind === GlobalKind.CONST && global.expr && !dynamicInit) {
            return GlobalLocation.PROGRAM;
        } else if (dynamicInit) {
            return GlobalLocation.DYNAMIC_INIT;
        } else {
            return GlobalLocation.STATIC_INIT;
        }
    }

    public generate(): void {
        this.dataMemory.initOutput();
        this.programMemory.initOutput();
        this.dynamicInit.initOutput();

        // Program memory immutable globals
        for (let global of this.module.globals.filter(g => this.getLocation(g) === GlobalLocation.PROGRAM)) {
            // Simply put global into discardable block.
            let words = valueTypeWords(global.type);
            this.programMemory.output([
                '.begin discardable',
                `$_global_${global.index} = vma()`,
                `.data${32 * words} ${global.expr?.constValue}`,
                '.end']);
        }

        // Statically initialized globals
        for (let global of this.module.globals.filter(g => this.getLocation(g) === GlobalLocation.STATIC_INIT)) {
            // TODO: Imported globals (that has no 'expr') should not be overridden by the startup code.
            let value = global.expr ? global.expr.constValue : '0';
            let words = valueTypeWords(global.type);
            // Put global into discardable block of data memory and reference discardable block responsible for initializing.
            this.dataMemory.output([
                '.begin discardable',
                `$_global_${global.index} = vma()`,
                `.data${32 * words} 0`,
                `.ref $_global_${global.index}_init`,
                '.end']);
            // Put initial value into part of memory init table
            this.dataMemory.output([
                `..part discardable ${4 * words}`,
                `$_global_${global.index}_init:`,
                `.data${32 * words} ${value}`,
                '..end']);
        }

        // Dynamically initialized globals
        for (let global of this.module.globals.filter(g => this.getLocation(g) === GlobalLocation.DYNAMIC_INIT)) {
            let words = valueTypeWords(global.type);
            if (global.expr?.kind !== WasmFunctionKind.WASM) {
                throw new Error('Internal error: Only WASM functions can be initializers.');
            }
            // Put global into discardable block of data memory and reference discardable block responsible for initializing.
            this.dataMemory.output([
                `$_global_${global.index}_begin = vma()`,
                '.begin discardable',
                `$_global_${global.index} = vma()`,
                `.data${32 * words} 0`,
                `.ref $_global_${global.index}_init`,
                '.end',
                `$_global_${global.index}_end = vma()`]);
            // Skip this data in memory init table because it will be initialized separately
            this.dataMemory.output(`..skip ${4 * words}, $_global_${global.index}_end - $_global_${global.index}_begin`);
            // Start initialization block
            this.dynamicInit.output([
                '.begin discardable',
                `$_global_${global.index}_init:`]);
            // Inline initialization function code
            let funcCode = this.funcGenerator.generate(true, global.expr, true);
            this.dynamicInit.outputRaw(funcCode);
            // Write function return value to global and end the block
            if (words === 1) {
                this.dynamicInit.output(`WRITE32 $_global_${global.index}`);
            } else if (this.conf.vmConf.extensions.mem64) {
                this.dynamicInit.output(`WRITE64 $_global_${global.index}`);
            } else {
                this.dynamicInit.output([
                    `WRITE32 $_global_${global.index} + 4`,
                    `WRITE32 $_global_${global.index}`]);
            }
            this.dynamicInit.output('.end');
        }
    }
}
