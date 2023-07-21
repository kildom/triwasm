

export const allowTemporaryNull: unknown = null;

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
