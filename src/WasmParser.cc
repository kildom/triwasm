
#include "common.hh"
#include "WasmData.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmParser.hh"
#include "WasmInstrDesc.hh"

WasmData$ WasmParser::parseFile(const char* fileName)
{
    TRACE();
    auto fileInput = FileInputStream$::create(fileName);
    r = WasmReader$$::create(fileInput.cast<WasmInputStream>());
    parse();
    return d;
}

void WasmParser::parse() {
    TRACE();

    d = new$;

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

    postProcess();
}

void WasmParser::parseSection()
{
    TRACE();

    u8 lastId = 0;
    auto id = r->byte();
    auto size = r->readU32();
    printf("Section %d \"%s\" of size %d\n", id, sectionNames[id]->buffer(), size);
    auto state = r->startContainer(size);
    auto expectFullyConsumed = true;
    if (id != SECTION_ID_CUSTOM) {
        if (id <= lastId)
            FATAL("Invalid order of the sections");
        lastId = id;
    }
    switch (id) {
        case SECTION_ID_TYPE:
            parseTypeSection();
            break;
        case SECTION_ID_IMPORT:
            parseImportSection();
            break;
        case SECTION_ID_FUNCTION:
            parseFunctionSection();
            break;
        case SECTION_ID_TABLE:
            parseTableSection();
            break;
        case SECTION_ID_MEMORY:
            parseMemorySection();
            break;
        case SECTION_ID_GLOBAL:
            parseGlobalSection();
            break;
        case SECTION_ID_EXPORT:
            parseExportSection();
            break;
        case SECTION_ID_START:
            parseStartSection();
            break;
        case SECTION_ID_ELEMENT:
            parseElementSection();
            break;
        case SECTION_ID_CODE:
            parseCodeSection();
            break;
        case SECTION_ID_DATA:
            parseDataSection();
            break;
        case SECTION_ID_DATA_COUNT:
            parseDataCountSection();
            break;
        case SECTION_ID_CUSTOM:
            parseCustomSection();
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
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        // types.html#binary-functype
        WasmFunctionType$ type = new$;
        auto startByte = r->byte();
        if (startByte != 0x60)
            FATAL("Invalid function type start byte");
        auto paramCount = r->readU32();
        for (u32 k = 0; k < paramCount; k++) {
            type->param->push(valueType());
        }
        paramCount = r->readU32();
        for (u32 k = 0; k < paramCount; k++) {
            type->result->push(valueType());
        }
        d->functionTypes->push(type);
        printf("  function type %d\n", i);
    }
}

void WasmParser::parseImportSection()
{
    TRACE();

    // modules.html#binary-importsec
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        WasmImport$ import;
        import->module = r->string();
        import->name = r->string();
        auto select = r->byte();
        switch (select) {
            case 0x00: {
                WasmFunction$ func;
                func->index = (u32)d->functions->length();
                func->type = d->functionTypes[r->readU32()];
                func->import = import;
                d->functions->push(func);
                d->importFunctions->push(func);
                printf("  import %d function %s::%s\n", d->functions[RangeEnd - 1]->index, import->name->buffer(), import->name->buffer());
                break;
            }
            case 0x01: {
                // types.html#binary-tabletype
                WasmTable$ table;
                table->index = (u32)d->tables->length(),
                table->type = refType();
                auto limits = parseLimits();
                table->min = (u32)limits.beginOffset;
                table->max = (u32)limits.endOffset;
                table->unlimited = limits.endFromEnd;
                table->import = import;
                d->tables->push(table);
                d->importTables->push(table);
                printf("  import %d table %s::%s of type %d and size from %d to %d%s\n", d->tables[RangeEnd - 1]->index, import->module->buffer(), import->name->buffer(), table->type, (int)limits.beginOffset, (int)limits.endOffset, limits.endFromEnd ? "(unlimited)" : "");
                break;
            }
            case 0x02: {
                // types.html#binary-memtype
                WasmMemory$ memory;
                memory->index = (u32)d->memories->length();
                auto limits = parseLimits();
                memory->min = (u32)limits.beginOffset;
                memory->max = (u32)limits.endOffset;
                memory->unlimited = limits.endFromEnd;
                memory->import = import;
                d->memories->push(memory);
                d->importMemories->push(memory);
                printf("  import %d memory %s::%s of size from %d to %d%s\n", d->memories[RangeEnd - 1]->index, import->module->buffer(), import->name->buffer(), (int)limits.beginOffset, (int)limits.endOffset, limits.endFromEnd ? "(unlimited)" : "");
                break;
            }
            case 0x03: {
                // types.html#binary-globaltype
                WasmGlobal$ global;
                global->index = (u32)d->globals->length();
                global->type = valueType();
                global->mut = !!r->byte();
                global->import = import;
                d->globals->push(global);
                d->importGlobals->push(global);
                printf("  import %d %s global %s::%s of type %d", d->globals[RangeEnd - 1]->index, global->mut ? "var" : "const", import->module->buffer(), import->name->buffer(), global->type);
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
    for (u32 i = 0; i < count; i++) {
        auto type = d->functionTypes[r->readU32()];
        d->functions->push(WasmFunction{
            .index = (u32)d->functions->length(),
            .type = type,
        });
        printf("  function %d\n", d->functions[RangeEnd - 1]->index);
    }
}

void WasmParser::parseTableSection() {
    TRACE();

    // modules.html#binary-tablesec
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        auto type = refType();
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

void WasmParser::parseMemorySection()
{
    // modules.html#binary-memsec
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        // types.html#binary-memtype
        auto limits = parseLimits();
        d->memories->push(WasmMemory{
            .min = (u32)limits.beginOffset,
            .max = (u32)limits.endOffset,
            .unlimited = limits.endFromEnd,
        });
        printf("  memory %d size from %d to %d%s\n", i, (int)limits.beginOffset, (int)limits.endOffset, limits.endFromEnd ? "(unlimited)" : "");
    }
}

void WasmParser::parseGlobalSection()
{
    // modules.html#binary-globalsec
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        // types.html#binary-globaltype
        auto type = r->byte();
        auto mut = r->byte();
        auto expr = parseExpr();
        d->globals->push(WasmGlobal{
            .type = type,
            .mut = !!mut,
            .initializer = expr,
        });
        printf("  global %s of type %d\n", mut ? "var" : "const", type);
    }
}

void WasmParser::parseExportSection()
{
    // modules.html#binary-exportsec
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        auto name = r->string();
        auto select = r->byte();
        auto index = r->readU32();
        switch (select) {
            case 0x00: {
                WasmFunction$ func = d->functions[index];
                func->exportName = name;
                d->exportFunctions->push(func);
                printf("  export function %d as %s\n", index, name->buffer());
                break;
            }
            case 0x01: {
                WasmTable$ table = d->tables[index];
                table->exportName = name;
                d->exportTables->push(table);
                printf("  export table %d as %s\n", index, name->buffer());
                break;
            }
            case 0x02: {
                WasmMemory$ memory = d->memories[index];
                memory->exportName = name;
                d->exportMemories->push(memory);
                printf("  export memory %d as %s\n", index, name->buffer());
                break;
            }
            case 0x03: {
                WasmGlobal$ global = d->globals[index];
                global->exportName = name;
                d->exportGlobals->push(global);
                printf("  export global %d as %s\n", index, name->buffer());
                break;
            }
            default:
                FATAL("Unknown select of import 0x%02d\n", select);
        }
    }
}

void WasmParser::parseStartSection()
{
    TRACE();
    // modules.html#binary-startsec
    d->startFunction = d->functions[r->readU32()];
    printf("  startup function\n");
}

void WasmParser::parseElementSection() {
    TRACE();

    d->activeElements = new$;
    d->passiveElements = new$;
    d->declarativeElements = new$;

    // modules.html#binary-elemsec
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        auto select = r->readU32();
        WasmElement$ element;
        Array$<WasmElement$$> arr;
        u8 elemkind = 0x00;
        switch (select & 0x03) {
            case 0x00:
                element->table = d->tables[0];
                element->expr = parseExpr();
                arr = d->activeElements;
                printf("  element active mode for table 0(default)\n");
                break;
            case 0x01:
                elemkind = r->byte();
                arr = d->passiveElements;
                printf("  element passive mode");
                break;
            case 0x02:
                element->table = d->tables[r->readU32()];
                element->expr = parseExpr();
                elemkind = r->byte();
                arr = d->activeElements;
                printf("  element active mode for table %d\n", element->table->index);
                break;
            case 0x03:
                elemkind = r->byte();
                arr = d->declarativeElements;
                printf("  element declarative mode");
                break;
        }
        if (elemkind != 0x00)
            FATAL("Only funcref is allowed in the element section");
        auto itemsCount = r->readU32();
        if (select & 0x04) {
            element->exprItems = new$;
            for (u32 j = 0; j < itemsCount; j++) {
                element->exprItems->push(parseExpr());
            }
            printf("    %d expression(s)\n", itemsCount);
        } else {
            element->functionItems = new$;
            for (u32 j = 0; j < itemsCount; j++) {
                element->functionItems->push(d->functions[r->readU32()]);
            }
            printf("    %d index(es)\n", itemsCount);
        }
        arr->push(element);
    }
}

void WasmParser::parseCodeSection() {
    TRACE();

    // modules.html#binary-codesec
    auto count = r->readU32();
    if (count != d->functions->length() - d->importFunctions->length())
        FATAL("Invalid number of functions in 'code' section.");
    for (u32 funcIndex = d->importFunctions->length(); funcIndex < d->functions->length(); funcIndex++) {
        auto funcSize = r->readU32();
        std::cout << "  function " << funcIndex << " of size " << funcSize << "\n";
        auto state = r->startContainer(funcSize);
        parseFuncCode(funcIndex);
        r->endContainer(state, true);
    }
}

void WasmParser::parseDataSection() {
    TRACE();

    WasmActiveData$ data;

    // modules.html#binary-datasec
    d->activeData = new$;
    d->passiveData = new$;

    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        u8 select = r->byte();
        switch (select) {
            case 0x00:
                data = new$;
                data->memory = 0;
                data->offset = parseExpr();
                data->bytes = r->bytes();
                d->activeData->push(data);
                printf("  data active mode for memory 0(default) of size %d\n", (int)data->bytes->length());
                break;
            case 0x01:
                d->passiveData->push(r->bytes());
                printf("  data passive mode of size %d\n", (int)d->passiveData[RangeEnd - 1]->length());
                break;
            case 0x02:
                data = new$;
                data->memory = r->readU32();
                data->offset = parseExpr();
                data->bytes = r->bytes();
                d->activeData->push(data);
                printf("  data active mode for memory %d of size %d\n", data->memory, (int)data->bytes->length());
                break;
            default:
                FATAL("Unknown kind of data ${select}");
        }
    }
}

void WasmParser::parseDataCountSection()
{
    TRACE();
    // modules.html#binary-datacountsec
    if (d->activeData->length() + d->passiveData->length() != r->readU32())
        FATAL("Invalid 'data count' section");
}

void WasmParser::parseCustomSection()
{
    TRACE();
    // modules.html#binary-customsec
    auto name = r->string();
    printf("Custom section '%s'\n", name->buffer());
    if (name == "name") {
        //parseNameSection();
    } else if (name == "producers") {
        //parseProducersSection();
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
    d->functions[funcIndex]->body = parseExpr();
}

Array$<WasmInstr$$> WasmParser::parseExpr(bool allowElse) {
    TRACE();
    Array$<WasmInstr$$> instrs;
    while (true) {
        WasmInstr$ instr;
        WasmInstrDesc$ desc;
        auto code = r->byte();

        if (code == INSTR_EXT) {
            auto extCode = r->readU32();
            code |= extCode << 8;
            desc = instrDescTable[extCode];
        } else {
            desc = instrDescTable[code];
        }

        instr->desc = desc;
        instr->code = code;
        
        if (desc->name == nullptr)
            FATAL("Unknown instruction 0x%02d", code);

        if (desc->imm == nullptr)
            desc->imm = "";

        if (desc->imm[0] == '*') {
            switch (code) {
                case INSTR_BLOCK:
                case INSTR_LOOP:
                case INSTR_IF:
                    instr->block = new$;
                    instr->block->instr = instr;
                    parseCompressedBlockType(instr->block);
                    instr->block->body = parseExpr(code == INSTR_IF);
                    break;
                case INSTR_ELSE:
                    if (!allowElse)
                        FATAL("'else' instruction not expected here");
                    allowElse = false;
                    break;
                case INSTR_END:
                    return instrs;
                case INSTR_BR_TABLE: {
                    auto count = r->readU32();
                    for (u32 i = 0; i < count; i++) {
                        instr->imm->push(r->readU32());
                    }
                    instr->imm->push(r->readU32());
                    break;
                }
                case INSTR_SELECT_ANNOTATED: {
                    auto count = r->readU32();
                    for (u32 i = 0; i < count; i++) {
                        instr->imm->push(r->byte());
                    }
                    break;
                }
                default:
                    FATAL("internal");
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
        instrs->push(instr);
        //printf("%s\n", instr->desc->name);
    }
    return instrs;
}

void WasmParser::parseCompressedBlockType(WasmBlock$ block)
{
    TRACE();

    auto typeIndex = r->readS64();

    switch (typeIndex) {
        case TYPE_BT_CMP_I32: {
                static WasmFunctionType$ resultType = WasmFunctionType {
                    .param = { },
                    .result = { TYPE_I32 },
                };
                block->type = resultType;
                break;
            }
        case TYPE_BT_CMP_I64: {
                static WasmFunctionType$ resultType = WasmFunctionType {
                    .param = { },
                    .result = { TYPE_I64 },
                };
                block->type = resultType;
                break;
            }
        case TYPE_BT_CMP_F32: {
                static WasmFunctionType$ resultType = WasmFunctionType {
                    .param = { },
                    .result = { TYPE_F32 },
                };
                block->type = resultType;
                break;
            }
        case TYPE_BT_CMP_F64: {
                static WasmFunctionType$ resultType = WasmFunctionType {
                    .param = { },
                    .result = { TYPE_F64 },
                };
                block->type = resultType;
                break;
            }
        case TYPE_BT_CMP_VOID: {
                static WasmFunctionType$ resultType = WasmFunctionType {
                    .param = { },
                    .result = { },
                };
                block->type = resultType;
                break;
            }
        default:
            if (typeIndex < 0)
                FATAL("Invalid type index");
            block->type = d->functionTypes[typeIndex];
            break;
    }
}


Range WasmParser::parseLimits() {
    TRACE();

    // types.html#binary-limits
    auto isMax = r->byte();
    auto min = r->readU32();
    if (isMax) {
        auto max = r->readU32();
        if (min > max)
            FATAL("Invalid limits min %d, max %d", min, max);
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


void WasmParser::postProcess()
{
    TRACE();

}

