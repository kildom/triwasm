
#include "common.hh"
#include "WasmReader.hh"

#define READER_BUFFER_SIZE 65536

WasmReader::WasmReader(WasmInputStream$$ stream) :
    stream(stream),
    buffer(READER_BUFFER_SIZE, '\0')
{
    ptr = (u8*)buffer.c_str() + READER_BUFFER_SIZE;
    end = ptr;
    offsetOfBuffer = 0;
    updateBuffer();
}

void WasmReader::updateBuffer()
{
    if (ptr < end)
        return;
    auto bufferEnd = (u8*)buffer.c_str() + READER_BUFFER_SIZE;
    if (ptr < bufferEnd) {
        FATAL("Unexpected end of input");
    }
    offsetOfBuffer += ptr - (u8*)buffer.c_str();
    ptr = (u8*)buffer.c_str();
    end = ptr;
    while (end < bufferEnd) {
        auto n = stream->read(end, bufferEnd - end);
        if (n == 0)
            break;
        end += n;
    }
    end = ptr;
}

$<std::basic_string<u8>> WasmReader::bytes()
{
    auto length = readU32();
    auto result = $<std::basic_string<u8>>::create(length, 0);

    if (length == 0)
        return result;

    auto buffer = (u8*)result->c_str();

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

