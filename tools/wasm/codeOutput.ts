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


export function dumpType(value: ValueType[] | ValueType | FunctionType): string {
    if (typeof value === 'number') {
        switch (value) {
        case NumberType.I32: return 'i32';
        case NumberType.I64: return 'i64';
        case NumberType.F32: return 'f32';
        case NumberType.F64: return 'f64';
        case RefType.FUNCREF: return 'funcref';
        case RefType.EXTERNREF: return 'externref';
        case VectorType.V128: return 'v128';
        default: exhaustiveCheck(value); return '';
        }
    } else if (value instanceof Array) {
        return value.map(x => dumpType(x)).join(', ');
    } else if (value.results.length == 0) {
        return `(${dumpType(value.params)}) => void`;
    } else if (value.results.length == 1) {
        return `(${dumpType(value.params)}) => ${dumpType(value.results)}`;
    } else {
        return `(${dumpType(value.params)}) => (${dumpType(value.results)})`;
    }
}

export function dumpWords(words: number): string {
    if (words > 0) {
        return `${words} (${4 * words})`;
    } else {
        return words.toString();
    }
}

export function toIntLiteral(value: number, bits: number): number {
    let shift = 32 - bits;
    return ((value << shift) & 0xFFFFFFFF) >> shift;
}

export class CodeOutput {

    // Output
    protected out: string[][] = [[]];

    public initOutput() {
        this.out = [[]];
    }

    public getOutput(asArray: true): string[];
    public getOutput(asArray: false): string;
    public getOutput(asArray: boolean): string | string[];
    public getOutput(asArray: boolean): string | string[] {
        let res: string | string[];
        if (this.out.length === 1) {
            res = asArray ? this.out[0] : this.out[0].join('');
        } else if (asArray) {
            res = this.out.reduce((p, x) => extendArray<string>(p, x), []);
        } else {
            res = this.out.map(x => x.join('')).join('');
        }
        return res;
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

    public outputRaw(code: string[] | string) {
        if (code instanceof Array) {
            extendArray(this.out.at(-1) as string[], code);
        } else {
            this.out.at(-1)!.push(code);
        }
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
