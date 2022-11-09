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

import { ParserError } from "./parser";
import { BASE, instrInfoById, INSTR, InstrInfo } from "./instrInfo";
import { Compiler } from "./compiler";

export interface ExprContext {
    instr: InstrBase;
    invalid?: boolean;
    deps?: Set<Block>;
};

export type ExprEval = (ctx: ExprContext) => bigint;


export class ExprCycleError extends Error { };


export class InstrBase {

    public pma: number | undefined;
    public pmaEnd: number = 0;
    public pmaOld: number = 0;
    public pmaEstimated: number | undefined;

    protected addr: number = 0;

    constructor(public compiler: Compiler, public lineNumber: number, public index: number, protected info: InstrInfo | null) {
    }

    getSize(ctx: ExprContext) {
        return 0;
    }

    collectDeps(deps: Set<Block>) {
    }

    generate(minSize: number) {
    }

    generateByte(value: number) {
        this.compiler.output[this.compiler.pma++] = value;
    }

    generateData(value: bigint, bytes: number) {
        let output = this.compiler.output;
        let addr = this.compiler.pma;
        for (let i = 0; i < bytes; i++) {
            output[addr++] = Number(value & 0xFFn);
            value = value >> 8n;
        }
        this.compiler.pma = addr;
    }

    generateImmediate(value: bigint, minSize: number) {
        let valueInt = Number(value & 0xFFFFFFFFn);
        let output = this.compiler.output;
        let addr = this.compiler.pma;
        if ((valueInt <= 0x7F || valueInt >= 0xFFFFFF80) && minSize <= 1) {
            output[addr++] = valueInt & 0xFF;
        } else if ((valueInt <= 0x7FFF || valueInt >= 0xFFFF8000) && minSize <= 2) {
            output[addr++] = valueInt & 0xFF;
            output[addr++] = (valueInt >> 8) & 0xFF;
        } else {
            output[addr++] = valueInt & 0xFF;
            output[addr++] = (valueInt >> 8) & 0xFF;
            output[addr++] = (valueInt >> 16) & 0xFF;
            output[addr++] = (valueInt >> 24) & 0xFF;
        }
        this.compiler.pma = addr;
    }

    getImmediateSize(value: bigint) {
        let valueInt = Number(value & 0xFFFFFFFFn);
        if (valueInt <= 0x7F || valueInt >= 0xFFFFFF80) {
            return 1;
        } else if (valueInt <= 0x7FFF || valueInt >= 0xFFFF8000) {
            return 2;
        } else {
            return 4;
        }
    }
};


export class Block extends InstrBase {
    public discardable: boolean = false;
    public moveTo: string | null = null;
    public end: InstrBase | null = null;
    public locals: { [k: string]: string } = {};
    public deps: Set<Block> = new Set();
    public used: boolean = false;

    constructor(compiler: Compiler, lineNumber: number, index: number, args: string, public block: Block | null) {
        super(compiler, lineNumber, index, null);
        let [blockType, blockArgs] = args.split(/\s+/, 2);
        blockArgs = blockArgs.trim();
        switch (blockType.toUpperCase()) {
            case 'DISCARDABLE':
                if (blockArgs != '') throw new ParserError(`${this.lineNumber}: Unexpected string after DISCARDABLE.`);
                this.discardable = true;
                break;
            case 'MOVABLE':
                if (blockArgs == '') throw new ParserError(`${this.lineNumber}: Destination name expected.`);
                this.moveTo = blockArgs;
                break;
            case '':
                // nothing to do
                break;
            default:
                throw new ParserError(`${this.lineNumber}: Unknown type of block.`);
        }
    }
};


export class BlockEnd extends InstrBase {
    constructor(compiler: Compiler, lineNumber: number, index: number, public block: Block) {
        super(compiler, lineNumber, index, null);
    }
};


export class EmptyInstr extends InstrBase {
    constructor(compiler: Compiler, lineNumber: number, index: number) {
        super(compiler, lineNumber, index, null);
    }
};


function mergeExprCtx(dst: ExprContext, src: ExprContext) {
    dst.invalid = dst.invalid || src.invalid;
    if (dst.deps && src.deps) {
        for (let b of src.deps) {
            dst.deps.add(b);
        }
    }
}


export class Assign extends InstrBase {
    private calculating: boolean = false;

    constructor(compiler: Compiler, lineNumber: number, index: number, protected value: ExprEval, protected block: Block) {
        super(compiler, lineNumber, index, null);
    }
    collectDeps(deps: Set<Block>): void {
        let newDeps: Set<Block> = new Set();
        let ctx: ExprContext = { instr: this, invalid: false, deps: newDeps };
        this.calculate(ctx);
        for (let b of newDeps) {
            deps.add(b);
        }
    }
    getValue(ctx: ExprContext): bigint {
        let thisCtx: ExprContext = { ...ctx, instr: this };
        let result = this.calculate(thisCtx);
        mergeExprCtx(ctx, thisCtx);
        if (ctx.deps) {
            ctx.deps.add(this.block);
        }
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
};

export class SimpleCoreInstruction extends InstrBase {

    public static INSTR_CODES = [0x83, 0x82, 0x81, 0, 0x80];

    private arg: ExprEval | null;

    constructor(compiler: Compiler, lineNumber: number, index: number, info: InstrInfo, args: ExprEval[], base: BASE) {
        super(compiler, lineNumber, index, info);
        this.arg = args.length > 0 ? args[0] : null;
    }
    collectDeps(deps: Set<Block>) {
        if (this.arg !== null) {
            this.arg({ instr: this, deps: deps, invalid: false });
        }
    }
    getSize(ctx: ExprContext): number {
        if (this.arg !== null) {
            let thisCtx: ExprContext = { instr: this };
            let argValue = this.arg(thisCtx);
            mergeExprCtx(ctx, thisCtx);
            if (thisCtx.invalid) {
                return 2;
            } else {
                return 1 + this.getImmediateSize(argValue);
            }
        } else {
            return 1;
        }
    }
    generate(minSize: number) {
        if (this.arg !== null) {
            let argValue = this.arg({ instr: this });
            let size = this.getImmediateSize(argValue);
            while (size < (minSize - 1) && size < 4) {
                size <<= 1;
            }
            this.generateByte(SimpleCoreInstruction.INSTR_CODES[size] | (this.info!.opcode << 2));
            this.generateImmediate(argValue, size);
        } else {
            this.generateByte(SimpleCoreInstruction.INSTR_CODES[0] | (this.info!.opcode << 2));
        }
    }
};

export class BranchInstruction extends InstrBase {

    private static INSTR_CODES = [0x83, 0x82, 0x81, 0, 0x80];

    constructor(compiler: Compiler, lineNumber: number, index: number, info: InstrInfo, private destExpr: ExprEval, private addrExpr: ExprEval) {
        super(compiler, lineNumber, index, info);
    }
    collectDeps(deps: Set<Block>) {
        this.destExpr({ instr: this, deps: deps });
        this.addrExpr({ instr: this, deps: deps });
    }
    getSize(ctx: ExprContext): number {
        ctx.invalid = true;
        return 2;
    }
    generate(minSize: number) {
        let dest = Number(this.destExpr({ instr: this }));
        let addr = Number(this.addrExpr({ instr: this }));
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
        this.generateByte(BranchInstruction.INSTR_CODES[size] | (this.info!.opcode << 2));
        this.generateImmediate(BigInt(offset - size - 1), size);
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

    constructor(compiler: Compiler, lineNumber: number, index: number, info: InstrInfo, args: ExprEval[], private base: BASE) {
        super(compiler, lineNumber, index, info);
        this.arg = args.length > 0 ? args[0] : (ctx => 0n);
        this.write = info.name.startsWith('W');
        this.signed = info.name.endsWith('S');
        this.bytes = info.opcode;
        if (base == BASE.ZERO && args.length == 0) {
            throw new ParserError(`${this.lineNumber}: "${info.name}" instruction without arguments!`);
        }
    }
    collectDeps(deps: Set<Block>) {
        this.arg({ instr: this, deps: deps });
    }
    getSize(ctx: ExprContext) {
        return this.genCommon(0, ctx);
    }
    generate(minSize: number) {
        this.genCommon(minSize, null);
    }
    genCommon(minSize: number, ctx: ExprContext | null) {
        let totalSize = 0;
        let argValue: bigint;
        let thisCtx: ExprContext = { instr: this };
        argValue = this.arg(thisCtx) & 0xFFFFFFFFn;
        if (ctx) {
            mergeExprCtx(ctx, thisCtx);
            if (!thisCtx.invalid) { // TODO: check if "!" is needed here
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
            let size = this.getImmediateSize(addImm);
            totalSize += 1 + size;
            if (!ctx) {
                this.generateByte(SimpleCoreInstruction.INSTR_CODES[size] | (opcode << 2));
                this.generateImmediate(addImm, size);
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
        } else if (this.compiler.extensions.MEM64) {
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
            this.generateByte(
                ((this.base & BASE.REG_MASK) << ReadWriteInstruction.BASE_SHIFT) |
                ((this.write ? 1 : 0) << ReadWriteInstruction.WRITE_SHIFT) |
                ((doPop ? 1 : 0) << ReadWriteInstruction.POP_SHIFT) |
                ((tailSize > 0 ? 1 : 0) << ReadWriteInstruction.MORE_SHIFT) |
                (rwImm >> (7 * tailSize)));
            while (tailSize > 0) {
                tailSize--;
                this.generateByte(
                    ((tailSize > 0 ? 1 : 0) << 7) |
                    ((rwImm >> (7 * tailSize)) & 0x7F));
            }
        }
        return totalSize;
    }
};

export class UnwindInstruction extends InstrBase {

    static INSTR_CODES = [0x83, 0x82, 0x81, 0, 0x80];

    constructor(compiler: Compiler, lineNumber: number, index: number, info: InstrInfo, private args: ExprEval[]) {
        super(compiler, lineNumber, index, info);
    }
    collectDeps(deps: Set<Block>) {
        this.args[0]({ instr: this, deps: deps });
        if (this.args.length > 1) {
            this.args[1]({ instr: this, deps: deps });
        }
    }
    getSize(ctx: ExprContext): number {
        let thisCtx: ExprContext = { instr: this };
        let argValue = this.getArgValue(thisCtx);
        ctx.invalid = ctx.invalid || thisCtx.invalid || argValue === null;
        if (thisCtx.invalid) {
            return 2;
        } else if (argValue === null) {
            return 1 + 4;
        } else {
            return 1 + this.getImmediateSize(argValue);
        }
    }
    generate(minSize: number) {
        let argValue = this.getArgValue({ instr: this });
        if (argValue === null) {
            this.compiler.postPostponedError = new ParserError(`${this.lineNumber}: Too many words to unwind!`);
            argValue = 0n;
        }
        let size = this.getImmediateSize(argValue);
        while (size < (minSize - 1) && size < 4) {
            size = size << 1;
        }
        this.generateByte(SimpleCoreInstruction.INSTR_CODES[size] | (this.info!.opcode << 2));
        this.generateImmediate(argValue, size);
    }
    getArgValue(ctx: ExprContext): bigint | null {
        let argValue = this.args[0](ctx);
        if (this.args.length > 1) {
            let keep = argValue;
            let reduce = this.args[1](ctx);
            if (reduce <= 15n && keep <= 7n) {
                return (keep << 4n) | reduce;
            } else if (reduce <= 15n && keep <= 15n) {
                return (keep << 4n) | reduce | 0xFFFFFF00n;
            } else if (reduce <= 255n && keep <= 127n) {
                return (keep << 8n) | reduce;
            } else if (reduce <= 255n && keep <= 255n) {
                return (keep << 8n) | reduce | 0xFFFF0000n;
            } else if (reduce <= 65535n && keep <= 65535n) {
                return (keep << 16n) | reduce;
            } else {
                return null;
            }
        } else {
            return argValue;
        }
    }
};

export class DataInstruction extends InstrBase {

    private itemBytes: number;

    constructor(compiler: Compiler, lineNumber: number, index: number, info: InstrInfo, private args: ExprEval[]) {
        super(compiler, lineNumber, index, info);
        this.itemBytes = this.info!.opcode;
        this.args = args;
    }
    collectDeps(deps: Set<Block>) {
        let ctx = { instr: this, deps: deps };
        for (let arg of this.args) {
            arg(ctx);
        }
    }
    getSize(): number {
        return this.itemBytes * this.args.length;
    }
    generate() {
        this.compiler.reserveOutput(this.itemBytes * this.args.length);
        for (let arg of this.args) {
            let value = arg({ instr: this });
            this.generateData(value, this.itemBytes);
        }
    }
};

export class AlignInstruction extends InstrBase {

    constructor(compiler: Compiler, lineNumber: number, index: number, info: InstrInfo, private alignExpr: ExprEval, private addrExpr: ExprEval) {
        super(compiler, lineNumber, index, info);
    }
    collectDeps(deps: Set<Block>) {
        let ctx = { instr: this, deps: deps };
        this.alignExpr(ctx);
        this.addrExpr(ctx);
    }
    getSize(ctx: ExprContext): number {
        ctx.invalid = true;
        return 0;
    }
    generate() {
        let thisCtx = { instr: this };
        let alignValue = Number(this.alignExpr(thisCtx));
        let addrValue = Number(this.addrExpr(thisCtx));
        let unaligned = alignValue == 0 ? 0 : addrValue % alignValue;
        if (unaligned != 0) {
            let size = alignValue - unaligned;
            this.compiler.reserveOutput(size);
            this.compiler.output.fill(0, this.compiler.pma, this.compiler.pma + size);
            this.compiler.pma += size;
        }
    }
};

export class AddrInstruction extends InstrBase {

    constructor(compiler: Compiler, lineNumber: number, index: number, info: InstrInfo, private expected: ExprEval, private current: ExprEval) {
        super(compiler, lineNumber, index, info);
    }
    collectDeps(deps: Set<Block>) {
        let ctx = { instr: this, deps: deps };
        this.expected(ctx);
        this.current(ctx);
    }
    getSize(ctx: ExprContext): number {
        ctx.invalid = true;
        return 0;
    }
    generate() {
        let thisCtx = { instr: this };
        let expectedValue = Number(this.expected(thisCtx));
        let currentValue = Number(this.current(thisCtx));
        let padding = expectedValue - currentValue;
        if (padding > 0) {
            this.compiler.reserveOutput(padding);
            this.compiler.output.fill(0, this.compiler.pma, this.compiler.pma + padding);
            this.compiler.pma += padding;
        }
    }
};

export class RefInstruction extends InstrBase {

    constructor(compiler: Compiler, lineNumber: number, index: number, info: InstrInfo, private args: ExprEval[]) {
        super(compiler, lineNumber, index, info);
    }
    collectDeps(deps: Set<Block>) {
        let ctx = { instr: this, deps: deps };
        for (let arg of this.args) {
            arg(ctx);
        }
    }
};

export class ReadSpInstruction extends InstrBase {
    static INSTR_CODE = 0x82;
    constructor(compiler: Compiler, lineNumber: number, index: number, info: InstrInfo) {
        super(compiler, lineNumber, index, info);
    }
    getSize(): number {
        return 1;
    }
    generate() {
        this.generateByte(ReadSpInstruction.INSTR_CODE | (this.info!.opcode << 2));
    }
};

export class PlaceInstruction extends InstrBase {
    public name: string;
    constructor(compiler: Compiler, lineNumber: number, index: number, info: InstrInfo, args: string) {
        super(compiler, lineNumber, index, info);
        this.name = args.trim();
        if (this.name = '') throw new ParserError(`${this.lineNumber}: Expecting name.`);
    }
};
