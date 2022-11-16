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


export class BytecodeGenerator {
    public pma: number = 0;
    private output: Uint8Array = new Uint8Array(65536);
    private err?: Error;

    constructor() {
    }

    public result(): Uint8Array {
        if (this.err)
            throw this.err;
        return this.output.subarray(0, this.pma);
    }

    public reset() {
        this.pma = 0;
        this.err = undefined;
    }

    public reserve(size: number) {
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

    error(err: Error) {
        this.err = err;
    }
}
