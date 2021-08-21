
#include "Utils.hh"
#include "WasmReader.hh"

#define READER_BUFFER_SIZE 65536

WasmReader::WasmReader(WasmInputStream$ stream) :
    stream(stream),
    buffer(READER_BUFFER_SIZE, '\0')
{
    ptr = (u8*)buffer.c_str() + READER_BUFFER_SIZE;
    end = ptr;
    offsetOfBuffer = 0;
    requestData();
}

void WasmReader::updateBuffer()
{
    if (ptr == end) {
        auto bufferBegin = (u8*)buffer.c_str();
        auto bufferEnd = bufferBegin + READER_BUFFER_SIZE;
        offsetOfBuffer += ptr - bufferBegin;
        ptr = bufferBegin;
        end = ptr;
        while (end < bufferEnd) {
            auto n = stream->read(end, bufferEnd - end);
            if (n == 0)
                break;
            end += n;
        }
    }
}


void WasmReader::requestData()
{
    updateBuffer();
    if (ptr == end)
        FATAL("Unexpected end of input");
}

String$$ WasmReader::string()
{
    auto text = bufferRead<String$$>();

    const char* c = text->buffer();
    const char* end = c + text->length();
    
    while (c < end) {
        u32 b = (u32)(u8)(*c);
        if (b & 0x80) {
            auto ones = __builtin_clz((~b) << 24);
            if (ones < 2 || ones > 6)
                FATAL("Invalid sequence in UTF-8 string");
            auto suffix = c + 1;
            c += ones;
            if (c > end)
                FATAL("Unexpected end of UTF-8 string");
            while (suffix < c) {
                if ((*suffix & 0xC0) != 0x80)
                    FATAL("Invalid sequence in UTF-8 string");
                suffix++;
            }
        } else {
            c++;
        }
    }

    return text;
}

Bytes$$ WasmReader::bytes() {
    return bufferRead<Bytes$$>();
}


void WasmReader::skip(ssize length)
{
    while (length > 0) {
        if (ptr == end)
            requestData();
        auto consumeBytes = std::min(length, end - ptr);
        ptr += consumeBytes;
        length -= consumeBytes;
    }
}

template<typename XX>
XX WasmReader::readXX()
{
    XX result = 0;
    u32 shift = 0;
    u32 byte;
    do {
        if (ptr == end)
            requestData();
        byte = *ptr++;
        result |= (XX)(byte & 0x7F) << shift;
        shift += 7;
    } while(byte & 0x80);
    if (std::is_signed<XX>::value && (shift < sizeof(XX) * 8) && (byte & 0x40))
        result |= ~(XX)0 << shift;
    return result;
}

template<typename T$$>
T$$ WasmReader::bufferRead()
{
    auto length = readU32();
    auto result = T$$::create(length, 0);

    if (length == 0)
        return result;

    u8* buffer = (u8*)result->buffer();

    auto available = end - ptr;
    if (available >= length) {
        std::memcpy(buffer, ptr, length);
        ptr += length;
        return result;
    }

    std::memcpy(buffer, ptr, available);
    ptr = end;

    length -= available;
    buffer += available;

    while (length > 0) {
        auto n = stream->read(buffer, length);
        if (n == 0)
            FATAL("Unexpected end of input");
        length -= n;
        buffer += n;
        offsetOfBuffer += n;
    }

    return result;
}

u32 WasmReader::readU32() {
    return readXX<u32>();
}

s32 WasmReader::readS32() {
    return readXX<s32>();
}

u64 WasmReader::readU64() {
    return readXX<u64>();
}

s64 WasmReader::readS64() {
    return readXX<s64>();
}

u32 WasmReader::readF32() {
    u32 result = 0;
    for (auto i = 0; i < 32; i += 8) {
        result |= byte() << i;
    }
    return result;
}

u64 WasmReader::readF64() {
    u64 result = 0;
    for (auto i = 0; i < 64; i += 8) {
        result |= byte() << i;
    }
    return result;
}

ssize WasmReader::startContainer(ssize length) {// returns file offset at the end of container: offsetOfBuffer + (ptr - buf.c_str()) + length
    return offset() + length;
}

void WasmReader::endContainer(ssize state, bool expectFullyConsumed) { // success when ended as expected, fatal read too much or expectAllConsumed and something was  not consumed
    auto current = offset();
    if (current > state)
        FATAL("Part of the input was bigger than expected");
    if (current < state) {
        if (expectFullyConsumed)
            FATAL("Part of the input %d was smaller than expected %d", (int)current, (int)state);
        skip(state - current);
    }
}

ssize WasmReader::offset()
{
    return offsetOfBuffer + (ptr - (u8*)buffer.c_str());
}

bool WasmReader::endOfInput()
{
    if (ptr == end)
        updateBuffer();
    return ptr == end;
}

bool WasmReader::endOfContainer(ssize state)
{
    return offset() >= state;
}

u8 WasmReader::byte()
{
    if (ptr == end)
        requestData();
    return *ptr++;
}
