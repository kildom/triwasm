
import { ArgsParser, parse } from './argparse';
import { ExitError } from './platform';

function assert(condition: boolean, message?: string) {
    if (condition) return;
    if (message) {
        throw new Error(`Assertion failed: ${message}`);
    } else {
        throw new Error(`Assertion failed.`);
    }
}

type ResultType = { [key: string]: any };

let testShortUsage = `
-s
--short <string>
    Test short
-p
--param
    Test option
-q
    Test short name
-o
    Other option
<file>
    Positional
[0-] <output>
    Positional2
`;
function testParsing() {
    let res: ResultType = {};
    let args: string;

    for (args of ['-p -q -s 123', '-pqs 123', '-pqs123', '-s123 -qp', '-s 123 -qp', '--short 123 -q --param', '--param -qs123']) {
        res = {};
        parse<ResultType>(testShortUsage, res, undefined, undefined, args.split(' '));
        //console.dir(res, { depth: null });
        assert(res.param === true);
        assert(res.q === true);
        assert(res.short === '123');
        assert(res.o === false);
        assert(res.file === undefined);
        assert(res.output.length === 0);
    }

    for (args of ['-o --short=123 -- --short=456', '--short 123 -o -- -q', '--short=123 -o -- --short=456', '-o --short 123 -- -q']) {
        res = {};
        parse<ResultType>(testShortUsage, res, undefined, undefined, args.split(' '));
        //console.dir(res, { depth: null });
        assert(res.param === false);
        assert(res.q === false);
        assert(res.short === '123');
        assert(res.o === true);
        assert(res.file === '--short=456' || res.file === '-q');
        assert(res.output.length === 0);
    }

    for (let a of Object.entries({ 'input -o output': ['output'], 'input a -o b': ['a', 'b'], 'input -o -- a b': ['a', 'b'], 'input a b c -o': ['a', 'b', 'c'] })) {
        args = a[0];
        res = {};
        parse<ResultType>(testShortUsage, res, undefined, undefined, args.split(' '));
        //console.dir(res, { depth: null });
        assert(res.param === false);
        assert(res.q === false);
        assert(res.short === undefined);
        assert(res.o === true);
        assert(res.file === 'input');
        assert(JSON.stringify(res.output) === JSON.stringify(a[1]));
    }

    for (args of ['--o', '--s x', '--po']) {
        try {
            parse<ResultType>(testShortUsage, res, undefined, undefined, args.split(' '));
            console.dir(res, { depth: null });
            assert(false);
        } catch (err) {
            if (!(err instanceof ExitError)) {
                console.dir(err);
            }
            assert(err instanceof ExitError);
        }
    }

}

let testMultiValueUsage = `
-v[0-]
    Verbose output
-r[1] <param>
    Required parameter
-l[0-3] <a>
    Lower limit
`;
function testMultiValue() {
    let res: ResultType = {};
    let args: string;

    for (let a of Object.entries({ '-r 1': 0, '-vr 1': 1, '-vvr 1': 2, '-vr1 -vv': 3, '-vvvvvvvvr1': 8})) {
        args = a[0];
        console.log('--- TEST:', args);
        res = {};
        parse<ResultType>(testMultiValueUsage, res, undefined, undefined, args.split(' '));
        //console.dir(res, { depth: null });
        assert(res.v === a[1]);
        assert(res.r === '1');
        assert(res.l.length === 0);
    }

    for (let a of Object.entries({ '-r0 -l0': ['0'], '-r0 -l0 -l 1': ['0', '1'], '-r0 -l0 -l 1 -vl2': ['0', '1', '2'] })) {
        args = a[0];
        console.log('--- TEST:', args);
        res = {};
        parse<ResultType>(testMultiValueUsage, res, undefined, undefined, args.split(' '));
        //console.dir(res, { depth: null });
        assert(res.v === 0 || res.v === 1);
        assert(res.r === '0');
        assert(JSON.stringify(res.l) === JSON.stringify(a[1]));
    }

    for (args of ['-v', '-r', '-l1 -l2 -l3 -l4', '-ra -rb']) {
        try {
            console.log('--- TEST:', args);
            parse<ResultType>(testMultiValueUsage, res, undefined, undefined, args.split(' '));
            console.dir(res, { depth: null });
            assert(false);
        } catch (err) {
            if (!(err instanceof ExitError)) {
                console.dir(err);
            }
            assert(err instanceof ExitError);
        }
    }

}

let testDefaultUsage = `
-a <value> = 1
    Default
-b[0-1] <value> = 2
    Default with range
-c[1] <value> = 3
    Default with one arg
`;
function testDefault() {
    let res: ResultType = {};
    let args: string;

    for (let a of Object.entries({ '': [1, 2, 3], '-a3': [3, 2, 3], '-a3 -b1': [3, 1, 3], '-a3 -b1 -c2': [3, 1, 2], '-b10 -c20 -a30': [30, 10, 20]})) {
        args = a[0];
        console.log('--- TEST:', args);
        res = {};
        parse<ResultType>(testDefaultUsage, res, undefined, undefined, args.split(' ').filter(x => x));
        //console.dir(res, { depth: null });
        assert(res.a === a[1][0].toString());
        assert(res.b === a[1][1].toString());
        assert(res.c === a[1][2].toString());
    }

}

let testFilterUsage = `
 The usage line.
-i:int <value>
    Integer
-j:int <value>
    Integer 2
-s:size[0-3] <value>
    The size
-p:Path <file>
    Path
-h:!help
    Help
-v:!ver
    Version
`;
function testFilter() {
    let res: ResultType = {};
    let args: string;

    for (let a of Object.entries({ '-i1': 1, '-i0xFF': 0xFF, '-i0xff': 0xFF, '-i0X8': 8, '-i-0X8': -8, '-i -10': -10})) {
        args = a[0];
        console.log('--- TEST:', args);
        res = {};
        parse<ResultType>(testFilterUsage, res, undefined, undefined, args.split(' ').filter(x => x));
        assert(res.i === a[1]);
        assert(res.j === undefined);
        assert(res.s.length === 0);
        assert(res.p === undefined);
    }

    for (let a of Object.entries({ '-s1': [1], '-s 12b -s 0x12b': [12, 299], '-s 12\tMB -s 0x33mbit -s 2KBytes': [12 * 1024 * 1024, 0x33 * 1024 * 1024 / 8, 2048]})) {
        args = a[0];
        console.log('--- TEST:', args);
        res = {};
        parse<ResultType>(testFilterUsage, res, undefined, undefined, args.split(' ').filter(x => x));
        //console.dir(res, { depth: null });
        assert(JSON.stringify(res.s) === JSON.stringify(a[1]));
    }

    for (let a of Object.entries({ '-p ./some': './some', '-p./some2': './some2'})) {
        args = a[0];
        console.log('--- TEST:', args);
        res = {};
        parse<ResultType>(testFilterUsage, res, undefined, undefined, args.split(' ').filter(x => x));
        //console.dir(res, { depth: null });
        assert(res.p.path === a[1]);
    }

    for (args of ['-h', '-v']) {
        try {
            console.log('--- TEST:', args);
            parse<ResultType>(testFilterUsage, res, undefined, undefined, args.split(' '));
            console.dir(res, { depth: null });
            assert(false);
        } catch (err) {
            if (!(err instanceof ExitError)) {
                console.dir(err);
            }
            assert(err instanceof ExitError);
        }
    }

}

testParsing();
testMultiValue();
testDefault();
testFilter();
