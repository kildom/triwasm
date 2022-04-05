#!/bin/bash

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd $SCRIPT_DIR/..

rm -f lemon/lemonParser.c lemon/lemonParser.h lemon/lemonParser.out

if [[ lemon/lemon.c -nt lemon/lemon.exe ]]; then
    echo Compiling lemon.exe...
    gcc lemon/lemon.c -o lemon/lemon.exe
fi

echo Generating parser...
lemon/lemon.exe -c -dlemon src/lemonParser.y

echo Embedding tokens into header file...
sed -n -e '0,/BEGIN LEMON TOKENS/p' src/lemonParser.h > _tmp.txt
cat lemon/lemonParser.h >> _tmp.txt
sed -n -e '/END LEMON TOKENS/,$p' src/lemonParser.h >> _tmp.txt
rm lemon/lemonParser.h src/lemonParser.h
mv _tmp.txt src/lemonParser.h

echo Done
