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


interface OutputEntry {
    text?: string;
    size: number;
}


const MAX_BLOCK_SIZE = 255;

export class MemInitOutput {

    // Output
    protected out: OutputEntry[][] = [[]];

    public initOutput() {
        this.out = [[]];
    }

    public getOutput(asArray: true, takenBytes?: number): string[];
    public getOutput(asArray: false, takenBytes?: number): string;
    public getOutput(asArray: boolean, takenBytes?: number): string | string[];
    public getOutput(asArray: boolean, takenBytes?: number): string | string[] {
        let output: string[] = [];
        let entries: OutputEntry[];
        if (this.out.length === 1) {
            entries = this.out[0];
        } else {
            entries = this.out.reduce((p, x) => extendArray<OutputEntry>(p, x), []);
        }
        let blockSize = takenBytes || 0;
        for (let entry of entries) {
            if (blockSize + entry.size > MAX_BLOCK_SIZE) {
                output.push('block_end:');
                output.push('.end');
                output.push('.block');
                output.push('.local block_begin, block_end');
                output.push('block_begin:');
                output.push('.data8 0, block_end - block_begin');
            }
        }
        return asArray ? output : output.join('');
    }

    public output(code: string | string[], comment?: string) {
        let out = this.out.at(-1) as string[];
        if (typeof (code) === 'string') {
            code = [code];
        }
        if (comment) {
            comment += ` # ${comment}`;
        } else {
            comment = '';
        }
        for (let line of code) {
            out.push(`${line}${comment}\n`);
            comment = '';
        }
    }

    public outputPart(code: string | string[], comment?: string) {
        let out = this.out.at(-1) as string[];
        if (typeof (code) === 'string') {
            code = [code];
        }
        if (comment) {
            comment += ` # ${comment}`;
        } else {
            comment = '';
        }
        for (let line of code) {
            out.push(`${line}${comment}`);
            comment = '';
        }
    }

    public outputRaw(code: string[]) {
        extendArray(this.out.at(-1) as string[], code);
    }

    public captureBegin() {
        this.out.push([]);
    }

    public captureEndGet(): string[] {
        let res = this.out.pop();
        if (res === undefined || this.out.length === 0) {
            throw new Error('Internal error: output stack underflow');
        }
        return res;
    }

    public captureEndCommit() {
        this.outputRaw(this.captureEndGet());
    }

}
