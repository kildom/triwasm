
#include <cstdio>

#include "common.hh"
#include "WasmReader.hh"

#include "FileInputStream.hh"

FileInputStream::FileInputStream(const char* fileName)
{
    file = std::fopen(fileName, "rb");
    if (!file)
        FATAL("Cannot open input file");
}

FileInputStream::~FileInputStream()
{
    close();
}

ssize FileInputStream::read(u8 *buffer, ssize length)
{
    if (!file)
        return 0;
    auto n = std::fread(buffer, 1, length, file);
    if (n < 0) {
        FATAL("Input file read error");
    } else if (n == 0) {
        close();
    }
    return n;
}


void FileInputStream::close()
{
    if (file != NULL) {
        std::fclose(file);
        file = NULL;
    }
}
