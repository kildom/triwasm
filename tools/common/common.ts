

export const U16_MAX_VALUE = 0xFFFF;
export const S16_MIN_VALUE = -0x8000;
export const S16_MAX_VALUE = 0x7FFF;

export const U16_MAX_SIZE = 0x10000;
export const S16_MAX_SIZE = 0x08000;

export const REGISTERS_END = 4 * 12;

export class ObjMarker {
    private sym: symbol;
    public constructor(id: string) {
        this.sym = Symbol(id);
    }
    public set(obj: any) {
        obj[this.sym] = true;
    }
    public is(obj: any) {
        return !!obj[this.sym];
    }
    public clear(obj: any) {
        delete obj[this.sym];
    }
}

export function* reMatchAll(re: RegExp, str: string) {
    let m: RegExpExecArray | null;
    re = new RegExp(re);
    while ((m = re.exec(str)) !== null)
        yield m;
}


export function pick<T>(array: T[], index: number, message?: string): T {
    if (index < 0 || index >= array.length) {
        throw new Error(message || 'Index out of range.');
    }
    return array[index];
}

export function enumize<E>(x: number, enumObject?: any): E {
    if (enumObject && !(x in enumObject)) {
        throw new Error(`Unsupported value type 0x${x.toString(16)}`);
    }
    return x as E;
}

let stackSizeLimit = 100000;

export function extendArray<T = unknown>(base: unknown[], add: unknown[]): T[] {
    if (add.length <= stackSizeLimit) {
        try {
            base.push(...add);
            return base as T[];
        } catch (ex) {
            stackSizeLimit = Math.ceil(stackSizeLimit / 2);
        }
    }

    if (add === base) {
        add = [...base];
    }

    for (let i = 0; i < add.length;) {
        try {
            base.push(...add.slice(i, i + stackSizeLimit));
            i += stackSizeLimit;
        } catch (ex) {
            stackSizeLimit = Math.ceil(stackSizeLimit / 2);
            if (stackSizeLimit < 1000) {
                throw ex;
            }
        }
    }

    return base as T[];
}

export function dedent(text: string | string[] | undefined, split: true, format?: boolean): string[];
export function dedent(text: string | string[] | undefined, split: false, format?: boolean): string;
export function dedent(text: string | string[] | undefined, split: boolean, format: boolean = true): string | string[] {
    let common = 10000;
    if (typeof text === 'string') {
        text = text.split(/\r?\n/);
    } else if (typeof text === 'undefined') {
        text = [];
    }
    for (let line of text) {
        let m = line.match(/^\s*/);
        if (line.trim() && m) {
            common = Math.min(m[0].length, common);
        }
    }
    text = text.map(line => line.substring(common));
    if (format) {
        text = text.map(line => line.trimEnd());
        while (text.length > 0 && !text[0]) {
            text.shift();
        }
        while (text.length > 0 && !text.at(-1)) {
            text.pop();
        }
    }
    if (split) {
        return text;
    } else {
        return text.join('\n');
    }
}


/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function exhaustiveCheck(...value: never[]) {
    return new Error('Exhaustive Check Assertion');
}

export type Dict<T> = { [key: string]: T; };

export function dict<T>(): Dict<T> {
    return Object.create(null);
}

export function bigIntMax(...args: bigint[]) {
    return args.reduce((m, e) => e > m ? e : m);
}

export function bigIntMin(...args: bigint[]) {
    return args.reduce((m, e) => e < m ? e : m);
}
