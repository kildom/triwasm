# Copyright (C) 2023 Dominik Kilian
# SPDX-License-Identifier: GPL-3.0-or-later


TARGET:=triwasmlib

SRC:=./i64.c \
	./i32.c \
	./general.c \
	./stubs.c

CFLAGS:=-msimd128 -fno-vectorize -fno-slp-vectorize -mno-tail-call

include ../common/Makefile.common
