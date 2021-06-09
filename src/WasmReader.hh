#ifndef _WASM_READER_HH_
#define _WASM_READER_HH_

#include "common.hh"

DOLLAR_CLASS(WasmInputStream);

class WasmInputStream {
public:
    virtual ~WasmInputStream() { };
    virtual ssize read(u8 *buffer, ssize length) = 0;
    virtual void close() = 0;
};

DOLLAR_CLASS(WasmReader);

class WasmReader {
private:
    u8* ptr;
    u8* end;
    WasmInputStream$$ stream;
    std::basic_string<u8> buffer;
    ssize offsetOfBuffer; // offset of `buffer` begin in a file
    void updateBuffer(); // TODO: at the end of this method: if (ptr == end) FATAL("Unexpected end of input");

    template<typename XX>
    XX WasmReader:: readXX()
    {
        XX result = 0;
        XX shift = 0;
        XX x;
        do {
            if (ptr == end)
                updateBuffer();
            x = *ptr++;
            result |= (x & 0x7F) << shift;
            shift += 7;
        } while(x & 0x80);
        if (std::is_signed<XX>::value && (shift < sizeof(XX) * 8) && (x & 0x40))
            result |= ~(XX)0 << shift;
        return result;
    }

public:
    WasmReader(WasmInputStream$$ stream);
    bool eof();
    ssize offset();
    u32 readU32() { return readXX<u32>(); }
    s32 readS32() { return readXX<s32>(); }
    u64 readU64() { return readXX<u64>(); }
    s64 readS64() { return readXX<s64>(); }
    u8 byte() {
        if (ptr == end)
            updateBuffer();
        return *ptr++;
    }
    $<std::string> string();
    $<std::basic_string<u8>> bytes();
    void skip(ssize length);
    ssize startContainer(ssize length); // returns file offset at the end of container: offsetOfBuffer + (ptr - buf.c_str()) + length
    void endContainer(ssize state, bool expectFullyConsumed); // success when ended as expected, fatal read too much or expectAllConsumed and something was  not consumed
};

#endif /* _WASM_READER_HH_ */
