#!/bin/bash
set -e

../scripts/regenerate.sh
gcc -I. -c ../lemon/lemonParser.c -g -O0 -o lemonParser.o
g++ -I. lemonParser.o Parser.cc -I../../cppUtils -g -O0 -o t
./t
