import { platform } from "../utils/platform";
import { OP } from "./opcodes";
import { FunctionType, Limits, NumberType, RefType, ValueType, ValueTypeObject, VectorType, WasmBlock, WasmBranchDir, WasmData, WasmElement, WasmEntity, WasmExport, WasmFunction, WasmFunctionKind, WasmGlobal, WasmImport, WasmInstr, WasmInstrBr, WasmInstrEnd, WasmInstrIndexed, WasmInstrWithBlock, WasmMemory, WasmModule, WasmTable, instrId, valueTypeWords } from "./wasmModule";


export enum ModuleStage {
    AfterParser = 0,
    AfterResolver = 1,
    AfterReducer = 2,
    AfterOptimization = 3,
};


const STACK_LABELS: { [key in ValueType]: string[] } = {
    [NumberType.I32]: ['i32'],
    [NumberType.I64]: ['i64lo', 'i64hi'],
    [NumberType.F32]: ['f32'],
    [NumberType.F64]: ['f64lo', 'f64hi'],
    [RefType.FUNCREF]: ['func'],
    [RefType.EXTERNREF]: ['extern'],
    [VectorType.V128]: ['v128a', 'v128b', 'v128c', 'v128d'],
};

const STACK_LABELS_REVERSED = {
    [NumberType.I32]: ['i32'],
    [NumberType.I64]: ['i64hi', 'i64lo'],
    [NumberType.F32]: ['f32'],
    [NumberType.F64]: ['f64hi', 'f64lo'],
    [RefType.FUNCREF]: ['func'],
    [RefType.EXTERNREF]: ['extern'],
    [VectorType.V128]: ['v128d', 'v128c', 'v128b', 'v128a'],
};

interface StackEntry {
    type: ValueType;
    label: string;
    prev?: StackEntry;
};

function html(text: string | undefined | null): string {
    return (text || '')
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatValue32(value: number) {
    let dec: bigint;
    let value2 = BigInt(value) & 0xFFFFFFFFn;
    if (value2 & 0x80000000n) {
        dec = value2 - 0x100000000n;
    } else {
        dec = value2;
    }
    let hex = '00000000' + value2.toString(16);
    hex = hex.substring(hex.length - 8);
    return `${dec} (0x${hex})`;
}

function formatValue64(value: bigint) {
    let dec: bigint;
    value &= 0xFFFFFFFFFFFFFFFFn;
    if (value & 0x8000000000000000n) {
        dec = value - 0x10000000000000000n;
    } else {
        dec = value;
    }
    let hex = '0000000000000000' + value.toString(16);
    hex = hex.substring(hex.length - 16);
    return `${dec} (0x${hex})`;
}


function formatType(type: FunctionType): string {
    let ret = type.results.length == 0 ? 'void' :
        type.results.length == 1 ? ValueTypeObject[type.results[0]] :
            '(' + type.results.map(x => ValueTypeObject[x]).join(', ') + ')';
    let params = type.params.map(x => ValueTypeObject[x]).join(', ');
    return `(${params}) ⇨ ${ret}`;
}


let lastErrorId = 1;

function newErrorId() {
    return ++lastErrorId;
}

class DiagError {
    public thisRef: string;
    public constructor(
        public message: string,
        public targetRef: string = ''
    ) {
        this.thisRef = `error-${newErrorId()}`;
    }

    getIcon() {
        return `<div class="error-icon"><div class="error-icon-tip">${html(this.message)}</div></div>`;
    }

    getOutput() {
        if (this.thisRef != '') {
            return `<div class="error"><a href="#${html(this.targetRef)}">#${html(this.targetRef)}</a>: ${html(this.message)}</div>`;
        } else {
            return `<div class="error">${html(this.message)}</div>`;
        }
    }
};

class InstructionFormatter {
    public instr: WasmInstr = { id: -1, opcode: OP.NOP };
    public params: string[] = [];
    public tools: { [label: string]: string } = {};
    public stackKeep: StackEntry[] = [];
    public stackPop: StackEntry[] = [];
    public stackPush: StackEntry[] = [];
    public unreachable: boolean = false;
    public brLevels: number[] = [];
    public errors: DiagError[] = [];

    constructor(
        public funcDiag: FunctionDiagnose
    ) {
    }

    public clear(instr: WasmInstr) {
        this.instr = instr;
        this.params = [];
        this.tools = {};
        this.stackKeep = [];
        this.stackPop = [];
        this.stackPush = [];
        this.unreachable = false;
        this.brLevels = [];
        this.errors = [];
    }

    public addParam(value: string) {
        this.params.push(value);
    }

    public addTool(label: string, code: string) {
        this.tools[label] = code;
    }

    public addError(message: string, targetRef: string = `instr-${this.instr.id}`) {
        this.errors.push(new DiagError(message, targetRef));
    }

    public getOutput() {
        let out = `<tr id="instr-${this.instr.id}"><td width="1%">`;
        for (let level of this.brLevels) {
            out += `<div class="br-line-${level > 0 ? 'down' : 'up'}"><div style="--levels: ${Math.abs(level)}"></div></div>`;
        }
        if (this.instr.opcode == OP.ELSE) {
            out += `<div class="else-line"><div></div></div>`;
        }
        out += html(INSTRUCTION_NAME[this.instr.opcode]);
        for (let param of this.params) {
            if (param.startsWith('#')) {
                out += ` <a href="${html(param)}" class="param">${html(param)}</a>`;
            } else {
                out += ` <span class="param">${html(param)}</span>`;
            }
        }
        for (let [label, code] of Object.entries(this.tools)) {
            if (code.startsWith('#')) {
                out += `<a class="tool" href="${code}">${label}</a>`;
            } else {
                out += `<a class="tool" href="javascript://" onclick="${html(code)}">${label}</a>`;
            }
        }
        out += `</td><td width="1%">${this.instr.id}</td><td width="98%"><div class="stack">`;
        if (this.unreachable) {
            out += `<div class="stack-remove"><div class="item-">unreachable</div></div>`;
        } else {
            if (this.stackKeep.length > 0) {
                out += `<div class="stack-none">`;
                for (let item of this.stackKeep) {
                    out += `<div class="item-${item.label}">${item.label}</div>`;
                }
                out += `</div>`;
            }
            if (this.stackPop.length > 0) {
                out += `<div class="stack-remove">`;
                let underflowError: DiagError | undefined = undefined;
                let invalidTypeError: DiagError | undefined = undefined;
                for (let item of this.stackPop) {
                    let prev = '';
                    let underflow = '';
                    if (!item.prev) {
                        underflow = ' underflow';
                        underflowError = new DiagError(`Stack underflow.`, `instr-${this.instr.id}`);
                    } else if (item.label != item.prev.label) {
                        prev = `<span>${item.prev.label}</span>`;
                        if (this.funcDiag.stage <= ModuleStage.AfterResolver) {
                            invalidTypeError = new DiagError(`Unexpected data type on stack.`, `instr-${this.instr.id}`);
                        }
                    }
                    out += `<div class="item-${item.label}${underflow}">${prev}${item.label}</div>`;
                }
                if (underflowError) {
                    this.errors.push(underflowError);
                }
                if (invalidTypeError) {
                    this.errors.push(invalidTypeError);
                }
                out += `</div>`;
            }
            if (this.stackPop.length > 0 && this.stackPush.length > 0) {
                out += `<div class="stack-tr">⇨</div>`;
            }
            if (this.stackPush.length > 0) {
                out += `<div class="stack-add">`;
                for (let item of this.stackPush) {
                    out += `<div class="item-${item.label}">${item.label}</div>`;
                }
                out += `</div>`;
            }
        }
        out += `</div></td></tr>`;
        let err = this.errors.map(error => error.getIcon()).join('');
        out = out.replace('</td>', `${err}</td>`);
        return out;
    }
};


export class FunctionDiagnose {

    private module: WasmModule;
    public stage: ModuleStage;
    private stack: StackEntry[] = [];
    private unreachable: boolean = false;
    private instrFormat: InstructionFormatter = new InstructionFormatter(this);
    private block?: WasmBlock;

    constructor(
        private moduleDiag: ModuleDebug,
        private func: WasmFunction,
    ) {
        this.module = moduleDiag.module;
        this.stage = moduleDiag.stage;
    }

    public diagnose() {
        let func = this.func;
        this.write(`<h2>Function ${func.index} ${func.name}</h2>`);
        if (func.import) {
            this.write(`<div>Import ${[func.import.module, func.import.name].filter(x => x).join('.')}</div>`);
        }
        for (let exp of func.exports) {
            this.write(`<div>Export ${[exp.module, exp.name].filter(x => x).join('.')}</div>`);
        }
        if (func != func.resolved) {
            this.write(`<div>=&gt; ${func.resolved.name}</div>`);
        }
        if (this.func.block) {
            this.diagnoseBlock(this.func.block);
        }
    }

    diagnoseBlock(block: WasmBlock) {
        let old: [StackEntry[], boolean, WasmBlock | undefined] = [this.stack, this.unreachable, this.block];
        this.stack = [];
        this.unreachable = false;
        this.block = block;
        if (block.parentInstruction.opcode != OP.TRIVM_FUNCTION) {
            this.push(...block.type.params);
        }
        this.write(`<table class="instr" id="${this.moduleDiag.getRef(block)}"><tbody>`);
        for (let instr of block.body) {
            if (instr.opcode == OP.BR_TABLE) {
                let stack = this.stack;
                for (let i = 0; i < instr.targets.length - 1; i++) {
                    this.stack = [...stack];
                    this.diagnoseInstr({ id: instrId(instr), opcode: OP.BR_TABLE, targets: [instr.targets[i]] }, false);
                }
                this.stack = [...stack];
                this.diagnoseInstr({ id: instr.id, opcode: OP.BR_TABLE, targets: [instr.targets[instr.targets.length - 1]] }, true);
            } else {
                this.diagnoseInstr(instr);
            }
        }
        this.write('</tbody></table>');
        [this.stack, this.unreachable, this.block] = old;
    }

    diagnoseInstr(instr: WasmInstr, brTableLast: boolean = false) {
        let writeIndex = this.write('');
        this.instrFormat.clear(instr);
        this.instrFormat.unreachable = this.unreachable;
        let newStack: ValueType[] | undefined = undefined;

        switch (instr.opcode) {
            // #region Instruction print and verify
            // -- Instruction print and verify - begin of source code generated with help of "gen-instr.ts" script --

            case OP.UNREACHABLE: {
                this.unreachable = true;
                this.instrFormat.unreachable = true;
                newStack = [];
                break;
            }
            case OP.BLOCK:
            case OP.LOOP:
            case OP.IF: {
                if (instr.opcode === OP.IF) {
                    this.pop(NumberType.I32);
                    this.instrFormat.addTool('¬', 'scrollToBlockElse(this)');;
                }
                this.pop(...instr.block.type.params);
                this.push(...instr.block.type.results);
                this.instrFormat.addParam(formatType(instr.block.type));
                this.instrFormat.addTool('⇩', 'scrollToBlockEnd(this)');;
                this.instrFormat.addTool('±', 'toggleBlock(this)');;
                break;
            }
            case OP.ELSE: {
                this.pop(...this.block!.type.results);
                newStack = this.block!.type.params;
                this.unreachable = false;
                break;
            }
            case OP.END: {
                this.pop(...this.block!.type.results);
                this.unreachable = true;
                newStack = [];
                break;
            }
            case OP.BR:
            case OP.BR_IF:
            case OP.BR_TABLE: {
                if (instr.opcode != OP.BR) {
                    this.pop(NumberType.I32);
                }
                let targets = instr.opcode == OP.BR_TABLE ? instr.targets : [instr.target];
                let direction = instr.opcode != OP.BR_TABLE ? instr.direction : undefined;
                for (let target of targets) {
                    let forward = direction != undefined
                        ? direction == WasmBranchDir.Forward
                        : target.parentInstruction.opcode != OP.LOOP;
                    let pop = forward ? target.type.results : target.type.params;
                    this.pop(...pop);
                    if (instr.opcode == OP.BR_IF) {
                        this.push(...pop);
                    }
                    let levels = 1;
                    let block = this.block;
                    while (block !== target) {
                        levels++;
                        if (!block) throw new Error('ASSERT');
                        block = block.parentBlock;
                    }
                    this.instrFormat.brLevels.push(forward ? levels : -levels);
                    if (brTableLast) {
                        this.instrFormat.addParam('default');
                    }
                    this.instrFormat.addParam((levels - 1).toString());
                    this.instrFormat.addTool('⇨', `#instr-${target.parentInstruction.id}`);
                }
                if (instr.opcode == OP.BR || (instr.opcode == OP.BR_TABLE && brTableLast)) {
                    this.unreachable = true;
                    newStack = [];
                }
                break;
            }
            case OP.RETURN: {
                this.pop(...this.func.type.results);
                this.unreachable = true;
                break;
            }
            case OP.CALL: {
                this.pop(...instr.func.type.params);
                this.push(...instr.func.type.results);
                let ref = this.moduleDiag.getRef(instr.func);
                this.instrFormat.addParam('#' + ref);
                break;
            }
            case OP.CALL_INDIRECT: {
                this.pop(NumberType.I32);
                this.pop(...instr.type.params);
                this.push(...instr.type.results);
                let ref = this.moduleDiag.getRef(instr.table);
                this.instrFormat.addParam('#' + ref);
                break;
            }
            case OP.DROP: {
                let type = this.stack.at(-1)?.type || NumberType.I32;
                this.pop(type);
                break;
            }
            case OP.SELECT:
            case OP.SELECT_T: {
                this.pop(NumberType.I32);
                let type = this.stack.at(-1)?.type || NumberType.I32;
                this.pop(type, type);
                this.push(type);
                break;
            }
            case OP.LOCAL_GET:
            case OP.LOCAL_SET:
            case OP.LOCAL_TEE: {
                let type: ValueType = NumberType.I32;
                if (instr.index < this.func.type.params.length) {
                    type = this.func.type.params[instr.index];
                    this.instrFormat.addParam(`param-${instr.index}`);
                } else if (instr.index < this.func.type.params.length + this.func.locals.length) {
                    type = this.func.locals[instr.index - this.func.type.params.length];
                    this.instrFormat.addParam(`local-${instr.index}`);
                } else {
                    this.instrFormat.addError('Local index out of range.');
                    this.instrFormat.addParam(`local-${instr.index}`);
                }
                if (instr.opcode != OP.LOCAL_GET) {
                    this.pop(type);
                }
                if (instr.opcode != OP.LOCAL_SET) {
                    this.push(type);
                }
                break;
            }
            case OP.GLOBAL_GET:
            case OP.GLOBAL_SET: {
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.global));
                if (instr.opcode == OP.GLOBAL_GET) {
                    this.push(instr.global.type);
                } else {
                    this.pop(instr.global.type);
                }
                break;
            }
            case OP.TABLE_GET:
            case OP.TABLE_SET: {
                throw new Error('Not implemented');
                break;
            }
            case OP.REF_NULL: {
                throw new Error('Not implemented');
                break;
            }
            case OP.REF_IS_NULL: {
                throw new Error('Not implemented');
                break;
            }
            case OP.TABLE_GROW: {
                throw new Error('Not implemented');
                break;
            }
            case OP.TABLE_FILL: {
                throw new Error('Not implemented');
                break;
            }
            case OP.TRIVM_MULTIBYTE_FIRST:
            case OP.TRIVM_FUNCTION: {
                this.instrFormat.addError('Pseudo instruction used as normal instruction.');
                break;
            }
            case OP.I32_LOAD:
            case OP.I32_LOAD8_S:
            case OP.I32_LOAD8_U:
            case OP.I32_LOAD16_S:
            case OP.I32_LOAD16_U: {
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                this.instrFormat.addParam(instr.offset.toString());
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                break;
            }
            case OP.I64_LOAD:
            case OP.I64_LOAD8_S:
            case OP.I64_LOAD8_U:
            case OP.I64_LOAD16_S:
            case OP.I64_LOAD16_U:
            case OP.I64_LOAD32_S:
            case OP.I64_LOAD32_U: {
                this.pop(NumberType.I32);
                this.push(NumberType.I64);
                this.instrFormat.addParam(instr.offset.toString());
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                break;
            }
            case OP.F32_LOAD: {
                this.pop(NumberType.I32);
                this.push(NumberType.F32);
                this.instrFormat.addParam(instr.offset.toString());
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                break;
            }
            case OP.F64_LOAD: {
                this.pop(NumberType.I32);
                this.push(NumberType.F64);
                this.instrFormat.addParam(instr.offset.toString());
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                break;
            }
            case OP.I32_STORE:
            case OP.I32_STORE8:
            case OP.I32_STORE16: {
                this.pop(NumberType.I32, NumberType.I32);
                this.instrFormat.addParam(instr.offset.toString());
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                break;
            }
            case OP.I64_STORE:
            case OP.I64_STORE8:
            case OP.I64_STORE16:
            case OP.I64_STORE32: {
                this.pop(NumberType.I32, NumberType.I64);
                this.instrFormat.addParam(instr.offset.toString());
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                break;
            }
            case OP.F32_STORE: {
                this.pop(NumberType.I32, NumberType.F32);
                this.instrFormat.addParam(instr.offset.toString());
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                break;
            }
            case OP.F64_STORE: {
                this.pop(NumberType.I32, NumberType.F64);
                this.instrFormat.addParam(instr.offset.toString());
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                break;
            }
            case OP.MEMORY_SIZE: {
                this.push(NumberType.I32);
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                break;
            }
            case OP.MEMORY_GROW: {
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                break;
            }
            case OP.I32_CONST: {
                this.instrFormat.addParam(formatValue32(instr.value));
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_CONST: {
                this.instrFormat.addParam(formatValue64(instr.value));
                this.push(NumberType.I64);
                break;
            }
            case OP.F32_CONST: {
                throw new Error('Not implemented');
                this.push(NumberType.F32);
                break;
            }
            case OP.F64_CONST: {
                throw new Error('Not implemented');
                this.push(NumberType.F64);
                break;
            }
            case OP.REF_FUNC: {
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.func));
                this.push(RefType.FUNCREF);
                break;
            }
            case OP.MEMORY_INIT: {
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.data));
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                this.pop(NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.DATA_DROP: {
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.data));
                break;
            }
            case OP.MEMORY_COPY: {
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memories[0]));
                this.instrFormat.addParam('->'); // TODO: check direction
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memories[1]));
                this.pop(NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.MEMORY_FILL: {
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                this.pop(NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.TABLE_INIT: {
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.element));
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.table));
                this.pop(NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.ELEM_DROP: {
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.element));
                break;
            }
            case OP.TABLE_COPY: {
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.tables[0]));
                this.instrFormat.addParam('->'); // TODO: check direction
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.tables[1]));
                this.pop(NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.TABLE_SIZE: {
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.table));
                this.push(NumberType.I32);
                break;
            }
            case OP.V128_LOAD:
            case OP.V128_LOAD8X8_S:
            case OP.V128_LOAD8X8_U:
            case OP.V128_LOAD16X4_S:
            case OP.V128_LOAD16X4_U:
            case OP.V128_LOAD32X2_S:
            case OP.V128_LOAD32X2_U:
            case OP.V128_LOAD8_SPLAT:
            case OP.V128_LOAD16_SPLAT:
            case OP.V128_LOAD32_SPLAT:
            case OP.V128_LOAD64_SPLAT: {
                this.instrFormat.addParam(instr.offset.toString());
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_STORE: {
                this.instrFormat.addParam(instr.offset.toString());
                this.instrFormat.addParam('#' + this.moduleDiag.getRef(instr.memory));
                this.pop(NumberType.I32, VectorType.V128);
                break;
            }
            case OP.V128_CONST: {
                let hex = [...instr.value].map(x => x.toString(16).padStart(2, '0')).join('');
                this.instrFormat.addParam(hex);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_SHUFFLE: {
                let order = [...instr.value].map(x => x.toString()).join(',');
                this.instrFormat.addParam(order);
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_EXTRACT_LANE_S:
            case OP.I8X16_EXTRACT_LANE_U: {
                this.instrFormat.addParam(instr.index.toString());
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I8X16_REPLACE_LANE: {
                this.instrFormat.addParam(instr.index.toString());
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I16X8_EXTRACT_LANE_S:
            case OP.I16X8_EXTRACT_LANE_U: {
                throw new Error('Not implemented');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I16X8_REPLACE_LANE: {
                throw new Error('Not implemented');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I32X4_EXTRACT_LANE: {
                throw new Error('Not implemented');
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32X4_REPLACE_LANE: {
                throw new Error('Not implemented');
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_EXTRACT_LANE: {
                throw new Error('Not implemented');
                this.pop(VectorType.V128);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64X2_REPLACE_LANE: {
                throw new Error('Not implemented');
                this.pop(VectorType.V128, NumberType.I64);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_EXTRACT_LANE: {
                throw new Error('Not implemented');
                this.pop(VectorType.V128);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32X4_REPLACE_LANE: {
                throw new Error('Not implemented');
                this.pop(VectorType.V128, NumberType.F32);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_EXTRACT_LANE: {
                throw new Error('Not implemented');
                this.pop(VectorType.V128);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64X2_REPLACE_LANE: {
                throw new Error('Not implemented');
                this.pop(VectorType.V128, NumberType.F64);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD8_LANE:
            case OP.V128_STORE8_LANE: {
                throw new Error('Not implemented');
                this.pop(NumberType.I32, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD16_LANE:
            case OP.V128_STORE16_LANE: {
                throw new Error('Not implemented');
                this.pop(NumberType.I32, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD32_LANE:
            case OP.V128_STORE32_LANE: {
                throw new Error('Not implemented');
                this.pop(NumberType.I32, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD64_LANE:
            case OP.V128_STORE64_LANE: {
                throw new Error('Not implemented');
                this.pop(NumberType.I32, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD32_ZERO: {
                throw new Error('Not implemented');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_LOAD64_ZERO: {
                throw new Error('Not implemented');
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.NOP: {
                break;
            }
            case OP.I32_EQZ:
            case OP.I32_CLZ:
            case OP.I32_CTZ:
            case OP.I32_POPCNT:
            case OP.I32_EXTEND8_S:
            case OP.I32_EXTEND16_S: {
                this.pop(NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_EQ:
            case OP.I32_NE:
            case OP.I32_LT_S:
            case OP.I32_LT_U:
            case OP.I32_GT_S:
            case OP.I32_GT_U:
            case OP.I32_LE_S:
            case OP.I32_LE_U:
            case OP.I32_GE_S:
            case OP.I32_GE_U:
            case OP.I32_ADD:
            case OP.I32_SUB:
            case OP.I32_MUL:
            case OP.I32_DIV_S:
            case OP.I32_DIV_U:
            case OP.I32_REM_S:
            case OP.I32_REM_U:
            case OP.I32_AND:
            case OP.I32_OR:
            case OP.I32_XOR:
            case OP.I32_SHL:
            case OP.I32_SHR_S:
            case OP.I32_SHR_U:
            case OP.I32_ROTL:
            case OP.I32_ROTR: {
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_EQZ:
            case OP.I32_WRAP_I64: {
                this.pop(NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_EQ:
            case OP.I64_NE:
            case OP.I64_LT_S:
            case OP.I64_LT_U:
            case OP.I64_GT_S:
            case OP.I64_GT_U:
            case OP.I64_LE_S:
            case OP.I64_LE_U:
            case OP.I64_GE_S:
            case OP.I64_GE_U: {
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I32);
                break;
            }
            case OP.F32_EQ:
            case OP.F32_NE:
            case OP.F32_LT:
            case OP.F32_GT:
            case OP.F32_LE:
            case OP.F32_GE: {
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.F64_EQ:
            case OP.F64_NE:
            case OP.F64_LT:
            case OP.F64_GT:
            case OP.F64_LE:
            case OP.F64_GE: {
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_CLZ:
            case OP.I64_CTZ:
            case OP.I64_POPCNT:
            case OP.I64_EXTEND8_S:
            case OP.I64_EXTEND16_S:
            case OP.I64_EXTEND32_S: {
                this.pop(NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_ADD:
            case OP.I64_SUB:
            case OP.I64_MUL:
            case OP.I64_DIV_S:
            case OP.I64_DIV_U:
            case OP.I64_REM_S:
            case OP.I64_REM_U:
            case OP.I64_AND:
            case OP.I64_OR:
            case OP.I64_XOR:
            case OP.I64_SHL:
            case OP.I64_SHR_S:
            case OP.I64_SHR_U:
            case OP.I64_ROTL:
            case OP.I64_ROTR: {
                this.pop(NumberType.I64, NumberType.I64);
                this.push(NumberType.I64);
                break;
            }
            case OP.F32_ABS:
            case OP.F32_NEG:
            case OP.F32_CEIL:
            case OP.F32_FLOOR:
            case OP.F32_TRUNC:
            case OP.F32_NEAREST:
            case OP.F32_SQRT: {
                this.pop(NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_ADD:
            case OP.F32_SUB:
            case OP.F32_MUL:
            case OP.F32_DIV:
            case OP.F32_MIN:
            case OP.F32_MAX:
            case OP.F32_COPYSIGN: {
                this.pop(NumberType.F32, NumberType.F32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F64_ABS:
            case OP.F64_NEG:
            case OP.F64_CEIL:
            case OP.F64_FLOOR:
            case OP.F64_TRUNC:
            case OP.F64_NEAREST:
            case OP.F64_SQRT: {
                this.pop(NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_ADD:
            case OP.F64_SUB:
            case OP.F64_MUL:
            case OP.F64_DIV:
            case OP.F64_MIN:
            case OP.F64_MAX:
            case OP.F64_COPYSIGN: {
                this.pop(NumberType.F64, NumberType.F64);
                this.push(NumberType.F64);
                break;
            }
            case OP.I32_TRUNC_F32_S:
            case OP.I32_TRUNC_F32_U:
            case OP.I32_REINTERPRET_F32:
            case OP.I32_TRUNC_SAT_F32_S:
            case OP.I32_TRUNC_SAT_F32_U: {
                this.pop(NumberType.F32);
                this.push(NumberType.I32);
                break;
            }
            case OP.I32_TRUNC_F64_S:
            case OP.I32_TRUNC_F64_U:
            case OP.I32_TRUNC_SAT_F64_S:
            case OP.I32_TRUNC_SAT_F64_U: {
                this.pop(NumberType.F64);
                this.push(NumberType.I32);
                break;
            }
            case OP.I64_EXTEND_I32_S:
            case OP.I64_EXTEND_I32_U: {
                this.pop(NumberType.I32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_TRUNC_F32_S:
            case OP.I64_TRUNC_F32_U:
            case OP.I64_TRUNC_SAT_F32_S:
            case OP.I64_TRUNC_SAT_F32_U: {
                this.pop(NumberType.F32);
                this.push(NumberType.I64);
                break;
            }
            case OP.I64_TRUNC_F64_S:
            case OP.I64_TRUNC_F64_U:
            case OP.I64_REINTERPRET_F64:
            case OP.I64_TRUNC_SAT_F64_S:
            case OP.I64_TRUNC_SAT_F64_U: {
                this.pop(NumberType.F64);
                this.push(NumberType.I64);
                break;
            }
            case OP.F32_CONVERT_I32_S:
            case OP.F32_CONVERT_I32_U:
            case OP.F32_REINTERPRET_I32: {
                this.pop(NumberType.I32);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_CONVERT_I64_S:
            case OP.F32_CONVERT_I64_U: {
                this.pop(NumberType.I64);
                this.push(NumberType.F32);
                break;
            }
            case OP.F32_DEMOTE_F64: {
                this.pop(NumberType.F64);
                this.push(NumberType.F32);
                break;
            }
            case OP.F64_CONVERT_I32_S:
            case OP.F64_CONVERT_I32_U: {
                this.pop(NumberType.I32);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_CONVERT_I64_S:
            case OP.F64_CONVERT_I64_U:
            case OP.F64_REINTERPRET_I64: {
                this.pop(NumberType.I64);
                this.push(NumberType.F64);
                break;
            }
            case OP.F64_PROMOTE_F32: {
                this.pop(NumberType.F32);
                this.push(NumberType.F64);
                break;
            }
            case OP.I8X16_SWIZZLE:
            case OP.I8X16_EQ:
            case OP.I8X16_NE:
            case OP.I8X16_LT_S:
            case OP.I8X16_LT_U:
            case OP.I8X16_GT_S:
            case OP.I8X16_GT_U:
            case OP.I8X16_LE_S:
            case OP.I8X16_LE_U:
            case OP.I8X16_GE_S:
            case OP.I8X16_GE_U:
            case OP.I16X8_EQ:
            case OP.I16X8_NE:
            case OP.I16X8_LT_S:
            case OP.I16X8_LT_U:
            case OP.I16X8_GT_S:
            case OP.I16X8_GT_U:
            case OP.I16X8_LE_S:
            case OP.I16X8_LE_U:
            case OP.I16X8_GE_S:
            case OP.I16X8_GE_U:
            case OP.I32X4_EQ:
            case OP.I32X4_NE:
            case OP.I32X4_LT_S:
            case OP.I32X4_LT_U:
            case OP.I32X4_GT_S:
            case OP.I32X4_GT_U:
            case OP.I32X4_LE_S:
            case OP.I32X4_LE_U:
            case OP.I32X4_GE_S:
            case OP.I32X4_GE_U:
            case OP.F32X4_EQ:
            case OP.F32X4_NE:
            case OP.F32X4_LT:
            case OP.F32X4_GT:
            case OP.F32X4_LE:
            case OP.F32X4_GE:
            case OP.F64X2_EQ:
            case OP.F64X2_NE:
            case OP.F64X2_LT:
            case OP.F64X2_GT:
            case OP.F64X2_LE:
            case OP.F64X2_GE:
            case OP.V128_AND:
            case OP.V128_ANDNOT:
            case OP.V128_OR:
            case OP.V128_XOR:
            case OP.I8X16_NARROW_I16X8_S:
            case OP.I8X16_NARROW_I16X8_U:
            case OP.I8X16_ADD:
            case OP.I8X16_ADD_SAT_S:
            case OP.I8X16_ADD_SAT_U:
            case OP.I8X16_SUB:
            case OP.I8X16_SUB_SAT_S:
            case OP.I8X16_SUB_SAT_U:
            case OP.I8X16_MIN_S:
            case OP.I8X16_MIN_U:
            case OP.I8X16_MAX_S:
            case OP.I8X16_MAX_U:
            case OP.I8X16_AVGR_U:
            case OP.I16X8_Q15MULR_SAT_S:
            case OP.I16X8_NARROW_I32X4_S:
            case OP.I16X8_NARROW_I32X4_U:
            case OP.I16X8_ADD:
            case OP.I16X8_ADD_SAT_S:
            case OP.I16X8_ADD_SAT_U:
            case OP.I16X8_SUB:
            case OP.I16X8_SUB_SAT_S:
            case OP.I16X8_SUB_SAT_U:
            case OP.I16X8_MUL:
            case OP.I16X8_MIN_S:
            case OP.I16X8_MIN_U:
            case OP.I16X8_MAX_S:
            case OP.I16X8_MAX_U:
            case OP.I16X8_AVGR_U:
            case OP.I16X8_EXTMUL_LOW_I8X16_S:
            case OP.I16X8_EXTMUL_HIGH_I8X16_S:
            case OP.I16X8_EXTMUL_LOW_I8X16_U:
            case OP.I16X8_EXTMUL_HIGH_I8X16_U:
            case OP.I32X4_ADD:
            case OP.I32X4_SUB:
            case OP.I32X4_MUL:
            case OP.I32X4_MIN_S:
            case OP.I32X4_MIN_U:
            case OP.I32X4_MAX_S:
            case OP.I32X4_MAX_U:
            case OP.I32X4_DOT_I16X8_S:
            case OP.I32X4_EXTMUL_LOW_I16X8_S:
            case OP.I32X4_EXTMUL_HIGH_I16X8_S:
            case OP.I32X4_EXTMUL_LOW_I16X8_U:
            case OP.I32X4_EXTMUL_HIGH_I16X8_U:
            case OP.I64X2_ADD:
            case OP.I64X2_SUB:
            case OP.I64X2_MUL:
            case OP.I64X2_EQ:
            case OP.I64X2_NE:
            case OP.I64X2_LT_S:
            case OP.I64X2_GT_S:
            case OP.I64X2_LE_S:
            case OP.I64X2_GE_S:
            case OP.I64X2_EXTMUL_LOW_I32X4_S:
            case OP.I64X2_EXTMUL_HIGH_I32X4_S:
            case OP.I64X2_EXTMUL_LOW_I32X4_U:
            case OP.I64X2_EXTMUL_HIGH_I32X4_U:
            case OP.F32X4_ADD:
            case OP.F32X4_SUB:
            case OP.F32X4_MUL:
            case OP.F32X4_DIV:
            case OP.F32X4_MIN:
            case OP.F32X4_MAX:
            case OP.F32X4_PMIN:
            case OP.F32X4_PMAX:
            case OP.F64X2_ADD:
            case OP.F64X2_SUB:
            case OP.F64X2_MUL:
            case OP.F64X2_DIV:
            case OP.F64X2_MIN:
            case OP.F64X2_MAX:
            case OP.F64X2_PMIN:
            case OP.F64X2_PMAX: {
                this.pop(VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.I8X16_SPLAT:
            case OP.I16X8_SPLAT:
            case OP.I32X4_SPLAT: {
                this.pop(NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.I64X2_SPLAT: {
                this.pop(NumberType.I64);
                this.push(VectorType.V128);
                break;
            }
            case OP.F32X4_SPLAT: {
                this.pop(NumberType.F32);
                this.push(VectorType.V128);
                break;
            }
            case OP.F64X2_SPLAT: {
                this.pop(NumberType.F64);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_NOT:
            case OP.F32X4_DEMOTE_F64X2_ZERO:
            case OP.F64X2_PROMOTE_LOW_F32X4:
            case OP.I8X16_ABS:
            case OP.I8X16_NEG:
            case OP.I8X16_POPCNT:
            case OP.F32X4_CEIL:
            case OP.F32X4_FLOOR:
            case OP.F32X4_TRUNC:
            case OP.F32X4_NEAREST:
            case OP.F64X2_CEIL:
            case OP.F64X2_FLOOR:
            case OP.F64X2_TRUNC:
            case OP.I16X8_EXTADD_PAIRWISE_I8X16_S:
            case OP.I16X8_EXTADD_PAIRWISE_I8X16_U:
            case OP.I32X4_EXTADD_PAIRWISE_I16X8_S:
            case OP.I32X4_EXTADD_PAIRWISE_I16X8_U:
            case OP.I16X8_ABS:
            case OP.I16X8_NEG:
            case OP.I16X8_EXTEND_LOW_I8X16_S:
            case OP.I16X8_EXTEND_HIGH_I8X16_S:
            case OP.I16X8_EXTEND_LOW_I8X16_U:
            case OP.I16X8_EXTEND_HIGH_I8X16_U:
            case OP.F64X2_NEAREST:
            case OP.I32X4_ABS:
            case OP.I32X4_NEG:
            case OP.I32X4_EXTEND_LOW_I16X8_S:
            case OP.I32X4_EXTEND_HIGH_I16X8_S:
            case OP.I32X4_EXTEND_LOW_I16X8_U:
            case OP.I32X4_EXTEND_HIGH_I16X8_U:
            case OP.I64X2_ABS:
            case OP.I64X2_NEG:
            case OP.I64X2_EXTEND_LOW_I32X4_S:
            case OP.I64X2_EXTEND_HIGH_I32X4_S:
            case OP.I64X2_EXTEND_LOW_I32X4_U:
            case OP.I64X2_EXTEND_HIGH_I32X4_U:
            case OP.F32X4_ABS:
            case OP.F32X4_NEG:
            case OP.F32X4_SQRT:
            case OP.F64X2_ABS:
            case OP.F64X2_NEG:
            case OP.F64X2_SQRT:
            case OP.I32X4_TRUNC_SAT_F32X4_S:
            case OP.I32X4_TRUNC_SAT_F32X4_U:
            case OP.F32X4_CONVERT_I32X4_S:
            case OP.F32X4_CONVERT_I32X4_U:
            case OP.I32X4_TRUNC_SAT_F64X2_S_ZERO:
            case OP.I32X4_TRUNC_SAT_F64X2_U_ZERO:
            case OP.F64X2_CONVERT_LOW_I32X4_S:
            case OP.F64X2_CONVERT_LOW_I32X4_U: {
                this.pop(VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_BITSELECT: {
                this.pop(VectorType.V128, VectorType.V128, VectorType.V128);
                this.push(VectorType.V128);
                break;
            }
            case OP.V128_ANY_TRUE:
            case OP.I8X16_ALL_TRUE:
            case OP.I8X16_BITMASK:
            case OP.I16X8_ALL_TRUE:
            case OP.I16X8_BITMASK:
            case OP.I32X4_ALL_TRUE:
            case OP.I32X4_BITMASK:
            case OP.I64X2_ALL_TRUE:
            case OP.I64X2_BITMASK: {
                this.pop(VectorType.V128);
                this.push(NumberType.I32);
                break;
            }
            case OP.I8X16_SHL:
            case OP.I8X16_SHR_S:
            case OP.I8X16_SHR_U:
            case OP.I16X8_SHL:
            case OP.I16X8_SHR_S:
            case OP.I16X8_SHR_U:
            case OP.I32X4_SHL:
            case OP.I32X4_SHR_S:
            case OP.I32X4_SHR_U:
            case OP.I64X2_SHL:
            case OP.I64X2_SHR_S:
            case OP.I64X2_SHR_U: {
                this.pop(VectorType.V128, NumberType.I32);
                this.push(VectorType.V128);
                break;
            }
            case OP.TRIVM_POP:
            case OP.TRIVM_LOCAL_SET32:
            case OP.TRIVM_GLOBAL_SET32: {
                this.pop(NumberType.I32);
                break;
            }
            case OP.TRIVM_DUP32: {
                this.pop(NumberType.I32);
                this.push(NumberType.I32, NumberType.I32);
                break;
            }
            case OP.TRIVM_DUP64: {
                this.pop(NumberType.I32, NumberType.I32);
                this.push(NumberType.I32, NumberType.I32, NumberType.I32, NumberType.I32);
                break;
            }
            case OP.TRIVM_LOCAL_GET32:
            case OP.TRIVM_GLOBAL_GET32: {
                this.push(NumberType.I32);
                break;
            }
            case OP.TRIVM_LOCAL_GET64:
            case OP.TRIVM_GLOBAL_GET64: {
                this.push(NumberType.I32, NumberType.I32);
                break;
            }
            case OP.TRIVM_LOCAL_SET64:
            case OP.TRIVM_GLOBAL_SET64: {
                this.pop(NumberType.I32, NumberType.I32);
                break;
            }

            // -- Instruction print and verify - end of source code generated with help of "gen-instr.ts" script --
            // #endregion
        }

        if (this.stack.length > this.instrFormat.stackPush.length) {
            this.instrFormat.stackKeep = this.stack.slice(0, this.stack.length - this.instrFormat.stackPush.length);
        }

        this.write(this.instrFormat.getOutput(), writeIndex);
        this.moduleDiag.errors.push(...this.instrFormat.errors);

        if (newStack) {
            this.stack = [];
            this.push(...newStack);
        }

        switch (instr.opcode) {
            case OP.BLOCK:
            case OP.LOOP:
            case OP.IF:
                this.write('<tr><td colspan="3" class="block-container">');
                this.diagnoseBlock(instr.block);
                this.write('</td></tr>');
                break;
            default:
                break;
        }
    }

    push(...types: ValueType[]) {
        for (let type of types) {
            for (let label of STACK_LABELS[type]) {
                this.pushItem(type, label);
            }
        }
    }

    pushItem(type: ValueType, label: string) {
        this.instrFormat.stackPush.push({ type, label });
        this.stack.push({ type, label });
    }

    pop(...types: ValueType[]) {
        let out: StackEntry[] = [];
        for (let type of types.reverse()) {
            for (let label of STACK_LABELS_REVERSED[type]) {
                out.push(this.popItem(type, label));
            }
        }
        return out.reverse();
    }

    popItem(type: ValueType, label: string) {
        let prev = this.stack.pop();
        this.instrFormat.stackPop.unshift({ type, label, prev });
        return prev || { type: NumberType.I32, label: 'i32' }; // TODO: fail if undefined
    }

    write(text: string, index: number = -1) {
        return this.moduleDiag.write(text, index);
    }
}

export class ModuleDebug { // TODO: Rename to ModuleDiag

    private out: string[] = []
    private refs: Map<any, string> = new Map<any, string>();
    private usedRefs: Set<string> = new Set<string>();
    public errors: DiagError[] = [];

    constructor(
        public module: WasmModule,
        public stage: ModuleStage
    ) {
    }

    public diagnose() {

        this.out = ['<html><head><link rel="stylesheet" href="style.css" type="text/css" /><script type="text/javascript" src="debug.js"></script></head><body>'];

        /*for (let mem of this.module.memories) {
            this.diagnoseMem(mem)
        }*/

        for (let func of this.module.functions) {
            let diag = new FunctionDiagnose(this, func);
            diag.diagnose();
            this.write('<hr>');
            //if (func == this.module.functions[1]) break;
        }

        this.addErrors();

        platform.writeFile('drafts/out.html', this.out.join(''));
    }

    addErrors() {
        let out = '';
        for (let error of this.errors) {
            out += error.getOutput();
        }
        this.out.splice(1, 0, out);
    }

    /*    diagnoseInstr(instr: WasmInstr) {
            let dump = new DumpInstruction();
            this.dumpInstr = dump;
            this.instructions.push(dump);
            dump.opcode = instr.opcode;
    
            this.dumpInstr = undefined;
        }*/

    write(text: string, index: number = -1) {
        if (index < 0) {
            index = this.out.length;
            this.out.push(text);
        } else {
            this.out[index] = text;
        }
        return index;
    }

    getRef(obj: any): string {
        let prefix = 'obj';
        if (obj instanceof WasmFunction) {
            prefix = 'func';
        } else if (obj instanceof WasmMemory) {
            prefix = 'memory';
        } else if (obj instanceof WasmTable) {
            prefix = 'table';
        } else if (obj instanceof WasmData) {
            prefix = 'data';
        } else if (obj instanceof WasmElement) {
            prefix = 'element';
        } else if (obj instanceof WasmGlobal) {
            prefix = 'global';
        } else if (obj instanceof WasmBlock) {
            prefix = 'block';
        } else {
            throw new Error(`Not implemented`);
        }
        if (!this.refs.has(obj)) {
            let name: string | undefined = undefined;
            let postfix: string | number = '';
            let ref: string;
            if (obj instanceof WasmEntity) {
                name = obj.exports.length > 0 ? obj.exports.at(-1)!.name :
                    obj.import ? obj.import.module + '.' + obj.import.name :
                        undefined;
            }
            if (!name) {
                postfix = -1;
            }
            do {
                if (name) {
                    ref = prefix + '-';
                    ref += name.replace(/[^a-z0-9_-]/gi, '_');
                    ref += postfix;
                } else {
                    ref = prefix;
                    ref += postfix;
                }
                postfix = 1 * (postfix as any) - 1;
            } while (this.usedRefs.has(ref.toLowerCase()));
            this.usedRefs.add(ref.toLowerCase());
            this.refs.set(obj, ref);
        }
        return this.refs.get(obj) as string;
    }


};


const INSTRUCTION_NAME: { [key in OP]: string } = {
    // -- Instruction names - begin of source code generated with help of "gen-instr.ts" script --

    [OP.UNREACHABLE]: 'unreachable',
    [OP.NOP]: 'nop',
    [OP.BLOCK]: 'block',
    [OP.LOOP]: 'loop',
    [OP.IF]: 'if',
    [OP.ELSE]: 'else',
    [OP.END]: 'end',
    [OP.BR]: 'br',
    [OP.BR_IF]: 'br_if',
    [OP.BR_TABLE]: 'br_table',
    [OP.RETURN]: 'return',
    [OP.CALL]: 'call',
    [OP.CALL_INDIRECT]: 'call_indirect',
    [OP.DROP]: 'drop',
    [OP.SELECT]: 'select',
    [OP.SELECT_T]: 'select_t',
    [OP.LOCAL_GET]: 'local.get',
    [OP.LOCAL_SET]: 'local.set',
    [OP.LOCAL_TEE]: 'local.tee',
    [OP.GLOBAL_GET]: 'global.get',
    [OP.GLOBAL_SET]: 'global.set',
    [OP.TABLE_GET]: 'table.get',
    [OP.TABLE_SET]: 'table.set',
    [OP.I32_LOAD]: 'i32.load',
    [OP.I64_LOAD]: 'i64.load',
    [OP.F32_LOAD]: 'f32.load',
    [OP.F64_LOAD]: 'f64.load',
    [OP.I32_LOAD8_S]: 'i32.load8_s',
    [OP.I32_LOAD8_U]: 'i32.load8_u',
    [OP.I32_LOAD16_S]: 'i32.load16_s',
    [OP.I32_LOAD16_U]: 'i32.load16_u',
    [OP.I64_LOAD8_S]: 'i64.load8_s',
    [OP.I64_LOAD8_U]: 'i64.load8_u',
    [OP.I64_LOAD16_S]: 'i64.load16_s',
    [OP.I64_LOAD16_U]: 'i64.load16_u',
    [OP.I64_LOAD32_S]: 'i64.load32_s',
    [OP.I64_LOAD32_U]: 'i64.load32_u',
    [OP.I32_STORE]: 'i32.store',
    [OP.I64_STORE]: 'i64.store',
    [OP.F32_STORE]: 'f32.store',
    [OP.F64_STORE]: 'f64.store',
    [OP.I32_STORE8]: 'i32.store8',
    [OP.I32_STORE16]: 'i32.store16',
    [OP.I64_STORE8]: 'i64.store8',
    [OP.I64_STORE16]: 'i64.store16',
    [OP.I64_STORE32]: 'i64.store32',
    [OP.MEMORY_SIZE]: 'memory.size',
    [OP.MEMORY_GROW]: 'memory.grow',
    [OP.I32_CONST]: 'i32.const',
    [OP.I64_CONST]: 'i64.const',
    [OP.F32_CONST]: 'f32.const',
    [OP.F64_CONST]: 'f64.const',
    [OP.I32_EQZ]: 'i32.eqz',
    [OP.I32_EQ]: 'i32.eq',
    [OP.I32_NE]: 'i32.ne',
    [OP.I32_LT_S]: 'i32.lt_s',
    [OP.I32_LT_U]: 'i32.lt_u',
    [OP.I32_GT_S]: 'i32.gt_s',
    [OP.I32_GT_U]: 'i32.gt_u',
    [OP.I32_LE_S]: 'i32.le_s',
    [OP.I32_LE_U]: 'i32.le_u',
    [OP.I32_GE_S]: 'i32.ge_s',
    [OP.I32_GE_U]: 'i32.ge_u',
    [OP.I64_EQZ]: 'i64.eqz',
    [OP.I64_EQ]: 'i64.eq',
    [OP.I64_NE]: 'i64.ne',
    [OP.I64_LT_S]: 'i64.lt_s',
    [OP.I64_LT_U]: 'i64.lt_u',
    [OP.I64_GT_S]: 'i64.gt_s',
    [OP.I64_GT_U]: 'i64.gt_u',
    [OP.I64_LE_S]: 'i64.le_s',
    [OP.I64_LE_U]: 'i64.le_u',
    [OP.I64_GE_S]: 'i64.ge_s',
    [OP.I64_GE_U]: 'i64.ge_u',
    [OP.F32_EQ]: 'f32.eq',
    [OP.F32_NE]: 'f32.ne',
    [OP.F32_LT]: 'f32.lt',
    [OP.F32_GT]: 'f32.gt',
    [OP.F32_LE]: 'f32.le',
    [OP.F32_GE]: 'f32.ge',
    [OP.F64_EQ]: 'f64.eq',
    [OP.F64_NE]: 'f64.ne',
    [OP.F64_LT]: 'f64.lt',
    [OP.F64_GT]: 'f64.gt',
    [OP.F64_LE]: 'f64.le',
    [OP.F64_GE]: 'f64.ge',
    [OP.I32_CLZ]: 'i32.clz',
    [OP.I32_CTZ]: 'i32.ctz',
    [OP.I32_POPCNT]: 'i32.popcnt',
    [OP.I32_ADD]: 'i32.add',
    [OP.I32_SUB]: 'i32.sub',
    [OP.I32_MUL]: 'i32.mul',
    [OP.I32_DIV_S]: 'i32.div_s',
    [OP.I32_DIV_U]: 'i32.div_u',
    [OP.I32_REM_S]: 'i32.rem_s',
    [OP.I32_REM_U]: 'i32.rem_u',
    [OP.I32_AND]: 'i32.and',
    [OP.I32_OR]: 'i32.or',
    [OP.I32_XOR]: 'i32.xor',
    [OP.I32_SHL]: 'i32.shl',
    [OP.I32_SHR_S]: 'i32.shr_s',
    [OP.I32_SHR_U]: 'i32.shr_u',
    [OP.I32_ROTL]: 'i32.rotl',
    [OP.I32_ROTR]: 'i32.rotr',
    [OP.I64_CLZ]: 'i64.clz',
    [OP.I64_CTZ]: 'i64.ctz',
    [OP.I64_POPCNT]: 'i64.popcnt',
    [OP.I64_ADD]: 'i64.add',
    [OP.I64_SUB]: 'i64.sub',
    [OP.I64_MUL]: 'i64.mul',
    [OP.I64_DIV_S]: 'i64.div_s',
    [OP.I64_DIV_U]: 'i64.div_u',
    [OP.I64_REM_S]: 'i64.rem_s',
    [OP.I64_REM_U]: 'i64.rem_u',
    [OP.I64_AND]: 'i64.and',
    [OP.I64_OR]: 'i64.or',
    [OP.I64_XOR]: 'i64.xor',
    [OP.I64_SHL]: 'i64.shl',
    [OP.I64_SHR_S]: 'i64.shr_s',
    [OP.I64_SHR_U]: 'i64.shr_u',
    [OP.I64_ROTL]: 'i64.rotl',
    [OP.I64_ROTR]: 'i64.rotr',
    [OP.F32_ABS]: 'f32.abs',
    [OP.F32_NEG]: 'f32.neg',
    [OP.F32_CEIL]: 'f32.ceil',
    [OP.F32_FLOOR]: 'f32.floor',
    [OP.F32_TRUNC]: 'f32.trunc',
    [OP.F32_NEAREST]: 'f32.nearest',
    [OP.F32_SQRT]: 'f32.sqrt',
    [OP.F32_ADD]: 'f32.add',
    [OP.F32_SUB]: 'f32.sub',
    [OP.F32_MUL]: 'f32.mul',
    [OP.F32_DIV]: 'f32.div',
    [OP.F32_MIN]: 'f32.min',
    [OP.F32_MAX]: 'f32.max',
    [OP.F32_COPYSIGN]: 'f32.copysign',
    [OP.F64_ABS]: 'f64.abs',
    [OP.F64_NEG]: 'f64.neg',
    [OP.F64_CEIL]: 'f64.ceil',
    [OP.F64_FLOOR]: 'f64.floor',
    [OP.F64_TRUNC]: 'f64.trunc',
    [OP.F64_NEAREST]: 'f64.nearest',
    [OP.F64_SQRT]: 'f64.sqrt',
    [OP.F64_ADD]: 'f64.add',
    [OP.F64_SUB]: 'f64.sub',
    [OP.F64_MUL]: 'f64.mul',
    [OP.F64_DIV]: 'f64.div',
    [OP.F64_MIN]: 'f64.min',
    [OP.F64_MAX]: 'f64.max',
    [OP.F64_COPYSIGN]: 'f64.copysign',
    [OP.I32_WRAP_I64]: 'i32.wrap_i64',
    [OP.I32_TRUNC_F32_S]: 'i32.trunc_f32_s',
    [OP.I32_TRUNC_F32_U]: 'i32.trunc_f32_u',
    [OP.I32_TRUNC_F64_S]: 'i32.trunc_f64_s',
    [OP.I32_TRUNC_F64_U]: 'i32.trunc_f64_u',
    [OP.I64_EXTEND_I32_S]: 'i64.extend_i32_s',
    [OP.I64_EXTEND_I32_U]: 'i64.extend_i32_u',
    [OP.I64_TRUNC_F32_S]: 'i64.trunc_f32_s',
    [OP.I64_TRUNC_F32_U]: 'i64.trunc_f32_u',
    [OP.I64_TRUNC_F64_S]: 'i64.trunc_f64_s',
    [OP.I64_TRUNC_F64_U]: 'i64.trunc_f64_u',
    [OP.F32_CONVERT_I32_S]: 'f32.convert_i32_s',
    [OP.F32_CONVERT_I32_U]: 'f32.convert_i32_u',
    [OP.F32_CONVERT_I64_S]: 'f32.convert_i64_s',
    [OP.F32_CONVERT_I64_U]: 'f32.convert_i64_u',
    [OP.F32_DEMOTE_F64]: 'f32.demote_f64',
    [OP.F64_CONVERT_I32_S]: 'f64.convert_i32_s',
    [OP.F64_CONVERT_I32_U]: 'f64.convert_i32_u',
    [OP.F64_CONVERT_I64_S]: 'f64.convert_i64_s',
    [OP.F64_CONVERT_I64_U]: 'f64.convert_i64_u',
    [OP.F64_PROMOTE_F32]: 'f64.promote_f32',
    [OP.I32_REINTERPRET_F32]: 'i32.reinterpret_f32',
    [OP.I64_REINTERPRET_F64]: 'i64.reinterpret_f64',
    [OP.F32_REINTERPRET_I32]: 'f32.reinterpret_i32',
    [OP.F64_REINTERPRET_I64]: 'f64.reinterpret_i64',
    [OP.I32_EXTEND8_S]: 'i32.extend8_s',
    [OP.I32_EXTEND16_S]: 'i32.extend16_s',
    [OP.I64_EXTEND8_S]: 'i64.extend8_s',
    [OP.I64_EXTEND16_S]: 'i64.extend16_s',
    [OP.I64_EXTEND32_S]: 'i64.extend32_s',
    [OP.REF_NULL]: 'ref.null',
    [OP.REF_IS_NULL]: 'ref.is_null',
    [OP.REF_FUNC]: 'ref.func',
    [OP.I32_TRUNC_SAT_F32_S]: 'i32.trunc_sat_f32_s',
    [OP.I32_TRUNC_SAT_F32_U]: 'i32.trunc_sat_f32_u',
    [OP.I32_TRUNC_SAT_F64_S]: 'i32.trunc_sat_f64_s',
    [OP.I32_TRUNC_SAT_F64_U]: 'i32.trunc_sat_f64_u',
    [OP.I64_TRUNC_SAT_F32_S]: 'i64.trunc_sat_f32_s',
    [OP.I64_TRUNC_SAT_F32_U]: 'i64.trunc_sat_f32_u',
    [OP.I64_TRUNC_SAT_F64_S]: 'i64.trunc_sat_f64_s',
    [OP.I64_TRUNC_SAT_F64_U]: 'i64.trunc_sat_f64_u',
    [OP.MEMORY_INIT]: 'memory.init',
    [OP.DATA_DROP]: 'data.drop',
    [OP.MEMORY_COPY]: 'memory.copy',
    [OP.MEMORY_FILL]: 'memory.fill',
    [OP.TABLE_INIT]: 'table.init',
    [OP.ELEM_DROP]: 'elem.drop',
    [OP.TABLE_COPY]: 'table.copy',
    [OP.TABLE_GROW]: 'table.grow',
    [OP.TABLE_SIZE]: 'table.size',
    [OP.TABLE_FILL]: 'table.fill',
    [OP.V128_LOAD]: 'v128.load',
    [OP.V128_LOAD8X8_S]: 'v128.load8x8_s',
    [OP.V128_LOAD8X8_U]: 'v128.load8x8_u',
    [OP.V128_LOAD16X4_S]: 'v128.load16x4_s',
    [OP.V128_LOAD16X4_U]: 'v128.load16x4_u',
    [OP.V128_LOAD32X2_S]: 'v128.load32x2_s',
    [OP.V128_LOAD32X2_U]: 'v128.load32x2_u',
    [OP.V128_LOAD8_SPLAT]: 'v128.load8_splat',
    [OP.V128_LOAD16_SPLAT]: 'v128.load16_splat',
    [OP.V128_LOAD32_SPLAT]: 'v128.load32_splat',
    [OP.V128_LOAD64_SPLAT]: 'v128.load64_splat',
    [OP.V128_STORE]: 'v128.store',
    [OP.V128_CONST]: 'v128.const',
    [OP.I8X16_SHUFFLE]: 'i8x16.shuffle',
    [OP.I8X16_SWIZZLE]: 'i8x16.swizzle',
    [OP.I8X16_SPLAT]: 'i8x16.splat',
    [OP.I16X8_SPLAT]: 'i16x8.splat',
    [OP.I32X4_SPLAT]: 'i32x4.splat',
    [OP.I64X2_SPLAT]: 'i64x2.splat',
    [OP.F32X4_SPLAT]: 'f32x4.splat',
    [OP.F64X2_SPLAT]: 'f64x2.splat',
    [OP.I8X16_EXTRACT_LANE_S]: 'i8x16.extract_lane_s',
    [OP.I8X16_EXTRACT_LANE_U]: 'i8x16.extract_lane_u',
    [OP.I8X16_REPLACE_LANE]: 'i8x16.replace_lane',
    [OP.I16X8_EXTRACT_LANE_S]: 'i16x8.extract_lane_s',
    [OP.I16X8_EXTRACT_LANE_U]: 'i16x8.extract_lane_u',
    [OP.I16X8_REPLACE_LANE]: 'i16x8.replace_lane',
    [OP.I32X4_EXTRACT_LANE]: 'i32x4.extract_lane',
    [OP.I32X4_REPLACE_LANE]: 'i32x4.replace_lane',
    [OP.I64X2_EXTRACT_LANE]: 'i64x2.extract_lane',
    [OP.I64X2_REPLACE_LANE]: 'i64x2.replace_lane',
    [OP.F32X4_EXTRACT_LANE]: 'f32x4.extract_lane',
    [OP.F32X4_REPLACE_LANE]: 'f32x4.replace_lane',
    [OP.F64X2_EXTRACT_LANE]: 'f64x2.extract_lane',
    [OP.F64X2_REPLACE_LANE]: 'f64x2.replace_lane',
    [OP.I8X16_EQ]: 'i8x16.eq',
    [OP.I8X16_NE]: 'i8x16.ne',
    [OP.I8X16_LT_S]: 'i8x16.lt_s',
    [OP.I8X16_LT_U]: 'i8x16.lt_u',
    [OP.I8X16_GT_S]: 'i8x16.gt_s',
    [OP.I8X16_GT_U]: 'i8x16.gt_u',
    [OP.I8X16_LE_S]: 'i8x16.le_s',
    [OP.I8X16_LE_U]: 'i8x16.le_u',
    [OP.I8X16_GE_S]: 'i8x16.ge_s',
    [OP.I8X16_GE_U]: 'i8x16.ge_u',
    [OP.I16X8_EQ]: 'i16x8.eq',
    [OP.I16X8_NE]: 'i16x8.ne',
    [OP.I16X8_LT_S]: 'i16x8.lt_s',
    [OP.I16X8_LT_U]: 'i16x8.lt_u',
    [OP.I16X8_GT_S]: 'i16x8.gt_s',
    [OP.I16X8_GT_U]: 'i16x8.gt_u',
    [OP.I16X8_LE_S]: 'i16x8.le_s',
    [OP.I16X8_LE_U]: 'i16x8.le_u',
    [OP.I16X8_GE_S]: 'i16x8.ge_s',
    [OP.I16X8_GE_U]: 'i16x8.ge_u',
    [OP.I32X4_EQ]: 'i32x4.eq',
    [OP.I32X4_NE]: 'i32x4.ne',
    [OP.I32X4_LT_S]: 'i32x4.lt_s',
    [OP.I32X4_LT_U]: 'i32x4.lt_u',
    [OP.I32X4_GT_S]: 'i32x4.gt_s',
    [OP.I32X4_GT_U]: 'i32x4.gt_u',
    [OP.I32X4_LE_S]: 'i32x4.le_s',
    [OP.I32X4_LE_U]: 'i32x4.le_u',
    [OP.I32X4_GE_S]: 'i32x4.ge_s',
    [OP.I32X4_GE_U]: 'i32x4.ge_u',
    [OP.F32X4_EQ]: 'f32x4.eq',
    [OP.F32X4_NE]: 'f32x4.ne',
    [OP.F32X4_LT]: 'f32x4.lt',
    [OP.F32X4_GT]: 'f32x4.gt',
    [OP.F32X4_LE]: 'f32x4.le',
    [OP.F32X4_GE]: 'f32x4.ge',
    [OP.F64X2_EQ]: 'f64x2.eq',
    [OP.F64X2_NE]: 'f64x2.ne',
    [OP.F64X2_LT]: 'f64x2.lt',
    [OP.F64X2_GT]: 'f64x2.gt',
    [OP.F64X2_LE]: 'f64x2.le',
    [OP.F64X2_GE]: 'f64x2.ge',
    [OP.V128_NOT]: 'v128.not',
    [OP.V128_AND]: 'v128.and',
    [OP.V128_ANDNOT]: 'v128.andnot',
    [OP.V128_OR]: 'v128.or',
    [OP.V128_XOR]: 'v128.xor',
    [OP.V128_BITSELECT]: 'v128.bitselect',
    [OP.V128_ANY_TRUE]: 'v128.any_true',
    [OP.V128_LOAD8_LANE]: 'v128.load8_lane',
    [OP.V128_LOAD16_LANE]: 'v128.load16_lane',
    [OP.V128_LOAD32_LANE]: 'v128.load32_lane',
    [OP.V128_LOAD64_LANE]: 'v128.load64_lane',
    [OP.V128_STORE8_LANE]: 'v128.store8_lane',
    [OP.V128_STORE16_LANE]: 'v128.store16_lane',
    [OP.V128_STORE32_LANE]: 'v128.store32_lane',
    [OP.V128_STORE64_LANE]: 'v128.store64_lane',
    [OP.V128_LOAD32_ZERO]: 'v128.load32_zero',
    [OP.V128_LOAD64_ZERO]: 'v128.load64_zero',
    [OP.F32X4_DEMOTE_F64X2_ZERO]: 'f32x4.demote_f64x2_zero',
    [OP.F64X2_PROMOTE_LOW_F32X4]: 'f64x2.promote_low_f32x4',
    [OP.I8X16_ABS]: 'i8x16.abs',
    [OP.I8X16_NEG]: 'i8x16.neg',
    [OP.I8X16_POPCNT]: 'i8x16.popcnt',
    [OP.I8X16_ALL_TRUE]: 'i8x16.all_true',
    [OP.I8X16_BITMASK]: 'i8x16.bitmask',
    [OP.I8X16_NARROW_I16X8_S]: 'i8x16.narrow_i16x8_s',
    [OP.I8X16_NARROW_I16X8_U]: 'i8x16.narrow_i16x8_u',
    [OP.F32X4_CEIL]: 'f32x4.ceil',
    [OP.F32X4_FLOOR]: 'f32x4.floor',
    [OP.F32X4_TRUNC]: 'f32x4.trunc',
    [OP.F32X4_NEAREST]: 'f32x4.nearest',
    [OP.I8X16_SHL]: 'i8x16.shl',
    [OP.I8X16_SHR_S]: 'i8x16.shr_s',
    [OP.I8X16_SHR_U]: 'i8x16.shr_u',
    [OP.I8X16_ADD]: 'i8x16.add',
    [OP.I8X16_ADD_SAT_S]: 'i8x16.add_sat_s',
    [OP.I8X16_ADD_SAT_U]: 'i8x16.add_sat_u',
    [OP.I8X16_SUB]: 'i8x16.sub',
    [OP.I8X16_SUB_SAT_S]: 'i8x16.sub_sat_s',
    [OP.I8X16_SUB_SAT_U]: 'i8x16.sub_sat_u',
    [OP.F64X2_CEIL]: 'f64x2.ceil',
    [OP.F64X2_FLOOR]: 'f64x2.floor',
    [OP.I8X16_MIN_S]: 'i8x16.min_s',
    [OP.I8X16_MIN_U]: 'i8x16.min_u',
    [OP.I8X16_MAX_S]: 'i8x16.max_s',
    [OP.I8X16_MAX_U]: 'i8x16.max_u',
    [OP.F64X2_TRUNC]: 'f64x2.trunc',
    [OP.I8X16_AVGR_U]: 'i8x16.avgr_u',
    [OP.I16X8_EXTADD_PAIRWISE_I8X16_S]: 'i16x8.extadd_pairwise_i8x16_s',
    [OP.I16X8_EXTADD_PAIRWISE_I8X16_U]: 'i16x8.extadd_pairwise_i8x16_u',
    [OP.I32X4_EXTADD_PAIRWISE_I16X8_S]: 'i32x4.extadd_pairwise_i16x8_s',
    [OP.I32X4_EXTADD_PAIRWISE_I16X8_U]: 'i32x4.extadd_pairwise_i16x8_u',
    [OP.I16X8_ABS]: 'i16x8.abs',
    [OP.I16X8_NEG]: 'i16x8.neg',
    [OP.I16X8_Q15MULR_SAT_S]: 'i16x8.q15mulr_sat_s',
    [OP.I16X8_ALL_TRUE]: 'i16x8.all_true',
    [OP.I16X8_BITMASK]: 'i16x8.bitmask',
    [OP.I16X8_NARROW_I32X4_S]: 'i16x8.narrow_i32x4_s',
    [OP.I16X8_NARROW_I32X4_U]: 'i16x8.narrow_i32x4_u',
    [OP.I16X8_EXTEND_LOW_I8X16_S]: 'i16x8.extend_low_i8x16_s',
    [OP.I16X8_EXTEND_HIGH_I8X16_S]: 'i16x8.extend_high_i8x16_s',
    [OP.I16X8_EXTEND_LOW_I8X16_U]: 'i16x8.extend_low_i8x16_u',
    [OP.I16X8_EXTEND_HIGH_I8X16_U]: 'i16x8.extend_high_i8x16_u',
    [OP.I16X8_SHL]: 'i16x8.shl',
    [OP.I16X8_SHR_S]: 'i16x8.shr_s',
    [OP.I16X8_SHR_U]: 'i16x8.shr_u',
    [OP.I16X8_ADD]: 'i16x8.add',
    [OP.I16X8_ADD_SAT_S]: 'i16x8.add_sat_s',
    [OP.I16X8_ADD_SAT_U]: 'i16x8.add_sat_u',
    [OP.I16X8_SUB]: 'i16x8.sub',
    [OP.I16X8_SUB_SAT_S]: 'i16x8.sub_sat_s',
    [OP.I16X8_SUB_SAT_U]: 'i16x8.sub_sat_u',
    [OP.F64X2_NEAREST]: 'f64x2.nearest',
    [OP.I16X8_MUL]: 'i16x8.mul',
    [OP.I16X8_MIN_S]: 'i16x8.min_s',
    [OP.I16X8_MIN_U]: 'i16x8.min_u',
    [OP.I16X8_MAX_S]: 'i16x8.max_s',
    [OP.I16X8_MAX_U]: 'i16x8.max_u',
    [OP.I16X8_AVGR_U]: 'i16x8.avgr_u',
    [OP.I16X8_EXTMUL_LOW_I8X16_S]: 'i16x8.extmul_low_i8x16_s',
    [OP.I16X8_EXTMUL_HIGH_I8X16_S]: 'i16x8.extmul_high_i8x16_s',
    [OP.I16X8_EXTMUL_LOW_I8X16_U]: 'i16x8.extmul_low_i8x16_u',
    [OP.I16X8_EXTMUL_HIGH_I8X16_U]: 'i16x8.extmul_high_i8x16_u',
    [OP.I32X4_ABS]: 'i32x4.abs',
    [OP.I32X4_NEG]: 'i32x4.neg',
    [OP.I32X4_ALL_TRUE]: 'i32x4.all_true',
    [OP.I32X4_BITMASK]: 'i32x4.bitmask',
    [OP.I32X4_EXTEND_LOW_I16X8_S]: 'i32x4.extend_low_i16x8_s',
    [OP.I32X4_EXTEND_HIGH_I16X8_S]: 'i32x4.extend_high_i16x8_s',
    [OP.I32X4_EXTEND_LOW_I16X8_U]: 'i32x4.extend_low_i16x8_u',
    [OP.I32X4_EXTEND_HIGH_I16X8_U]: 'i32x4.extend_high_i16x8_u',
    [OP.I32X4_SHL]: 'i32x4.shl',
    [OP.I32X4_SHR_S]: 'i32x4.shr_s',
    [OP.I32X4_SHR_U]: 'i32x4.shr_u',
    [OP.I32X4_ADD]: 'i32x4.add',
    [OP.I32X4_SUB]: 'i32x4.sub',
    [OP.I32X4_MUL]: 'i32x4.mul',
    [OP.I32X4_MIN_S]: 'i32x4.min_s',
    [OP.I32X4_MIN_U]: 'i32x4.min_u',
    [OP.I32X4_MAX_S]: 'i32x4.max_s',
    [OP.I32X4_MAX_U]: 'i32x4.max_u',
    [OP.I32X4_DOT_I16X8_S]: 'i32x4.dot_i16x8_s',
    [OP.I32X4_EXTMUL_LOW_I16X8_S]: 'i32x4.extmul_low_i16x8_s',
    [OP.I32X4_EXTMUL_HIGH_I16X8_S]: 'i32x4.extmul_high_i16x8_s',
    [OP.I32X4_EXTMUL_LOW_I16X8_U]: 'i32x4.extmul_low_i16x8_u',
    [OP.I32X4_EXTMUL_HIGH_I16X8_U]: 'i32x4.extmul_high_i16x8_u',
    [OP.I64X2_ABS]: 'i64x2.abs',
    [OP.I64X2_NEG]: 'i64x2.neg',
    [OP.I64X2_ALL_TRUE]: 'i64x2.all_true',
    [OP.I64X2_BITMASK]: 'i64x2.bitmask',
    [OP.I64X2_EXTEND_LOW_I32X4_S]: 'i64x2.extend_low_i32x4_s',
    [OP.I64X2_EXTEND_HIGH_I32X4_S]: 'i64x2.extend_high_i32x4_s',
    [OP.I64X2_EXTEND_LOW_I32X4_U]: 'i64x2.extend_low_i32x4_u',
    [OP.I64X2_EXTEND_HIGH_I32X4_U]: 'i64x2.extend_high_i32x4_u',
    [OP.I64X2_SHL]: 'i64x2.shl',
    [OP.I64X2_SHR_S]: 'i64x2.shr_s',
    [OP.I64X2_SHR_U]: 'i64x2.shr_u',
    [OP.I64X2_ADD]: 'i64x2.add',
    [OP.I64X2_SUB]: 'i64x2.sub',
    [OP.I64X2_MUL]: 'i64x2.mul',
    [OP.I64X2_EQ]: 'i64x2.eq',
    [OP.I64X2_NE]: 'i64x2.ne',
    [OP.I64X2_LT_S]: 'i64x2.lt_s',
    [OP.I64X2_GT_S]: 'i64x2.gt_s',
    [OP.I64X2_LE_S]: 'i64x2.le_s',
    [OP.I64X2_GE_S]: 'i64x2.ge_s',
    [OP.I64X2_EXTMUL_LOW_I32X4_S]: 'i64x2.extmul_low_i32x4_s',
    [OP.I64X2_EXTMUL_HIGH_I32X4_S]: 'i64x2.extmul_high_i32x4_s',
    [OP.I64X2_EXTMUL_LOW_I32X4_U]: 'i64x2.extmul_low_i32x4_u',
    [OP.I64X2_EXTMUL_HIGH_I32X4_U]: 'i64x2.extmul_high_i32x4_u',
    [OP.F32X4_ABS]: 'f32x4.abs',
    [OP.F32X4_NEG]: 'f32x4.neg',
    [OP.F32X4_SQRT]: 'f32x4.sqrt',
    [OP.F32X4_ADD]: 'f32x4.add',
    [OP.F32X4_SUB]: 'f32x4.sub',
    [OP.F32X4_MUL]: 'f32x4.mul',
    [OP.F32X4_DIV]: 'f32x4.div',
    [OP.F32X4_MIN]: 'f32x4.min',
    [OP.F32X4_MAX]: 'f32x4.max',
    [OP.F32X4_PMIN]: 'f32x4.pmin',
    [OP.F32X4_PMAX]: 'f32x4.pmax',
    [OP.F64X2_ABS]: 'f64x2.abs',
    [OP.F64X2_NEG]: 'f64x2.neg',
    [OP.F64X2_SQRT]: 'f64x2.sqrt',
    [OP.F64X2_ADD]: 'f64x2.add',
    [OP.F64X2_SUB]: 'f64x2.sub',
    [OP.F64X2_MUL]: 'f64x2.mul',
    [OP.F64X2_DIV]: 'f64x2.div',
    [OP.F64X2_MIN]: 'f64x2.min',
    [OP.F64X2_MAX]: 'f64x2.max',
    [OP.F64X2_PMIN]: 'f64x2.pmin',
    [OP.F64X2_PMAX]: 'f64x2.pmax',
    [OP.I32X4_TRUNC_SAT_F32X4_S]: 'i32x4.trunc_sat_f32x4_s',
    [OP.I32X4_TRUNC_SAT_F32X4_U]: 'i32x4.trunc_sat_f32x4_u',
    [OP.F32X4_CONVERT_I32X4_S]: 'f32x4.convert_i32x4_s',
    [OP.F32X4_CONVERT_I32X4_U]: 'f32x4.convert_i32x4_u',
    [OP.I32X4_TRUNC_SAT_F64X2_S_ZERO]: 'i32x4.trunc_sat_f64x2_s_zero',
    [OP.I32X4_TRUNC_SAT_F64X2_U_ZERO]: 'i32x4.trunc_sat_f64x2_u_zero',
    [OP.F64X2_CONVERT_LOW_I32X4_S]: 'f64x2.convert_low_i32x4_s',
    [OP.F64X2_CONVERT_LOW_I32X4_U]: 'f64x2.convert_low_i32x4_u',
    [OP.TRIVM_MULTIBYTE_FIRST]: 'TRIVM.MULTIBYTE_FIRST',
    [OP.TRIVM_FUNCTION]: 'TRIVM.FUNCTION',
    [OP.TRIVM_POP]: 'TRIVM.POP',
    [OP.TRIVM_DUP32]: 'TRIVM.DUP32',
    [OP.TRIVM_DUP64]: 'TRIVM.DUP64',
    [OP.TRIVM_LOCAL_GET32]: 'TRIVM.LOCAL_GET32',
    [OP.TRIVM_LOCAL_GET64]: 'TRIVM.LOCAL_GET64',
    [OP.TRIVM_LOCAL_SET32]: 'TRIVM.LOCAL_SET32',
    [OP.TRIVM_LOCAL_SET64]: 'TRIVM.LOCAL_SET64',
    [OP.TRIVM_GLOBAL_GET32]: 'TRIVM.GLOBAL_GET32',
    [OP.TRIVM_GLOBAL_GET64]: 'TRIVM.GLOBAL_GET64',
    [OP.TRIVM_GLOBAL_SET32]: 'TRIVM.GLOBAL_SET32',
    [OP.TRIVM_GLOBAL_SET64]: 'TRIVM.GLOBAL_SET64',

    // -- Instruction names - end of source code generated with help of "gen-instr.ts" script --
};
