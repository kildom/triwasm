
const TOKEN_EOF = 0;
const TOKEN_PRAGMA = 1;
const TOKEN_EOL = 2;
const TOKEN_ID = 3;
const TOKEN_STRING = 4;
const TOKEN_NUMBER = 5;
const TOKEN_BIT_NOT = 6;
const TOKEN_NOT = 7;
const TOKEN_MOD = 8;
const TOKEN_DIV = 9;
const TOKEN_MUL = 10;
const TOKEN_OPEN = 11;
const TOKEN_CLOSE = 12;
const TOKEN_SUB = 13;
const TOKEN_ADD = 14;
const TOKEN_COMMA = 15;
const TOKEN_COLON = 16;
const TOKEN_ASSIGN = 17;
const TOKEN_QUESTION = 18;
const TOKEN_BIT_OR = 19;
const TOKEN_BIT_XOR = 20;
const TOKEN_BIT_AND = 21;
const TOKEN_LT = 22;
const TOKEN_GT = 23;
const TOKEN_SHL = 24;
const TOKEN_SHR = 25;
const TOKEN_LE = 26;
const TOKEN_GE = 27;
const TOKEN_OR = 28;
const TOKEN_AND = 29;
const TOKEN_EQ = 30;
const TOKEN_NE = 31;
const TOKEN_BASE_REG = 32;


const oneCharTokenMap = {
    '~': TOKEN_BIT_NOT,
    '!': TOKEN_NOT,
    '%': TOKEN_MOD,
    '/': TOKEN_DIV,
    '*': TOKEN_MUL,
    '(': TOKEN_OPEN,
    ')': TOKEN_CLOSE,
    '-': TOKEN_SUB,
    '+': TOKEN_ADD,
    ',': TOKEN_COMMA,
    ':': TOKEN_COLON,
    '=': TOKEN_ASSIGN,
    '?': TOKEN_QUESTION,
    '|': TOKEN_BIT_OR,
    '^': TOKEN_BIT_XOR,
    '&': TOKEN_BIT_AND,
    '<': TOKEN_LT,
    '>': TOKEN_GT,
};


const twoCharsTokenMap = {
    '<<': TOKEN_SHL,
    '>>': TOKEN_SHR,
    '<=': TOKEN_LE,
    '>=': TOKEN_GE,
    '||': TOKEN_OR,
    '&&': TOKEN_AND,
    '==': TOKEN_EQ,
    '!=': TOKEN_NE,
};


function _twoCharToken(value) {
    return { id: twoCharsTokenMap[value] };
}


function _oneCharToken(value) {
    return { id: oneCharTokenMap[value] };
}


function _number(value) {
    let valueBig = BigInt(value);
    let value64 = valueBig & 0xFFFFFFFFFFFFFFFFn;
    if (value64 != valueBig) {
        throw Error(`Integer literal out of range!`);
    }
    return { id: TOKEN_NUMBER, value: value64 };
}


const reIds = [0, /*        */ 1, /**/ 2, /*                     */ 3, /*                  */ 32, /*     */ 0, /*           */ 0, /*        */ _twoCharToken, /*           */ _oneCharToken, /* */_number, _number, _number, /*          */ 0, /*               */ 4,];
const rePattern = /(?:(\.PRAGMA)|(\r?\n)|([a-z_\$@\.][a-z_\$@\.0-9]*)|(?:\[(POP|AMB0|AMB1|SP)\])|(\/\/[^\n]*)|(\/\*[\S\s]*?\*\/)|(<<|>>|<=|>=|\|\||&&|==|!=)|([~!%/\*\(\)\-\+,:=\?\|\^&<>])|(0x[0-9a-f]+)|(0o[0-7]+)|([0-9]+)|(\\[\t ]*\r?\n)|(?:"(|[\S\s]*?[^\\])"))[\t ]*/;

class Tokenizer {

    constructor(input) {
        this.re = new RegExp(rePattern.source, 'gi');
        this.input = input;
        this.line = 1;
    }

    readToken() {
        retryLoop:
        do {
            let start = this.re.lastIndex;
            if (start >= this.input.length) {
                return { id: TOKEN_EOF };
            }
            let m = this.re.exec(this.input);
            if (m === null || m.index != start) {
                throw Error(`Invalid input in line ${this.line}`);
            }
            for (let i = 1; i < reIds.length; i++) {
                if (m[i] !== undefined) {
                    let id = reIds[i];
                    if (typeof (id) == 'number') {
                        if (id == 0) {
                            continue retryLoop;
                        } else {
                            return { id, value: m[i] };
                        }
                    } else {
                        return id(m[i]);
                    }
                }
            }
            console.log(m);
            throw Error('Internal error');
        } while (true);
    }
};

class Parser {
    constructor(tokenizer, output) {
        this.tokenizer = tokenizer;
        this.token = null;
        this.tokenId = TOKEN_EOF;
        this.output = output;
        this.consume();
    }

    consume() {
        this.token = this.tokenizer.readToken();
        this.tokenId = this.token.id;
        console.log(this.token);
    }

    parseCommand() {
        if (this.tokenId == TOKEN_PRAGMA) {
            this.consume();
            if (this.tokenId != TOKEN_STRING) {
                throw Error(`Expecting string literal!`);
            }
            console.log(`PRAGMA ${this.token.value}`);
            this.consume();
        } else if (this.tokenId == TOKEN_ID) {
            let name = this.token.value;
            this.consume();
            if (this.tokenId == TOKEN_COLON) {
                this.consume();
                console.log(`LABEL ${name}`);
            } else if (this.tokenId == TOKEN_ASSIGN) {
                this.consume();
                let expr = this.parseExpr();
                console.log(`ASSIGN ${name} = ...`);
            } else {
                let args = this.parseArgs();
                console.log(`INSTRUCTION ${name} ${args}`);
            }
        } else {
            throw Error(`Expecting instruction or directive!`);
        }
    }

    parseArgs() {
        let result = [];
        do {
            if (this.tokenId == TOKEN_EOF || this.tokenId == TOKEN_EOL || this.tokenId == TOKEN_COMMA || this.tokenId == TOKEN_CLOSE) {
                break;
            }
            let expr = this.parseExpr();
            result.push(expr);
            if (this.tokenId != TOKEN_COMMA) {
                break;
            } else {
                this.consume();
                continue;
            }
        } while (true);
        return result;
    }

    parseExpr() {
        return this.parseTernaryExpr();
    }

    parseTernaryExpr() {
        let first = this.parseOrExpr();
        if (this.tokenId == TOKEN_QUESTION) {
            this.consume();
            let second = this.parseTernaryExpr();
            if (this.tokenId != TOKEN_COLON) {
                throw Error(`Expecting ":"!`);
            }
            this.consume();
            let third = this.parseTernaryExpr();
            console.log(`?:`);
        } else {
            return first;
        }
    }

    parseOrExpr() {
        let result = this.parseAndExpr();
        while (this.tokenId == TOKEN_OR) {
            this.consume();
            result = this.output.parsedOrExpr(result, this.parseAndExpr());
        }
        return result;
    }

    parseAndExpr() {
        let result = this.parseBitOrExpr();
        while (this.tokenId == TOKEN_AND) {
            this.consume();
            result = this.output.parsedAndExpr(result, this.parseBitOrExpr());
        }
        return result;
    }

    parseBitOrExpr() {
        let result = this.parseBitXorExpr();
        while (this.tokenId == TOKEN_BIT_OR) {
            this.consume();
            result = this.output.parsedBitOrExpr(result, this.parseBitXorExpr());
        }
        return result;
    }

    parseBitXorExpr() {
        let result = this.parseBitAndExpr();
        while (this.tokenId == TOKEN_BIT_XOR) {
            this.consume();
            result = this.output.parsedBitXorExpr(result, this.parseBitAndExpr());
        }
        return result;
    }

    parseBitAndExpr() {
        let result = this.parseEqNeExpr();
        while (this.tokenId == TOKEN_BIT_AND) {
            this.consume();
            result = this.output.parsedBitAndExpr(result, this.parseEqNeExpr());
        }
        return result;
    }

    parseEqNeExpr() {
        let result = this.parseRelExpr();
        while (true) {
            if (this.tokenId == TOKEN_EQ) {
                this.consume();
                result = this.output.parsedEqExpr(result, this.parseRelExpr());
            } else if (this.tokenId == TOKEN_NE) {
                this.consume();
                result = this.output.parsedNeExpr(result, this.parseRelExpr());
            } else {
                break;
            }
        }
        return result;
    }

    parseRelExpr() {
        let result = this.parseUnaryExpr();
        while (true) {
            if (this.tokenId == TOKEN_LT) {
                this.consume();
                result = this.output.parsedLtExpr(result, this.parseUnaryExpr());
            } else if (this.tokenId == TOKEN_GT) {
                this.consume();
                result = this.output.parsedGtExpr(result, this.parseUnaryExpr());
            } else if (this.tokenId == TOKEN_LE) {
                this.consume();
                result = this.output.parsedLeExpr(result, this.parseUnaryExpr());
            } else if (this.tokenId == TOKEN_GE) {
                this.consume();
                result = this.output.parsedGeExpr(result, this.parseUnaryExpr());
            } else {
                break;
            }
        }
        return result;
    }

    parseUnaryExpr() {
        if (this.tokenId == TOKEN_SUB) {
            this.consume();
            return this.output.parsedExprMinus(this.parseUnaryExpr());
        }
        return this.parseTerminalExpr();
    }

    parseTerminalExpr() {
        let result;
        if (this.tokenId == TOKEN_OPEN) {
            this.consume();
            result = this.parseExpr();
            if (this.tokenId != TOKEN_CLOSE) {
                throw Error('Missing closing bracket');
            }
            this.consume();
        } else if (this.tokenId == TOKEN_NUMBER) {
            result = this.output.parsedExprNumber(this.token.value);
            this.consume();
        } else if (this.tokenId == TOKEN_ID) {
            let id = this.token.value;
            this.consume();
            if (this.tokenId == TOKEN_OPEN) {
                this.consume();
                let args = this.parseArgs();
                if (this.tokenId != TOKEN_CLOSE) {
                    throw Error('Missing closing bracket');
                }
                this.consume();
                result = this.output.parsedCall(id, args);
            } else {
                result = this.output.parsedId(id);
            }
        } else {
            throw Error(`Expecting expression!`);
        }
        return result;
    }

    parse() {
        while (true) {
            while (this.tokenId == TOKEN_EOL) {
                this.consume();
            }
            if (this.tokenId == TOKEN_EOF) {
                break;
            }
            this.parseCommand();
            if (this.tokenId != TOKEN_EOF && this.tokenId != TOKEN_EOL) {
                throw Error(`Expecting end of line!`);
            }
        }
    }
};


class ParserOutput {
    parsedExprNumber(value) {
        return 'NUMBER:' + value;
    }
    parsedId(name) {
        return 'ID:' + name;
    }
    parsedOrExpr(a, b) {
        return `(${a} || ${b})`;
    }
    parsedAndExpr(a, b) {
        return `(${a} && ${b})`;
    }
    parsedBitOrExpr(a, b) {
        return `(${a} | ${b})`;
    }
    parsedBitAndExpr(a, b) {
        return `(${a} & ${b})`;
    }
    parsedBitXorExpr(a, b) {
        return `(${a} ^ ${b})`;
    }
    parsedEqExpr(a, b) {
        return `(${a} == ${b})`;
    }
    parsedNeExpr(a, b) {
        return `(${a} != ${b})`;
    }
    parsedLtExpr(a, b) {
        return `(${a} < ${b})`;
    }
    parsedGtExpr(a, b) {
        return `(${a} > ${b})`;
    }
    parsedLeExpr(a, b) {
        return `(${a} <= ${b})`;
    }
    parsedGeExpr(a, b) {
        return `(${a} >= ${b})`;
    }
    parsedExprMinus(a) {
        return `(-${a})`;
    }
    parsedCall(id, args) {
        return `CALL:${id}(${args})`;
    }
};

let t = new Tokenizer(`
s:
a = 12 | f(x)
add f(x) | x, a,
`);

let o = new ParserOutput()

let p = new Parser(t, o);
p.parse();

/*
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
console.log(t.readToken());
*/
