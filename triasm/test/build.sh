#!/bin/bash

gcc -c -I../src -I../../cppUtils ../lemon/triasmParser.c -g -O0 -o triasmParser.o
g++ triasmParser.o testTokens.cpp -I../src -I../../cppUtils -g -O0 -o t && ./t
