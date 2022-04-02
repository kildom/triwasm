#!/bin/bash
set -e

rm -f lemonParser.c lemonParser.h lemonParser.out

if [[ lemon.c -nt lemon.exe ]]; then
    echo Compiling lemon.exe...
    gcc lemon.c -o lemon.exe
fi

echo Generating parser...
./lemon.exe -c lemonParser.y

echo Done
