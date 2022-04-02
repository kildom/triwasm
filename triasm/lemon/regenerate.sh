#!/bin/bash
#
# The author disclaims copyright to this source code.
#

set -e

rm -f lemonParser.c lemonParser.h lemonParser.out

if [[ lemon.c -nt lemon.exe ]]; then
    echo Compiling lemon.exe...
    gcc lemon.c -o lemon.exe
fi

echo Generating parser...
./lemon.exe -c lemonParser.y

echo '/*' > _tmp.txt
cat LICENSE >> _tmp.txt
echo '*/' >> _tmp.txt
echo '' >> _tmp.txt
cat lemonParser.h >> _tmp.txt
rm lemonParser.h
mv _tmp.txt lemonParser.h

echo Done
