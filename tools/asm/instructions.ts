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

import { BASE, instrInfoById, INSTR, InstrInfo } from './instrInfo';
import { Compiler } from './compiler';
import { ExprMaker } from './exprMaker';
import { CompilerError } from './errors';
import { BytecodeGenerator } from './generator';
import { Dict, bigIntMin } from '../common/common';

const MAX_FILL_SIZE = 128 * 1024 * 1024;

export class ExprContext {
    private mutableOld?: boolean;
    private depsOld?: Set<Block>;
    private depsLevels?: number;
    constructor(public mutable?: boolean, public deps?: Set<Block>, private parent?: ExprContext) {
    }
    pushMutable() {
        this.mutableOld = this.mutable;
        this.mutable = false;
    }
    popMutable() {
        let result = this.mutable;
        this.mutable = this.mutable || this.mutableOld;
        return result;
    }
    pushDeps() {
        if (this.deps) {
            this.depsOld = this.deps;
            this.depsLevels = 1;
        } else {
            this.depsLevels = (this.depsLevels || 0) + 1;
        }
        this.deps = undefined;
    }
    popDeps() {
        (this.depsLevels as number)--;
        if (this.depsLevels === 0) {
            this.deps = this.depsOld;
        }
    }
}

export type ExprEval = (ctx: ExprContext) => bigint;


function getImmediateSize(value: bigint, minSize: number = 0) {
    let valueInt = Number(value & 0xFFFFFFFFn);
    if ((valueInt <= 0x7F || valueInt >= 0xFFFFFF80) && minSize <= 1) {
        return 1;
    } else if ((valueInt <= 0x7FFF || valueInt >= 0xFFFF8000) && minSize <= 2) {
        return 2;
    } else {
        return 4;
    }
}


function putImmediate(generator: BytecodeGenerator, value: bigint, minSize: number) {
    let valueInt = Number(value & 0xFFFFFFFFn);
    if ((valueInt <= 0x7F || valueInt >= 0xFFFFFF80) && minSize <= 1) {
        generator.put8(valueInt);
    } else if ((valueInt <= 0x7FFF || valueInt >= 0xFFFF8000) && minSize <= 2) {
        generator.put16(valueInt);
    } else {
        generator.put32(valueInt);
    }
}


function getMemImmediateSize(value: bigint, minSize: number = 0) {
    if (value < 128n && minSize <= 1) {
        return 1;
    } else if (value < 16384n && minSize <= 2) {
        return 2;
    } else if (value < 2097152n && minSize <= 3) {
        return 3;
    } else if (value < 268435456n && minSize <= 4) {
        return 4;
    } else {
        return 5;
    }
}

function putMemImmediate(generator: BytecodeGenerator, value: bigint, minSize: number) {
    if (value < 0x80000000n) {
        let v = Number(value);
        if (v < 128 && minSize <= 1) {
            generator.put8(v << 1);
        } else if (v < 16384 && minSize <= 2) {
            generator.put8((v >> 6) | 1);
            generator.put8((v << 1) & 0xFF);
        } else if (v < 2097152 && minSize <= 3) {
            generator.put8((v >> 13) | 1);
            generator.put8(((v >> 6) & 0xFF) | 1);
            generator.put8((v << 1) & 0xFE);
        } else if (v < 268435456 && minSize <= 4) {
            generator.put8((v >> 20) | 1);
            generator.put8(((v >> 13) & 0xFF) | 1);
            generator.put8(((v >> 6) & 0xFF) | 1);
            generator.put8((v << 1) & 0xFF);
        } else {
            generator.put8((v >> 27) | 1);
            generator.put8(((v >> 20) & 0xFF) | 1);
            generator.put8(((v >> 13) & 0xFF) | 1);
            generator.put8(((v >> 6) & 0xFF) | 1);
            generator.put8((v << 1) & 0xFF);
        }
    } else {
        generator.put8(Number((value >> 27n) | 1n));
        generator.put8(Number(((value >> 20n) & 0xFFn) | 1n));
        generator.put8(Number(((value >> 13n) & 0xFFn) | 1n));
        generator.put8(Number(((value >> 6n) & 0xFFn) | 1n));
        generator.put8(Number((value << 1n) & 0xFFn));
    }
}


export class ExprCycleError extends Error { }


export class InstrParams { // TODO: Rename it
    constructor(
        public compiler: Compiler,
        public lineNumber: number,
        public index: number,
        public info: InstrInfo,
        public exprMaker: ExprMaker
    ) {
    }
}


export class InstrBase {

    public compiler: Compiler;
    public lineNumber: number;
    public index: number;
    public info: InstrInfo;

    public address: {
        current: number | undefined,
        estimated: number | undefined,
        old: number,
        end: number;
    } = {
            current: undefined,
            estimated: undefined,
            old: 0,
            end: 0,
        };

    constructor(params: InstrParams) {
        this.compiler = params.compiler;
        this.lineNumber = params.lineNumber;
        this.index = params.index;
        this.info = params.info;
    }

    getSize(ctx: ExprContext) {
        void (ctx);
        return 0;
    }

    collectDeps(ctx: ExprContext) {
        void (ctx);
    }

    generate(generator: BytecodeGenerator, minSize: number) {
        void (minSize);
    }

}


export class Block extends InstrBase {
    public discarded: boolean = false;
    public moveTo: string | null = null;
    public end!: BlockEnd;
    public locals: { [k: string]: string; } = {};
    public deps: Set<Block> = new Set();

    constructor(params: InstrParams, args: string, public parent: Block | null) {
        super(params);
        let [blockType, blockArgs] = args.split(/\s+/, 2);
        blockArgs = (blockArgs || '').trim();
        switch (blockType.toUpperCase()) {
        case 'DISCARDABLE':
            if (blockArgs != '') throw new CompilerError(this.lineNumber, 'Unexpected string after DISCARDABLE.');
            this.discarded = true;
            break;
        case 'MOVABLE':
            if (blockArgs == '') throw new CompilerError(this.lineNumber, 'Destination name expected.');
            this.moveTo = blockArgs;
            break;
        case '':
            // nothing to do
            break;
        default:
            throw new CompilerError(this.lineNumber, 'Unknown type of block.');
        }
    }
}


export class BlockEnd extends InstrBase {
    constructor(params: InstrParams, public block: Block) {
        super(params);
    }
}


export class Assign extends InstrBase {
    private calculating: boolean = false;
    private value: ExprEval;

    constructor(params: InstrParams, value: string, public block: Block) {
        super(params);
        this.value = params.exprMaker.makeSingleExpression(this, value);
    }
    collectDeps(ctx: ExprContext): void {
        this.calculate(ctx);
    }
    getValue(ctx: ExprContext): bigint {
        if (ctx.deps)
            ctx.deps.add(this.block);
        ctx.pushDeps();
        let result = this.calculate(ctx);
        ctx.popDeps();
        return result;
    }
    calculate(ctx: ExprContext): bigint {
        let result: bigint;
        if (this.calculating) {
            throw new ExprCycleError(`${this.lineNumber}: Cycle in assignment evaluation! Cycle in the line numbers:`);
        }
        try {
            this.calculating = true;
            result = this.value(ctx);
            this.calculating = false;
        } catch (ex) {
            if (ex instanceof ExprCycleError) {
                throw new ExprCycleError(ex.message + ' ' + this.lineNumber);
            }
            throw ex;
        }
        return result;
    }
}

export class SimpleCoreInstruction extends InstrBase {

    public static INSTR_CODES = [0x83, 0x82, 0x81, 0, 0x80];

    private arg: ExprEval | null;

    constructor(params: InstrParams, args: string) {
        super(params);
        this.arg = params.exprMaker.makeOptionalExpression(this, args);
    }
    collectDeps(ctx: ExprContext) {
        if (this.arg !== null) {
            this.arg(ctx);
        }
    }
    getSize(ctx: ExprContext): number {
        if (this.arg !== null) {
            ctx.pushMutable();
            let argValue = this.arg(ctx);
            if (ctx.popMutable()) {
                return 2;
            } else {
                return 1 + getImmediateSize(argValue);
            }
        } else {
            return 1;
        }
    }
    generate(generator: BytecodeGenerator, minSize: number) {
        if (this.arg !== null) {
            let argValue = this.arg(new ExprContext());
            let size = getImmediateSize(argValue, minSize - 1);
            generator.put8(SimpleCoreInstruction.INSTR_CODES[size] | (this.info.opcode << 2));
            putImmediate(generator, argValue, size);
        } else {
            generator.put8(SimpleCoreInstruction.INSTR_CODES[0] | (this.info.opcode << 2));
        }
    }
}

export class SimpleExt32Instruction extends InstrBase {

    private static CODE_FIRST = [0xFB, 0xFA, 0xF9, 0, 0xF8];

    private arg: ExprEval | null;

    constructor(params: InstrParams, args: string) {
        super(params);
        this.arg = params.exprMaker.makeOptionalExpression(this, args);
    }
    collectDeps(ctx: ExprContext) {
        if (this.arg !== null) {
            this.arg(ctx);
        }
    }
    getSize(ctx: ExprContext): number {
        if (this.arg !== null) {
            ctx.pushMutable();
            let argValue = this.arg(ctx);
            if (ctx.popMutable()) {
                return 3;
            } else {
                return 2 + getImmediateSize(argValue);
            }
        } else {
            return 2;
        }
    }
    generate(generator: BytecodeGenerator, minSize: number) {
        if (this.arg !== null) {
            let argValue = this.arg(new ExprContext());
            let size = getImmediateSize(argValue, minSize - 2);
            generator.put8(SimpleExt32Instruction.CODE_FIRST[size]);
            putImmediate(generator, argValue, size);
            generator.put8(this.info.opcode);
        } else {
            generator.put8(SimpleExt32Instruction.CODE_FIRST[0]);
            generator.put8(this.info.opcode);
        }
    }
}

export class SimpleExt64Instruction extends InstrBase {

    private static CODE_FIRST = [0xFB, 0xFA, 0xF9, 0, 0xF8];

    private arg: ExprEval | null;

    constructor(params: InstrParams, args: string) {
        super(params);
        this.arg = params.exprMaker.makeOptionalExpression(this, args);
    }
    collectDeps(ctx: ExprContext) {
        if (this.arg !== null) {
            this.arg(ctx);
        }
    }
    getSize(ctx: ExprContext): number {
        if (this.arg !== null) {
            ctx.pushMutable();
            let argValue = this.arg(ctx);
            if (ctx.popMutable()) {
                return 3;
            } else {
                void (argValue);
                throw new Error('Not implemented');
                // TODOv1: Size may be forced to have more than 4 bytes if both arg0 and result are 32-bit.
                //return 2 + generator.getImmediate64Size(argValue);
            }
        } else {
            return 2;
        }
    }
    generate(generator: BytecodeGenerator, minSize: number) {
        if (this.arg !== null) {
            void (minSize);
            throw new Error('Not implemented'); // TODOv1: Implement ext64 instruction class
        } else {
            generator.put8(SimpleExt64Instruction.CODE_FIRST[0]);
            generator.put8(this.info.opcode);
        }
    }
}

export class UnwindInstruction extends InstrBase {

    private keep: ExprEval;
    private reduce: ExprEval;

    constructor(params: InstrParams, args: string) {
        super(params);
        let expr = params.exprMaker.makeExpressions(this, args);
        if (expr.length != 2) {
            throw new CompilerError(this.lineNumber, 'UNWIND instruction requires zero or two arguments.');
        }
        this.keep = expr[0];
        this.reduce = expr[1];
    }
    collectDeps(ctx: ExprContext) {
        this.keep(ctx);
        if (this.reduce)
            this.reduce(ctx);
    }
    getSize(ctx: ExprContext): number {
        ctx.pushMutable();
        let keepValue = this.keep(ctx);
        let reduceValue = this.reduce(ctx);
        if (ctx.popMutable()) {
            return 2;
        } else {
            let size = this.getArgSize(keepValue, reduceValue);
            if (size == 0)
                throw new CompilerError(this.lineNumber, 'Too many items to unwind!');
            return 1 + size;
        }
    }
    private getArgSize(keep: bigint, reduce: bigint, minSize?: number): number {
        minSize = minSize || 1;
        if (reduce <= 15n && keep <= 15n && minSize <= 1) {
            return 1;
        } else if (reduce <= 255n && keep <= 255n && minSize <= 2) {
            return 2;
        } else if (reduce <= 65535n && keep <= 65535n) {
            return 4;
        } else {
            return 0;
        }
    }
    generate(generator: BytecodeGenerator, minSize: number) {
        let ctx = new ExprContext();
        let keepValue = this.keep(ctx);
        let reduceValue = this.reduce(ctx);
        let size = this.getArgSize(keepValue, reduceValue);
        if (size == 0) {
            this.compiler.error(this.lineNumber, 'Too many items to unwind!');
            generator.fill(0, 5);
            return;
        }
        size = Math.max(minSize - 1, size);
        generator.put8(SimpleCoreInstruction.INSTR_CODES[size] | (this.info.opcode << 2));
        let value = (keepValue << BigInt(size * 4)) | reduceValue;
        generator.putInt(value, size);
    }
}

export class BranchInstruction extends InstrBase {

    private static INSTR_CODES = [0x83, 0x82, 0x81, 0, 0x80];

    private destExpr: ExprEval | null;
    private addrExpr: ExprEval;

    constructor(params: InstrParams, args: string) {
        super(params);
        this.destExpr = params.exprMaker.makeOptionalExpression(this, args);
        this.addrExpr = params.exprMaker.makeSingleExpression(this, 'vma()');
    }
    collectDeps(ctx: ExprContext) {
        if (this.destExpr)
            this.destExpr(ctx);
    }
    getSize(ctx: ExprContext): number {
        ctx.mutable = !!this.destExpr;
        return this.destExpr ? 2 : 1;
    }
    generate(generator: BytecodeGenerator, minSize: number) {
        if (this.destExpr) {
            let ctx = new ExprContext();
            let dest = Number(this.destExpr(ctx));
            let addr = Number(this.addrExpr(ctx));
            let offset = dest - addr;
            let size: number;
            if (offset >= -126 && offset <= 129) {
                size = 1;
            } else if (offset >= -32765 && offset <= 32770) {
                size = 2;
            } else {
                size = 4;
            }
            while (size < (minSize - 1) && size < 4) {
                size = size << 1;
            }
            generator.put8(BranchInstruction.INSTR_CODES[size] | (this.info.opcode << 2));
            putImmediate(generator, BigInt(offset - size - 1), size);
        } else {
            generator.put8(BranchInstruction.INSTR_CODES[0] | (this.info.opcode << 2));
        }
    }
}

export class StackInstruction extends InstrBase {

    private arg: ExprEval;
    private code: number;

    constructor(params: InstrParams, args: string) {
        super(params);
        this.arg = params.exprMaker.makeOptionalExpression(this, args) || (() => 0n);
        this.code = this.info.instrOptions.write ? 0x60 : 0x40;
    }

    collectDeps(ctx: ExprContext) {
        this.arg(ctx);
    }

    getSize(ctx_or_offset: ExprContext | bigint) {
        let offset: bigint;
        if (typeof ctx_or_offset === 'bigint') {
            offset = ctx_or_offset;
        } else {
            offset = this.arg(ctx_or_offset) & 0xFFFFFFFFn;
        }
        if ((offset & 3n) !== 0n) {
            this.compiler.error(this.lineNumber, `Memory access relative to SP must be 32-bit aligned, but offset is ${offset}.`);
        }
        offset = offset / 4n;
        if (offset < 31n) {
            return 1;
        } else {
            return 1 + getMemImmediateSize(offset - 31n);
        }
    }

    generate(generator: BytecodeGenerator, minSize: number) {
        let offset = this.arg(new ExprContext()) & 0xFFFFFFFFn;
        let allowedSize = this.getSize(offset);
        let size = Math.min(6, Math.max(minSize, allowedSize));
        offset /= 4n;
        if (offset < 31n) {
            generator.put8(this.code | Number(offset));
            // Use BR to the next instruction as noop to fill required size.
            if (size === 6) {
                generator.put8(0x80 | (instrInfoById[INSTR.BR].opcode << 2) | 0x00);
                generator.put32(0);
            } else if (size === 5) {
                generator.put8(0x80 | (instrInfoById[INSTR.BR].opcode << 2) | 0x02);
                generator.put8(0);
                generator.put8(0x80 | (instrInfoById[INSTR.BR].opcode << 2) | 0x02);
                generator.put8(0);
            } else if (size === 4) {
                generator.put8(0x80 | (instrInfoById[INSTR.BR].opcode << 2) | 0x01);
                generator.put16(0);
            } else if (size > 1) {
                generator.put8(0x80 | (instrInfoById[INSTR.BR].opcode << 2) | 0x02);
                generator.put8(0);
            }
        } else {
            generator.put8(this.code | 31);
            putMemImmediate(generator, offset - 31n, size - 1);
        }
    }
}

interface UnalignedInstrSizeDesc {
    value: bigint;
    mem: number;
    math: number;
    memMax: bigint;
    negative?: boolean;
    fallback?: boolean;
}

// ---- Unaligned memory access optimal instruction sizes - begin - generated with help of script ----

const unalignedSizes: Dict<UnalignedInstrSizeDesc[]> = {
    longAlign1Postfix1Unaligned: [
        { value: 191n, mem: 2, math: 2, memMax: 63n, },
        { value: 32831n, mem: 2, math: 3, memMax: 63n, },
        { value: 1048703n, mem: 4, math: 2, memMax: 1048575n, },
        { value: 4294934528n, mem: 2, math: 5, memMax: 63n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign1Postfix1Aligned: [
        { value: 63n, mem: 2, math: 0, memMax: 63n, },
        { value: 8191n, mem: 3, math: 0, memMax: 8191n, },
        { value: 1048575n, mem: 4, math: 0, memMax: 1048575n, },
        { value: 134217727n, mem: 5, math: 0, memMax: 134217727n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign1Postfix2Unaligned: [
        { value: 159n, mem: 2, math: 2, memMax: 31n, },
        { value: 32799n, mem: 2, math: 3, memMax: 31n, },
        { value: 524415n, mem: 4, math: 2, memMax: 524287n, },
        { value: 4294934528n, mem: 2, math: 5, memMax: 31n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign1Postfix2Aligned: [
        { value: 31n, mem: 2, math: 0, memMax: 31n, },
        { value: 4095n, mem: 3, math: 0, memMax: 4095n, },
        { value: 524287n, mem: 4, math: 0, memMax: 524287n, },
        { value: 67108863n, mem: 5, math: 0, memMax: 67108863n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign1Postfix3Unaligned: [
        { value: 143n, mem: 2, math: 2, memMax: 15n, },
        { value: 32783n, mem: 2, math: 3, memMax: 15n, },
        { value: 262271n, mem: 4, math: 2, memMax: 262143n, },
        { value: 4294934528n, mem: 2, math: 5, memMax: 15n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign1Postfix3Aligned: [
        { value: 15n, mem: 2, math: 0, memMax: 15n, },
        { value: 2047n, mem: 3, math: 0, memMax: 2047n, },
        { value: 262143n, mem: 4, math: 0, memMax: 262143n, },
        { value: 33554431n, mem: 5, math: 0, memMax: 33554431n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign2Postfix1Unaligned: [
        { value: 254n, mem: 2, math: 2, memMax: 126n, },
        { value: 32894n, mem: 2, math: 3, memMax: 126n, },
        { value: 2097278n, mem: 4, math: 2, memMax: 2097150n, },
        { value: 4294934528n, mem: 2, math: 5, memMax: 126n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign2Postfix1Aligned: [
        { value: 126n, mem: 2, math: 0, memMax: 126n, },
        { value: 16382n, mem: 3, math: 0, memMax: 16382n, },
        { value: 2097150n, mem: 4, math: 0, memMax: 2097150n, },
        { value: 268435454n, mem: 5, math: 0, memMax: 268435454n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign2Postfix2Unaligned: [
        { value: 190n, mem: 2, math: 2, memMax: 62n, },
        { value: 32830n, mem: 2, math: 3, memMax: 62n, },
        { value: 1048702n, mem: 4, math: 2, memMax: 1048574n, },
        { value: 4294934528n, mem: 2, math: 5, memMax: 62n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign2Postfix2Aligned: [
        { value: 62n, mem: 2, math: 0, memMax: 62n, },
        { value: 8190n, mem: 3, math: 0, memMax: 8190n, },
        { value: 1048574n, mem: 4, math: 0, memMax: 1048574n, },
        { value: 134217726n, mem: 5, math: 0, memMax: 134217726n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign2Postfix3Unaligned: [
        { value: 158n, mem: 2, math: 2, memMax: 30n, },
        { value: 32798n, mem: 2, math: 3, memMax: 30n, },
        { value: 524414n, mem: 4, math: 2, memMax: 524286n, },
        { value: 4294934528n, mem: 2, math: 5, memMax: 30n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign2Postfix3Aligned: [
        { value: 30n, mem: 2, math: 0, memMax: 30n, },
        { value: 4094n, mem: 3, math: 0, memMax: 4094n, },
        { value: 524286n, mem: 4, math: 0, memMax: 524286n, },
        { value: 67108862n, mem: 5, math: 0, memMax: 67108862n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign4Postfix1Unaligned: [
        { value: 380n, mem: 2, math: 2, memMax: 252n, },
        { value: 33020n, mem: 2, math: 3, memMax: 252n, },
        { value: 4194428n, mem: 4, math: 2, memMax: 4194300n, },
        { value: 4294934528n, mem: 2, math: 5, memMax: 252n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign4Postfix1Aligned: [
        { value: 252n, mem: 2, math: 0, memMax: 252n, },
        { value: 32764n, mem: 3, math: 0, memMax: 32764n, },
        { value: 4194300n, mem: 4, math: 0, memMax: 4194300n, },
        { value: 536870908n, mem: 5, math: 0, memMax: 536870908n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign4Postfix2Unaligned: [
        { value: 252n, mem: 2, math: 2, memMax: 124n, },
        { value: 32892n, mem: 2, math: 3, memMax: 124n, },
        { value: 2097276n, mem: 4, math: 2, memMax: 2097148n, },
        { value: 4294934528n, mem: 2, math: 5, memMax: 124n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign4Postfix2Aligned: [
        { value: 124n, mem: 2, math: 0, memMax: 124n, },
        { value: 16380n, mem: 3, math: 0, memMax: 16380n, },
        { value: 2097148n, mem: 4, math: 0, memMax: 2097148n, },
        { value: 268435452n, mem: 5, math: 0, memMax: 268435452n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign4Postfix3Unaligned: [
        { value: 188n, mem: 2, math: 2, memMax: 60n, },
        { value: 32828n, mem: 2, math: 3, memMax: 60n, },
        { value: 1048700n, mem: 4, math: 2, memMax: 1048572n, },
        { value: 4294934528n, mem: 2, math: 5, memMax: 60n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    longAlign4Postfix3Aligned: [
        { value: 60n, mem: 2, math: 0, memMax: 60n, },
        { value: 8188n, mem: 3, math: 0, memMax: 8188n, },
        { value: 1048572n, mem: 4, math: 0, memMax: 1048572n, },
        { value: 134217724n, mem: 5, math: 0, memMax: 134217724n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 2, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 2, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign1Postfix1Unaligned: [
        { value: 133n, mem: 1, math: 2, memMax: 5n, },
        { value: 32773n, mem: 1, math: 3, memMax: 5n, },
        { value: 32831n, mem: 2, math: 3, memMax: 63n, },
        { value: 4294934528n, mem: 1, math: 5, memMax: 5n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign1Postfix1Aligned: [
        { value: 5n, mem: 1, math: 0, memMax: 5n, },
        { value: 63n, mem: 2, math: 0, memMax: 63n, },
        { value: 8191n, mem: 3, math: 0, memMax: 8191n, },
        { value: 1048575n, mem: 4, math: 0, memMax: 1048575n, },
        { value: 134217727n, mem: 5, math: 0, memMax: 134217727n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign1Postfix2Unaligned: [
        { value: 133n, mem: 1, math: 2, memMax: 5n, },
        { value: 32773n, mem: 1, math: 3, memMax: 5n, },
        { value: 32799n, mem: 2, math: 3, memMax: 31n, },
        { value: 4294934528n, mem: 1, math: 5, memMax: 5n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign1Postfix2Aligned: [
        { value: 5n, mem: 1, math: 0, memMax: 5n, },
        { value: 31n, mem: 2, math: 0, memMax: 31n, },
        { value: 4095n, mem: 3, math: 0, memMax: 4095n, },
        { value: 524287n, mem: 4, math: 0, memMax: 524287n, },
        { value: 67108863n, mem: 5, math: 0, memMax: 67108863n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign1Postfix3Unaligned: [
        { value: 133n, mem: 1, math: 2, memMax: 5n, },
        { value: 32773n, mem: 1, math: 3, memMax: 5n, },
        { value: 32783n, mem: 2, math: 3, memMax: 15n, },
        { value: 4294934528n, mem: 1, math: 5, memMax: 5n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign1Postfix3Aligned: [
        { value: 5n, mem: 1, math: 0, memMax: 5n, },
        { value: 15n, mem: 2, math: 0, memMax: 15n, },
        { value: 2047n, mem: 3, math: 0, memMax: 2047n, },
        { value: 262143n, mem: 4, math: 0, memMax: 262143n, },
        { value: 33554431n, mem: 5, math: 0, memMax: 33554431n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign2Postfix1Unaligned: [
        { value: 138n, mem: 1, math: 2, memMax: 10n, },
        { value: 32778n, mem: 1, math: 3, memMax: 10n, },
        { value: 32894n, mem: 2, math: 3, memMax: 126n, },
        { value: 4294934528n, mem: 1, math: 5, memMax: 10n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign2Postfix1Aligned: [
        { value: 10n, mem: 1, math: 0, memMax: 10n, },
        { value: 126n, mem: 2, math: 0, memMax: 126n, },
        { value: 16382n, mem: 3, math: 0, memMax: 16382n, },
        { value: 2097150n, mem: 4, math: 0, memMax: 2097150n, },
        { value: 268435454n, mem: 5, math: 0, memMax: 268435454n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign2Postfix2Unaligned: [
        { value: 138n, mem: 1, math: 2, memMax: 10n, },
        { value: 32778n, mem: 1, math: 3, memMax: 10n, },
        { value: 32830n, mem: 2, math: 3, memMax: 62n, },
        { value: 4294934528n, mem: 1, math: 5, memMax: 10n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign2Postfix2Aligned: [
        { value: 10n, mem: 1, math: 0, memMax: 10n, },
        { value: 62n, mem: 2, math: 0, memMax: 62n, },
        { value: 8190n, mem: 3, math: 0, memMax: 8190n, },
        { value: 1048574n, mem: 4, math: 0, memMax: 1048574n, },
        { value: 134217726n, mem: 5, math: 0, memMax: 134217726n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign2Postfix3Unaligned: [
        { value: 138n, mem: 1, math: 2, memMax: 10n, },
        { value: 32778n, mem: 1, math: 3, memMax: 10n, },
        { value: 32798n, mem: 2, math: 3, memMax: 30n, },
        { value: 4294934528n, mem: 1, math: 5, memMax: 10n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign2Postfix3Aligned: [
        { value: 10n, mem: 1, math: 0, memMax: 10n, },
        { value: 30n, mem: 2, math: 0, memMax: 30n, },
        { value: 4094n, mem: 3, math: 0, memMax: 4094n, },
        { value: 524286n, mem: 4, math: 0, memMax: 524286n, },
        { value: 67108862n, mem: 5, math: 0, memMax: 67108862n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign4Postfix1Unaligned: [
        { value: 148n, mem: 1, math: 2, memMax: 20n, },
        { value: 32788n, mem: 1, math: 3, memMax: 20n, },
        { value: 33020n, mem: 2, math: 3, memMax: 252n, },
        { value: 4294934528n, mem: 1, math: 5, memMax: 20n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign4Postfix1Aligned: [
        { value: 20n, mem: 1, math: 0, memMax: 20n, },
        { value: 252n, mem: 2, math: 0, memMax: 252n, },
        { value: 32764n, mem: 3, math: 0, memMax: 32764n, },
        { value: 4194300n, mem: 4, math: 0, memMax: 4194300n, },
        { value: 536870908n, mem: 5, math: 0, memMax: 536870908n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign4Postfix2Unaligned: [
        { value: 148n, mem: 1, math: 2, memMax: 20n, },
        { value: 32788n, mem: 1, math: 3, memMax: 20n, },
        { value: 32892n, mem: 2, math: 3, memMax: 124n, },
        { value: 4294934528n, mem: 1, math: 5, memMax: 20n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign4Postfix2Aligned: [
        { value: 20n, mem: 1, math: 0, memMax: 20n, },
        { value: 124n, mem: 2, math: 0, memMax: 124n, },
        { value: 16380n, mem: 3, math: 0, memMax: 16380n, },
        { value: 2097148n, mem: 4, math: 0, memMax: 2097148n, },
        { value: 268435452n, mem: 5, math: 0, memMax: 268435452n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign4Postfix3Unaligned: [
        { value: 148n, mem: 1, math: 2, memMax: 20n, },
        { value: 32788n, mem: 1, math: 3, memMax: 20n, },
        { value: 32828n, mem: 2, math: 3, memMax: 60n, },
        { value: 4294934528n, mem: 1, math: 5, memMax: 20n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
    shortAlign4Postfix3Aligned: [
        { value: 20n, mem: 1, math: 0, memMax: 20n, },
        { value: 60n, mem: 2, math: 0, memMax: 60n, },
        { value: 8188n, mem: 3, math: 0, memMax: 8188n, },
        { value: 1048572n, mem: 4, math: 0, memMax: 1048572n, },
        { value: 134217724n, mem: 5, math: 0, memMax: 134217724n, },
        { value: 4294934528n, mem: 6, math: 0, memMax: 4294967295n, fallback: true, },
        { value: 4294967168n, mem: 1, math: 3, memMax: 0n, negative: true, },
        { value: 4294967295n, mem: 1, math: 2, memMax: 0n, negative: true, },
    ],
};

// ---- Unaligned memory access optimal instruction sizes - end - generated with help of script ----

export class MemInstruction extends InstrBase {

    private static WRITE_FLAG = 1 << 5;
    private static CODES_SHORT = {
        [BASE.MAB0]: 0x00,
        [BASE.MAB1]: 0x02,
        [BASE.MAB0 | BASE.POP]: 0x01,
        [BASE.MAB1 | BASE.POP]: 0x03,
    };
    private static CODES_LONG = {
        [BASE.MAB0]: 0x18,
        [BASE.MAB1]: 0x1A,
        [BASE.MAB2]: 0x1C,
        [BASE.MAB3]: 0x1E,
        [BASE.MAB0 | BASE.POP]: 0x19,
        [BASE.MAB1 | BASE.POP]: 0x1B,
        [BASE.MAB2 | BASE.POP]: 0x1D,
        [BASE.MAB3 | BASE.POP]: 0x1F,
    };

    private static SHORT_OFFSET_SHIFT = 2;

    private static SMALLER_THAN_WORD_FLAG = 1 << 0;
    private static HALF_WORD_FLAG = 1 << 1;
    private static SIGN_EXT_FLAG = 1 << 2;
    private static BITS_64_FLAG = 1 << 1;

    private arg: ExprEval;
    private bytes: number;
    private align: number;
    private postfixSize: number;
    private postfix: number;
    private codeShort: number | undefined;
    private codeLong: number;
    private sizesAligned: UnalignedInstrSizeDesc[];
    private sizesUnaligned: UnalignedInstrSizeDesc[];

    constructor(params: InstrParams, args: string, private base: BASE) {
        super(params);
        this.arg = params.exprMaker.makeOptionalExpression(this, args) || (() => 0n);
        this.bytes = this.info.instrOptions.bytes as number;
        this.align = Math.min(4, this.bytes);
        let write = !!this.info.instrOptions.write;
        let signExtend = !!this.info.instrOptions.signExtend;
        // Instruction can be short (one-byte code only) or long (instruction code, offset and postfix).
        // Prepare instruction code for both short and long version. If short is not possible, codeShort is undefined.
        this.codeShort = MemInstruction.CODES_SHORT[base];
        this.codeLong = MemInstruction.CODES_LONG[base];
        if (write) {
            if (this.codeShort != undefined) {
                this.codeShort |= MemInstruction.WRITE_FLAG;
            }
            this.codeLong |= MemInstruction.WRITE_FLAG;
        }
        // Prepare postfix (and its size).
        this.postfix = 0;
        if (this.bytes < 4) {
            // Short version is not possible for access size other than 32-bits.
            this.codeShort = undefined;
            // Set bit indicating non-32-bit access.
            this.postfix |= MemInstruction.SMALLER_THAN_WORD_FLAG;
            // Add and set bit indicating whether this is 16-bit operation or not.
            this.postfixSize = 2;
            if (this.bytes === 2) {
                this.postfix |= MemInstruction.HALF_WORD_FLAG;
            }
            // For read operations, add and set bit indicating whether sign extending should be done.
            if (!write) {
                this.postfixSize = 3;
                if (signExtend) {
                    this.postfix |= MemInstruction.SIGN_EXT_FLAG;
                }
            }
        } else if (this.bytes === 4) {
            if (this.compiler.extensions.mem64) {
                // Add one bit to postfix indicating whether this is 64-bit operation or not.
                this.postfixSize = 2;
            } else {
                this.postfixSize = 1;
            }
        } else {
            // Short version is not possible for access size other than 32-bits.
            this.codeShort = undefined;
            // Add one bit to postfix indicating 64-bit operation.
            this.postfixSize = 2;
            this.postfix |= MemInstruction.BITS_64_FLAG;
        }
        // Get optimal instruction sizes for this instruction
        let id = `${this.codeShort === undefined ? 'long' : 'short'}Align${this.align}Postfix${this.postfixSize}`;
        this.sizesAligned = unalignedSizes[id + 'Aligned'];
        this.sizesUnaligned = unalignedSizes[id + 'Unaligned'];
    }

    collectDeps(ctx: ExprContext) {
        this.arg(ctx);
    }

    getSize(ctx: ExprContext) {
        let offset = this.arg(ctx) & 0xFFFFFFFFn;
        let sizesArray = ((offset & BigInt(this.align - 1)) === 0n) ? this.sizesAligned : this.sizesUnaligned;
        for (let sizes of sizesArray) {
            if (offset <= sizes.value) {
                return sizes.mem + sizes.math;
            }
        }
        throw new CompilerError(this.lineNumber, 'Internal error.');
    }

    generate(generator: BytecodeGenerator, minSize: number) {
        let offset = this.arg(new ExprContext()) & 0xFFFFFFFFn;
        let aligned = ((offset & BigInt(this.align - 1)) === 0n) && minSize <= 6;
        let sizesArray = aligned ? this.sizesAligned : this.sizesUnaligned;
        // Find optimal memory and arithmetic instructions for this offset.
        let optimalSize!: UnalignedInstrSizeDesc;
        for (let size of sizesArray) {
            if (offset <= size.value && minSize <= size.mem + size.math) {
                optimalSize = size;
                break;
            } else if (size.fallback) {
                optimalSize = size;
            }
        }
        //
        let isPop = this.codeLong & 1;
        // Calculate maximum memory operation offset
        let memOffset = bigIntMin(offset, optimalSize.memMax);
        memOffset &= BigInt(this.align - 1) ^ 0xFFFFFFFFn;
        let popFlag: number;
        if (optimalSize.math === 0) {
            popFlag = 0;
        } else {
            // Calculate remaining offset for arithmetic operation
            let mathOffset = -(offset - memOffset);
            // Output the arithmetic operation
            let immSize = getImmediateSize(mathOffset, optimalSize.math - 1);
            let mathInstrCodeFlags = immSize === 1 ? 0x82 : immSize === 2 ? 0x81 : 0x80;
            generator.put8(mathInstrCodeFlags | (instrInfoById[isPop ? INSTR.SUB : INSTR.NEG].opcode << 2));
            putImmediate(generator, mathOffset, immSize);
            popFlag = 1;
        }
        memOffset /= BigInt(this.align);
        if (this.codeShort !== undefined && optimalSize.mem === 1) {
            generator.put8(this.codeShort | popFlag | (Number(memOffset) << MemInstruction.SHORT_OFFSET_SHIFT));
        } else {
            generator.put8(this.codeLong | popFlag);
            memOffset <<= BigInt(this.postfixSize);
            memOffset |= BigInt(this.postfix);
            putMemImmediate(generator, memOffset, optimalSize.mem - 1);
        }
    }

}


export class DataInstruction extends InstrBase {

    private itemBytes: number;
    private args: ExprEval[];

    constructor(params: InstrParams, args: string) {
        super(params);
        this.itemBytes = this.info.instrOptions.bytes as number;
        this.args = params.exprMaker.makeExpressions(this, args);
    }
    collectDeps(ctx: ExprContext) {
        for (let arg of this.args)
            arg(ctx);
    }
    getSize(): number {
        return this.itemBytes * this.args.length;
    }
    generate(generator: BytecodeGenerator) {
        let ctx = new ExprContext();
        generator.reserve(this.itemBytes * this.args.length);
        for (let arg of this.args) {
            let value = arg(ctx);
            generator.putInt(value, this.itemBytes);
        }
    }
}


export class FillInstruction extends InstrBase {

    private itemBytes: number;
    private bytes: ExprEval;
    private args: ExprEval[];

    constructor(params: InstrParams, args: string) {
        super(params);
        this.itemBytes = this.info.instrOptions.bytes as number;
        this.args = params.exprMaker.makeExpressions(this, args);
        this.bytes = this.args.shift() as ExprEval;
    }
    collectDeps(ctx: ExprContext) {
        this.bytes(ctx);
        for (let arg of this.args)
            arg(ctx);
    }
    getSize(ctx: ExprContext): number {
        let expectedSize = Number(this.bytes(ctx));
        if (expectedSize > MAX_FILL_SIZE) {
            return 0;
        }
        return expectedSize;
    }
    generate(generator: BytecodeGenerator) {
        let ctx = new ExprContext();
        let expectedSize = Number(this.bytes(ctx));
        if (expectedSize > MAX_FILL_SIZE) {
            this.compiler.error(this.lineNumber, 'Fill bytes too high.');
            return;
        }
        // Allocate data buffer on the output big enough to hold the input at least one time.
        let buffer = generator.allocate(Math.max(expectedSize, this.args.length * this.itemBytes));
        // Put input data into buffer
        let start = generator.address;
        for (let arg of this.args) {
            let value = arg(ctx);
            generator.putInt(value, this.itemBytes);
        }
        let size = generator.address - start;
        // If we have no input, assume some zeros
        if (size == 0) {
            generator.put32(0);
            size += 4;
        }
        if (buffer) {
            // Double data that we already filled until we reach expected size
            while (size < expectedSize) {
                buffer.copyWithin(size, 0, size);
                size *= 2;
            }
        }
        // Commit the buffer to the output
        generator.address = start + expectedSize;
    }
}

export class AlignInstruction extends InstrBase {

    private alignExpr: ExprEval;
    private addrExpr: ExprEval;

    constructor(params: InstrParams, args: string) {
        super(params);
        this.alignExpr = params.exprMaker.makeSingleExpression(this, args);
        this.addrExpr = params.exprMaker.makeSingleExpression(this, 'vma()');
    }
    collectDeps(ctx: ExprContext) {
        this.alignExpr(ctx);
    }
    getSize(ctx: ExprContext): number {
        ctx.mutable = true;
        return 0;
    }
    generate(generator: BytecodeGenerator) {
        let ctx = new ExprContext();
        let alignValue = Number(this.compiler.checkDiv0(this, ctx, this.alignExpr, 'Invalid alignment.'));
        let addrValue = Number(this.addrExpr(ctx));
        let unaligned = alignValue == 0 ? 0 : addrValue % alignValue;
        if (unaligned != 0) {
            let size = alignValue - unaligned;
            generator.fill(0, size);
        }
    }
}

export class AddrInstruction extends InstrBase {

    private expected: ExprEval;
    private current: ExprEval;

    constructor(params: InstrParams, args: string) {
        super(params);
        this.expected = params.exprMaker.makeSingleExpression(this, args);
        this.current = this.info.instrOptions.program
            ? params.exprMaker.makeSingleExpression(this, 'pma()')
            : params.exprMaker.makeSingleExpression(this, 'vma()');
    }
    collectDeps(ctx: ExprContext) {
        this.expected(ctx);
    }
    getSize(ctx: ExprContext): number {
        ctx.mutable = true;
        return 0;
    }
    generate(generator: BytecodeGenerator) {
        let ctx = new ExprContext();
        let expectedValue = Number(this.expected(ctx));
        let currentValue = Number(this.current(ctx));
        let padding = expectedValue - currentValue;
        if (padding > 0) {
            generator.fill(0, padding);
        } else if (padding < 0) {
            this.compiler.error(this.lineNumber, 'Address directive cannot decrease address.');
        }
    }
}

export class RefInstruction extends InstrBase {

    private args: ExprEval[];

    constructor(params: InstrParams, args: string) {
        super(params);
        this.args = params.exprMaker.makeExpressions(this, args);
    }
    collectDeps(ctx: ExprContext) {
        for (let arg of this.args)
            arg(ctx);
    }
}

export class ReadSpInstruction extends InstrBase {
    static INSTR_CODE = 0x82;
    constructor(params: InstrParams, args: string) {
        super(params);
        params.exprMaker.makeExpressions(this, args);
    }
    getSize(): number {
        return 1;
    }
    generate(generator: BytecodeGenerator) {
        generator.put8(ReadSpInstruction.INSTR_CODE | (this.info.opcode << 2));
    }
}

export class PlaceInstruction extends InstrBase {
    public name: string;
    constructor(params: InstrParams, args: string) {
        super(params);
        this.name = args.trim();
        if (this.name == '')
            throw new CompilerError(this.lineNumber, 'Expecting name.');
    }
}


export class BaseInstruction extends InstrBase {
    private arg: ExprEval;
    constructor(params: InstrParams, args: string) {
        super(params);
        this.arg = params.exprMaker.makeSingleExpression(this, args);
    }
    collectDeps(ctx: ExprContext) {
        let base = this.arg(ctx);
        if (ctx.mutable) {
            throw new CompilerError(this.lineNumber, 'Expression is not constant.');
        }
        this.compiler.pmaBase = Number(base);
    }
}

export class AssertInstruction extends InstrBase {
    private arg: ExprEval;
    private message: string;
    constructor(params: InstrParams, args: string) {
        super(params);
        /* cre`
            expr: lazy-repeat any
            ","
            repeat whitespace
            ["]
            message: repeat any
            ["]
            repeat whitespace
            end-of-text
        `*/
        let groups = args.match(/(?<expr>.*?),\s*"(?<message>.*)"\s*$/su)?.groups;
        if (!groups) {
            throw new CompilerError(this.lineNumber, 'Invalid assertion.');
        }
        this.message = groups.message;
        this.arg = params.exprMaker.makeSingleExpression(this, groups.expr);
    }
    collectDeps(ctx: ExprContext) {
        this.arg(ctx);
    }
    generate() {
        let ctx = new ExprContext();
        let condition = this.arg(ctx);
        if (condition === 0n) {
            this.compiler.error(this.lineNumber, `Assertion: ${this.message}`);
        }
    }
}

export class MTableInstruction extends InstrBase {
}
