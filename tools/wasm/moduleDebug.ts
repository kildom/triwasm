import { extendArray } from '../common/common';
import { Path } from '../common/path';
import { platform } from '../common/platform';
import { getInstrPopPush } from './instrStack';
import { EnterBlockCtx, EnterFunctionCtx, EnterInstrCtx, ExitBlockCtx, ExitInstrCtx, walkFunctions } from './moduleWalker';
import { OP, OP_NAMES } from './opcodes';
import { DUMP_HTML_CSS, DUMP_HTML_JS } from './res';
import {
    FunctionType, NumberType, RefType, ValueType, VectorType, WasmBranchDir,
    WasmData,
    WasmElement,
    WasmFunction, WasmFunctionKind, WasmGlobal, WasmMemory, WasmModule, WasmTable, valueTypeWords
} from './wasmModule';


export enum ModuleStage {
    AfterParser = 0,
    AfterResolver = 1,
    AfterReducer = 2,
    AfterOptimization = 3,
}

let lastModuleUid = 0;
let lastFuncUid = 1000000;
const moduleUidMap: Map<WasmModule, string> = new Map();
const funcUidMap: Map<WasmFunction, string> = new Map();
const usedUids: Set<string> = new Set();

function getModuleUid(module: WasmModule): string {
    if (moduleUidMap.has(module)) {
        return moduleUidMap.get(module) as string;
    }
    lastModuleUid++;
    moduleUidMap.set(module, lastModuleUid.toString());
    return lastModuleUid.toString();
}

function getFuncPostfixForUid(func: WasmFunction): string {
    let name: string | undefined = func.import?.name;
    if (!name) {
        name = func.exports[0]?.name;
    }
    let m: RegExpMatchArray | null;
    if ((m = name?.match(/export=([a-z0-9_$]+)/i))) {
        name = m[1];
    }
    if (!name?.match(/^[a-z0-9_$]+$/i)) {
        return '';
    } else {
        return '-' + name;
    }
}

function getFuncUid(module: WasmModule, func: WasmFunction): string {
    if (funcUidMap.has(func)) {
        return funcUidMap.get(func) as string;
    } else {
        let moduleUid = 'F-' + getModuleUid(module);
        let postfix = getFuncPostfixForUid(func);
        for (let i = 0; i < module.functions.length; i++) {
            if (func === module.functions[i]) {
                let uid = moduleUid + '-' + i + postfix;
                let k = 0;
                while (usedUids.has(uid)) {
                    k++;
                    uid = moduleUid + '-' + i + '-' + k + postfix;
                }
                funcUidMap.set(func, uid);
                return uid;
            }
        }
        lastFuncUid++;
        let uid = moduleUid + '-' + lastFuncUid + postfix;
        funcUidMap.set(func, uid);
        return uid;
    }
}

function getFuncLink(module: WasmModule, func: WasmFunction): string {
    let uid = getFuncUid(module, func);
    if (func.resolved !== func) {
        let resUid = getFuncUid(module, func.resolved);
        return `<a href="#${uid}">#${uid}</a> =&gt; <a href="#${resUid}">#${resUid}</a>`;
    }
    return `<a href="#${uid}">#${uid}</a>`;
}

class ModuleData {

    constructor(
        public module: WasmModule,
        public stage: ModuleStage,
        public output: string[] | undefined) { }

}

interface FunctionData {
}

class BlockData {
    public unreachable: boolean = false;
    public labelsStack: string[] = [];
    public typesStack: ValueType[] = [];
}

class InstrData {
    public output: string[] | undefined;

    constructor(useOutput: boolean) {
        this.output = useOutput ? [] : undefined;
    }
}

const STACK_LABELS: { [key in ValueType]: string[] } = {
    [NumberType.I32]: ['i32'],
    [NumberType.I64]: ['i64lo', 'i64hi'],
    [NumberType.F32]: ['f32'],
    [NumberType.F64]: ['f64lo', 'f64hi'],
    [RefType.FUNCREF]: ['func'],
    [RefType.EXTERNREF]: ['extern'],
    [VectorType.V128]: ['v128a', 'v128b', 'v128c', 'v128d'],
};

const STACK_LABELS_REVERSED: { [key in ValueType]: string[] } = {
    [NumberType.I32]: ['i32'],
    [NumberType.I64]: ['i64hi', 'i64lo'],
    [NumberType.F32]: ['f32'],
    [NumberType.F64]: ['f64hi', 'f64lo'],
    [RefType.FUNCREF]: ['func'],
    [RefType.EXTERNREF]: ['extern'],
    [VectorType.V128]: ['v128d', 'v128c', 'v128b', 'v128a'],
};

const TYPE_NAMES: { [key in ValueType]: string } = {
    [NumberType.I32]: 'i32',
    [NumberType.I64]: 'i64',
    [NumberType.F32]: 'f32',
    [NumberType.F64]: 'f64',
    [RefType.FUNCREF]: 'func',
    [RefType.EXTERNREF]: 'extern',
    [VectorType.V128]: 'v128',
};

const htmlHeader = [
    '<html><head><style>',
    DUMP_HTML_CSS,
    '</style>',
    '<script>',
    DUMP_HTML_JS,
    '</script></head><body>'
];

const htmlFooter = [
    '</body></html>'
];

function html(text: string | undefined | null): string {
    return (text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function dumpFunctionType(type: FunctionType, force: boolean = false): string {
    if (!force && type.params.length === 0 && type.results.length === 0) {
        return '';
    }
    let params = type.params.map(t => TYPE_NAMES[t]).join(', ');
    let ret = 'void';
    if (type.results.length > 0) {
        ret = type.results.map(t => TYPE_NAMES[t]).join('');
        if (type.results.length > 1) {
            ret = `(${ret})`;
        }
    }
    return `(${params}) => ${ret}`;
}


function enterFunction(ctx: EnterFunctionCtx<ModuleData>): FunctionData {
    let out = ctx.moduleData.output;
    let func = ctx.func;
    let uid = getFuncUid(ctx.module, func);
    out?.push(`<h2 id="${uid}">Function ${getFuncLink(ctx.module, func)}</h2>`);
    out?.push('<table class="func-header">');
    out?.push(`<tr><td>Kind:</td><td>${WasmFunctionKind[func.kind]}</td></tr>`);
    out?.push(`<tr><td>Type:</td><td>${dumpFunctionType(func.type, true)}</td></tr>`);
    out?.push(`<tr><td>Name:</td><td>${html(func.name) || '-'}</td></tr>`);
    out?.push(`<tr><td>Index:</td><td>${func.index}</td></tr>`);
    for (let exp of func.exports) {
        out?.push(`<tr><td>Export:</td><td>${html(exp.module) || '?'}.${html(exp.name)}</td></tr>`);
    }
    if (func.import) {
        out?.push(`<tr><td>Import:</td><td>${html(func.import.module) || '?'}.${html(func.import.name)}</td></tr>`);
    }
    if (func.data) {
        out?.push(`<tr><td>Data:</td><td><pre>${html(func.data)}</pre></td></tr>`);
    }
    if (func.type.params.length) {
        out?.push('<tr><td>Params:</td><td><pre>');
        out?.push(html(func.type.params.map((t, i) => `[${i}]: ${TYPE_NAMES[t]}`).join(', ')));
        out?.push('</pre></td></tr>');
    }
    if (func.locals.length) {
        out?.push('<tr><td>Locals:</td><td><pre>');
        out?.push(html(func.locals.map((t, i) => `[${i + func.type.params.length}]: ${TYPE_NAMES[t]}`).join(', ')));
        out?.push('</pre></td></tr>');
    }
    out?.push('</table>');
    ctx.walkFunction = (func.kind === WasmFunctionKind.WASM);
    // TODO: Verify correctness of the function at this stage
    return {};
}

function enterBlock(ctx: EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): BlockData {
    let out = ctx.instrDataStack.at(-1)?.output || ctx.moduleData.output;
    out?.push(`<table class="instr" id="${'...'}"><tbody>`);
    let blockData = new BlockData();
    if (ctx.block.parentInstruction.opcode !== OP.TRIVM_FUNCTION) {
        for (let type of ctx.block.type.params) {
            blockData.typesStack.push(type);
            blockData.labelsStack.push(...STACK_LABELS[type]);
        }
    }
    return blockData;
}

function exitBlock(ctx: ExitBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): void {
    let out = ctx.instrDataStack.at(-1)?.output || ctx.moduleData.output;
    out?.push('</tbody></table>');
}

function enterInstr(ctx: EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData>): InstrData {
    return new InstrData(ctx.moduleData.output ? true : false);
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

function addParam(out: string[] | undefined, ctx: ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>,
                  value: string | number | bigint | WasmFunction | WasmTable | WasmGlobal | WasmMemory | WasmData | WasmElement) {
    let htmlValue:string;
    if (typeof(value) === 'number') {
        htmlValue = value.toString();
    } else if (typeof(value) === 'bigint') {
        if (value <= 0xFFFFFFFFn) {
            htmlValue = formatValue32(Number(value));
        } else {
            htmlValue = formatValue64(value);
        }
    } else if (typeof(value) === 'string') {
        htmlValue = html(value);
    } else if (value instanceof WasmFunction) {
        htmlValue = getFuncLink(ctx.module, value);
    } else if (value instanceof WasmTable) {
        htmlValue = '// TODO: table link';
    } else if (value instanceof WasmGlobal) {
        htmlValue = '// TODO: global link';
    } else if (value instanceof WasmMemory) {
        htmlValue = '// TODO: memory link';
    } else if (value instanceof WasmData) {
        htmlValue = '// TODO: data link';
    } else if (value instanceof WasmElement) {
        htmlValue = '// TODO: element link';
    } else {
        htmlValue = 'ERROR';
    }
    out?.push(` <span class="param">${htmlValue}</span>`);
}

function validateInstr(out: string[] | undefined, ctx: ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>) {
    let instr = ctx.instr;
    switch (instr.opcode) {
    case OP.BLOCK:
    case OP.LOOP:
    case OP.IF:
        addParam(out, ctx, dumpFunctionType(instr.block.type));
        break;
    case OP.BR:
    case OP.BR_IF:
        addParam(out, ctx, ctx.blockStack.length - ctx.blockStack.indexOf(instr.target) - 1);
        break;
    case OP.CALL:
        addParam(out, ctx, instr.func);
        break;
    case OP.CALL_INDIRECT:
    case OP.TABLE_GET:
    case OP.TABLE_SET:
        addParam(out, ctx, instr.table);
        break;
    case OP.LOCAL_GET:
    case OP.LOCAL_SET:
    case OP.LOCAL_TEE:
        addParam(out, ctx, instr.index);
        break;
    case OP.GLOBAL_GET:
    case OP.GLOBAL_SET:
        addParam(out, ctx, instr.global);
        break;
    case OP.I32_LOAD:
    case OP.I64_LOAD:
    case OP.F32_LOAD:
    case OP.F64_LOAD:
    case OP.I32_LOAD8_S:
    case OP.I32_LOAD8_U:
    case OP.I32_LOAD16_S:
    case OP.I32_LOAD16_U:
    case OP.I64_LOAD8_S:
    case OP.I64_LOAD8_U:
    case OP.I64_LOAD16_S:
    case OP.I64_LOAD16_U:
    case OP.I64_LOAD32_S:
    case OP.I64_LOAD32_U:
    case OP.I32_STORE:
    case OP.I64_STORE:
    case OP.F32_STORE:
    case OP.F64_STORE:
    case OP.I32_STORE8:
    case OP.I32_STORE16:
    case OP.I64_STORE8:
    case OP.I64_STORE16:
    case OP.I64_STORE32:
        addParam(out, ctx, instr.memory);
        if (instr.offset != 0) {
            addParam(out, ctx, BigInt(instr.offset));
        }
        break;
    case OP.MEMORY_SIZE:
    case OP.MEMORY_GROW:
        addParam(out, ctx, instr.memory);
        break;
    case OP.I32_CONST:
    case OP.I64_CONST:
    case OP.F32_CONST:
    case OP.F64_CONST:
        addParam(out, ctx, BigInt(instr.value));
        break;
    case OP.REF_FUNC:
        addParam(out, ctx, instr.func);
        break;
    case OP.MEMORY_INIT:
        addParam(out, ctx, instr.memory);
        addParam(out, ctx, instr.data);
        break;
    case OP.DATA_DROP:
        addParam(out, ctx, instr.data);
        break;
    case OP.MEMORY_COPY:
        addParam(out, ctx, instr.memories[0]);
        if (instr.memories[0] !== instr.memories[1]) {
            addParam(out, ctx, instr.memories[1]);
        }
        break;
    case OP.MEMORY_FILL:
        addParam(out, ctx, instr.memory);
        break;
    case OP.TABLE_INIT:
        addParam(out, ctx, instr.table);
        addParam(out, ctx, instr.element);
        break;
    case OP.ELEM_DROP:
        addParam(out, ctx, instr.element);
        break;
    case OP.TABLE_COPY:
        addParam(out, ctx, instr.tables[0]);
        if (instr.tables[0] !== instr.tables[1]) {
            addParam(out, ctx, instr.tables[1]);
        }
        break;
    case OP.TABLE_GROW:
    case OP.TABLE_SIZE:
    case OP.TABLE_FILL:
        addParam(out, ctx, instr.table);
        break;
    }
}

function exitInstr(ctx: ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>) {

    let out = ctx.instrDataStack.at(-1)?.output || ctx.moduleData.output;
    let instr = ctx.instr;
    let blockData = ctx.blockData;
    let labelsStack = blockData.labelsStack;
    let typesStack = blockData.typesStack;

    let popPush = getInstrPopPush(ctx.func, ctx.block, ctx.instr, typesStack, false);
    popPush.unreachable = popPush.unreachable || blockData.unreachable;

    if (!blockData.unreachable) {
        for (let error of popPush.errors) {
            console.log(error); // TODO: report errors
        }
    }

    out?.push(`<tr id="instr-${instr.id}"><td width="1%">`);

    if (instr.opcode == OP.ELSE) {
        out?.push('<div class="else-line"><div></div></div>');
        /*ctx.moduleData.assert(ctx.block.parentInstruction.opcode === OP.IF, instr,
            'The "else" instruction without "if".');
        ctx.moduleData.assert(ctx.instrData.elseCount === 0, instr,
            'Too many "else" instructions.');
        ctx.instrData.elseCount++;*/
    } else if (instr.opcode === OP.RETURN) {
        out?.push(`<div class="br-line-down"><div style="--levels: ${ctx.blockStack.length}"></div></div>`);
    } else if (instr.opcode === OP.BR || instr.opcode === OP.BR_IF) {
        let levels = ctx.blockStack.length - ctx.blockStack.indexOf(instr.target);
        out?.push(`<div class="br-line-${instr.direction === WasmBranchDir.Forward ? 'down' : 'up'}">`);
        out?.push(`<div style="--levels: ${levels}"></div></div>`);
    }

    out?.push(html(OP_NAMES[instr.opcode]));
    validateInstr(out, ctx);
    out?.push(`</td><td width="1%">${instr.id}</td><td width="98%"><div class="stack">`);

    if (blockData.unreachable) {
        // Do not analyze stack of unreachable instructions
        out?.push('<div class="stack-remove"><div class="item-">unreachable</div></div>');
    } else {
        // Analyze popped values from the stack
        let stackOut: string[] | undefined = out ? [] : undefined;
        for (let type of [...popPush.poppedTypes].reverse()) {
            // Analyze and remove labels from the stack
            for (let label of STACK_LABELS_REVERSED[type]) {
                if (labelsStack.length === 0) {
                    stackOut?.unshift(`<div class="item-${label} underflow">${label}</div>`);
                    // TODO: error underflow
                } else if (labelsStack.at(-1) !== label) {
                    let prev = labelsStack.pop();
                    stackOut?.unshift(`<div class="item-${label}"><span>${prev}</span>${label}</div>`);
                } else {
                    labelsStack.pop();
                    stackOut?.unshift(`<div class="item-${label}">${label}</div>`);
                }
            }
            // Remove types from the stack (analysis was already done above)
            let popWords = valueTypeWords(type);
            while (popWords > 0 && typesStack.length > 0) {
                let topWords = valueTypeWords(typesStack.pop() as ValueType);
                if (topWords <= popWords) {
                    popWords -= topWords;
                } else {
                    for (let i = 0; i < topWords - popWords; i++) {
                        typesStack.push(NumberType.I32);
                    }
                }
            }
        }
        out?.push('<div class="stack-none">');
        out?.push(...labelsStack.map(label => `<div class="item-${label}">${label}</div>`));
        out?.push('</div>');
        out?.push('<div class="stack-remove">');
        out?.push(...(stackOut || []));
        out?.push('</div>');
        if (popPush.poppedTypes.length > 0 || popPush.pushedTypes.length > 0) {
            out?.push('<div class="stack-tr">⇨</div>');
        }
        out?.push('<div class="stack-add">');
        for (let type of popPush.pushedTypes) {
            for (let label of STACK_LABELS[type]) {
                labelsStack.push(label);
                out?.push(`<div class="item-${label}">${label}</div>`);
            }
            typesStack.push(type);
        }
        out?.push('</div>');
    }

    out?.push('</div></td></tr>');

    if (instr.opcode === OP.BR_TABLE) {
        for (let i = 0; i < instr.targets.length; i++) {
            let target = instr.targets[i];
            let levels = ctx.blockStack.length - ctx.blockStack.indexOf(target);
            out?.push(`<tr id="instr-${instr.id}"><td width="1%">`);
            out?.push(`<div class="br-line-${target.parentInstruction.opcode !== OP.LOOP ? 'down' : 'up'}">`);
            out?.push(`<div style="--levels: ${levels}"></div></div>`);
            if (i === instr.targets.length - 1) {
                out?.push('* default');
            } else {
                out?.push(`* case ${i}`);
            }
            addParam(out, ctx, levels - 1);
            out?.push('<td></td><td></td></td></tr>');
        }
    }

    let innerOut = ctx.instrData.output;
    if (out && innerOut?.length) {
        out?.push('<tr><td colspan="3" class="block-container">');
        extendArray(out, innerOut);
        out?.push('</td></tr>');
    }

    if (instr.opcode == OP.ELSE) {
        blockData.typesStack = [];
        blockData.labelsStack = [];
        for (let type of ctx.block.type.params) {
            blockData.typesStack.push(type);
            blockData.labelsStack.push(...STACK_LABELS[type]);
        }
        blockData.unreachable = false;
    } else {
        blockData.unreachable = popPush.unreachable;
    }
}

export function moduleDebug(module: WasmModule, stage: ModuleStage, dumpFile?: Path): void {
    let out = dumpFile ? [...htmlHeader] : undefined;
    let moduleData = new ModuleData(module, stage, out);
    out?.push('<h1>Functions</h1>');
    walkFunctions(module, moduleData, {
        enterFunction,
        enterBlock,
        exitBlock,
        enterInstr,
        exitInstr,
    });
    if (moduleData.output) {
        moduleData.output.push(...htmlFooter);
        platform.writeFile(dumpFile!.toString(), moduleData.output.join('\n'));
    }
}
