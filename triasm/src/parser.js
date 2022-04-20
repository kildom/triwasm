
const { ExprParser } = require('./exprParser');

//setTimeout(()=>{}, 500000);

const BASE_ZERO = 0;
const BASE_SP = 1;
const BASE_AMB0 = 2;
const BASE_AMB1 = 3;
const BASE_REG_MASK = 3;
const BASE_POP = 4;

const instrInfo = Object.fromEntries(`
# Name       Args.  With
#            num.   base
add          0-1    0                 
sub          0-1    0                 
mod          0-1    0                 
not          0-1    0                 
neg          0-1    0                 
# Read/Write instructions
read8s       0-1    1                 
read8        0-1    1                 
read16s      0-1    1                 
read16       0-1    1                 
read32       0-1    1                 
read64       0-1    1                 
write8       0-1    1                 
write16      0-1    1                 
write32      0-1    1                 
write64      0-1    1                 
.data8       0-     0                
.data16      0-     0                
.data32      0-     0                
.data64      0-     0                
.addr        1-1    0                 
.align       1-1    0                 
.trampoline  1-1    0                 
.ref         0-     0                
.local       -      0               
.begin       -      0               
.pragma      -      0               
`
    .split('\n')
    .filter(x => x.trim().length > 0 && !x.trim().startsWith('#'))
    .map(x => x.trim().split(/\s+/))
    .map(x => [
        x[0].toUpperCase(),
        {
            args: x[1] == '-' ? null : x[1].split('-').map(y => y == '' ? 0x7FFFFFFF : parseInt(y)),
            withBase: !!parseInt(x[2]),
        }
    ]));

/* reLine decoding:
 *     #empty       # no group
 *     label:       # group 1+2
 *     assign = 123 # group 1+3
 *     instr 123    # group 1+4
 *     no_arg_instr # group 1
 */
const reLine = /^[ \t]*(?:([a-z_\$@\.][a-z_\$@\.0-9]*)[ \t]*(?:(:)[ \t]*|=[ \t]*([^\r\n# \t][^\r\n#]*)|[ \t]([^\r\n# \t:=][^\r\n#]*)|))?(?:#.*)?$/gmi;


function parseExpr(line, input, outputObject) {
    return input.split(',').map(x => `{{{${x.trim()}}}}`);
}

function parseBase(args) {
    if (args === undefined) {
        return [0, '0'];
    }
    let m = args.match(/^(?:\[\s*(POP)\s*\]\s*(?:\+\s*\[\s*(AMB0|AMB1|SP)\s*\])?|\[\s*(AMB0|AMB1|SP)\s*\]\s*(?:\+\s*\[\s*(POP)\s*\])?)\s*(\+|-|$)\s*/i);
    if (m === null) {
        return [0, args];
    }
    args = args.substring(m[0].length).trim();
    if (args === '') {
        args = '0';
    } else if (m[5] === '-') {
        args = `0 - ${args}`;
    }
    let base;
    switch ((m[2] || m[3] || '').toUpperCase()) {
        case 'AMB0': base = BASE_AMB0; break;
        case 'AMB1': base = BASE_AMB1; break;
        case 'SP': base = BASE_SP; break;
        default: base = BASE_ZERO; break;
    }
    if (m[1] || m[4]) {
        base |= BASE_POP;
    }
    return [base, args];
}

function parse(input, outputObject) {
    let exprParser = new ExprParser(outputObject);
    let line = 1;
    let offset = 0;
    for (let m of input.matchAll(reLine)) {
        if (input.substring(offset, m.index).trim() !== '') {
            throw Error(`Syntax error on line ${line}`);
        }
        offset = m.index + m[0].length;
        if (m[1] === undefined) {
            // skip comments and empty lines
        } else if (m[2] !== undefined) {
            outputObject.onParserLabel(line, m[1]);
        } else if (m[3] !== undefined) {
            let args = exprParser.parse(m[3]);
            if (args.length != 1) {
                throw Error(`Exactly one argument allowed on line ${line}`);
            }
            outputObject.onParserAssign(line, m[1], args);
        } else {
            let name = m[1].toUpperCase();
            let info = instrInfo[name];
            if (!info) {
                throw Error(`Invalid instruction name on line ${line}`);
            }
            let args = m[4];
            let base = BASE_ZERO;
            if (info.withBase) {
                [base, args] = parseBase(args);
            }
            if (args === undefined) {
                if (info.args !== null) {
                    args = [];
                } else {
                    args = '';
                }
            } else if (info.args !== null) {
                args = exprParser.parse(args);
                if (args.length < info.args[0] || args.length > info.args[1]) {
                    throw Error(`Invalid number of arguments on line ${line}`);
                }
            }
            outputObject.onParserInstr(line, name, args, base);
        }
        line++;
    }
}

parse(`
read8s [SP] - 

`, {
    onParserLabel: (l, n) => console.log(`${l} LABEL ${n}`),
    onParserAssign: (l, n, v) => console.log(`${l} ASSIGN ${n} = ${v}`),
    onParserInstr: (l, n, a, b) => console.log(`${l} INSTR ${n} ${a === undefined ? '{/}' : a}   BASE: ${b}`),
    onParserNumberExpr: (value) => { return 'NUMBER:' + value; },
    onParserIdExpr: (name) => { return 'ID:' + name; },
    onParserOrExpr: (a, b) => { return `(${a} || ${b})`; },
    onParserAndExpr: (a, b) => { return `(${a} && ${b})`; },
    onParserBitOrExpr: (a, b) => { return `(${a} | ${b})`; },
    onParserBitAndExpr: (a, b) => { return `(${a} & ${b})`; },
    onParserBitXorExpr: (a, b) => { return `(${a} ^ ${b})`; },
    onParserEqExpr: (a, b) => { return `(${a} == ${b})`; },
    onParserNeExpr: (a, b) => { return `(${a} != ${b})`; },
    onParserLtExpr: (a, b) => { return `(${a} < ${b})`; },
    onParserGtExpr: (a, b) => { return `(${a} > ${b})`; },
    onParserLeExpr: (a, b) => { return `(${a} <= ${b})`; },
    onParserGeExpr: (a, b) => { return `(${a} >= ${b})`; },
    onParserAddExpr: (a, b) => { return `(${a} + ${b})`; },
    onParserSubExpr: (a, b) => { return `(${a} - ${b})`; },
    onParserMulExpr: (a, b) => { return `(${a} * ${b})`; },
    onParserDivExpr: (a, b) => { return `(${a} / ${b})`; },
    onParserModExpr: (a, b) => { return `(${a} % ${b})`; },
    onParserMinusExpr: (a) => { return `(-${a})`; },
    onParserCallExpr: (id, args) => { return `CALL:${id}(${args})`; },
});


