export function* reMatchAll(re, str) {
    let m;
    re = new RegExp(re);
    while ((m = re.exec(str)) !== null)
        yield m;
}
