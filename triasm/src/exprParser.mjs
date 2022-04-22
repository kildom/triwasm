/*!
 * Copyright (c) 2023 Dominik Kilian <kontakt@dominik.cc>
 *
 * This program is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this
 * program. If not, see <https://www.gnu.org/licenses/>.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
Expression parser output object methods:
    onParserStartExpr();
    onParserTernaryExpr(cond, a, b);
    onParserOrExpr(a, b);
    onParserAndExpr(a, b);
    onParserBitOrExpr(a, b);
    onParserBitXorExpr(a, b);
    onParserBitAndExpr(a, b);
    onParserEqExpr(a, b);
    onParserNeExpr(a, b);
    onParserLtExpr(a, b);
    onParserGtExpr(a, b);
    onParserLeExpr(a, b);
    onParserGeExpr(a, b);
    onParserShlExpr(a, b);
    onParserShrExpr(a, b);
    onParserAddExpr(a, b);
    onParserSubExpr(a, b);
    onParserMulExpr(a, b);
    onParserDivExpr(a, b);
    onParserModExpr(a, b);
    onParserMinusExpr(a);
    onParserNotExpr(a);
    onParserBitNotExpr(a);
    onParserNumberExpr(valueStr);
    onParserCallExpr(name, args);
    onParserIdExpr(name);
*/


class ExprParserError extends Error {
    constructor(message) {
        super(message);
        this.name = "ExprParserError";
    }
};

const TOKEN_END = 0;
const TOKEN_ID = 3;
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

const reToken = /(?:([a-z_\$@\.][a-z_\$@\.0-9]*)|(<<|>>|<=|>=|\|\||&&|==|!=)|([~!%/\*\(\)\-\+,:=\?\|\^&<>])|(0x[0-9a-f]+)|(0o[0-7]+)|([0-9]+))[\t ]*/gi

function tokenize(input) {
    let result = [];
    input = input.trim();
    offset = 0;
    for (let m of input.matchAll(reToken)) {
        if (input.substring(offset, m.index).trim() !== '') {
            throw new ExprParserError(`Syntax error!`);
        }
        offset = m.index + m[0].length;
        if (m[1] !== undefined) {
            result.push({
                id: TOKEN_ID,
                value: m[1],
            });
        } else if (m[2] !== undefined) {
            result.push({
                id: twoCharsTokenMap[m[2]],
            });
        } else if (m[3] !== undefined) {
            result.push({
                id: oneCharTokenMap[m[3]],
            });
        } else if (m[4] || m[5] || m[6]) {
            /*let valueBig = BigInt(m[4] || m[5] || m[6]);
            let value64 = valueBig & 0xFFFFFFFFFFFFFFFFn;
            if (value64 != valueBig) {
                throw new ExprParserError(`Integer literal out of range!`);
            }*/
            result.push({
                id: TOKEN_NUMBER, value: m[4] || m[5] || m[6]
            });
        }
    }
    result.push({
        id: TOKEN_END
    });
    return result;
}

class ExprParser {
    constructor(outputObject) {
        this.outputObject = outputObject;
    }

    parse(input) {
        this.tokens = tokenize(input);
        this.tokenIndex = 0;
        this.tokenId = this.tokens[0].id;
        this.tokenValue = this.tokens[0].value;
        this.outputObject.onParserStartExpr();
        let result = this.parseArgs();
        if (this.tokenId != TOKEN_END) {
            throw new ExprParserError('Unexpected token!');
        }
        return result;
    }

    consume() {
        if (this.tokenId == TOKEN_END) {
            throw new ExprParserError('Unexpected end of expression!');
        }
        this.tokenIndex++;
        this.tokenId = this.tokens[this.tokenIndex].id;
        this.tokenValue = this.tokens[this.tokenIndex].value;
    }

    parseArgs() {
        let result = [];
        do {
            if (this.tokenId == TOKEN_END || this.tokenId == TOKEN_COMMA || this.tokenId == TOKEN_CLOSE) {
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
                throw new ExprParserError(`Expecting ":"!`);
            }
            this.consume();
            let third = this.parseTernaryExpr();
            return this.outputObject.onParserTernaryExpr(first, second, third);
        } else {
            return first;
        }
    }

    parseOrExpr() {
        let result = this.parseAndExpr();
        while (this.tokenId == TOKEN_OR) {
            this.consume();
            result = this.outputObject.onParserOrExpr(result, this.parseAndExpr());
        }
        return result;
    }

    parseAndExpr() {
        let result = this.parseBitOrExpr();
        while (this.tokenId == TOKEN_AND) {
            this.consume();
            result = this.outputObject.onParserAndExpr(result, this.parseBitOrExpr());
        }
        return result;
    }

    parseBitOrExpr() {
        let result = this.parseBitXorExpr();
        while (this.tokenId == TOKEN_BIT_OR) {
            this.consume();
            result = this.outputObject.onParserBitOrExpr(result, this.parseBitXorExpr());
        }
        return result;
    }

    parseBitXorExpr() {
        let result = this.parseBitAndExpr();
        while (this.tokenId == TOKEN_BIT_XOR) {
            this.consume();
            result = this.outputObject.onParserBitXorExpr(result, this.parseBitAndExpr());
        }
        return result;
    }

    parseBitAndExpr() {
        let result = this.parseEqNeExpr();
        while (this.tokenId == TOKEN_BIT_AND) {
            this.consume();
            result = this.outputObject.onParserBitAndExpr(result, this.parseEqNeExpr());
        }
        return result;
    }

    parseEqNeExpr() {
        let result = this.parseRelExpr();
        while (true) {
            if (this.tokenId == TOKEN_EQ) {
                this.consume();
                result = this.outputObject.onParserEqExpr(result, this.parseRelExpr());
            } else if (this.tokenId == TOKEN_NE) {
                this.consume();
                result = this.outputObject.onParserNeExpr(result, this.parseRelExpr());
            } else {
                break;
            }
        }
        return result;
    }

    parseRelExpr() {
        let result = this.parseShiftExpr();
        while (true) {
            if (this.tokenId == TOKEN_LT) {
                this.consume();
                result = this.outputObject.onParserLtExpr(result, this.parseShiftExpr());
            } else if (this.tokenId == TOKEN_GT) {
                this.consume();
                result = this.outputObject.onParserGtExpr(result, this.parseShiftExpr());
            } else if (this.tokenId == TOKEN_LE) {
                this.consume();
                result = this.outputObject.onParserLeExpr(result, this.parseShiftExpr());
            } else if (this.tokenId == TOKEN_GE) {
                this.consume();
                result = this.outputObject.onParserGeExpr(result, this.parseShiftExpr());
            } else {
                break;
            }
        }
        return result;
    }

    parseShiftExpr() {
        let result = this.parseAddSubExpr();
        while (true) {
            if (this.tokenId == TOKEN_SHL) {
                this.consume();
                result = this.outputObject.onParserShlExpr(result, this.parseAddSubExpr());
            } else if (this.tokenId == TOKEN_SHR) {
                this.consume();
                result = this.outputObject.onParserShrExpr(result, this.parseAddSubExpr());
            } else {
                break;
            }
        }
        return result;
    }

    parseAddSubExpr() {
        let result = this.parseMulDivModExpr();
        while (true) {
            if (this.tokenId == TOKEN_ADD) {
                this.consume();
                result = this.outputObject.onParserAddExpr(result, this.parseMulDivModExpr());
            } else if (this.tokenId == TOKEN_SUB) {
                this.consume();
                result = this.outputObject.onParserSubExpr(result, this.parseMulDivModExpr());
            } else {
                break;
            }
        }
        return result;
    }

    parseMulDivModExpr() {
        let result = this.parseUnaryExpr();
        while (true) {
            if (this.tokenId == TOKEN_MUL) {
                this.consume();
                result = this.outputObject.onParserMulExpr(result, this.parseUnaryExpr());
            } else if (this.tokenId == TOKEN_DIV) {
                this.consume();
                result = this.outputObject.onParserDivExpr(result, this.parseUnaryExpr());
            } else if (this.tokenId == TOKEN_MOD) {
                this.consume();
                result = this.outputObject.onParserModExpr(result, this.parseUnaryExpr());
            } else {
                break;
            }
        }
        return result;
    }

    parseUnaryExpr() {
        if (this.tokenId == TOKEN_SUB) {
            this.consume();
            return this.outputObject.onParserMinusExpr(this.parseUnaryExpr());
        } else if (this.tokenId == TOKEN_ADD) {
            this.consume();
            return this.parseUnaryExpr();
        } else if (this.tokenId == TOKEN_NOT) {
            this.consume();
            return this.outputObject.onParserNotExpr(this.parseUnaryExpr());
        } else if (this.tokenId == TOKEN_BIT_NOT) {
            this.consume();
            return this.outputObject.onParserBitNotExpr(this.parseUnaryExpr());
        }
        return this.parseTerminalExpr();
    }

    parseTerminalExpr() {
        let result;
        if (this.tokenId == TOKEN_OPEN) {
            this.consume();
            result = this.parseExpr();
            if (this.tokenId != TOKEN_CLOSE) {
                throw new ExprParserError('Missing closing bracket!');
            }
            this.consume();
        } else if (this.tokenId == TOKEN_NUMBER) {
            result = this.outputObject.onParserNumberExpr(this.tokenValue);
            this.consume();
        } else if (this.tokenId == TOKEN_ID) {
            let id = this.tokenValue;
            this.consume();
            if (this.tokenId == TOKEN_OPEN) {
                this.consume();
                let args = this.parseArgs();
                if (this.tokenId != TOKEN_CLOSE) {
                    throw new ExprParserError('Missing closing bracket!');
                }
                this.consume();
                result = this.outputObject.onParserCallExpr(id, args);
            } else {
                result = this.outputObject.onParserIdExpr(id);
            }
        } else {
            throw new ExprParserError(`Invalid expression!`);
        }
        return result;
    }

};


export { ExprParser, ExprParserError };
