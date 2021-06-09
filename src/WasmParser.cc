
#include "common.hh"
#include "FileInputStream.hh"
#include "WasmConsts.hh"
#include "WasmParser.hh"

WasmData$ WasmParser::parseFile(const char* fileName)
{
    auto fileInput = FileInputStream$::create(fileName);
    r = WasmReader$$::create(fileInput.cast<WasmInputStream>());
    d = WasmData$::create();
    parse();
    return d;
}

void WasmParser::parse() {

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
            //this.parseTableSection(r->sub(size));
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
            //this.parseCodeSection(r->sub(size));
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
            /*case 0x03: {
                // types.html#binary-globaltype
                auto type = r->byte();
                auto mut = r->byte();
                this.importGlobals.push({
                    module: moduleName,
                    name: memberName,
                    type: type,
                    mutable: !!mut,
                });
                console.log(`  import ${mut ? 'var' : 'const'} global ${moduleName}.${memberName} of type ${consts.typeNames[type]}`);
                break;
            }*/
            default:
                FATAL("Unknown select of import %d", select);
        }
    }
}

Range WasmParser::parseLimits() {
    // types.html#binary-limits
    auto isMax = r->byte();
    auto min = r->readU32();
    if (isMax) {
        auto max = r->readU32();
        return Range(min, max);
    }
    return Range(min, RangeEnd - 0);
}

void WasmParser::parseFunctionSection() {
    // modules.html#binary-funcsec
    auto count = r->readU32();
    for (u32 funcIndex = 0; funcIndex < count; funcIndex++) {
        auto typeIndex = r->readU32();
        d->functions->grow(funcIndex)->typeIndex = typeIndex;
        printf("  function %d type is %d\n", funcIndex, typeIndex);
    }
}

u32 WasmParser::valueType()
{
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

