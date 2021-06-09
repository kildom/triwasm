
#include "common.hh"
#include "WasmReader.hh"

#define READER_BUFFER_SIZE 65536
#define READER_WATHERMARK 20

WasmReader::WasmReader(WasmInputStream$$ stream) :
    stream(stream),
    buffer(READER_BUFFER_SIZE + READER_WATHERMARK, '\0')
{
    ptr = (u8*)buffer.c_str();
    end = ptr;
    fillBuffer();
    wathermark = end - READER_WATHERMARK;
    if (wathermark < ptr) {
        wathermark = end;
    }
    offsetOfBuffer = 0;
}

bool WasmReader::fillBuffer()
{
    auto bufferEnd = (u8*)buffer.c_str() + READER_BUFFER_SIZE;
    while (end < bufferEnd) {
        auto n = stream->read(end, bufferEnd - end);
        if (n == 0)
            return false;
        end += n;
    }
}