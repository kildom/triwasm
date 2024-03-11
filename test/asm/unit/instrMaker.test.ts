
import { describe, expect, test, vi, beforeEach } from 'vitest';
import * as instructions from '../../../tools/asm/instructions';
import { Compiler } from '../../../tools/asm/compiler';
import { ExprMaker } from '../../../tools/asm/exprMaker';
import { BytecodeGenerator } from '../../../tools/asm/generator';
import { InstrMaker } from '../../../tools/asm/instrMaker';
import { BASE, INSTR, instrInfoById } from '../../../tools/asm/instrInfo';


// Mocks of external objects
const compiler = {} as Compiler;
const generator = {} as BytecodeGenerator;
const exprMaker = {} as ExprMaker;
// List of instructions created by mocked instructions module
let mockInstructions: any[] = [];
// Number of instructions of specified class (key is the class from instructions module)
let instrClassCounter = new Map<any, number>();
// List of returned instructions that will be compared with mockInstructions
let returnedInstructions: instructions.InstrBase[] = [];


// Mock instructions module
vi.mock('../../../tools/asm/instructions', async (importOriginal) => {
    const actual = (await importOriginal()) as typeof instructions;
    return {
        ...actual,
        Block: fnShallowCopyFirst((p, args, parent) => saveMockInstruction({ ...p, parent })),
        BlockEnd: fnShallowCopyFirst((p, block) => saveMockInstruction({ ...p, block })),
        SimpleCoreInstruction: fnShallowCopyFirst((p) => saveMockInstruction({ ...p })),
        DataInstruction: fnShallowCopyFirst((p) => saveMockInstruction({ ...p })),
        FillInstruction: fnShallowCopyFirst((p) => saveMockInstruction({ ...p })),
    };
});

// Create mock function wrapper that do shallow copy of the first argument
function fnShallowCopyFirst<TArgs extends any[] = any[], R = any>(implementation: (...args: TArgs) => R) {
    let mock = vi.fn(implementation);
    let f = function (...args) {
        if (typeof args[0] === 'object' && args[0] !== null && !(args[0] instanceof Array)) {
            args[0] = { ...args[0] };
        }
        return mock.call(this, ...args);
    };
    (f as any)._my_mock = mock;
    return f;
}

// Get mock function from mock function wrapper
function fromShallowCopy(f: any): ReturnType<typeof vi.fn> {
    return (f as any)._my_mock ? (f as any)._my_mock : f;
}

// Save mocked instruction in array, so it can be later used
function saveMockInstruction<T>(obj: T): T {
    (obj as any)._my_index = mockInstructions.length;
    mockInstructions.push(obj);
    return obj;
}

// Expect specific instruction
function expectInstruction(instrClass: any, lineNumber: number, index: number, instr: INSTR, ...args: any[]): void {
    let count: number;
    if (instrClassCounter.has(instrClass)) {
        count = instrClassCounter.get(instrClass) as number + 1;
    } else {
        count = 1;
    }
    instrClassCounter.set(instrClass, count);
    expect(fromShallowCopy(instrClass)).toHaveBeenNthCalledWith(count,
        expect.objectContaining({
            compiler,
            generator,
            exprMaker,
            lineNumber,
            index,
            info: instrInfoById[instr],
        }), ...args);
    expect(returnedInstructions[count - 1]).toStrictEqual(mockInstructions[count - 1]);
}

// Check if number of instructions used in expectInstruction is correct
function expectInstructionCounts() {
    for (let [instrClass, count] of instrClassCounter.entries()) {
        expect(fromShallowCopy(instrClass)).toHaveBeenCalledTimes(count);
    }
}

// Reset state before executing next test
beforeEach(() => {
    instrClassCounter = new Map();
    mockInstructions = [];
});


describe('InstrMaker', () => {

    test('test', () => {

        let maker = new InstrMaker(compiler, generator, exprMaker);
        maker.parse(`
            ADD
            SUB 2
            .data8 1, 2, 3
            .begin discardable
            .fill 12
            .end
        `);

        returnedInstructions = maker.getInstructions();

        expectInstruction(instructions.Block, 0, 0, INSTR._BEGIN, '', null);
        expectInstruction(instructions.SimpleCoreInstruction, 2, 1, INSTR.ADD, '', BASE.MAB0);
        expectInstruction(instructions.SimpleCoreInstruction, 3, 2, INSTR.SUB, '2', BASE.MAB0);
        expectInstruction(instructions.DataInstruction, 4, 3, INSTR._DATA8, '1, 2, 3', BASE.MAB0);
        expectInstruction(instructions.Block, 5, 4, INSTR._BEGIN, 'discardable', mockInstructions[0]);
        expectInstruction(instructions.FillInstruction, 6, 5, INSTR._FILL, '12', BASE.MAB0);
        expectInstruction(instructions.BlockEnd, 7, 6, INSTR._END, mockInstructions[4]);
        expectInstruction(instructions.BlockEnd, 8, 7, INSTR._END, mockInstructions[0]);
        expectInstructionCounts();
    });
});
