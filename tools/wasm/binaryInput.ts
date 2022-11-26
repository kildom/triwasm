import { platform } from '../utils/platform';


export class BinaryInput {

    private buffer: Uint8Array;
    private view: DataView;
    private pos: number;
    private limit: number;
    // @ts-ignore
    private dec: TextDecoder; // TODO: Why TS returns error here?

    public constructor(file: string);
    public constructor(source: BinaryInput, start: number, length: number);
    constructor(file_or_source: string | BinaryInput, start?: number, length?: number) {
        if (typeof (file_or_source) === 'string') {
            this.buffer = platform.readFile(file_or_source, true);
            this.view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
            this.pos = 0;
            this.limit = this.buffer.length;
            this.dec = new TextDecoder();
        } else {
            this.buffer = file_or_source.buffer;
            this.view = file_or_source.view;
            this.pos = start as number;
            this.limit = this.pos + (length as number);
            this.dec = file_or_source.dec;
        }
    }

    public slice(length: number): BinaryInput {
        if (this.pos + length > this.limit) {
            throw Error('Unexpected end of module file.');
        }
        let res = new BinaryInput(this, this.pos, length);
        this.pos += length;
        return res;
    }

    public finalize(): void {
        if (this.pos != this.limit) {
            throw Error(`Unexpected data at the end of module file or its inner container. Expected offset ${this.limit}, got ${this.pos}.`);
        }
    }

    public byte(): number {
        return this.buffer[this.pos++] || 0;
    }

    public peekByte(): number {
        return this.buffer[this.pos] || 0;
    }

    public raw(length: number): Uint8Array {
        if (this.pos + length > this.limit) {
            throw Error('Unexpected end of module file.');
        }
        let ret = this.buffer.subarray(this.pos, this.pos + length);
        this.pos += length;
        return ret;
    }

    public rawUint32(): number {
        let ret = this.view.getUint32(this.pos, true);
        this.pos += 4;
        return ret;
    }

    public rawInt32(): number {
        let ret = this.view.getInt32(this.pos, true);
        this.pos += 4;
        return ret;
    }

    public rawInt64(): bigint {
        let ret = this.view.getBigInt64(this.pos, true);
        this.pos += 8;
        return ret;
    }

    public remaining(): number {
        return this.limit - this.pos;
    }

    public u32(): number {
        let mul = 1;
        let b: number;
        let result = 0;
        do {
            b = this.buffer[this.pos++];
            result += (b & 0x7F) * mul;
            mul = mul << 7;
        } while (b & 0x80);
        return result & 0xFFFFFFFF;
    }

    public s32(): number {
        let mul = 1;
        let b: number;
        let result = 0;
        do {
            b = this.buffer[this.pos++];
            result += (b & 0x7F) * mul;
            mul *= 128;
        } while (b & 0x80);
        if (result >= mul / 2) {
            result--;
            result ^= mul - 1;
            result = -result;
        }
        return result & 0xFFFFFFFF;
    }

    public u64(): bigint {
        let mul = 1n;
        let b: number;
        let result = 0n;
        do {
            b = this.buffer[this.pos++];
            result += BigInt(b & 0x7F) * mul;
            mul = (mul * 128n) & 0xFFFFFFFFFFFFFFFFn;
        } while (b & 0x80);
        return result;
    }

    public s64(): bigint {
        let mul = 1n;
        let b: number;
        let result = 0n;
        do {
            b = this.buffer[this.pos++];
            result += BigInt(b & 0x7F) * mul;
            mul *= 128n;
        } while (b & 0x80);
        if (result >= (mul >> 1n)) {
            result--;
            result ^= (mul - 1n);
            result = -result;
        }
        return result;
    }

    str() {
        let length = this.u32();
        let result = this.dec.decode(this.buffer.subarray(this.pos, this.pos + length));
        this.pos += length;
        return result;
    }

}

