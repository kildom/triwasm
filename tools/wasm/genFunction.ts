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

import { OP, OP_NAMES } from './opcodes';
import * as OpType from './opcodeTypes';
import { WalkFunctionListener, WalkResult, walkFunctions } from './moduleWalker2';
import {
    FunctionType,
    NumberType,
    RefType,
    ValueType,
    valueTypeWords, VectorType, WasmBlock, WasmBranchDir, WasmFunction, WasmFunctionKind, WasmInstr, WasmModule
} from './wasmModule';
import { WasmArgs, WasmConf, WasmFaults } from './args';
import { PopPushResult, getInstrPopPush } from './instrStack';
import { dedent, exhaustiveCheck, extendArray } from '../common/common';
import { Conf, ConfExtensions } from '../conf/conf';
import { CodeOutput, dumpType, dumpWords, toIntLiteral } from './codeOutput';

interface BlockData {
    stackBase: number;
    paramsWords: number;
    resultsWords: number;
}

interface InstrData {
}

enum BranchCondition {
    NONE = 'BR',
    POSITIVE = 'BRT',
    NEGATIVE = 'BRF',
}

export class FuncGenerator extends CodeOutput implements WalkFunctionListener<BlockData, InstrData> {
    // TODOv1: Separate CodeOutput object, but keep this.output() method.

    func!: WasmFunction;
    block?: WasmBlock;
    blockData?: BlockData;
    blockStack!: WasmBlock[];
    blockDataStack!: BlockData[];
    instr?: WasmInstr;
    instrData?: InstrData;
    instrIndex!: number;
    instrStack!: WasmInstr[];
    instrDataStack!: InstrData[];
    instrIndexStack!: number[];

    // Current function information
    stackSize: number = 0;
    localsOffsets: number[] = [];
    localsStartOffset: number = 0;
    frameSize: number = 0;
    returnAddressOffset: number = 0;
    localLabels: string[] = [];

    popPush?: PopPushResult;

    // Output
    outLastInstr?: WasmInstr;
    outLastPopPush?: PopPushResult;
    uniqueCounter: number = 0;

    // Configuration
    args: WasmArgs;
    faults: WasmFaults;
    vmConf: Conf;
    extensions: ConfExtensions;

    // Generating specific function
    requireFunc?: WasmFunction;
    inline?: boolean;

    constructor(
        public module: WasmModule,
        public conf: WasmConf,
    ) {
        super();
        this.args = conf.args;
        this.faults = conf.faults;
        this.vmConf = conf.vmConf;
        this.extensions = conf.vmConf.extensions;
    }

    public generate(asArray: false, func?: WasmFunction, inline?: boolean): string;
    public generate(asArray: true, func?: WasmFunction, inline?: boolean): string[];
    public generate(asArray: boolean, func?: WasmFunction, inline?: boolean): string | string[] {
        this.requireFunc = func;
        this.inline = inline;
        this.initOutput();
        walkFunctions(this);
        let res = this.getOutput(asArray);
        this.initOutput();
        return res;
    }

    public output(code: string | string[], comment?: string) {
        let out = this.out.at(-1) as string[];
        let ind = '  '.repeat(this.blockStack.length);
        if (typeof (code) === 'string') {
            code = [code];
        }
        let allComments = '';
        if (this.instr && this.instr !== this.outLastInstr) {
            allComments += ` #${this.instr.id} # ${OP_NAMES[this.instr.opcode]}`;
            this.outLastInstr = this.instr;
        }
        if (this.instr && this.popPush && this.popPush !== this.outLastPopPush) {
            allComments += ` # stack: ${dumpWords(this.stackSize)}`;
            if (this.popPush.poppedWords > 0) {
                allComments += ` - ${dumpWords(this.popPush.poppedWords)}`;
            }
            if (this.popPush.pushedWords > 0) {
                allComments += ` + ${dumpWords(this.popPush.pushedWords)}`;
            }
            if (this.popPush.poppedWords > 0 || this.popPush.pushedWords > 0) {
                let newStackSize = this.stackSize - this.popPush.poppedWords + this.popPush.pushedWords;
                allComments += ` => ${dumpWords(newStackSize)}`;
            }
            this.outLastPopPush = this.popPush;
        }
        if (comment) {
            allComments += ` # ${comment}`;
        }
        for (let line of code) {
            out.push(`${ind}${line}${allComments}\n`);
            allComments = '';
        }
    }

    private outputLocalLabel(label: string, comment?: string) {
        label = label.trim().replace(/:$/, '');
        this.localLabels.push(label);
        this.output(label + ':', comment);
    }

    private generateWasmFunc() {
        this.localsOffsets = [];
        this.frameSize = 0;

        // Function parameters
        for (let p of this.func.type.params) {
            this.localsOffsets.push(this.frameSize);
            this.frameSize += 4 * valueTypeWords(p);
        }

        // Return address
        if (!this.inline) {
            this.returnAddressOffset = this.frameSize;
            this.frameSize += 4;
        }

        // Function locals
        this.localsStartOffset = this.frameSize;
        for (let p of this.func.locals) {
            this.localsOffsets.push(this.frameSize);
            this.frameSize += 4 * valueTypeWords(p);
        }

        // Initial stack
        this.stackSize = 0;

        if (!this.inline) {
            this.output('.begin discardable');
        } else {
            this.output('.begin');
        }
        this.captureBegin();
        this.localLabels = [];
        if (!this.inline) {
            this.output(`${this.func.name}:`, `WASM function ${dumpType(this.func.type)}`);
        } else {
            this.output(`# inlined ${this.func.name}:`, `WASM function ${dumpType(this.func.type)}`);
        }
        if (this.frameSize > this.localsStartOffset) {
            let localsSize = this.frameSize - this.localsStartOffset;
            let code: string[];
            if (localsSize >= 16) {
                code = [
                    'READSP',
                    `SUB -${localsSize}`,
                    'WRITESP',
                ];
            } else {
                code = new Array(localsSize / 4).fill('READSP');
            }
            this.output(code, 'Allocate stack for locals');
        }
    }

    private generateAssemblyFunc() {
        this.output([
            '.begin discardable',
            `${this.func.name}:`,
        ], `Assembly function ${dumpType(this.func.type)}`);
        this.output(dedent(this.func.data, true));
        this.output(['.end', '']);
    }

    private getBlockData(target: WasmBlock): BlockData {
        for (let i = 0; i < this.blockStack.length; i++) {
            if (this.blockStack[i] === target) {
                return this.blockDataStack[i];
            }
        }
        throw new Error('Internal error: Block is not parent block.');
    }

    private generateUnwind(keepWords: number, skipWords: number, ret: boolean): boolean {
        if (keepWords < 0 || skipWords < 0) {
            throw new Error('Internal error: Invalid UNWIND parameters.');
        }

        if (skipWords == 0) {
            if (ret) {
                this.output('WRITE32 PC');
                return true;
            } else {
                return false;
            }
        }

        let optKey = `${keepWords},${skipWords}`;

        if (!ret && UNWIND_OPTIMIZED_CASES[optKey]) {
            this.output(UNWIND_OPTIMIZED_CASES[optKey]);
        } else if (this.extensions.unwind && skipWords <= 0x20000 && keepWords < 0x4000) {
            if (ret) {
                this.output(`UNWINDRET ${keepWords}, ${skipWords}`);
            } else {
                this.output(`UNWIND ${keepWords}, ${skipWords}`);
            }
        } else {
            let bits: string;
            if (skipWords <= 65536 && keepWords < 65536) {
                let packed: number;
                if (skipWords <= 16 && keepWords < 16) {
                    packed = toIntLiteral((skipWords - 1) | (keepWords << 4), 8);
                    bits = '8';
                } else if (skipWords <= 256 && keepWords < 256) {
                    packed = toIntLiteral((skipWords - 1) | (keepWords << 8), 16);
                    bits = '16';
                } else {
                    packed = toIntLiteral((skipWords - 1) | (keepWords << 16), 32);
                    bits = '32';
                }
                this.output(`NEG -(${packed})`);
            } else {
                this.output(`NEG -(${skipWords})`);
                this.output(`NEG -(${keepWords})`);
                bits = '';
            }
            if (ret) {
                this.output(`BR __triwasmlib_unwind${bits}_ret`);
            } else {
                this.output(`CALL __triwasmlib_unwind${bits}`);
            }
        }

        return true;
    }

    private generateBranch(target: WasmBlock, direction: WasmBranchDir | undefined, condition: BranchCondition,
        allowFallback: boolean): boolean {

        let targetData = this.getBlockData(target);
        let targetInstr = target.parentInstruction;
        let conditionDone = false;

        if (direction === undefined) {
            direction = targetInstr.opcode == OP.LOOP ? WasmBranchDir.Backward : WasmBranchDir.Forward;
        }

        let isReturn = (targetInstr.opcode == OP.TRIVM_FUNCTION);

        let keepWords: number;
        let skipWords: number;

        if (isReturn && !this.inline) {
            keepWords = valueTypeWords(this.func.type.results);
            // TODO: Add bytes/words to identifiers (this.stackSize, e.t.c.) to avoid confusion.
            skipWords = (this.frameSize / 4) + this.stackSize - keepWords;
            let returnAddrRelOffset = 4 * this.stackSize + this.frameSize - this.returnAddressOffset - 4;
            if (keepWords === 1 && this.frameSize === 8 && this.returnAddressOffset === 4) {
                this.output(['WRITE32 [SP] - 4', 'WRITE32 PC']);
            } else if (keepWords === 1 && this.frameSize === 12 && this.returnAddressOffset === 8) {
                this.output(['WRITE32 [SP] - 8', 'WRITE32 [SP]', 'WRITE32 PC']);
            } else if (keepWords === 2 && this.frameSize === 12 && this.returnAddressOffset === 8) {
                this.output(['WRITE32 [SP] - 8', 'WRITE32 [SP] - 8', 'WRITE32 PC']);
            } else if (returnAddrRelOffset === 0 && keepWords === 0 && skipWords > 0) {
                this.generateUnwind(keepWords, skipWords - 1, true);
            } else {
                this.output(`READ32 [SP] - ${returnAddrRelOffset}`);
                this.generateUnwind(keepWords, skipWords, true);
            }
        } else {
            if (isReturn) {
                keepWords = valueTypeWords(this.func.type.results);
                skipWords = (this.frameSize / 4) + this.stackSize - keepWords;
            } else {
                keepWords = valueTypeWords((direction == WasmBranchDir.Forward) ? target.type.results : target.type.params);
                skipWords = this.stackSize - targetData.stackBase - keepWords;
            }
            let unwindGenerated = this.generateUnwind(keepWords, skipWords, false);
            if (direction === WasmBranchDir.Backward) {
                if (condition !== BranchCondition.NONE && !unwindGenerated) {
                    this.output(`${condition} $_block_${target.parentInstruction.id}`);
                    conditionDone = true;
                } else {
                    this.output(`BR $_block_${target.parentInstruction.id}`);
                }
            } else {
                let skipBranch = false;
                if (allowFallback && target === this.block) {
                    let lastIndex = target.body.length - 1;
                    while (lastIndex > 0 && target.body[lastIndex]?.opcode === OP.END) {
                        lastIndex--;
                    }
                    skipBranch = (this.instrIndex === lastIndex);
                }
                if (skipBranch) {
                    this.output('# Fallback out of block');
                } else {
                    if (condition != BranchCondition.NONE && !unwindGenerated) {
                        this.output(`${condition} $_block_${target.parentInstruction.id}_end`);
                        conditionDone = true;
                    } else {
                        this.output(`BR $_block_${target.parentInstruction.id}_end`);
                    }
                }
            }
        }

        return conditionDone;
    }

    private generateIf(target: WasmBlock, direction: WasmBranchDir | undefined, condition: BranchCondition,
        allowFallback: boolean) {

        this.captureBegin();
        this.stackSize--;
        let conditionDone = this.generateBranch(target, direction, condition, allowFallback);
        this.stackSize++;
        if (!conditionDone && condition !== BranchCondition.NONE) {
            let branchCode = this.captureEndGet();
            let instrName = (condition === BranchCondition.POSITIVE) ? 'BRF' : 'BRT';
            let uid = this.uniqueCounter++;
            this.output(`${instrName} $_br_skip_${this.instr!.id}_${uid}`);
            this.outputRaw(branchCode);
            this.outputLocalLabel(`$_br_skip_${this.instr!.id}_${uid}:`);
        } else {
            this.captureEndCommit();
        }
    }

    enterFunction() {
        if (this.requireFunc && this.requireFunc !== this.func) {
            return WalkResult.SKIP_CHILDREN;
        }
        switch (this.func.kind) {
        case WasmFunctionKind.ANNOTATION:
        case WasmFunctionKind.INLINE_ASSEMBLY:
        case WasmFunctionKind.UNUSED:
        case WasmFunctionKind.LINK:
        case WasmFunctionKind.HOST:
            // This kind of function does not have body.
            // It is handled by the function invocation.
            return WalkResult.SKIP_CHILDREN;
        case WasmFunctionKind.WASM:
            this.generateWasmFunc();
            return;
        case WasmFunctionKind.ASSEMBLY:
            this.generateAssemblyFunc();
            return WalkResult.SKIP_CHILDREN;
        case WasmFunctionKind.IMPORT:
            throw new Error('Internal error: Import function should not be here.');
        default:
            exhaustiveCheck(this.func.kind);
            return;
        }
    }

    exitFunction() {
        if (this.requireFunc === this.func) {
            return WalkResult.SKIP_SIBLINGS;
        }
        switch (this.func.kind) {
        case WasmFunctionKind.ANNOTATION:
        case WasmFunctionKind.INLINE_ASSEMBLY:
        case WasmFunctionKind.UNUSED:
        case WasmFunctionKind.LINK:
        case WasmFunctionKind.HOST:
        case WasmFunctionKind.IMPORT:
        case WasmFunctionKind.ASSEMBLY:
            return;
        case WasmFunctionKind.WASM: {
            let bodyCode = this.captureEndGet();
            this.output('.local ' + this.localLabels.join(', '));
            this.outputRaw(bodyCode);
            this.output(['.end', ''], this.func.name);
            return;
        }
        default:
            exhaustiveCheck(this.func.kind);
            return;
        }
    }

    enterBlock() {
        let paramsWords = valueTypeWords(this.block!.type.params);
        let resultsWords = valueTypeWords(this.block!.type.results);
        let stackBase = this.stackSize - paramsWords;
        this.blockData = {
            stackBase,
            paramsWords,
            resultsWords,
        };
        this.outputLocalLabel(`$_block_${this.block!.parentInstruction.id}:`,
            this.block!.parentInstruction.opcode === OP.TRIVM_FUNCTION ? 'function block' :
                (paramsWords + resultsWords > 0) ? `base: ${dumpWords(stackBase)}, ${dumpWords(paramsWords)} ` +
                    `=> ${dumpWords(resultsWords)}` :
                    `base: ${dumpWords(stackBase)}`);
    }

    exitBlock() {
        this.stackSize = this.blockData!.stackBase + this.blockData!.resultsWords;
        if (this.block!.parentInstruction.opcode === OP.IF && !this.block!.parentInstruction.withElse) {
            this.outputLocalLabel(`$_block_${this.block!.parentInstruction.id}_else:`);
        }
        this.outputLocalLabel(`$_block_${this.block!.parentInstruction.id}_end:`);
    }

    enterInstr() {
        if (!this.instr) return; // just TypeScript type narrowing

        this.popPush = getInstrPopPush(this.func, this.block as WasmBlock, this.instr, undefined, true);

        switch (this.instr.opcode) {
        // ---- Generators - begin - generated with help of "wasm-instr.ts" script ----

        case OP.BLOCK: {
            this.popPush.poppedWords = 0; // Skip stack adjustment, handled by enterBlock
            this.popPush.pushedWords = 0;
            break;
        }
        case OP.LOOP: {
            this.popPush.poppedWords = 0; // Skip stack adjustment, handled by enterBlock
            this.popPush.pushedWords = 0;
            break;
        }
        case OP.IF: {
            this.popPush.poppedWords = 1; // Skip stack adjustment, handled by enterBlock
            this.popPush.pushedWords = 0;
            this.output(`BRF $_block_${this.instr.id}_else`);
            break;
        }
        case OP.ELSE: {
            this.popPush.poppedWords = 0; // Skip stack adjustment
            this.popPush.pushedWords = 0;
            this.stackSize = this.blockData!.stackBase + this.blockData!.paramsWords;
            this.output(`$_block_${this.block!.parentInstruction.id}_else:`);
            break;
        }
        case OP.END: {
            // no code to generate, handled by BR added by reducer
            break;
        }
        case OP.BR: {
            this.generateBranch(this.instr.target, this.instr.direction, BranchCondition.NONE, true);
            break;
        }
        case OP.BR_IF: {
            this.output('# br_if');
            this.generateIf(this.instr.target, this.instr.direction, BranchCondition.POSITIVE, true);
            break;
        }
        case OP.BR_TABLE: {
            this.output('# br_table');
            if (this.instr.targets.length == 2) {
                this.generateIf(this.instr.targets[0], undefined, BranchCondition.NEGATIVE, false);
            } else {
                let valueOffset = 0;
                this.output('WRITE32 GPR0');
                for (let i = 0; i < this.instr.targets.length - 1; i++) {
                    let target = this.instr.targets[i];
                    if (i - valueOffset == 128 && this.instr.targets.length - i > 4) {
                        valueOffset += 128;
                        this.output([
                            'READ32 GPR0',
                            'ADD -128',
                            'WRITE32 GPR0']);
                    }
                    this.output('READ32 GPR0');
                    if (i - valueOffset == 0) {
                        this.generateIf(target, undefined, BranchCondition.NEGATIVE, false);
                    } else {
                        this.output(`EQ ${i - valueOffset}`);
                        this.generateIf(target, undefined, BranchCondition.POSITIVE, false);
                    }
                }
            }
            this.stackSize--;
            this.popPush.poppedWords--;
            this.generateBranch(this.instr.targets.at(-1) as WasmBlock, undefined, BranchCondition.NONE, true);
            break;
        }
        case OP.CALL: {
            let target = this.instr.func.resolved;
            switch (target.kind) {
            case WasmFunctionKind.ANNOTATION:
                this.output(`.pragma ${target.data}`);
                break;
            case WasmFunctionKind.ASSEMBLY:
            case WasmFunctionKind.WASM:
                this.output(`CALL ${target.name}`);
                break;
            case WasmFunctionKind.INLINE_ASSEMBLY:
                this.output(dedent(target.data, true));
                break;
            case WasmFunctionKind.HOST:
                this.output(`HOST ${target.data}`);
                break;
            case WasmFunctionKind.IMPORT:
            case WasmFunctionKind.UNUSED:
            case WasmFunctionKind.LINK:
                throw new Error('Internal error: Unexpected kind of function called.');
            default:
                exhaustiveCheck(target.kind);
                break;
            }
            break;
        }
        case OP.TABLE_GET: {
            throw new Error(`Unimplemented ${this.instr.id}`); // TODO: Implement tables
            break;
        }
        case OP.TABLE_SET: {
            throw new Error(`Unimplemented ${this.instr.id}`); // TODO: Implement tables
            break;
        }
        case OP.I32_CONST: {
            if (this.instr.value === 0) {
                this.output('READ32 MAB0');
            } else {
                this.output(`NEG -(${this.instr.value})`);
            }
            break;
        }
        case OP.I64_CONST: {
            if (this.instr.value === 0n) {
                this.output(['READ32 MAB0', 'READ32 MAB0']);
            } else {
                this.output(`NEG64 -(${this.instr.value})`);
            }
            break;
        }
        case OP.REF_FUNC: {
            let target = this.instr.func.resolved;
            this.output(`NEG -(${target.name})`);
            break;
        }
        case OP.TRIVM_LOCAL_GET32: {
            this.output(`READ32 [SP] - ${4 * this.stackSize
                + this.frameSize - this.localsOffsets[this.instr.index] - this.instr.offset - 4}`);
            break;
        }
        case OP.TRIVM_LOCAL_GET64: {
            this.output(`READ64 [SP] - ${4 * this.stackSize
                + this.frameSize - this.localsOffsets[this.instr.index] - this.instr.offset - 4}`);
            break;
        }
        case OP.TRIVM_LOCAL_SET32: {
            this.output(`WRITE32 [SP] - ${4 * (this.stackSize - this.popPush.poppedWords)
                + this.frameSize - this.localsOffsets[this.instr.index] - this.instr.offset - 4}`);
            break;
        }
        case OP.TRIVM_LOCAL_SET64: {
            this.output(`WRITE64 [SP] - ${4 * (this.stackSize - this.popPush.poppedWords)
                + this.frameSize - this.localsOffsets[this.instr.index] - this.instr.offset - 4}`);
            break;
        }
        case OP.TRIVM_RAW: {
            this.output(this.instr.code);
            break;
        }

        // ---- Generators - end - generated with help of "wasm-instr.ts" script ----

        default: {
            let simpleGen = simpleGenerators[this.instr.opcode];
            if (simpleGen) {
                if (typeof (simpleGen) !== 'string') {
                    simpleGen = simpleGen(this.instr);
                }
                this.output(simpleGen);
            } else {
                throw new Error(`Unimplemented ${this.instr.id}`);
            }
            break;
        }
        }

        this.stackSize -= this.popPush.poppedWords;
        this.stackSize += this.popPush.pushedWords;
        this.popPush = undefined;
    }
}

const simpleGenerators: { [key: number]: string | ((instr: any) => string); } = {
    // ---- Simple generators - begin - generated with help of "wasm-instr.ts" script ----

    /* eslint-disable max-len */
    [OP.NOP]: '# NOP',
    [OP.I32_LOAD]: (instr: OpType.I32_LOAD) => `UREAD32 [AMB0] + [POP] + ${instr.offset}`,
    [OP.I64_LOAD]: (instr: OpType.I64_LOAD) => `UREAD64 [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_LOAD8_S]: (instr: OpType.I32_LOAD8_S) => `UREAD8S [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_LOAD8_U]: (instr: OpType.I32_LOAD8_U) => `UREAD8U [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_LOAD16_S]: (instr: OpType.I32_LOAD16_S) => `UREAD16S [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_LOAD16_U]: (instr: OpType.I32_LOAD16_U) => `UREAD16U [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_STORE]: (instr: OpType.I32_STORE) => `UWRITE32 [AMB0] + [POP] + ${instr.offset}`,
    [OP.I64_STORE]: (instr: OpType.I64_STORE) => `UWRITE64 [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_STORE8]: (instr: OpType.I32_STORE8) => `UWRITE8 [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_STORE16]: (instr: OpType.I32_STORE16) => `UWRITE16 [AMB0] + [POP] + ${instr.offset}`,
    [OP.I32_EQZ]: 'NOT',
    [OP.I32_EQ]: 'EQ',
    [OP.I32_LT_S]: 'SLT',
    [OP.I32_LT_U]: 'ULT',
    [OP.I32_GT_S]: 'SGT',
    [OP.I32_GT_U]: 'UGT',
    [OP.I64_EQ]: 'EQ64',
    [OP.I64_LT_S]: 'SLT64',
    [OP.I64_LT_U]: 'ULT64',
    [OP.I64_GT_S]: 'SGT64',
    [OP.I64_GT_U]: 'UGT64',
    [OP.F32_EQ]: 'EQF32',
    [OP.F32_LT]: 'LTF32',
    [OP.F32_GT]: 'GTF32',
    [OP.F32_LE]: 'LEF32',
    [OP.F32_GE]: 'GEF32',
    [OP.F64_EQ]: 'EQF64',
    [OP.F64_LT]: 'LTF64',
    [OP.F64_GT]: 'GTF64',
    [OP.F64_LE]: 'LEF64',
    [OP.F64_GE]: 'GEF64',
    [OP.I32_ADD]: 'ADD',
    [OP.I32_SUB]: 'SUB',
    [OP.I32_MUL]: 'MUL',
    [OP.I32_DIV_S]: 'SDIV',
    [OP.I32_DIV_U]: 'UDIV',
    [OP.I32_REM_S]: 'SMOD',
    [OP.I32_REM_U]: 'UMOD',
    [OP.I32_AND]: 'AND',
    [OP.I32_OR]: 'OR',
    [OP.I32_XOR]: 'XOR',
    [OP.I32_SHL]: 'SHL',
    [OP.I32_SHR_S]: 'SSHR',
    [OP.I32_SHR_U]: 'USHR',
    [OP.I64_ADD]: 'ADD64',
    [OP.I64_SUB]: 'SUB64',
    [OP.I64_MUL]: 'MUL64',
    [OP.I64_DIV_S]: 'SDIV64',
    [OP.I64_DIV_U]: 'UDIV64',
    [OP.I64_REM_S]: 'SMOD64',
    [OP.I64_REM_U]: 'UMOD64',
    [OP.I64_AND]: 'AND64',
    [OP.I64_OR]: 'OR64',
    [OP.I64_XOR]: 'XOR64',
    [OP.I64_SHL]: 'SHL64',
    [OP.I64_SHR_S]: 'SSHR64',
    [OP.I64_SHR_U]: 'USHR64',
    [OP.F32_CEIL]: 'CEILF32',
    [OP.F32_FLOOR]: 'FLOORF32',
    [OP.F32_TRUNC]: 'TRUNCF32',
    [OP.F32_NEAREST]: 'NEARESTF32',
    [OP.F32_SQRT]: 'SQRTF32',
    [OP.F32_ADD]: 'ADDF32',
    [OP.F32_SUB]: 'SUBF32',
    [OP.F32_MUL]: 'MULF32',
    [OP.F32_DIV]: 'DIVF32',
    [OP.F64_CEIL]: 'CEILF64',
    [OP.F64_FLOOR]: 'FLOORF64',
    [OP.F64_TRUNC]: 'TRUNCF64',
    [OP.F64_NEAREST]: 'NEARESTF64',
    [OP.F64_SQRT]: 'SQRTF64',
    [OP.F64_ADD]: 'ADDF64',
    [OP.F64_SUB]: 'SUBF64',
    [OP.F64_MUL]: 'MULF64',
    [OP.F64_DIV]: 'DIVF64',
    [OP.I32_TRUNC_F32_S]: 'TRUNCF32S32',
    [OP.I32_TRUNC_F32_U]: 'TRUNCF32U32',
    [OP.I32_TRUNC_F64_S]: 'TRUNCF64S32',
    [OP.I32_TRUNC_F64_U]: 'TRUNCF64U32',
    [OP.I64_EXTEND_I32_S]: 'EXTS64HL 32',
    [OP.I64_TRUNC_F32_S]: 'TRUNCF32S64',
    [OP.I64_TRUNC_F32_U]: 'TRUNCF32U64',
    [OP.I64_TRUNC_F64_S]: 'TRUNCF64S64',
    [OP.I64_TRUNC_F64_U]: 'TRUNCF64U64',
    [OP.F32_CONVERT_I32_S]: 'CONVF32S32',
    [OP.F32_CONVERT_I32_U]: 'CONVF32U32',
    [OP.F32_CONVERT_I64_S]: 'CONVF32S64',
    [OP.F32_CONVERT_I64_U]: 'CONVF32U64',
    [OP.F32_DEMOTE_F64]: 'DEMOTE',
    [OP.F64_CONVERT_I32_S]: 'CONVF64S32',
    [OP.F64_CONVERT_I32_U]: 'CONVF64U32',
    [OP.F64_CONVERT_I64_S]: 'CONVF64S64',
    [OP.F64_CONVERT_I64_U]: 'CONVF64U64',
    [OP.F64_PROMOTE_F32]: 'PROMOTE',
    [OP.TRIVM_POP]: 'WRITE32 GPR0',
    [OP.TRIVM_DUP32]: 'READ32 [SP]',
    [OP.TRIVM_DUP64]: 'READ64 [SP] - 4',
    [OP.TRIVM_GLOBAL_GET32]: (instr: OpType.TRIVM_GLOBAL_GET32) => `READ32 $_global_${instr.global.index} + ${instr.offset}`,
    [OP.TRIVM_GLOBAL_GET64]: (instr: OpType.TRIVM_GLOBAL_GET64) => `READ64 $_global_${instr.global.index} + ${instr.offset}`,
    [OP.TRIVM_GLOBAL_SET32]: (instr: OpType.TRIVM_GLOBAL_SET32) => `WRITE32 $_global_${instr.global.index} + ${instr.offset}`,
    [OP.TRIVM_GLOBAL_SET64]: (instr: OpType.TRIVM_GLOBAL_SET64) => `WRITE64 $_global_${instr.global.index} + ${instr.offset}`,
    [OP.TRIVM_SHL_CONST]: (instr: OpType.TRIVM_SHL_CONST) => `SHL ${instr.value}`,
    [OP.TRIVM_USHR_CONST]: (instr: OpType.TRIVM_USHR_CONST) => `USHR ${instr.value}`,
    [OP.TRIVM_SSHR_CONST]: (instr: OpType.TRIVM_SSHR_CONST) => `SSHR ${instr.value}`,
    [OP.TRIVM_EXTS_CONST]: (instr: OpType.TRIVM_EXTS_CONST) => `EXTS ${instr.value}`,
    [OP.TRIVM_EXTS64_CONST]: (instr: OpType.TRIVM_EXTS64_CONST) => `EXTS64 ${instr.value}`,
    /* eslint-enable max-len */

    // ---- Simple generators - end - generated with help of "wasm-instr.ts" script ----
};

const UNWIND_OPTIMIZED_CASES: {[key:string]: string[]} = {
    // 'keep,skip': [ instructions ]
    '0,1': [ 'WRITE32 GPR0' ],
    '1,1': [ 'WRITE32 [SP]' ],
    '0,2': [ 'WRITE32 GPR0', 'WRITE32 GPR0' ],
    '1,2': [ 'WRITE32 [SP] - 4', 'WRITE32 GPR0' ],
    '2,2': [ 'WRITE32 [SP] - 4', 'WRITE32 [SP] - 4' ],
};
