#ifndef _WASM_READER_HH_
#define _WASM_READER_HH_

#include "common.hh"

DOLLAR_CLASS(WasmInputStream);

class WasmInputStream {
public:
    virtual ~WasmInputStream() { };
    virtual ssize read(u8 *buffer, ssize length) { __builtin_unreachable(); };
    virtual void close() { __builtin_unreachable(); };
};

DOLLAR_CLASS(WasmReader);

class WasmReader {
private:
    u8* ptr;
    u8* end;
    WasmInputStream$$ stream;
    std::basic_string<u8> buffer;
    ssize offsetOfBuffer;
    bool eofReceived;

    void updateBuffer();

    template<typename XX>
    XX readXX();

    template<typename T$>
    T$ bufferRead();

public:
    WasmReader(WasmInputStream$$ stream);
    u32 readU32() { return readXX<u32>(); }
    s32 readS32() { return readXX<s32>(); }
    u64 readU64() { return readXX<u64>(); }
    s64 readS64() { return readXX<s64>(); }
    u8 byte() {
        if (ptr == end)
            updateBuffer();
        return *ptr++;
    }
    String$ string();
    Bytes$ bytes();
    void skip(ssize length);
    ssize startContainer(ssize length); // returns file offset at the end of container: offsetOfBuffer + (ptr - buf.c_str()) + length
    void endContainer(ssize state, bool expectFullyConsumed); // success when ended as expected, fatal read too much or expectAllConsumed and something was  not consumed
    ssize offset();
    bool eof();
};

template<typename XX>
XX WasmReader::readXX()
{
    XX result = 0;
    u32 shift = 0;
    u32 byte;
    do {
        if (ptr == end)
            updateBuffer();
        byte = *ptr++;
        result |= (XX)(byte & 0x7F) << shift;
        shift += 7;
    } while(byte & 0x80);
    if (std::is_signed<XX>::value && (shift < sizeof(XX) * 8) && (byte & 0x40))
        result |= ~(XX)0 << shift;
    return result;
}

template<typename T$>
T$ WasmReader::bufferRead()
{
    auto length = readU32();
    auto result = T$::create(length, 0);

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

#endif /* _WASM_READER_HH_ */
