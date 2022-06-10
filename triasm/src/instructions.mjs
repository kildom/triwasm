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

import { ParserError } from "./parser.mjs";
import { BASE, instrInfoById, INSTR } from "./instrInfo.mjs";


class ExprCycleError extends Error { };


class InstrBase {
    constructor(compiler, lineNumber, index, info) {
        this.compiler = compiler;
        this.lineNumber = lineNumber;
        this.index = index;
        this.info = info;
        this.addr = 0;
    }

    getSize(ctx) {
        return 0;
    }

    collectDeps() {
    }

    generate(minSize) {
    }

    generateByte(value) {
        this.compiler.output[this.compiler.addr++] = value;
    }

    generateData(value, bytes) {
        let output = this.compiler.output;
        let addr = this.compiler.addr;
        for (let i = 0; i < bytes; i++) {
            output[addr++] = Number(value & 0xFFn);
            value >>= 8n;
        }
        this.compiler.addr = addr;
    }

    generateImmediate(value, minSize) {
        value = Number(value & 0xFFFFFFFFn);
        let output = this.compiler.output;
        let addr = this.compiler.addr;
        if ((value <= 0x7F || value >= 0xFFFFFF80) && minSize <= 1) {
            output[addr++] = value & 0xFF;
        } else if ((value <= 0x7FFF || value >= 0xFFFF8000) && minSize <= 2) {
            output[addr++] = value & 0xFF;
            output[addr++] = (value >> 8) & 0xFF;
        } else {
            output[addr++] = value & 0xFF;
            output[addr++] = (value >> 8) & 0xFF;
            output[addr++] = (value >> 16) & 0xFF;
            output[addr++] = (value >> 24) & 0xFF;
        }
        this.compiler.addr = addr;
    }

    getImmediateSize(value) {
        value = Number(value & 0xFFFFFFFFn);
        if (value <= 0x7F || value >= 0xFFFFFF80) {
            return 1;
        } else if (value <= 0x7FFF || value >= 0xFFFF8000) {
            return 2;
        } else {
            return 4;
        }
    }
};


class Block extends InstrBase {
    constructor(compiler, lineNumber, index, args, block) {
        super(compiler, lineNumber, index, null);
        this.block = block;
        this.discardable = false;
        this.moveTo = null;
        this.end = null;
        this.locals = {};
        this.deps = new Set();
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


class BlockEnd extends InstrBase {
    constructor(compiler, lineNumber, index, block) {
        super(compiler, lineNumber, index, null);
        this.block = block;
    }
};


class EmptyInstr extends InstrBase {
    constructor(compiler, lineNumber, index) {
        super(compiler, lineNumber, index, null);
    }
};

function mergeExprCtx(dst, src) {
    dst.invalid = dst.invalid || src.invalid;
    if (dst.deps && src.deps) {
        for (let b of src.deps) {
            dst.deps.add(b);
        }
    }
}


class Assign extends InstrBase {
    constructor(compiler, lineNumber, index, value, block) {
        super(compiler, lineNumber, index, null);
        this.value = value;
        this.block = block;
    }
    collectDeps(deps) {
        let ctx = { instr: this, deps: new Set() };
        this.calculate(ctx);
        for (let b of ctx.deps) {
            deps.add(b);
        }
    }
    getValue(ctx) {
        let thisCtx = { ...ctx, instr: this };
        let result = this.calculate(thisCtx);
        mergeExprCtx(ctx, thisCtx);
        if (ctx.deps) {
            ctx.deps.add(this.block);
        }
        return result;
    }
    calculate(ctx) {
        let result;
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

class SimpleCoreInstruction extends InstrBase {

    static INSTR_CODES = [0x83, 0x82, 0x81, 0, 0x80];

    constructor(compiler, lineNumber, index, info, args, base) {
        super(compiler, lineNumber, index, info);
        this.arg = args.length > 0 ? args[0] : null;
    }
    collectDeps(deps) {
        if (this.arg !== null) {
            this.arg({ instr: this, deps: deps });
        }
    }
    getSize(ctx) {
        if (this.arg !== null) {
            let thisCtx = { instr: this };
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
    generate(minSize) {
        if (this.arg !== null) {
            let argValue = this.arg({ instr: this });
            let size = this.getImmediateSize(argValue);
            while (size < (minSize - 1) && size < 4) {
                size <<= 1;
            }
            this.generateByte(SimpleCoreInstruction.INSTR_CODES[size] | (this.info.opcode << 2));
            this.generateImmediate(argValue, size);
        } else {
            this.generateByte(SimpleCoreInstruction.INSTR_CODES[0] | (this.info.opcode << 2));
        }
    }
};

class BranchInstruction extends InstrBase {

    static INSTR_CODES = [0x83, 0x82, 0x81, 0, 0x80];

    constructor(compiler, lineNumber, index, info, destExpr, addrExpr) {
        super(compiler, lineNumber, index, info);
        this.destExpr = destExpr;
        this.addrExpr = addrExpr;
    }
    collectDeps(deps) {
        this.destExpr({ instr: this, deps: deps });
        this.addrExpr({ instr: this, deps: deps });
    }
    getSize(ctx) {
        ctx.invalid = true;
        return 2;
    }
    generate(minSize) {
        let dest = Number(this.destExpr({ instr: this }));
        let addr = Number(this.addrExpr({ instr: this }));
        let offset = dest - addr;
        let size;
        if (offset >= -126 && offset <= 129) {
            size = 1;
        } else if (offset >= -32765 && offset <= 32770) {
            size = 2;
        } else {
            size = 4;
        }
        while (size < (minSize - 1) && size < 4) {
            size <<= 1;
        }
        this.generateByte(SimpleCoreInstruction.INSTR_CODES[size] | (this.info.opcode << 2));
        this.generateImmediate(BigInt(offset - size - 1), size);
    }
};

class ReadWriteInstruction extends InstrBase {

    static BASE_SHIFT = 5;
    static WRITE_SHIFT = 4;
    static POP_SHIFT = 3;
    static MORE_SHIFT = 2;
    static MEM64_SHIFT = 1;
    static SMALL_SHIFT = 0;
    static SIGNED_SHIFT = 1;
    static BYTE_SHIFT = 2;

    constructor(compiler, lineNumber, index, info, args, base) {
        super(compiler, lineNumber, index, info);
        this.arg = args.length > 0 ? args[0] : (ctx => 0n);
        this.base = base;
        this.signed = info.name.endsWith('S');
        this.bytes = info.opcode;
        this.write = info.name.startsWith('W');
        if (base == 0 && args.length == 0) {
            throw new ParserError(`${this.lineNumber}: "${info.name}" instruction without arguments!`);
        }
    }
    collectDeps(deps) {
        this.arg({ instr: this, deps: deps });
    }
    getSize(ctx) {
        return this.genCommon(0, ctx);
    }
    generate(minSize) {
        this.genCommon(minSize, null);
    }
    genCommon(minSize, ctx) {
        let totalSize = 0;
        let argValue;
        let thisCtx = { instr: this };
        argValue = this.arg(thisCtx) & 0xFFFFFFFFn;
        if (ctx) {
            mergeExprCtx(ctx, thisCtx);
            if (!thisCtx.invalid) {
                argValue = 0n;
            }
        }
        if ((this.base & BASE.REG_MASK) == BASE.SP) {
            argValue = (-argValue) & 0xFFFFFFFFn;
        }
        let align = this.bytes < 4 ? BigInt(this.bytes) : 4n;
        let doPop;
        if (argValue % align != 0n || minSize >= 7) {
            let maxSub;
            if (this.bytes == 8) {
                maxSub = 127n * align;
            } else if (this.bytes == 4) {
                maxSub = 3n * align;
            } else {
                maxSub = 63n * align;
            }
            let addImm;
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
            doPop = this.base & BASE.POP;
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
        } else if (this.compiler.conf.extMem64) {
            rwImm = rwImm << 2;
        } else {
            rwImm = rwImm << 1;
        }
        let tailSize;
        let rem = rwImm;
        if (this.bytes == 4) {
            tailSize = 0;
            rem >>= 2;
        } else {
            tailSize = 1;
            rem >>= 9;
        }
        while (rem > 0) {
            tailSize++;
            rem >>= 7;
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

    constructor(compiler, lineNumber, index, info, args) {
        super(compiler, lineNumber, index, info);
        this.args = args;
    }
    collectDeps(deps) {
        this.args[0]({ instr: this, deps: deps });
        if (this.args.length > 1) {
            this.args[1]({ instr: this, deps: deps });
        }
    }
    getSize(ctx) {
        let thisCtx = { instr: this };
        let argValue = this.getArgValue(thisCtx);
        ctx.invalid = ctx.invalid || thisCtx.invalid || argValue === null;
        if (thisCtx.invalid) {
            return 2;
        } else {
            return 1 + this.getImmediateSize(argValue);
        }
    }
    generate(minSize) {
        if (this.arg !== null) {
            let argValue = this.getArgValue({ instr: this });
            if (argValue === null) {
                this.compiler.postPostponedError = new ParserError(`${this.lineNumber}: Too many words to unwind!`);
                argValue = 0n;
            }
            let size = this.getImmediateSize(argValue);
            while (size < (minSize - 1) && size < 4) {
                size <<= 1;
            }
            this.generateByte(SimpleCoreInstruction.INSTR_CODES[size] | (this.info.opcode << 2));
            this.generateImmediate(argValue, size);
        } else {
            this.generateByte(SimpleCoreInstruction.INSTR_CODES[0] | (this.info.opcode << 2));
        }
    }
    getArgValue(ctx) {
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

class DataInstruction extends InstrBase {

    constructor(compiler, lineNumber, index, info, args) {
        super(compiler, lineNumber, index, info);
        this.itemBytes = this.info.opcode;
        this.args = args;
    }
    collectDeps(deps) {
        let ctx = { instr: this, deps: deps };
        for (let arg of this.args) {
            arg(ctx);
        }
    }
    getSize(ctx) {
        return this.itemBytes * this.args.length;
    }
    generate(minSize) {
        this.compiler.reserveOutput(this.itemBytes * this.args.length);
        for (let arg of this.args) {
            let value = arg({ instr: this });
            this.generateData(value, this.itemBytes);
        }
    }
};

class AlignInstruction extends InstrBase {

    constructor(compiler, lineNumber, index, info, alignExpr, addrExpr) {
        super(compiler, lineNumber, index, info);
        this.alignExpr = alignExpr;
        this.addrExpr = addrExpr;
    }
    collectDeps(deps) {
        let ctx = { instr: this, deps: deps };
        this.alignExpr(ctx);
        this.addrExpr(ctx);
    }
    getSize(ctx) {
        ctx.invalid = true;
        return 0;
    }
    generate(minSize) {
        let thisCtx = { instr: this };
        let alignValue = Number(this.alignExpr(thisCtx));
        let addrValue = Number(this.addrExpr(thisCtx));
        let unaligned = alignValue == 0 ? 0 : addrValue % alignValue;
        if (unaligned != 0) {
            let size = alignValue - unaligned;
            this.compiler.reserveOutput(size);
            this.compiler.output.fill(0, this.compiler.addr, this.compiler.addr + size);
            this.compiler.addr += size;
        }
    }
};

class AddrInstruction extends InstrBase {

    constructor(compiler, lineNumber, index, info, expected, current) {
        super(compiler, lineNumber, index, info);
        this.expected = expected;
        this.current = current;
    }
    collectDeps(deps) {
        let ctx = { instr: this, deps: deps };
        this.expected(ctx);
        this.current(ctx);
    }
    getSize(ctx) {
        ctx.invalid = true;
        return 0;
    }
    generate(minSize) {
        let thisCtx = { instr: this };
        let expectedValue = Number(this.expected(thisCtx));
        let currentValue = Number(this.current(thisCtx));
        let padding = expectedValue - currentValue;
        if (padding > 0) {
            this.compiler.reserveOutput(padding);
            this.compiler.output.fill(0, this.compiler.addr, this.compiler.addr + padding);
            this.compiler.addr += padding;
        }
    }
};

class RefInstruction extends InstrBase {

    constructor(compiler, lineNumber, index, info, args, base) {
        super(compiler, lineNumber, index, info);
        this.args = args;
    }
    collectDeps(deps) {
        let ctx = { instr: this, deps: deps };
        for (let arg of this.args) {
            arg(ctx);
        }
    }
};

class ReadSpInstruction extends InstrBase {
    static INSTR_CODE = 0x82;
    constructor(compiler, lineNumber, index, info, args, base) {
        super(compiler, lineNumber, index, info);
    }
    getSize(ctx) {
        return 1;
    }
    generate(minSize) {
        this.generateByte(ReadSpInstruction.INSTR_CODE | (this.info.opcode << 2));
    }
};

class PlaceInstruction extends InstrBase {
    constructor(compiler, lineNumber, index, info, args, base) {
        super(compiler, lineNumber, index, info);
        this.name = args.trim();
        if (this.name = '') throw new ParserError(`${this.lineNumber}: Expecting name.`);
    }
};

export {
    ExprCycleError, Block, BlockEnd, EmptyInstr, Assign, SimpleCoreInstruction, DataInstruction,
    AlignInstruction, AddrInstruction, RefInstruction, ReadSpInstruction, BranchInstruction,
    ReadWriteInstruction, PlaceInstruction
};
