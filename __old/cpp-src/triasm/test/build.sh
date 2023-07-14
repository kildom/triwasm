#!/bin/bash

../scripts/regenerate.sh
gcc -c -I../src -I../../cppUtils ../lemon/lemonParser.c -g -O0 -o lemonParser.o
g++ lemonParser.o testTokens.cpp -I../src -I../../cppUtils -g -O0 -o t && ./t
