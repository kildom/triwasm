
export interface Generator<T = unknown, TReturn = any, TNext = unknown>
    extends Iterator<T, TReturn, TNext> {
    next(...args: [] | [TNext]): IteratorResult<T, TReturn>;
    return(value: TReturn): IteratorResult<T, TReturn>;
    throw(e: any): IteratorResult<T, TReturn>;
    [Symbol.iterator](): Generator<T, TReturn, TNext>;
}


export function* reMatchAll(re: RegExp, str: string): Generator<RegExpExecArray> {
    let m: RegExpExecArray | null;
    re = new RegExp(re);
    while ((m = re.exec(str)) !== null) yield m;
}
        
