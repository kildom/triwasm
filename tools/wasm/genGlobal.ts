import { exhaustiveCheck } from '../common/common';
import { Conf, ConfExtensions } from '../conf/conf';
import { WasmArgs, WasmConf, WasmFaults } from './args';
import { CodeOutput } from './codeOutput';
import { FuncGenerator } from './genFunction';
import { GlobalKind, NumberType, RefType, VectorType, WasmFunctionKind, WasmGlobal, WasmModule, valueTypeWords } from './wasmModule';


export class GlobalsGenerator {
    // Configuration
    args: WasmArgs;
    faults: WasmFaults;
    vmConf: Conf;
    extensions: ConfExtensions;

    // Outputs
    placementConstInit = new CodeOutput();
    placementDynamicInit = new CodeOutput();
    placementProgram = new CodeOutput();
    constInit = new CodeOutput();
    dynamicInit = new CodeOutput();

    funcGenerator:FuncGenerator;

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
        this.placementConstInit.initOutput();
        this.placementDynamicInit.initOutput();
        this.placementProgram.initOutput();
        this.constInit.initOutput();
        this.dynamicInit.initOutput();
        // TODO: Allocate import/export globals at their location first.
        for (let global of this.module.globals) {
            let words = valueTypeWords(global.type);
            if (words > 2) {
                throw new Error('Not implemented');
            }
            let internal = (global.exports.length === 0 && global.import === undefined);
            let dynamicInit = global.expr && global.expr.constValue === undefined;
            if (internal && global.kind === GlobalKind.CONST && global.expr && !dynamicInit) {
                this.generateProgramGlobal(global, words);
            } else {
                let placement = dynamicInit ? this.placementDynamicInit : this.placementConstInit;
                placement.output([
                    `$_global_${global.index}_weak:`,
                    '.begin discardable',
                    `$_global_${global.index}:`,
                    words === 1 ? '.data32 0' : '.data64 0',
                    `.ref $_global_${global.index}_init`,
                    '.end']);
                if (dynamicInit) {
                    this.dynamicInit.output([
                        '.begin discardable',
                        `$_global_${global.index}_init:`]);
                    if (global.expr?.kind !== WasmFunctionKind.WASM) {
                        throw new Error('Internal error: Only WASM functions can be initializers.');
                    }
                    let funcCode = this.funcGenerator.generate(true, global.expr, true);
                    this.dynamicInit.outputRaw(funcCode);
                    this.dynamicInit.output('.end');
                } else {
                    // TODO: Imported globals (that has no 'expr') should not be overridden by the startup code.
                    let value = global.expr ? global.expr.constValue : '0';
                    this.constInit.output([
                        '.begin discardable',
                        `$_global_${global.index}_init:`,
                        words === 1 ? `.data32 ${value}` : `.data64 ${value}`,
                        '.end']);
                }
            }
        }
    }

    generateProgramGlobal(global: WasmGlobal, words: number) {
        this.placementProgram.output([
            '.begin discardable',
            `$_global_${global.index}:`]);
        if (words === 1) {
            this.placementProgram.output(`.word32 ${global.expr?.constValue}`);
        } else {
            this.placementProgram.output(`.word64 ${global.expr?.constValue}`);
        }
        this.placementProgram.output('.end');
    }

}