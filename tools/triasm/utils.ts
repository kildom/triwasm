
export function* reMatchAll(re: RegExp, str: string) {
    let m: RegExpExecArray | null;
    re = new RegExp(re);
    while ((m = re.exec(str)) !== null)
        yield m;
}

