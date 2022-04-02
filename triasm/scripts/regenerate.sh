#!/bin/bash
#
# The author disclaims copyright to this source code.
#

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd $SCRIPT_DIR/..

rm -f lemon/triasmParser.c lemon/triasmParser.h lemon/triasmParser.out

if [[ lemon/lemon.c -nt lemon/lemon.exe ]]; then
    echo Compiling lemon.exe...
    gcc lemon/lemon.c -o lemon/lemon.exe
fi

echo Generating parser...
lemon/lemon.exe -c -dlemon src/triasmParser.y

echo Embedding tokens into header file...
sed -n -e '0,/BEGIN LEMON TOKENS/p' src/triasmParser.h > _tmp.txt
cat lemon/triasmParser.h >> _tmp.txt
sed -n -e '/END LEMON TOKENS/,$p' src/triasmParser.h >> _tmp.txt
rm lemon/triasmParser.h src/triasmParser.h
mv _tmp.txt src/triasmParser.h

echo Done
