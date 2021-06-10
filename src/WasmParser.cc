
#include "common.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmParser.hh"
#include "InstructionDesc.hh"

WasmData$ WasmParser::parseFile(const char* fileName)
{
    TRACE();
    auto fileInput = FileInputStream$::create(fileName);
    r = WasmReader$$::create(fileInput.cast<WasmInputStream>());
    d = WasmData$::create();
    parse();
    return d;
}

void WasmParser::parse() {
    TRACE();

    // modules.html#binary-magic
    auto magicOk = r->byte() == 0x00
        && r->byte() == 0x61
        && r->byte() == 0x73
        && r->byte() == 0x6D;
    if (!magicOk) {
        FATAL("Invalid wasm binary file");
    }

    // modules.html#binary-version
    auto versionOk = r->byte() == 0x01
        && r->byte() == 0x00
        && r->byte() == 0x00
        && r->byte() == 0x00;
    if (!versionOk) {
        FATAL("Unsupported wasm binary file version");
    }

    printf("Header is Ok.\n");

    // modules.html#binary-module
    while (!r->endOfInput()) {
        parseSection();
    }

    //TODO: postProcess();
}

void WasmParser::parseSection()
{
    TRACE();

    auto id = r->byte();
    auto size = r->readU32();
    printf("Section %d \"%s\" of size %d\n", id, sectionNames[id]->buffer(), size);
    auto state = r->startContainer(size);
    auto expectFullyConsumed = false;// TODO: true
    switch (id) {
        case SECTION_ID_TYPE:
            parseTypeSection();
            expectFullyConsumed = true;
            break;
        case SECTION_ID_IMPORT:
            parseImportSection();
            break;
        case SECTION_ID_FUNCTION:
            parseFunctionSection();
            expectFullyConsumed = true;
            break;
        case SECTION_ID_TABLE:
            parseTableSection();
            expectFullyConsumed = true;
            break;
        case SECTION_ID_MEMORY:
            //this.parseMemorySection(r->sub(size));
            break;
        case SECTION_ID_GLOBAL:
            //this.parseGlobalSection(r->sub(size));
            break;
        case SECTION_ID_EXPORT:
            //this.parseExportSection(r->sub(size));
            break;
        case SECTION_ID_START:
            //this.parseStartSection(r->sub(size));
            break;
        case SECTION_ID_ELEMENT:
            //this.parseElementSection(r->sub(size));
            break;
        case SECTION_ID_CODE:
            parseCodeSection();
            expectFullyConsumed = true;
            break;
        case SECTION_ID_DATA:
            //this.parseDataSection(r->sub(size));
            break;
        case SECTION_ID_DATA_COUNT:
            //this.parseDataCountSection(r->sub(size));
            break;
        case SECTION_ID_CUSTOM:
            //this.parseCustomSection(r->sub(size));
            expectFullyConsumed = false;
            break;
        default:
            FATAL("Unsupported section id %d", id);
    }
    r->endContainer(state, expectFullyConsumed);
}

void WasmParser::parseTypeSection()
{
    TRACE();

    // modules.html#binary-typesec
    d->functionTypes = nullptr;
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        // types.html#binary-functype
        auto startByte = r->byte();
        if (startByte != 0x60)
            FATAL("Invalid function type start byte");
        Array$<u32> paramTypes;
        Array$<u32> resultTypes;
        auto paramCount = r->readU32();
        for (u32 k = 0; k < paramCount; k++) {
            paramTypes->push(valueType());
        }
        paramCount = r->readU32();
        for (u32 k = 0; k < paramCount; k++) {
            resultTypes->push(valueType());
        }
        d->functionTypes->push(WasmFunctionType{
            paramTypes,
            resultTypes,
        });
        printf("  function type %d\n", i);
    }
}

void WasmParser::parseImportSection()
{
    TRACE();

    // modules.html#binary-importsec
    d->importFunctions = nullptr;
    d->importTables = nullptr;
    d->importMemories = nullptr;
    //d->importGlobals = nullptr;
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        auto moduleName = r->string();
        auto memberName = r->string();
        auto select = r->byte();
        switch (select) {
            case 0x00: {
                auto typeIndex = r->readU32();
                d->importFunctions->push(WasmImportFunction{
                    .module = moduleName,
                    .name = memberName,
                    .typeIndex = typeIndex,
                });
                printf("  import function %s::%s of type %d\n", moduleName->buffer(), memberName->buffer(), typeIndex);
                break;
            }
            case 0x01: {
                // types.html#binary-tabletype
                auto type = refType();
                auto limits = parseLimits();
                d->importTables->push(WasmImportTable{
                    .module = moduleName,
                    .name = memberName,
                    .type = type,
                    .min = (u32)limits.beginOffset,
                    .max = (u32)limits.endOffset,
                    .unlimited = limits.endFromEnd,
                });
                printf("  import table %s::%s of type %d and size from %d to %d%s\n", moduleName->buffer(), memberName->buffer(), type, (int)limits.beginOffset, (int)limits.endOffset, limits.endFromEnd ? "(unlimited)" : "");
                break;
            }
            case 0x02: {
                // types.html#binary-memtype
                auto limits = parseLimits();
                d->importMemories->push(WasmImportMemory{
                    .module = moduleName,
                    .name = memberName,
                    .min = (u32)limits.beginOffset,
                    .max = (u32)limits.endOffset,
                    .unlimited = limits.endFromEnd,
                });
                printf("  import table %s::%s of size from %d to %d%s\n", moduleName->buffer(), memberName->buffer(), (int)limits.beginOffset, (int)limits.endOffset, limits.endFromEnd ? "(unlimited)" : "");
                break;
            }
            case 0x03: {
                // types.html#binary-globaltype
                auto type = r->byte();
                auto mut = r->byte();
                d->importGlobals->push(WasmImportGlobal{
                    .module = moduleName,
                    .name = memberName,
                    .type = type,
                    .mut = !!mut,
                });
                printf("  import %s global %s::%s of type %d", mut ? "var" : "const", moduleName->buffer(), memberName->buffer(), type);
                break;
            }
            default:
                FATAL("Unknown select of import %d", select);
        }
    }
}

void WasmParser::parseFunctionSection() {
    TRACE();

    // modules.html#binary-funcsec
    auto count = r->readU32();
    for (u32 funcIndex = 0; funcIndex < count; funcIndex++) {
        auto typeIndex = r->readU32();
        d->functions->grow(funcIndex)->typeIndex = typeIndex;
        printf("  function %d type is %d\n", funcIndex, typeIndex);
    }
}

void WasmParser::parseTableSection() {
    TRACE();

    // modules.html#binary-tablesec
    d->tables = nullptr;
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        auto type = r->byte();
        auto limits = parseLimits();
        d->tables->push(WasmTable{
            .type = type,
            .min = (u32)limits.beginOffset,
            .max = (u32)limits.endOffset,
            .unlimited = limits.endFromEnd,
        });
        std::cout << "  table of type " << (int)type << " and size from " << limits.beginOffset << " to " << limits.endOffset << (limits.endFromEnd ? "(unlimited)" : "") << "\n";
    }
}

void WasmParser::parseCodeSection() {
    TRACE();

    // modules.html#binary-codesec
    auto count = r->readU32();
    for (u32 funcIndex = 0; funcIndex < count; funcIndex++) {
        auto funcSize = r->readU32();
        std::cout << "  function " << funcIndex << " of size " << funcSize << "\n";
        auto state = r->startContainer(funcSize);
        parseFuncCode(funcIndex);
        r->endContainer(state, true);
    }
}

void WasmParser::parseFuncCode(u32 funcIndex) {
    TRACE();

    // modules.html#binary-codesec
    Array$<u32> locals;
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        auto localsCount = r->readU32();
        auto type = valueType();
        for (u32 j = 0; j < localsCount; j++)
            locals->push(type);
    }
    d->functions[funcIndex]->locals = locals;
    std::cout << "    locals: " << locals->length() << "\n";
    //d->functions[funcIndex]->body = parseExpr();
}

Array$<WasmInstruction$> WasmParser::parseExpr(bool allowElse) {
    TRACE();
    Array$<WasmInstruction$> instructions;
    while (true) {
        WasmInstruction$ instr;
        auto code = r->byte();
        auto desc = instrDescTable[code];
        Array$<u64> params;
        
        if (desc->name == nullptr)
            FATAL("Unknown instruction 0x%02d", code);

        if (desc->imm == nullptr)
            desc->imm = "";

        if (desc->imm[0] == '*') {
            switch (code) {
                case 0x02:
                    params.push(this.parseCompressedBlockType(r));
                    params.push(this.parseExpr(r));
                    break;
                case 0x03:
                    params.push(this.parseCompressedBlockType(r));
                    params.push(this.parseExpr(r));
                    break;
                case 0x04: {
                    params.push(this.parseCompressedBlockType(r));
                    let [subInstr, endedWithElse] = this.parseExpr(r, true);
                    params.push(subInstr);
                    if (endedWithElse) {
                        params.push(this.parseExpr(r));
                    } else {
                        params.push([]);
                    }
                    break;
                }
                case 0x05:
                    if (!allowElse)
                        throw error(`'else' instruction not expected here`);
                    return [instructions, true];
                case 0x0B:
                    return allowElse ? [instructions, false] : instructions;
                case 0x0E: {
                    let count = r.u32();
                    params[0] = [];
                    for (let i = 0; i < count; i++) {
                        params[0][i] = r.u32();
                    }
                    params[1] = r.u32();
                    break;
                }
                case 0x1C: {
                    let count = r.u32();
                    params[0] = [];
                    for (let i = 0; i < count; i++) {
                        params[0][i] = r.byte();
                    }
                    break;
                }
                default:
                    throw error(`internal, code: 0x${code.toString(16)}`);
            }
        } else {
            const char* p = desc->imm;
            while (*p) {
                // TODO: value range checking
                switch (*p++) {
                    case 'i':
                    case 'l':
                        instr->imm->push(r->readS64());
                        break;
                    case 'u':
                        instr->imm->push(r->readU64());
                        break;
                    case 'b':
                        instr->imm->push(r->byte());
                        break;
                    default:
                        FATAL("Internal");
                }
            }
        }
        #if 0
        if ('params' in desc) {
            if (desc.params == null) {
                switch (code) {
                    case 0x02:
                        params.push(this.parseCompressedBlockType(r));
                        params.push(this.parseExpr(r));
                        break;
                    case 0x03:
                        params.push(this.parseCompressedBlockType(r));
                        params.push(this.parseExpr(r));
                        break;
                    case 0x04: {
                        params.push(this.parseCompressedBlockType(r));
                        let [subInstr, endedWithElse] = this.parseExpr(r, true);
                        params.push(subInstr);
                        if (endedWithElse) {
                            params.push(this.parseExpr(r));
                        } else {
                            params.push([]);
                        }
                        break;
                    }
                    case 0x05:
                        if (!allowElse)
                            throw error(`'else' instruction not expected here`);
                        return [instructions, true];
                    case 0x0B:
                        return allowElse ? [instructions, false] : instructions;
                    case 0x0E: {
                        let count = r.u32();
                        params[0] = [];
                        for (let i = 0; i < count; i++) {
                            params[0][i] = r.u32();
                        }
                        params[1] = r.u32();
                        break;
                    }
                    case 0x1C: {
                        let count = r.u32();
                        params[0] = [];
                        for (let i = 0; i < count; i++) {
                            params[0][i] = r.byte();
                        }
                        break;
                    }
                    default:
                        throw error(`internal, code: 0x${code.toString(16)}`);
                }
            } else {
                for (let i = 0; i < desc.params.length; i++) {
                    switch (desc.params[i]) {
                        case 'i':
                        case 'l':
                            params.push(r.sleb128());
                            break;
                        case 'u':
                            params.push(r.uleb128());
                            break;
                        case 'b':
                            params.push(r.byte());
                            break;
                        default:
                            throw error(`internal, param: ${desc.params[i]}, ${desc.name}`);
                    }
                }
            }
        }
        #endif
        instructions->push(instr);
    }
    return instructions;
}


Range WasmParser::parseLimits() {
    TRACE();

    // types.html#binary-limits
    auto isMax = r->byte();
    auto min = r->readU32();
    if (isMax) {
        auto max = r->readU32();
        return Range(min, max);
    }
    return Range(min, RangeEnd - 0);
}

u32 WasmParser::valueType()
{
    TRACE();

    auto type = r->byte();
    switch (type) {
        case TYPE_I32:
        case TYPE_I64:
        case TYPE_F32:
        case TYPE_F64:
        case TYPE_FUNCREF:
        case TYPE_EXTERNREF:
            return type;
        default:
            FATAL("Unknown value type 0x%02X", type);
            return 0;
    }
}

u32 WasmParser::refType()
{
    TRACE();

    auto type = r->byte();
    switch (type) {
        case TYPE_FUNCREF:
        case TYPE_EXTERNREF:
            return type;
        default:
            FATAL("Unknown value type 0x%02X", type);
            return 0;
    }
}

