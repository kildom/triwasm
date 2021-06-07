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
    std::basic_string<u8> buffer;
    ssize offsetOfBuffer; // offset of `buffer` begin in a file
    u8* wathermark; // if wathermark is less than 20 bytes before `end` of data this means that end of file was reached.
    u8* ptr;
    u8* end;
    void checkWathermark() {
        if (ptr >= wathermark) { // wathermark is 20 bytes before end of data `end` or less at the end of file
            updateBuffer();
        }
    }
public:
    WasmReader(WasmInputStream$$ stream);
    ssize offset();
    u32 readU32();
    s32 readS32();
    u64 readU64();
    s64 readS64();
    u8 byte() {
        checkWathermark();
        return *ptr++;
    }
    $<std::string> string();
    $<std::basic_string<u8>> bytes();
    void skip(ssize length);
    ssize startContainer(ssize length); // returns file offset at the end of container: offsetOfBuffer + (ptr - buf.c_str()) + length
    void endContainer(ssize state, bool expectFullyConsumed); // success when ended as expected, fatal read too much or expectAllConsumed and something was  not consumed
    void updateBuffer(); // TODO: at the end of this method: if (ptr == end) FATAL("Unexpected end of input");
};

#endif /* _WASM_READER_HH_ */
