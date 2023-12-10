import { extendArray } from '../common/common';
import { Path } from '../common/path';
import { platform } from '../common/platform';
import { EnterBlockCtx, EnterFunctionCtx, EnterInstrCtx, ExitBlockCtx, ExitInstrCtx, walkFunctions } from './moduleWalker';
import { OP } from './opcodes';
import { FunctionType, NumberType, RefType, ValueType, VectorType, WasmBranchDir, WasmFunction, WasmFunctionKind, WasmInstr, WasmModule } from './wasmModule';


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
    public stack: string[] = [];
}

class InstrData {
    public output: string[] | undefined;
    public pushedTypes: ValueType[] = [];
    public poppedTypes: ValueType[] = [];
    public unreachable = false;

    constructor(useOutput: boolean) {
        this.output = useOutput ? [] : undefined;
    }

    push(...types: ValueType[]) {
        this.pushedTypes.push(...types);
    }

    pop(...types: ValueType[]) {
        this.poppedTypes.push(...types.reverse());
    }
}

type Ctx = ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>;

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
    '<html><head><link rel="stylesheet" href="style.css" type="text/css" />',
    '<script type="text/javascript" src="debug.js"></script></head><body>'
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
    ctx.walkFunction = (func.kind === WasmFunctionKind.WASM || func.kind === WasmFunctionKind.WASM_TYPE_UNKNOWN);
    // TODO: Verify correctness of the function at this stage
    return {};
}

function enterBlock(ctx: EnterBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): BlockData {
    let out = ctx.instrDataStack.at(-1)?.output || ctx.moduleData.output;
    out?.push(`<table class="instr" id="${'...'}"><tbody>`);
    return new BlockData();
}

function exitBlock(ctx: ExitBlockCtx<ModuleData, FunctionData, BlockData, InstrData>): void {
    let out = ctx.instrDataStack.at(-1)?.output || ctx.moduleData.output;
    out?.push('</tbody></table>');
}

function enterInstr(ctx: EnterInstrCtx<ModuleData, FunctionData, BlockData, InstrData>): InstrData {
    return new InstrData(ctx.moduleData.output ? true : false);
}

function verifyInstr(ctx: Ctx, out: string[] | undefined, instr: WasmInstr) {
    let instrData = ctx.instrData;
    switch (instr.opcode) {
    case OP.UNREACHABLE: {
        instrData.unreachable = true;
        ctx.blockData.unreachable = true;
        break;
    }
    case OP.LOCAL_TEE: {
        let type = ctx.func.getLocal(instr.index);
        instrData.pop(type);
        instrData.push(type);
        break;
    }
    case OP.LOCAL_GET: {
        instrData.push(ctx.func.getLocal(instr.index));
        break;
    }
    case OP.LOCAL_SET: {
        instrData.pop(ctx.func.getLocal(instr.index));
        break;
    }
    case OP.GLOBAL_GET: {
        //out?.push(getLink(instr.global));
        instrData.push(instr.global.type);
        break;
    }
    case OP.GLOBAL_SET: {
        //out?.push(getLink(instr.global));
        instrData.pop(instr.global.type);
        break;
    }
    case OP.I32_CONST: {
        instrData.push(NumberType.I32);
        break;
    }
    case OP.I64_CONST: {
        instrData.push(NumberType.I64);
        break;
    }
    case OP.I32_EQZ:
    case OP.I32_LOAD: {
        instrData.pop(NumberType.I32);
        instrData.push(NumberType.I32);
        break;
    }
    case OP.I64_STORE: {
        instrData.pop(NumberType.I32, NumberType.I64);
        break;
    }
    case OP.I32_STORE: {
        instrData.pop(NumberType.I32, NumberType.I32);
        break;
    }
    case OP.BR_IF: {
        instrData.pop(NumberType.I32);
        let types = (instr.direction === WasmBranchDir.Forward) ? instr.target.type.results : instr.target.type.params;
        instrData.pop(...types);
        instrData.push(...types);
        break;
    }
    case OP.IF: {
        instrData.pop(NumberType.I32);
        instrData.pop(...instr.block.type.params);
        instrData.pop(...instr.block.type.results);
        //TODO: determine in block if after this instruction code is reachable
        break;
    }
    case OP.I32_LT_U:
    case OP.I32_LT_S:
    case OP.I32_EQ:
    case OP.I32_NE:
    case OP.I32_ADD:
    case OP.I32_MUL:
    case OP.I32_XOR:
    case OP.I32_AND:
    case OP.I32_SUB: {
        instrData.pop(NumberType.I32, NumberType.I32);
        instrData.push(NumberType.I32);
        break;
    }
    case OP.CALL: {
        let type: FunctionType;
        if (instr.type) {
            type = instr.type;
        } else if (instr.func.kind === WasmFunctionKind.WASM_TYPE_UNKNOWN) {
            type = {params:[], results: []}; // TODO: get types
        } else {
            type = instr.func.type;
        }
        instrData.pop(...type.params);
        instrData.push(...type.results);
        break;
    }
    }
}

function exitInstr(ctx: ExitInstrCtx<ModuleData, FunctionData, BlockData, InstrData>) {

    let out = ctx.instrDataStack.at(-1)?.output || ctx.moduleData.output;
    let instr = ctx.instr;
    let instrData = ctx.instrData;
    let blockData = ctx.blockData;
    let stack = blockData.stack;

    instrData.unreachable = blockData.unreachable;

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

    out?.push(html(INSTRUCTION_NAME[instr.opcode]));
    verifyInstr(ctx, out, instr);
    out?.push(`</td><td width="1%">${instr.id}</td><td width="98%"><div class="stack">`);


    if (blockData.unreachable) {
        out?.push('<div class="stack-remove"><div class="item-">unreachable</div></div>');
    } else {
        let stackOut: string[] | undefined = out ? [] : undefined;
        for (let type of instrData.poppedTypes) {
            for (let label of STACK_LABELS_REVERSED[type]) {
                if (stack.length === 0) {
                    stackOut?.unshift(`<div class="item-${label} underflow">${label}</div>`);
                    // TODO: error underflow
                } else if (stack.at(-1) !== label) {
                    let prev = stack.pop();
                    stackOut?.unshift(`<div class="item-${label}"><span>${prev}</span>${label}</div>`);
                } else {
                    stack.pop();
                    stackOut?.unshift(`<div class="item-${label}">${label}</div>`);
                }
            }
        }
        out?.push('<div class="stack-none">');
        out?.push(...stack.map(label => `<div class="item-${label}">${label}</div>`));
        out?.push('</div>');
        out?.push('<div class="stack-remove">');
        out?.push(...(stackOut || []));
        out?.push('</div>');
        out?.push('<div class="stack-tr">⇨</div>');
        out?.push('<div class="stack-add">');
        for (let type of instrData.pushedTypes) {
            for (let label of STACK_LABELS[type]) {
                stack.push(label);
                out?.push(`<div class="item-${label}">${label}</div>`);
            }
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
                out?.push(`* default: ${levels - 1}`);
            } else {
                out?.push(`* case ${i}: ${levels - 1}`);
            }
            out?.push('</td></tr>');
        }
    }

    let innerOut = ctx.instrData.output;
    if (out && innerOut?.length) {
        out?.push('<tr><td colspan="3" class="block-container">');
        extendArray(out, innerOut);
        out?.push('</td></tr>');
    }

    blockData.unreachable = instrData.unreachable;
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
    [OP.TRIVM_RAW]: 'TRIVM.RAW',

    // -- Instruction names - end of source code generated with help of "gen-instr.ts" script --
};
