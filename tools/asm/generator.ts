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

import { CompilerError } from './errors';


export interface BytecodeGenerator {
    address: number;
    reset(initialAddresses: number): void;
    reserve(size: number): void;
    put8(data: number): void;
    put16(data: number): void;
    put32(data: number): void;
    put64(data: bigint): void;
    putInt(value: bigint, bytes: number): void;
    fill(value: number, size: number): void;
    allocate(size: number): Uint8Array | undefined;
}


export class ProgramBytecodeGenerator implements BytecodeGenerator {

    private offset: number = 0;
    private initialAddresses: number = 0;
    private output: Uint8Array = new Uint8Array(65536);

    public get address(): number {
        return this.offset + this.initialAddresses;
    }

    public set address(value: number) {
        if (value < this.initialAddresses) {
            throw new CompilerError(0, 'Internal error.');
        }
        this.offset = value - this.initialAddresses;
        if (this.output.length < this.offset) {
            this.reserve(this.offset - this.output.length);
        }
    }

    public reset(initialAddresses: number): void {
        this.offset = 0;
        this.initialAddresses = initialAddresses;
    }

    public reserve(size: number): void {
        if (this.offset + size > this.output.length) {
            let old = this.output.subarray(0, this.offset);
            this.output = new Uint8Array(2 * (this.offset + size));
            this.output.set(old);
        }
    }

    public put8(data: number): void {
        this.output[this.offset++] = data;
    }

    public put16(data: number): void {
        this.output[this.offset++] = data & 0xFF;
        this.output[this.offset++] = (data >> 8) & 0xFF;
    }

    public put32(data: number): void {
        this.output[this.offset++] = data & 0xFF;
        this.output[this.offset++] = (data >> 8) & 0xFF;
        this.output[this.offset++] = (data >> 16) & 0xFF;
        this.output[this.offset++] = (data >> 24) & 0xFF;
    }

    public put64(data: bigint): void {
        this.output[this.offset++] = Number(data & 0xFFn);
        this.output[this.offset++] = Number((data >> 8n) & 0xFFn);
        this.output[this.offset++] = Number((data >> 16n) & 0xFFn);
        this.output[this.offset++] = Number((data >> 24n) & 0xFFn);
        this.output[this.offset++] = Number((data >> 32n) & 0xFFn);
        this.output[this.offset++] = Number((data >> 40n) & 0xFFn);
        this.output[this.offset++] = Number((data >> 48n) & 0xFFn);
        this.output[this.offset++] = Number((data >> 64n) & 0xFFn);
    }

    public putInt(value: bigint, bytes: number): void {
        for (let i = 0; i < bytes; i++) {
            this.output[this.offset++] = Number(value & 0xFFn);
            value = value >> 8n;
        }
    }

    public fill(value: number, size: number): void {
        this.reserve(size);
        this.output.fill(value & 0xFF, this.offset, this.offset + size);
        this.offset += size;
    }

    public allocate(size: number): Uint8Array | undefined {
        this.reserve(size);
        let result = this.output.subarray(this.offset, this.offset + size);
        return result;
    }

    public commit(buffer: Uint8Array | undefined, size: number): void {
        this.offset += size;
    }

    public result(): Uint8Array {
        return this.output.subarray(0, this.offset);
    }
}


export class NullBytecodeGenerator implements BytecodeGenerator {
    public address: number;
    public reset(initialAddresses: number): void {
        this.address = initialAddresses;
    }
    public reserve(): void {
    }
    public put8(): void {
        this.address++;
    }
    public put16(): void {
        this.address += 2;
    }
    public put32(): void {
        this.address += 4;
    }
    public put64(): void {
        this.address += 8;
    }
    public putInt(value: bigint, bytes: number): void {
        this.address += bytes;
    }
    public fill(value: number, size: number): void {
        this.address += size;
    }
    public allocate(): Uint8Array | undefined {
        return undefined;
    }
}


/*
    public reset(this: Private) {
        this.addr = 0;
        this.err = undefined;
    }

    public reserve(size: number) {
        let endAddress = this.addr + size;

        if (this.pma + size > this.output.length) {
            let old = this.output.subarray(0, this.pma);
            this.output = new Uint8Array(2 * (this.pma + size));
            this.output.set(old);
        }
    }

    put8(data: number) {
        this.output[this.pma++] = data & 0xFF;
    }

    put16(data: number) {
        this.output[this.pma++] = data & 0xFF;
        this.output[this.pma++] = (data >> 8) & 0xFF;
    }

    put32(data: number) {
        this.output[this.pma++] = data & 0xFF;
        this.output[this.pma++] = (data >> 8) & 0xFF;
        this.output[this.pma++] = (data >> 16) & 0xFF;
        this.output[this.pma++] = (data >> 24) & 0xFF;
    }

    put64(data: bigint) {
        this.output[this.pma++] = Number(data & 0xFFn);
        this.output[this.pma++] = Number((data >> 8n) & 0xFFn);
        this.output[this.pma++] = Number((data >> 16n) & 0xFFn);
        this.output[this.pma++] = Number((data >> 24n) & 0xFFn);
        this.output[this.pma++] = Number((data >> 32n) & 0xFFn);
        this.output[this.pma++] = Number((data >> 40n) & 0xFFn);
        this.output[this.pma++] = Number((data >> 48n) & 0xFFn);
        this.output[this.pma++] = Number((data >> 64n) & 0xFFn);
    }

    fill(value: number, size: number) {
        this.reserve(size);
        this.output.fill(value & 0xFF, this.pma, this.pma + size);
        this.pma += size;
    }

    putInt(value: bigint, bytes: number) {
        for (let i = 0; i < bytes; i++) {
            this.output[this.pma++] = Number(value & 0xFFn);
            value = value >> 8n;
        }
    }

    putImmediate(value: bigint, minSize: number) {
        let valueInt = Number(value & 0xFFFFFFFFn);
        if ((valueInt <= 0x7F || valueInt >= 0xFFFFFF80) && minSize <= 1) {
            this.output[this.pma++] = valueInt & 0xFF;
        } else if ((valueInt <= 0x7FFF || valueInt >= 0xFFFF8000) && minSize <= 2) {
            this.output[this.pma++] = valueInt & 0xFF;
            this.output[this.pma++] = (valueInt >> 8) & 0xFF;
        } else {
            this.output[this.pma++] = valueInt & 0xFF;
            this.output[this.pma++] = (valueInt >> 8) & 0xFF;
            this.output[this.pma++] = (valueInt >> 16) & 0xFF;
            this.output[this.pma++] = (valueInt >> 24) & 0xFF;
        }
    }

    putImmediate64First(value: bigint, minSize: number) {
        let size = this.getImmediateSize(value, minSize);
        if (size > 4) {
            this.putImmediate((value >> 32n) & 0xFFFFFFFFn, size - 4);
        } else {
            this.putImmediate(value & 0xFFFFFFFFn, size);
        }
    }

    putImmediate64Last(value: bigint, minSize: number) {
        let size = this.getImmediateSize(value, minSize);
        if (size > 4) {
            this.put32(Number(value & 0xFFFFFFFFn));
        }
    }

    getImmediateSize(value: bigint, minSize?: number) {
        minSize = minSize || 0;
        let valueInt = Number(value & 0xFFFFFFFFn);
        if ((valueInt <= 0x7F || valueInt >= 0xFFFFFF80) && minSize <= 1) {
            return 1;
        } else if ((valueInt <= 0x7FFF || valueInt >= 0xFFFF8000) && minSize <= 2) {
            return 2;
        } else {
            return 4;
        }
    }

    getImmediate64Size(value: bigint, minSize: number = 0) {
        let high = (value & 0xFFFFFFFF00000000n) >> 32n;
        let low = value & 0xFFFFFFFFn;
        let lowSignExt = ((low >> 31n) << 32n) - 1n;
        if (high === lowSignExt && minSize <= 4) {
            return this.getImmediateSize(low, minSize);
        } else {
            return 4 + this.getImmediateSize(high, minSize);
        }
    }

    error(err: Error) {
        this.err = err;
    }
}

class Private extends BytecodeGenerator {
    public addr: BytecodeGenerator['addr'];
}
*/
