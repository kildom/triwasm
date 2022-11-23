
function f(e, v, m) {
    let n = v
        .split('.')
        .map(x => parseInt(x.replace(/[^0-9]/, '')))
        .slice(0, 2)
        .reduce((a, x) => a = 100 * a + x);
    e(n < parseInt(m) ? 87 : 86);
}

if (typeof(Deno) == 'object') {
    f(Deno.exit, Deno.version.deno, Deno.args[0]);
} else if (typeof(process) == 'object') {
    f(process.exit, process.version, process.argv[2]);
} else {
    throw Error();
}
