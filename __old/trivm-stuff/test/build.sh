#!/bin/bash

gcc -O0 -g -I. -I../src -DTRACE_ENABLED=1 test_main.c ../src/trivm.c -o test_main && ./test_main
