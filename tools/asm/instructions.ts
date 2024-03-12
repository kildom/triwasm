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
import cre from 'con-reg-exp';

const MAX_FILL_SIZE = 128 * 1024 * 1024;

export interface ExprContextModification {
    mutable?: boolean;
    deps?: Set<Block> | null;
}

export class ExprContext {
    constructor(public mutable?: boolean, public deps?: Set<Block>, private parent?: ExprContext) {
    }
    shallowClone(mod?: ExprContextModification) {
        return new ExprContext(
            !mod || mod.mutable === undefined ? this.mutable : mod.mutable,
            !mod || mod.deps === undefined ? this.deps : mod.deps === null ? undefined : mod.deps,
            this);
    }
    shallowMergeToParent() {
        if (this.parent) {
            this.parent.mutable = this.parent.mutable || this.mutable;
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

    public addr: {
        current: number | undefined,
        estimated: number | undefined,
        old: number,
        end: number
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
        void(ctx);
        return 0;
    }

    collectDeps(ctx: ExprContext) {
        void(ctx);
    }

    generate(generator: BytecodeGenerator, minSize: number) {
        void(minSize);
    }

}


export class Block extends InstrBase {
    public discarded: boolean = false;
    public moveTo: string | null = null;
    public end!: BlockEnd;
    public locals: { [k: string]: string } = {};
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
        let ctx2 = ctx.shallowClone({ deps: null });
        let result = this.calculate(ctx2);
        ctx2.shallowMergeToParent();
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
            let ctx2 = ctx.shallowClone({ mutable: false });
            let argValue = this.arg(ctx2);
            ctx2.shallowMergeToParent();
            if (ctx2.mutable) {
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
            let ctx2 = ctx.shallowClone({ mutable: false });
            let argValue = this.arg(ctx2);
            ctx2.shallowMergeToParent();
            if (ctx2.mutable) {
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
            let ctx2 = ctx.shallowClone({ mutable: false });
            let argValue = this.arg(ctx2);
            ctx2.shallowMergeToParent();
            if (ctx2.mutable) {
                return 3;
            } else {
                void(argValue);
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
            void(minSize);
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
        let ctx2 = ctx.shallowClone({ mutable: false });
        let keepValue = this.keep(ctx2);
        let reduceValue = this.reduce(ctx2);
        ctx2.shallowMergeToParent();
        if (ctx2.mutable) {
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
            this.compiler.error(new CompilerError(this.lineNumber, 'Too many items to unwind!'));
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

export class ReadWriteInstruction extends InstrBase {

    private static BASE_SHIFT = 5;
    private static WRITE_SHIFT = 4;
    private static POP_SHIFT = 3;
    private static MORE_SHIFT = 2;
    private static MEM64_SHIFT = 1;
    private static SMALL_SHIFT = 0;
    private static SIGNED_SHIFT = 1;
    private static BYTE_SHIFT = 2;

    private arg: ExprEval;
    private bytes: number;
    private unaligned: boolean;
    private write: boolean;
    private signed: boolean;

    constructor(params: InstrParams, args: string, private base: BASE) {
        super(params);
        let name = this.info.name;
        this.arg = params.exprMaker.makeOptionalExpression(this, args) || (() => 0n);
        this.bytes = this.info.instrOptions.bytes || 1;
        this.unaligned = name.startsWith('U') && this.bytes > 1;
        this.write = name.startsWith('W') || name.startsWith('UW');
        this.signed = name.endsWith('S');
    }
    collectDeps(ctx: ExprContext) {
        this.arg(ctx);
    }
    getSize(ctx: ExprContext) {
        return this.genCommon(undefined, 0, ctx);
    }
    generate(generator: BytecodeGenerator, minSize: number) {
        this.genCommon(generator, minSize);
    }
    genCommon(generator: BytecodeGenerator | undefined, minSize: number, ctx?: ExprContext) {
        let totalSize = 0;
        let argValue: bigint;
        let ctx2: ExprContext = ctx ? ctx.shallowClone() : new ExprContext();
        argValue = this.arg(ctx2) & 0xFFFFFFFFn;
        if (ctx) {
            ctx2.shallowMergeToParent();
            if (ctx2.mutable) {
                argValue = 0n;
            }
        }
        /*if ((this.base & BASE_REG_MASK) == BASE.SP) {
            argValue = (-argValue) & 0xFFFFFFFFn;
        }*/
        let align = this.bytes < 4 ? BigInt(this.bytes) : 4n;
        let doPop = !!(this.base & BASE.POP);
        if (!this.unaligned) {
            if (argValue % align != 0n && !ctx) {
                this.compiler.error(new CompilerError(this.lineNumber, 'Unaligned memory operation offset.'));
            }
        } else if (argValue % align != 0n || minSize >= 7) {
            let maxSub: bigint;
            if (this.bytes == 8) {
                maxSub = 127n * align;
            } else if (this.bytes == 4) {
                maxSub = 3n * align;
            } else {
                maxSub = 63n * align;
            }
            let addImm: bigint;
            if (argValue > maxSub) {
                addImm = argValue - maxSub;
            } else {
                addImm = argValue % align;
            }
            argValue -= addImm;
            let opcode = instrInfoById[doPop ? INSTR.SUB : INSTR.NEG].opcode;
            addImm = (-addImm) & 0xFFFFFFFFn;
            let size = getImmediateSize(addImm);
            totalSize += 1 + size;
            if (!ctx && generator) {
                generator.put8(SimpleCoreInstruction.INSTR_CODES[size] | (opcode << 2));
                putImmediate(generator, addImm, size);
            }
            minSize = Math.max(0, minSize - size - 1);
            doPop = true;
        }
        let rwImm = argValue / align;
        if (this.bytes == 8) {
            rwImm = (rwImm << 2n) | 0x00n;
        } else if (this.bytes == 1) {
            rwImm = (rwImm << 3n) | 0x04n | (this.signed ? 0x02n : 0x00n) | 0x01n;
        } else if (this.bytes == 2) {
            rwImm = (rwImm << 3n) | 0x00n | (this.signed ? 0x02n : 0x00n) | 0x01n;
        } else if (rwImm < 4 && minSize <= 1) {
            rwImm = rwImm << 0n;
        } else if (this.compiler.extensions.mem64) {
            rwImm = (rwImm << 2n) | 0x02n;
        } else {
            rwImm = rwImm << 1n;
        }
        let tailSize: number;
        let rem = rwImm;
        if (this.bytes == 4) {
            tailSize = 0;
            rem = rem >> 2n;
        } else {
            tailSize = 1;
            rem = rem >> 9n;
        }
        while (rem > 0) {
            tailSize++;
            rem = rem >> 7n;
        }
        tailSize = Math.min(Math.max(minSize - 1, tailSize), 5);
        totalSize += 1 + tailSize;
        if (!ctx && generator) {
            generator.put8(
                //((this.base & BASE_REG_MASK) << ReadWriteInstruction.BASE_SHIFT) |
                ((this.write ? 1 : 0) << ReadWriteInstruction.WRITE_SHIFT) |
                ((doPop ? 1 : 0) << ReadWriteInstruction.POP_SHIFT) |
                ((tailSize > 0 ? 1 : 0) << ReadWriteInstruction.MORE_SHIFT) |
                (Number(rwImm >> BigInt(7 * tailSize))));
            while (tailSize > 0) {
                tailSize--;
                generator.put8(
                    ((tailSize > 0 ? 1 : 0) << 7) |
                    (Number(rwImm >> BigInt(7 * tailSize)) & 0x7F));
            }
        }
        return totalSize;
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
            this.compiler.error(new CompilerError(this.lineNumber, 'Fill bytes too high.'));
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
            this.compiler.error(new CompilerError(this.lineNumber, 'Address directive cannot decrease address.'));
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
        let groups = args.match(cre.cache`
            expr: lazy-repeat any
            ","
            repeat whitespace
            ["]
            message: repeat any
            ["]
            repeat whitespace
            end-of-text
        `)?.groups;
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
            this.compiler.error(new CompilerError(this.lineNumber, `Assertion: ${this.message}`));
        }
    }
}

export class MTableInstruction extends InstrBase {
}
