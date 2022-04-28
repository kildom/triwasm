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

    generate() {
    }

    cleanup() {
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
        this.end = null;
        this.locals = {};
        this.deps = new Set();
        switch (args.toUpperCase()) {
            case 'DISCARDABLE':
                this.discardable = true;
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


class Assign extends InstrBase {
    constructor(compiler, lineNumber, index, value, block) {
        super(compiler, lineNumber, index, null);
        this.value = value;
        this.block = block;
        this.ctx = null;
    }
    collectDeps(deps) {
        this.calculate(true);
        for (let b of this.ctx.deps) {
            deps.add(b);
        }
    }
    getValue(ctx) {
        this.calculate(ctx.deps);
        ctx.invalid = ctx.invalid || this.ctx.invalid;
        if (ctx.deps) {
            ctx.deps.add(this.block);
        }
        return this.ctx.value;
    }
    calculate(useDeps) {
        if (this.calculating) {
            throw new ExprCycleError(`${this.lineNumber}: Cycle in assignment evaluation! Cycle in the line numbers:`);
        }
        if (this.ctx === null) {
            this.ctx = { instr: this };
            if (useDeps) {
                this.ctx.deps = new Set();
            }
            try {
                this.calculating = true;
                this.ctx.value = this.value(this.ctx);
                this.calculating = false;
            } catch (ex) {
                if (ex instanceof ExprCycleError) {
                    throw new ExprCycleError(ex.message + ' ' + this.lineNumber);
                }
                throw ex;
            }
        }
    }
    cleanup() {
        this.ctx = null;
    }
    generate() {
        this.ctx = null;
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
            ctx.invalid = ctx.invalid || thisCtx.invalid;
            return 1 + this.getImmediateSize(argValue);
        } else {
            return 1;
        }
    }
    generate() {
        if (this.arg !== null) {
            let argValue = this.arg({ instr: this });
            let size = this.getImmediateSize(argValue);
            let minSize = (this.endAddr - this.addr) - 1;
            while (size < minSize && size < 4) {
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
    generate() {
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
        let minSize = (this.endAddr - addr) - 1;
        while (size < minSize && size < 4) {
            size <<= 1;
        }
        this.generateByte(SimpleCoreInstruction.INSTR_CODES[size] | (this.info.opcode << 2));
        this.generateImmediate(BigInt(offset - size - 1), size);
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
        if (argValue === null) {
            ctx.invalid = true;
            return 2;
        } else {
            ctx.invalid = ctx.invalid || thisCtx.invalid;
            return 1 + this.getImmediateSize(argValue);
        }
    }
    generate() {
        if (this.arg !== null) {
            let argValue = this.getArgValue({ instr: this });
            if (argValue === null) {
                this.compiler.postPostponedError = new ParserError(`${this.lineNumber}: Too many words to unwind!`);
                argValue = 0n;
            }
            let size = this.getImmediateSize(argValue);
            let minSize = (this.endAddr - this.addr) - 1;
            while (size < minSize && size < 4) {
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
    generate() {
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
    generate() {
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
    generate() {
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
    generate() {
        this.generateByte(ReadSpInstruction.INSTR_CODE | (this.info.opcode << 2));
    }
};

export { ExprCycleError, Block, BlockEnd, EmptyInstr, Assign, SimpleCoreInstruction, DataInstruction, AlignInstruction, AddrInstruction, RefInstruction, ReadSpInstruction, BranchInstruction };
