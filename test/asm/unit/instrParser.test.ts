
import { CompilerError } from '../../../tools/asm/errors';
import { BASE, INSTR } from '../../../tools/asm/instrInfo';
import { instrParse, InstrParserConsumer } from '../../../tools/asm/instrParser';

import { describe, expect, test, vi } from 'vitest';


export interface InstrParserConsumersss {
    onParserLine(lineNumber: number): void;
    onParserLabel(name: string): void;
    onParserAssign(name: string, value: string): void;
    onParserInstr(id: number, args: string, base: BASE): void;
}

let consumerMock: InstrParserConsumer = {
    onParserLabel: () => { },
    onParserAssign: () => { },
    onParserInstr: () => { },
};


describe('instrParser', () => {
    test('instructions', () => {
        const consumer = { ...consumerMock };
        const label = vi.spyOn(consumer, 'onParserLabel');
        const assign = vi.spyOn(consumer, 'onParserAssign');
        const instr = vi.spyOn(consumer, 'onParserInstr');
        instrParse(`
            ADD
            SUB x
            # Comment
            MUL \t99#Comment

            add  (some_expression + some_variable * 2) #
            Neg - 80
            Label:
            Label2 : # Comment
            variable = 12 + 12 # Comment
            variable2=x # Comment
            $variable3=1
            .local $_one, $_two, $_three
            READST -12
            WRITE8 [MAB1] + [POP] - x
            READ16U [MAB2] +  y
            READ64 var
        `, consumer);
        expect(instr).toHaveBeenNthCalledWith(1, 2, INSTR.ADD, '', BASE.MAB0);
        expect(instr).toHaveBeenNthCalledWith(2, 3, INSTR.SUB, 'x', BASE.MAB0);
        expect(instr).toHaveBeenNthCalledWith(3, 5, INSTR.MUL, '99', BASE.MAB0);
        expect(instr).toHaveBeenNthCalledWith(4, 7, INSTR.ADD, '(some_expression + some_variable * 2)', BASE.MAB0);
        expect(instr).toHaveBeenNthCalledWith(5, 8, INSTR.NEG, '- 80', BASE.MAB0);
        expect(label).toHaveBeenNthCalledWith(1, 9, 'Label');
        expect(label).toHaveBeenNthCalledWith(2, 10, 'Label2');
        expect(assign).toHaveBeenNthCalledWith(1, 11, 'variable', '12 + 12');
        expect(assign).toHaveBeenNthCalledWith(2, 12, 'variable2', 'x');
        expect(assign).toHaveBeenNthCalledWith(3, 13, '$variable3', '1');
        expect(instr).toHaveBeenNthCalledWith(6, 14, INSTR._LOCAL, '$_one, $_two, $_three', BASE.MAB0);
        expect(instr).toHaveBeenNthCalledWith(7, 15, INSTR.READST, '-12', BASE.MAB0);
        expect(instr).toHaveBeenNthCalledWith(8, 16, INSTR.WRITE8, '0 - x', BASE.MAB1 | BASE.POP);
        expect(instr).toHaveBeenNthCalledWith(9, 17, INSTR.READ16U, 'y', BASE.MAB2);
        expect(instr).toHaveBeenNthCalledWith(10, 18, INSTR.READ64, 'var', BASE.MAB0);
        expect(label).toHaveBeenCalledTimes(2);
        expect(assign).toHaveBeenCalledTimes(3);
        expect(instr).toHaveBeenCalledTimes(10);
    });
    test('errors', () => {
        expect(() => instrParse('InvalidInstr', consumerMock))
            .toThrowError(new CompilerError(1, 'Invalid instruction name "INVALIDINSTR"!'));
        expect(() => instrParse('label: ADD', consumerMock)).toThrowError(new CompilerError(1, 'Syntax error!'));
        expect(() => instrParse('INVALID!CHAR', consumerMock)).toThrowError(new CompilerError(1, 'Syntax error!'));
        expect(() => instrParse('empty_value=\n', consumerMock)).toThrowError(new CompilerError(1, 'Assigned value is empty.'));
        expect(() => instrParse('empty_value = \n', consumerMock)).toThrowError(new CompilerError(1, 'Assigned value is empty.'));
        expect(() => instrParse('=\n', consumerMock)).toThrowError(new CompilerError(1, 'Syntax error!'));
        expect(() => instrParse(':\n', consumerMock)).toThrowError(new CompilerError(1, 'Syntax error!'));
        expect(() => instrParse('\t:  \n', consumerMock)).toThrowError(new CompilerError(1, 'Syntax error!'));
        expect(() => instrParse('\nADD\n:\n', consumerMock)).toThrowError(new CompilerError(3, 'Syntax error!'));
        expect(() => instrParse('\nADD\n=\n', consumerMock)).toThrowError(new CompilerError(3, 'Syntax error!'));
    });
});
