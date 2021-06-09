#ifndef _FILE_INPUT_STREAM_HH_
#define _FILE_INPUT_STREAM_HH_

#include <cstdio>

#include "common.hh"

#include "WasmReader.hh"

DOLLAR_CLASS(FileInputStream);

class FileInputStream : public WasmInputStream {
private:
    FILE* file;
public:
    FileInputStream(const char* fileName);
    virtual ~FileInputStream();
    virtual ssize read(u8 *buffer, ssize length);
    void close();
};

#endif /* _FILE_INPUT_STREAM_HH_ */
