
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


String$ WasmReader::string() {
    return bufferRead<String$>();
}

Bytes$ WasmReader::bytes() {
    return bufferRead<Bytes$>();
}


void WasmReader::skip(ssize length)
{
    u8 buffer[1024];
    if (length == 0)
        return;

    auto available = end - ptr;
    if (available >= length) {
        ptr += length;
        return;
    }

    ptr = end;

    length -= available;

    while (length > 0) {
        auto n = stream->read(buffer, std::min(length, (ssize)sizeof(buffer)));
        if (n == 0)
            FATAL("Unexpected end of input");
        length -= n;
        offsetOfBuffer += n;
    }
}

ssize WasmReader::startContainer(ssize length) {// returns file offset at the end of container: offsetOfBuffer + (ptr - buf.c_str()) + length
}

void WasmReader::endContainer(ssize state, bool expectFullyConsumed){ // success when ended as expected, fatal read too much or expectAllConsumed and something was  not consumed
}

ssize WasmReader::offset()
{

}

bool WasmReader::eof()
{
    return ptr == end && end < (u8*)buffer.c_str() + READER_BUFFER_SIZE;
}
