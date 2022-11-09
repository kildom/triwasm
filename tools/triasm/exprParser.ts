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

import { reMatchAll } from './utils';

export class ExprParserError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ExprParserError";
    }
};

enum TOKEN {
    END, ID, NUMBER, BIT_NOT, NOT, MOD, DIV, MUL, OPEN, CLOSE, SUB, ADD, COMMA, COLON,
    QUESTION, BIT_OR, BIT_XOR, BIT_AND, LT, GT, SHL, SHR, LE, GE, OR, AND, EQ, NE,
};


const oneCharTokenMap: { [k: string]: TOKEN } = {
    '~': TOKEN.BIT_NOT,
    '!': TOKEN.NOT,
    '%': TOKEN.MOD,
    '/': TOKEN.DIV,
    '*': TOKEN.MUL,
    '(': TOKEN.OPEN,
    ')': TOKEN.CLOSE,
    '-': TOKEN.SUB,
    '+': TOKEN.ADD,
    ',': TOKEN.COMMA,
    ':': TOKEN.COLON,
    '?': TOKEN.QUESTION,
    '|': TOKEN.BIT_OR,
    '^': TOKEN.BIT_XOR,
    '&': TOKEN.BIT_AND,
    '<': TOKEN.LT,
    '>': TOKEN.GT,
};


const twoCharsTokenMap: { [k: string]: TOKEN } = {
    '<<': TOKEN.SHL,
    '>>': TOKEN.SHR,
    '<=': TOKEN.LE,
    '>=': TOKEN.GE,
    '||': TOKEN.OR,
    '&&': TOKEN.AND,
    '==': TOKEN.EQ,
    '!=': TOKEN.NE,
};

const reToken = /(?:([a-z_\$@\.][a-z_\$@\.0-9]*)|(<<|>>|<=|>=|\|\||&&|==|!=)|([~!%/\*\(\)\-\+,:=\?\|\^&<>])|(0x[0-9a-f]+)|(0o[0-7]+)|([0-9]+))[\t ]*/gi

interface Token {
    id: number;
    value?: string;
};

function tokenize(input: string): Token[] {
    let result: Token[] = [];
    input = input.trim();
    let offset = 0;
    for (let m of reMatchAll(reToken, input)) {
        if (input.substring(offset, m.index).trim() !== '') {
            throw new ExprParserError(`Syntax error!`);
        }
        offset = m.index + m[0].length;
        if (m[1] !== undefined) {
            result.push({
                id: TOKEN.ID,
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
            result.push({
                id: TOKEN.NUMBER, value: m[4] || m[5] || m[6]
            });
        }
    }
    result.push({
        id: TOKEN.END
    });
    return result;
}

export interface ExprParserOutput {
    onParserTernaryExpr(cond: any, a: any, b: any): any;
    onParserOrExpr(a: any, b: any): any;
    onParserAndExpr(a: any, b: any): any;
    onParserBitOrExpr(a: any, b: any): any;
    onParserBitXorExpr(a: any, b: any): any;
    onParserBitAndExpr(a: any, b: any): any;
    onParserEqExpr(a: any, b: any): any;
    onParserNeExpr(a: any, b: any): any;
    onParserLtExpr(a: any, b: any): any;
    onParserGtExpr(a: any, b: any): any;
    onParserLeExpr(a: any, b: any): any;
    onParserGeExpr(a: any, b: any): any;
    onParserShlExpr(a: any, b: any): any;
    onParserShrExpr(a: any, b: any): any;
    onParserAddExpr(a: any, b: any): any;
    onParserSubExpr(a: any, b: any): any;
    onParserMulExpr(a: any, b: any): any;
    onParserDivExpr(a: any, b: any): any;
    onParserModExpr(a: any, b: any): any;
    onParserMinusExpr(a: any): any;
    onParserNotExpr(a: any): any;
    onParserBitNotExpr(a: any): any;
    onParserNumberExpr(valueStr: string): any;
    onParserCallExpr(name: string, args: any[]): any;
    onParserIdExpr(name: string): any;
};


export class ExprParser {
    tokens: Token[] = [];
    tokenIndex: number = 0;
    tokenId: number = 0;
    tokenValue: string | undefined;

    constructor(private outputObject: ExprParserOutput) {
    }

    parse(input: string): any[] {
        this.tokens = tokenize(input);
        this.tokenIndex = 0;
        this.tokenId = this.tokens[0].id;
        this.tokenValue = this.tokens[0].value;
        let result = this.parseArgs();
        if (this.tokenId != TOKEN.END) {
            throw new ExprParserError('Unexpected token!');
        }
        return result;
    }

    consume(): void {
        if (this.tokenId == TOKEN.END) {
            throw new ExprParserError('Unexpected end of expression!');
        }
        this.tokenIndex++;
        this.tokenId = this.tokens[this.tokenIndex].id;
        this.tokenValue = this.tokens[this.tokenIndex].value;
    }

    parseArgs(): any[] {
        let result: any[] = [];
        do {
            if (this.tokenId == TOKEN.END || this.tokenId == TOKEN.COMMA || this.tokenId == TOKEN.CLOSE) {
                break;
            }
            let expr = this.parseExpr();
            result.push(expr);
            if (this.tokenId != TOKEN.COMMA) {
                break;
            } else {
                this.consume();
                continue;
            }
        } while (true);
        return result;
    }

    parseExpr(): any {
        return this.parseTernaryExpr();
    }

    parseTernaryExpr(): any {
        let first = this.parseOrExpr();
        if (this.tokenId == TOKEN.QUESTION) {
            this.consume();
            let second = this.parseTernaryExpr();
            if (this.tokenId as number != TOKEN.COLON) {
                throw new ExprParserError(`Expecting ":"!`);
            }
            this.consume();
            let third = this.parseTernaryExpr();
            return this.outputObject.onParserTernaryExpr(first, second, third);
        } else {
            return first;
        }
    }

    parseOrExpr(): any {
        let result = this.parseAndExpr();
        while (this.tokenId == TOKEN.OR) {
            this.consume();
            result = this.outputObject.onParserOrExpr(result, this.parseAndExpr());
        }
        return result;
    }

    parseAndExpr(): any {
        let result = this.parseBitOrExpr();
        while (this.tokenId == TOKEN.AND) {
            this.consume();
            result = this.outputObject.onParserAndExpr(result, this.parseBitOrExpr());
        }
        return result;
    }

    parseBitOrExpr(): any {
        let result = this.parseBitXorExpr();
        while (this.tokenId == TOKEN.BIT_OR) {
            this.consume();
            result = this.outputObject.onParserBitOrExpr(result, this.parseBitXorExpr());
        }
        return result;
    }

    parseBitXorExpr(): any {
        let result = this.parseBitAndExpr();
        while (this.tokenId == TOKEN.BIT_XOR) {
            this.consume();
            result = this.outputObject.onParserBitXorExpr(result, this.parseBitAndExpr());
        }
        return result;
    }

    parseBitAndExpr(): any {
        let result = this.parseEqNeExpr();
        while (this.tokenId == TOKEN.BIT_AND) {
            this.consume();
            result = this.outputObject.onParserBitAndExpr(result, this.parseEqNeExpr());
        }
        return result;
    }

    parseEqNeExpr(): any {
        let result = this.parseRelExpr();
        while (true) {
            if (this.tokenId == TOKEN.EQ) {
                this.consume();
                result = this.outputObject.onParserEqExpr(result, this.parseRelExpr());
            } else if (this.tokenId == TOKEN.NE) {
                this.consume();
                result = this.outputObject.onParserNeExpr(result, this.parseRelExpr());
            } else {
                break;
            }
        }
        return result;
    }

    parseRelExpr(): any {
        let result = this.parseShiftExpr();
        while (true) {
            if (this.tokenId == TOKEN.LT) {
                this.consume();
                result = this.outputObject.onParserLtExpr(result, this.parseShiftExpr());
            } else if (this.tokenId == TOKEN.GT) {
                this.consume();
                result = this.outputObject.onParserGtExpr(result, this.parseShiftExpr());
            } else if (this.tokenId == TOKEN.LE) {
                this.consume();
                result = this.outputObject.onParserLeExpr(result, this.parseShiftExpr());
            } else if (this.tokenId == TOKEN.GE) {
                this.consume();
                result = this.outputObject.onParserGeExpr(result, this.parseShiftExpr());
            } else {
                break;
            }
        }
        return result;
    }

    parseShiftExpr(): any {
        let result = this.parseAddSubExpr();
        while (true) {
            if (this.tokenId == TOKEN.SHL) {
                this.consume();
                result = this.outputObject.onParserShlExpr(result, this.parseAddSubExpr());
            } else if (this.tokenId == TOKEN.SHR) {
                this.consume();
                result = this.outputObject.onParserShrExpr(result, this.parseAddSubExpr());
            } else {
                break;
            }
        }
        return result;
    }

    parseAddSubExpr(): any {
        let result = this.parseMulDivModExpr();
        while (true) {
            if (this.tokenId == TOKEN.ADD) {
                this.consume();
                result = this.outputObject.onParserAddExpr(result, this.parseMulDivModExpr());
            } else if (this.tokenId == TOKEN.SUB) {
                this.consume();
                result = this.outputObject.onParserSubExpr(result, this.parseMulDivModExpr());
            } else {
                break;
            }
        }
        return result;
    }

    parseMulDivModExpr(): any {
        let result = this.parseUnaryExpr();
        while (true) {
            if (this.tokenId == TOKEN.MUL) {
                this.consume();
                result = this.outputObject.onParserMulExpr(result, this.parseUnaryExpr());
            } else if (this.tokenId == TOKEN.DIV) {
                this.consume();
                result = this.outputObject.onParserDivExpr(result, this.parseUnaryExpr());
            } else if (this.tokenId == TOKEN.MOD) {
                this.consume();
                result = this.outputObject.onParserModExpr(result, this.parseUnaryExpr());
            } else {
                break;
            }
        }
        return result;
    }

    parseUnaryExpr(): any {
        if (this.tokenId == TOKEN.SUB) {
            this.consume();
            return this.outputObject.onParserMinusExpr(this.parseUnaryExpr());
        } else if (this.tokenId == TOKEN.ADD) {
            this.consume();
            return this.parseUnaryExpr();
        } else if (this.tokenId == TOKEN.NOT) {
            this.consume();
            return this.outputObject.onParserNotExpr(this.parseUnaryExpr());
        } else if (this.tokenId == TOKEN.BIT_NOT) {
            this.consume();
            return this.outputObject.onParserBitNotExpr(this.parseUnaryExpr());
        }
        return this.parseTerminalExpr();
    }

    parseTerminalExpr(): any {
        let result: any;
        if (this.tokenId == TOKEN.OPEN) {
            this.consume();
            result = this.parseExpr();
            if (this.tokenId as number != TOKEN.CLOSE) {
                throw new ExprParserError('Missing closing bracket!');
            }
            this.consume();
        } else if (this.tokenId == TOKEN.NUMBER) {
            result = this.outputObject.onParserNumberExpr(this.tokenValue as string);
            this.consume();
        } else if (this.tokenId == TOKEN.ID) {
            let id = this.tokenValue as string;
            this.consume();
            if (this.tokenId as number == TOKEN.OPEN) {
                this.consume();
                let args = this.parseArgs();
                if (this.tokenId as number != TOKEN.CLOSE) {
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

