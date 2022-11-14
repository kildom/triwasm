/*!
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

import { BASE, instrInfoById, INSTR, InstrInfo } from "./instrInfo";
import { Compiler } from "./compiler";
import { ExprMaker } from "./exprMaker";
import { CompilerError } from "./errors";
import { allowTemporaryNull } from "../utils/common";
import { BytecodeGenerator } from "./generator";

export interface ExprContextModification {
    mutable?: boolean;
    deps?: Set<Block>;
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
};

export type ExprEval = (ctx: ExprContext) => bigint;


export class ExprCycleError extends Error { };


export class InstrParams {
    constructor(public compiler: Compiler, public generator: BytecodeGenerator, public lineNumber: number, public index: number, public info: InstrInfo, public exprMaker: ExprMaker) {
    }
};


export class InstrBase {

    public compiler: Compiler;
    public generator: BytecodeGenerator;
    public lineNumber: number;
    public index: number;
    public info: InstrInfo;

    public pma: {
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
        this.generator = params.generator;
        this.lineNumber = params.lineNumber;
        this.index = params.index;
        this.info = params.info;
    }

    getSize(ctx: ExprContext) {
        return 0;
    }

    collectDeps(ctx: ExprContext) {
    }

    generate(minSize: number) {
    }

};


export class Block extends InstrBase {
    public discarded: boolean = false;
    public moveTo: string | null = null;
    public end: BlockEnd;
    public locals: { [k: string]: string } = {};
    public deps: Set<Block> = new Set();

    constructor(params: InstrParams, args: string, public parent: Block | null) {
        super(params);
        this.end = allowTemporaryNull as BlockEnd;
        let [blockType, blockArgs] = args.split(/\s+/, 2);
        blockArgs = (blockArgs || '').trim();
        switch (blockType.toUpperCase()) {
            case 'DISCARDABLE':
                if (blockArgs != '') throw new CompilerError(this.lineNumber, `Unexpected string after DISCARDABLE.`);
                this.discarded = true;
                break;
            case 'MOVABLE':
                if (blockArgs == '') throw new CompilerError(this.lineNumber, `Destination name expected.`);
                this.moveTo = blockArgs;
                break;
            case '':
                // nothing to do
                break;
            default:
                throw new CompilerError(this.lineNumber, `Unknown type of block.`);
        }
    }
};


export class BlockEnd extends InstrBase {
    constructor(params: InstrParams, public block: Block) {
        super(params);
    }
};


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
        return this.calculate(ctx);
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
};

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
                return 1 + this.generator.getImmediateSize(argValue);
            }
        } else {
            return 1;
        }
    }
    generate(minSize: number) {
        if (this.arg !== null) {
            let argValue = this.arg(new ExprContext());
            let size = this.generator.getImmediateSize(argValue, minSize - 1);
            this.generator.put8(SimpleCoreInstruction.INSTR_CODES[size] | (this.info.opcode << 2));
            this.generator.putImmediate(argValue, size);
        } else {
            this.generator.put8(SimpleCoreInstruction.INSTR_CODES[0] | (this.info.opcode << 2));
        }
    }
};

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
    generate(minSize: number) {
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
            this.generator.put8(BranchInstruction.INSTR_CODES[size] | (this.info.opcode << 2));
            this.generator.putImmediate(BigInt(offset - size - 1), size);
        } else {
            this.generator.put8(BranchInstruction.INSTR_CODES[0] | (this.info.opcode << 2));
        }
    }
};

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
    private write: boolean;
    private signed: boolean;
    private bytes: number;

    constructor(params: InstrParams, args: string, private base: BASE) {
        super(params);
        this.arg = params.exprMaker.makeOptionalExpression(this, args) || (() => 0n);
        this.write = this.info.name.startsWith('W');
        this.signed = this.info.name.endsWith('S');
        this.bytes = this.info.opcode;
    }
    collectDeps(ctx: ExprContext) {
        this.arg(ctx);
    }
    getSize(ctx: ExprContext) {
        return this.genCommon(0, ctx);
    }
    generate(minSize: number) {
        this.genCommon(minSize);
    }
    genCommon(minSize: number, ctx?: ExprContext) {
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
        if ((this.base & BASE.REG_MASK) == BASE.SP) {
            argValue = (-argValue) & 0xFFFFFFFFn;
        }
        let align = this.bytes < 4 ? BigInt(this.bytes) : 4n;
        let doPop: boolean;
        if (argValue % align != 0n || minSize >= 7) {
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
            let opcode = instrInfoById[(this.base & BASE.POP) ? INSTR.SUB : INSTR.NEG].opcode;
            addImm = (-addImm) & 0xFFFFFFFFn;
            let size = this.generator.getImmediateSize(addImm); // TODO: if more bytes are needed because of minSize
            totalSize += 1 + size;
            if (!ctx) {
                this.generator.put8(SimpleCoreInstruction.INSTR_CODES[size] | (opcode << 2));
                this.generator.putImmediate(addImm, size);
            }
            minSize = Math.max(0, minSize - size - 1);
            doPop = true;
        } else {
            doPop = !!(this.base & BASE.POP);
        }
        let rwImm = Number(argValue / align);
        if (this.bytes == 8) {
            rwImm = (rwImm << 2) | 0x02;
        } else if (this.bytes == 1) {
            rwImm = (rwImm << 3) | 0x04 | (this.signed ? 0x02 : 0x00) | 0x01;
        } else if (this.bytes == 2) {
            rwImm = (rwImm << 3) | 0x00 | (this.signed ? 0x02 : 0x00) | 0x01;
        } else if (rwImm < 4 && minSize <= 1) {
            rwImm = rwImm << 0;
        } else if (this.compiler.extensions.mem64) {
            rwImm = rwImm << 2;
        } else {
            rwImm = rwImm << 1;
        }
        let tailSize: number;
        let rem = rwImm;
        if (this.bytes == 4) {
            tailSize = 0;
            rem = rem >> 2;
        } else {
            tailSize = 1;
            rem = rem >> 9;
        }
        while (rem > 0) {
            tailSize++;
            rem = rem >> 7;
        }
        tailSize = Math.min(Math.max(minSize - 1, tailSize), 5);
        totalSize += 1 + tailSize;
        if (!ctx) {
            this.generator.put8(
                ((this.base & BASE.REG_MASK) << ReadWriteInstruction.BASE_SHIFT) |
                ((this.write ? 1 : 0) << ReadWriteInstruction.WRITE_SHIFT) |
                ((doPop ? 1 : 0) << ReadWriteInstruction.POP_SHIFT) |
                ((tailSize > 0 ? 1 : 0) << ReadWriteInstruction.MORE_SHIFT) |
                (rwImm >> (7 * tailSize)));
            while (tailSize > 0) {
                tailSize--;
                this.generator.put8(
                    ((tailSize > 0 ? 1 : 0) << 7) |
                    ((rwImm >> (7 * tailSize)) & 0x7F));
            }
        }
        return totalSize;
    }
};


export class DataInstruction extends InstrBase {

    private itemBytes: number;
    private args: ExprEval[];

    constructor(params: InstrParams, args: string) {
        super(params);
        this.itemBytes = this.info.opcode;
        this.args = params.exprMaker.makeExpressions(this, args);
    }
    collectDeps(ctx: ExprContext) {
        for (let arg of this.args)
            arg(ctx);
    }
    getSize(): number {
        return this.itemBytes * this.args.length;
    }
    generate() {
        let ctx = new ExprContext();
        this.generator.reserve(this.itemBytes * this.args.length);
        for (let arg of this.args) {
            let value = arg(ctx);
            this.generator.putInt(value, this.itemBytes);
        }
    }
};

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
    generate() {
        let ctx = new ExprContext();
        let alignValue = Number(this.alignExpr(ctx));
        let addrValue = Number(this.addrExpr(ctx));
        let unaligned = alignValue == 0 ? 0 : addrValue % alignValue;
        if (unaligned != 0) {
            let size = alignValue - unaligned;
            this.generator.fill(0, size);
        }
    }
};

export class AddrInstruction extends InstrBase {

    private expected: ExprEval;
    private current: ExprEval;

    constructor(params: InstrParams, args: string) {
        super(params);
        this.expected = params.exprMaker.makeSingleExpression(this, args);
        this.current = this.info.opcode
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
    generate() {
        let ctx = new ExprContext();
        let expectedValue = Number(this.expected(ctx));
        let currentValue = Number(this.current(ctx));
        let padding = expectedValue - currentValue;
        if (padding > 0) {
            this.generator.fill(0, padding);
        }
    }
};

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
};

export class ReadSpInstruction extends InstrBase {
    static INSTR_CODE = 0x82;
    constructor(params: InstrParams) {
        super(params);
    }
    getSize(): number {
        return 1;
    }
    generate() {
        this.generator.put8(ReadSpInstruction.INSTR_CODE | (this.info.opcode << 2));
    }
};

export class PlaceInstruction extends InstrBase {
    public name: string;
    constructor(params: InstrParams, args: string) {
        super(params);
        this.name = args.trim();
        if (this.name == '')
            throw new CompilerError(this.lineNumber, `Expecting name.`);
    }
};


export class BaseInstruction extends InstrBase {
    private arg: ExprEval;
    constructor(params: InstrParams, args: string) {
        super(params);
        this.arg = params.exprMaker.makeSingleExpression(this, args);
    }
    collectDeps(ctx: ExprContext) {
        let base = this.arg(ctx);
        if (ctx.mutable) {
            throw new CompilerError(this.lineNumber, `Expression is not constant.`);
        }
        this.compiler.pmaBase = Number(base);
    }
}
