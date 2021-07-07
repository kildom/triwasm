
#include "Utils.hh"
#include "WasmData.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmInstr.hh"
#include "WasmParser.hh"

WasmModule$ WasmParser::parse(WasmInputStream$$ stream)
{
    TRACE();
    r = WasmReader$$::create(stream);
    mod = new$;
    parse();
    return mod;
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
        mod->functionTypes->push(type);
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
                func->index = (u32)mod->functions->length();
                func->type = mod->functionTypes[r->readU32()];
                func->import = import;
                mod->functions->push(func);
                mod->importFunctions->push(func);
                printf("  import %d function %s::%s\n", mod->functions[RangeEnd - 1]->index, import->name->buffer(), import->name->buffer());
                break;
            }
            case 0x01: {
                // types.html#binary-tabletype
                WasmTable$ table;
                table->index = (u32)mod->tables->length(),
                table->type = refType();
                auto limits = parseLimits();
                table->min = (u32)limits.beginOffset;
                table->max = (u32)limits.endOffset;
                table->unlimited = limits.endFromEnd;
                table->import = import;
                mod->tables->push(table);
                mod->importTables->push(table);
                printf("  import %d table %s::%s of type %d and size from %d to %d%s\n", mod->tables[RangeEnd - 1]->index, import->module->buffer(), import->name->buffer(), table->type, (int)limits.beginOffset, (int)limits.endOffset, limits.endFromEnd ? "(unlimited)" : "");
                break;
            }
            case 0x02: {
                // types.html#binary-memtype
                WasmMemory$ memory;
                memory->index = (u32)mod->memories->length();
                auto limits = parseLimits();
                memory->min = (u32)limits.beginOffset;
                memory->max = (u32)limits.endOffset;
                memory->unlimited = limits.endFromEnd;
                memory->import = import;
                mod->memories->push(memory);
                mod->importMemories->push(memory);
                printf("  import %d memory %s::%s of size from %d to %d%s\n", mod->memories[RangeEnd - 1]->index, import->module->buffer(), import->name->buffer(), (int)limits.beginOffset, (int)limits.endOffset, limits.endFromEnd ? "(unlimited)" : "");
                break;
            }
            case 0x03: {
                // types.html#binary-globaltype
                WasmGlobal$ global;
                global->index = (u32)mod->globals->length();
                global->type = valueType();
                global->mut = !!r->byte();
                global->import = import;
                mod->globals->push(global);
                mod->importGlobals->push(global);
                printf("  import %d %s global %s::%s of type %d", mod->globals[RangeEnd - 1]->index, global->mut ? "var" : "const", import->module->buffer(), import->name->buffer(), global->type);
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
        auto type = mod->functionTypes[r->readU32()];
        mod->functions->push(WasmFunction{
            .index = (u32)mod->functions->length(),
            .type = type,
        });
        printf("  function %d\n", mod->functions[RangeEnd - 1]->index);
    }
}

void WasmParser::parseTableSection() {
    TRACE();

    // modules.html#binary-tablesec
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        auto type = refType();
        auto limits = parseLimits();
        mod->tables->push(WasmTable{
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
        mod->memories->push(WasmMemory{
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
        mod->globals->push(WasmGlobal{
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
                WasmFunction$ func = mod->functions[index];
                func->exportName = name;
                mod->exportFunctions->push(func);
                printf("  export function %d as %s\n", index, name->buffer());
                break;
            }
            case 0x01: {
                WasmTable$ table = mod->tables[index];
                table->exportName = name;
                mod->exportTables->push(table);
                printf("  export table %d as %s\n", index, name->buffer());
                break;
            }
            case 0x02: {
                WasmMemory$ memory = mod->memories[index];
                memory->exportName = name;
                mod->exportMemories->push(memory);
                printf("  export memory %d as %s\n", index, name->buffer());
                break;
            }
            case 0x03: {
                WasmGlobal$ global = mod->globals[index];
                global->exportName = name;
                mod->exportGlobals->push(global);
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
    mod->startFunction = mod->functions[r->readU32()];
    printf("  startup function\n");
}

void WasmParser::parseElementSection() {
    TRACE();

    mod->elements = new$;

    // modules.html#binary-elemsec
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        auto select = r->readU32();
        WasmElement$ element;
        u8 elemkind = 0x00;
        switch (select & 0x03) {
            case 0x00:
                element->kind = WASM_ELEMENT_ACTIVE;
                element->table = mod->tables[0];
                element->offset = parseExpr();
                printf("  element active mode for table 0(default)\n");
                break;
            case 0x01:
                element->kind = WASM_ELEMENT_PASSIVE;
                elemkind = r->byte();
                printf("  element passive mode");
                break;
            case 0x02:
                element->kind = WASM_ELEMENT_ACTIVE;
                element->table = mod->tables[r->readU32()];
                element->offset = parseExpr();
                elemkind = r->byte();
                printf("  element active mode for table %d\n", element->table->index);
                break;
            case 0x03:
                element->kind = WASM_ELEMENT_DECLARATIVE;
                elemkind = r->byte();
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
                element->functionItems->push(mod->functions[r->readU32()]);
            }
            printf("    %d index(es)\n", itemsCount);
        }
        element->index = mod->elements->length();
        mod->elements->push(element);
    }
}

void WasmParser::parseCodeSection() {
    TRACE();

    // modules.html#binary-codesec
    auto count = r->readU32();
    if (count != mod->functions->length() - mod->importFunctions->length())
        FATAL("Invalid number of functions in 'code' section.");
    for (u32 funcIndex = mod->importFunctions->length(); funcIndex < mod->functions->length(); funcIndex++) {
        auto funcSize = r->readU32();
        std::cout << "  function " << funcIndex << " of size " << funcSize << "\n";
        auto state = r->startContainer(funcSize);
        parseFuncCode(funcIndex);
        r->endContainer(state, true);
    }
}

void WasmParser::parseDataSection() {
    TRACE();

    WasmDataSegment$ data;

    // modules.html#binary-datasec
    mod->data = new$;

    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        u32 memoryIndex;
        u8 select = r->byte();
        switch (select) {
            case 0x00:
                data = new$;
                data->active = true;
                data->memory = 0;
                data->offset = parseExpr();
                data->bytes = r->bytes();
                printf("  data active mode for memory 0(default) of size %d\n", (int)data->bytes->length());
                break;
            case 0x01:
                data = new$;
                data->active = false;
                data->bytes = r->bytes();
                printf("  data passive mode of size %d\n", (int)data->bytes->length());
                break;
            case 0x02:
                data = new$;
                data->active = true;
                memoryIndex = r->readU32();
                if (memoryIndex >= mod->memories->length())
                    FATAL("Unknown memory index %d", (int)memoryIndex);
                data->memory = mod->memories[memoryIndex];
                data->offset = parseExpr();
                data->bytes = r->bytes();
                printf("  data active mode for memory %d of size %d\n", data->memory->index, (int)data->bytes->length());
                break;
            default:
                FATAL("Unknown kind of data ${select}");
        }
        data->index = i;
        mod->data->push(data);
    }
}

void WasmParser::parseDataCountSection()
{
    TRACE();
    // modules.html#binary-datacountsec
    if (mod->data->length() != r->readU32())
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
    function = mod->functions[funcIndex];
    Array$<u32> locals;
    for (auto type : function->type->param) {
        locals->push(type);
    }
    auto count = r->readU32();
    for (u32 i = 0; i < count; i++) {
        auto localsCount = r->readU32();
        auto type = valueType();
        for (u32 j = 0; j < localsCount; j++)
            locals->push(type);
    }
    function->locals = locals;
    std::cout << "    locals: " << locals->length() << "\n";
    function->block = WasmBlock{
        .type = function->type,
    };
    function->block->instr = WasmInstr{
        .code = INSTR_TRIVM_FUNCTION,
        .block = function->block,
    };
    blockStack = { function->block };
    function->block->body = parseExpr();
    function = nullptr;
}

Array$<WasmInstr$$> WasmParser::parseExpr(bool allowElse) {
    TRACE();
    Array$<WasmInstr$$> instrs;
    while (true) {
        WasmInstr$ instr;
        auto code = r->byte();

        if (code == INSTR_TRIVM_WASM_EXT) {
            auto extCode = r->readU32();
            code |= extCode << 8;
        }

        instr->code = code;
        instr->imm = new$;

        bool last = parseInstr(instr, allowElse);

        instrs->push(instr);

        if (last) {
            return instrs;
        }
    }

    /*switch (code) {
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
            }*/
    return instrs;
}

bool WasmParser::parseInstr(WasmInstr$$ instr, bool &allowElse)
{
    TRACE();

    instr->imm = new$;
    auto imm = instr->imm;

    switch (instr->code)
    {
    /* -- Begin of source code generated with help of "gen_instr.js" script -- */
    case INSTR_BLOCK:
    case INSTR_LOOP:
    case INSTR_IF: {
        TRACE();
        instr->block = new$;
        instr->block->instr = instr;
        parseCompressedBlockType(instr->block);
        blockStack->push(instr->block);
        instr->block->body = parseExpr(instr->code == INSTR_IF);
        blockStack->pop();
        break;
    }
    case INSTR_ELSE: {
        TRACE();
        if (!allowElse)
            FATAL("'else' instruction not expected here");
        allowElse = false;
        break;
    }
    case INSTR_END: {
        TRACE();
        return true;
    }
    case INSTR_BR:
    case INSTR_BR_IF: {
        TRACE();
        u32 labelidx0 = r->readU32();
        if (labelidx0 >= blockStack->length())
            FATAL("Invlaid label index");
        instr->imm->push(labelidx0);
        break;
    }
    case INSTR_BR_TABLE: {
        TRACE();
        u32 length = r->readU32();
        for (u32 i = 0; i < length + 1; i++)
        {
            u32 labelidx0 = r->readU32();
            if (labelidx0 >= blockStack->length())
                FATAL("Invlaid label index");
            instr->imm->push(labelidx0);
        }
        break;
    }
    case INSTR_CALL_INDIRECT: {
        TRACE();
        u32 typeidx0 = r->readU32();
        if (typeidx0 >= mod->functionTypes->length())
            FATAL("Invalid type index");
        imm->push(typeidx0);
        u32 tableidx1 = r->readU32();
        if (tableidx1 >= mod->tables->length())
            FATAL("Invalid table index");
        imm->push(tableidx1);
        break;
    }
    case INSTR_SELECT_T: {
        TRACE();
        u32 length = r->readU32();
        for (u32 i = 0; i < length; i++)
        {
            u32 valtype0 = valueType();
            instr->imm->push(valtype0);
        }
        break;
    }
    case INSTR_I32_CONST: {
        TRACE();
        u32 const0 = r->readS32();
        imm->push(const0);
        break;
    }
    case INSTR_I64_CONST: {
        TRACE();
        u64 const0 = r->readS64();
        imm->push(const0);
        break;
    }
    case INSTR_F32_CONST: {
        TRACE();
        u32 const0 = r->readF32();
        imm->push(const0);
        break;
    }
    case INSTR_F64_CONST: {
        TRACE();
        u64 const0 = r->readF64();
        imm->push(const0);
        break;
    }
    case INSTR_REF_NULL: {
        TRACE();
        u32 const0 = r->readF32();
        if (const0 != TYPE_FUNCREF && const0 != TYPE_EXTERNREF)
            FATAL("Unknown type of reference");
        imm->push(const0);
        break;
    }
    // ===== Generated parsers =====
    case INSTR_UNREACHABLE:
    case INSTR_NOP:
    case INSTR_RETURN:
    case INSTR_DROP:
    case INSTR_SELECT:
    case INSTR_I32_EQZ:
    case INSTR_I32_EQ:
    case INSTR_I32_NE:
    case INSTR_I32_LT_S:
    case INSTR_I32_LT_U:
    case INSTR_I32_GT_S:
    case INSTR_I32_GT_U:
    case INSTR_I32_LE_S:
    case INSTR_I32_LE_U:
    case INSTR_I32_GE_S:
    case INSTR_I32_GE_U:
    case INSTR_I64_EQZ:
    case INSTR_I64_EQ:
    case INSTR_I64_NE:
    case INSTR_I64_LT_S:
    case INSTR_I64_LT_U:
    case INSTR_I64_GT_S:
    case INSTR_I64_GT_U:
    case INSTR_I64_LE_S:
    case INSTR_I64_LE_U:
    case INSTR_I64_GE_S:
    case INSTR_I64_GE_U:
    case INSTR_F32_EQ:
    case INSTR_F32_NE:
    case INSTR_F32_LT:
    case INSTR_F32_GT:
    case INSTR_F32_LE:
    case INSTR_F32_GE:
    case INSTR_F64_EQ:
    case INSTR_F64_NE:
    case INSTR_F64_LT:
    case INSTR_F64_GT:
    case INSTR_F64_LE:
    case INSTR_F64_GE:
    case INSTR_I32_CLZ:
    case INSTR_I32_CTZ:
    case INSTR_I32_POPCNT:
    case INSTR_I32_ADD:
    case INSTR_I32_SUB:
    case INSTR_I32_MUL:
    case INSTR_I32_DIV_S:
    case INSTR_I32_DIV_U:
    case INSTR_I32_REM_S:
    case INSTR_I32_REM_U:
    case INSTR_I32_AND:
    case INSTR_I32_OR:
    case INSTR_I32_XOR:
    case INSTR_I32_SHL:
    case INSTR_I32_SHR_S:
    case INSTR_I32_SHR_U:
    case INSTR_I32_ROTL:
    case INSTR_I32_ROTR:
    case INSTR_I64_CLZ:
    case INSTR_I64_CTZ:
    case INSTR_I64_POPCNT:
    case INSTR_I64_ADD:
    case INSTR_I64_SUB:
    case INSTR_I64_MUL:
    case INSTR_I64_DIV_S:
    case INSTR_I64_DIV_U:
    case INSTR_I64_REM_S:
    case INSTR_I64_REM_U:
    case INSTR_I64_AND:
    case INSTR_I64_OR:
    case INSTR_I64_XOR:
    case INSTR_I64_SHL:
    case INSTR_I64_SHR_S:
    case INSTR_I64_SHR_U:
    case INSTR_I64_ROTL:
    case INSTR_I64_ROTR:
    case INSTR_F32_ABS:
    case INSTR_F32_NEG:
    case INSTR_F32_CEIL:
    case INSTR_F32_FLOOR:
    case INSTR_F32_TRUNC:
    case INSTR_F32_NEAREST:
    case INSTR_F32_SQRT:
    case INSTR_F32_ADD:
    case INSTR_F32_SUB:
    case INSTR_F32_MUL:
    case INSTR_F32_DIV:
    case INSTR_F32_MIN:
    case INSTR_F32_MAX:
    case INSTR_F32_COPYSIGN:
    case INSTR_F64_ABS:
    case INSTR_F64_NEG:
    case INSTR_F64_CEIL:
    case INSTR_F64_FLOOR:
    case INSTR_F64_TRUNC:
    case INSTR_F64_NEAREST:
    case INSTR_F64_SQRT:
    case INSTR_F64_ADD:
    case INSTR_F64_SUB:
    case INSTR_F64_MUL:
    case INSTR_F64_DIV:
    case INSTR_F64_MIN:
    case INSTR_F64_MAX:
    case INSTR_F64_COPYSIGN:
    case INSTR_I32_WRAP_I64:
    case INSTR_I32_TRUNC_F32_S:
    case INSTR_I32_TRUNC_F32_U:
    case INSTR_I32_TRUNC_F64_S:
    case INSTR_I32_TRUNC_F64_U:
    case INSTR_I64_EXTEND_I32_S:
    case INSTR_I64_EXTEND_I32_U:
    case INSTR_I64_TRUNC_F32_S:
    case INSTR_I64_TRUNC_F32_U:
    case INSTR_I64_TRUNC_F64_S:
    case INSTR_I64_TRUNC_F64_U:
    case INSTR_F32_CONVERT_I32_S:
    case INSTR_F32_CONVERT_I32_U:
    case INSTR_F32_CONVERT_I64_S:
    case INSTR_F32_CONVERT_I64_U:
    case INSTR_F32_DEMOTE_F64:
    case INSTR_F64_CONVERT_I32_S:
    case INSTR_F64_CONVERT_I32_U:
    case INSTR_F64_CONVERT_I64_S:
    case INSTR_F64_CONVERT_I64_U:
    case INSTR_F64_PROMOTE_F32:
    case INSTR_I32_REINTERPRET_F32:
    case INSTR_I64_REINTERPRET_F64:
    case INSTR_F32_REINTERPRET_I32:
    case INSTR_F64_REINTERPRET_I64:
    case INSTR_I32_EXTEND8_S:
    case INSTR_I32_EXTEND16_S:
    case INSTR_I64_EXTEND8_S:
    case INSTR_I64_EXTEND16_S:
    case INSTR_I64_EXTEND32_S:
    case INSTR_REF_IS_NULL:
    case INSTR_I32_TRUNC_SAT_F32_S:
    case INSTR_I32_TRUNC_SAT_F32_U:
    case INSTR_I32_TRUNC_SAT_F64_S:
    case INSTR_I32_TRUNC_SAT_F64_U:
    case INSTR_I64_TRUNC_SAT_F32_S:
    case INSTR_I64_TRUNC_SAT_F32_U:
    case INSTR_I64_TRUNC_SAT_F64_S:
    case INSTR_I64_TRUNC_SAT_F64_U: {
        TRACE();
        break;
    }
    case INSTR_CALL:
    case INSTR_REF_FUNC: {
        TRACE();
        u32 funcidx0 = r->readU32();
        if (funcidx0 >= mod->functions->length())
            FATAL("Invalid function index");
        imm->push(funcidx0);
        break;
    }
    case INSTR_LOCAL_GET:
    case INSTR_LOCAL_SET:
    case INSTR_LOCAL_TEE: {
        TRACE();
        u32 localidx0 = r->readU32();
        if (localidx0 >= function->locals->length())
            FATAL("Invalid local variable index");
        imm->push(localidx0);
        break;
    }
    case INSTR_GLOBAL_GET:
    case INSTR_GLOBAL_SET: {
        TRACE();
        u32 globalidx0 = r->readU32();
        if (globalidx0 >= mod->globals->length())
            FATAL("Invalid global variable index");
        imm->push(globalidx0);
        break;
    }
    case INSTR_TABLE_GET:
    case INSTR_TABLE_SET:
    case INSTR_TABLE_GROW:
    case INSTR_TABLE_SIZE:
    case INSTR_TABLE_FILL: {
        TRACE();
        u32 tableidx0 = r->readU32();
        if (tableidx0 >= mod->tables->length())
            FATAL("Invalid table index");
        imm->push(tableidx0);
        break;
    }
    case INSTR_I32_LOAD:
    case INSTR_I64_LOAD:
    case INSTR_F32_LOAD:
    case INSTR_F64_LOAD:
    case INSTR_I32_LOAD8_S:
    case INSTR_I32_LOAD8_U:
    case INSTR_I32_LOAD16_S:
    case INSTR_I32_LOAD16_U:
    case INSTR_I64_LOAD8_S:
    case INSTR_I64_LOAD8_U:
    case INSTR_I64_LOAD16_S:
    case INSTR_I64_LOAD16_U:
    case INSTR_I64_LOAD32_S:
    case INSTR_I64_LOAD32_U:
    case INSTR_I32_STORE:
    case INSTR_I64_STORE:
    case INSTR_F32_STORE:
    case INSTR_F64_STORE:
    case INSTR_I32_STORE8:
    case INSTR_I32_STORE16:
    case INSTR_I64_STORE8:
    case INSTR_I64_STORE16:
    case INSTR_I64_STORE32: {
        TRACE();
        r->readU32(); // ignore align
        u32 offset0 = r->readU32();
        imm->push(offset0);
        break;
    }
    case INSTR_MEMORY_SIZE:
    case INSTR_MEMORY_GROW:
    case INSTR_MEMORY_FILL: {
        TRACE();
        u32 memidx0 = r->readU32();
        if (memidx0 != 0)
            FATAL("Only one memory is supported");
        imm->push(memidx0);
        break;
    }
    case INSTR_MEMORY_INIT: {
        TRACE();
        u32 dataidx0 = r->readU32();
        // TODO: dataidx validation must be done later
        imm->push(dataidx0);
        u32 memidx1 = r->readU32();
        if (memidx1 != 0)
            FATAL("Only one memory is supported");
        imm->push(memidx1);
        break;
    }
    case INSTR_DATA_DROP: {
        TRACE();
        u32 dataidx0 = r->readU32();
        // dataidx validation must be done later
        imm->push(dataidx0);
        break;
    }
    case INSTR_MEMORY_COPY: {
        TRACE();
        u32 memidx0 = r->readU32();
        if (memidx0 != 0)
            FATAL("Only one memory is supported");
        imm->push(memidx0);
        u32 memidx1 = r->readU32();
        if (memidx1 != 0)
            FATAL("Only one memory is supported");
        imm->push(memidx1);
        break;
    }
    case INSTR_TABLE_INIT: {
        TRACE();
        u32 elemidx0 = r->readU32();
        if (elemidx0 >= mod->elements->length()) // TODO: check if elemidx is for passive only or both
            FATAL("Invalid table element index");
        if (mod->elements[elemidx0]->kind != WASM_ELEMENT_PASSIVE)
            FATAL("Invalid initialization of non-passive element");
        imm->push(elemidx0);
        u32 tableidx1 = r->readU32();
        if (tableidx1 >= mod->tables->length())
            FATAL("Invalid table index");
        imm->push(tableidx1);
        break;
    }
    case INSTR_ELEM_DROP: {
        TRACE();
        u32 elemidx0 = r->readU32();
        if (elemidx0 >= mod->elements->length()) // TODO: check if elemidx is for passive only or both
            FATAL("Invalid table element index");
        imm->push(elemidx0);
        break;
    }
    case INSTR_TABLE_COPY: {
        TRACE();
        u32 tableidx0 = r->readU32();
        if (tableidx0 >= mod->tables->length())
            FATAL("Invalid table index");
        imm->push(tableidx0);
        u32 tableidx1 = r->readU32();
        if (tableidx1 >= mod->tables->length())
            FATAL("Invalid table index");
        imm->push(tableidx1);
        break;
    }
    /* -- End of source code generated with help of "gen_instr.js" script -- */
    default:
        TRACE();
        FATAL("Invalid instruction opcode 0x%02X", instr->code);
        break;
    }
    return false;
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
            block->type = mod->functionTypes[typeIndex];
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

