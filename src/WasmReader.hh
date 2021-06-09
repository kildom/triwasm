#ifndef _WASM_READER_HH_
#define _WASM_READER_HH_

#include "common.hh"

DOLLAR_CLASS(WasmInputStream);

class WasmInputStream {
public:
    virtual ~WasmInputStream() { };
    virtual ssize read(u8 *buffer, ssize length) { __builtin_unreachable(); };
};

DOLLAR_CLASS(WasmReader);

class WasmReader {
private:
    u8* ptr;
    u8* end;
    WasmInputStream$$ stream;
    std::basic_string<u8> buffer;
    ssize offsetOfBuffer;

    void updateBuffer();
    void requestData();

    template<typename XX>
    XX readXX();

    template<typename T$>
    T$ bufferRead();

public:
    WasmReader(WasmInputStream$$ stream);
    u32     readU32();
    s32     readS32();
    u64     readU64();
    s64     readS64();
    u8      byte();
    String$ string();
    Bytes$  bytes();
    void    skip(ssize length);
    ssize   startContainer(ssize length);
    void    endContainer(ssize state, bool expectFullyConsumed);
    ssize   offset();
    bool    endOfInput();
    bool    endOfContainer(ssize state);
};



#endif /* _WASM_READER_HH_ */
