
/*============================================================================

This C source file is part of the SoftFloat IEEE Floating-Point Arithmetic
Package, Release 3e, by John R. Hauser.

Copyright 2011, 2012, 2013, 2014, 2015, 2016 The Regents of the University of
California.  All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice,
    this list of conditions, and the following disclaimer.

 2. Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions, and the following disclaimer in the documentation
    and/or other materials provided with the distribution.

 3. Neither the name of the University nor the names of its contributors may
    be used to endorse or promote products derived from this software without
    specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE REGENTS AND CONTRIBUTORS "AS IS", AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE, ARE
DISCLAIMED.  IN NO EVENT SHALL THE REGENTS OR CONTRIBUTORS BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

=============================================================================*/

#include <stdint.h>
#include "platform.h"
#include "primitives.h"

uint16_t softfloat_approxRecip_1k0s( int index ) {
    switch ( index )
    {
    case 0: return 0xFFC4;
    case 1: return 0xF0BE;
    case 2: return 0xE363;
    case 3: return 0xD76F;
    case 4: return 0xCCAD;
    case 5: return 0xC2F0;
    case 6: return 0xBA16;
    case 7: return 0xB201;
    case 8: return 0xAA97;
    case 9: return 0xA3C6;
    case 10: return 0x9D7A;
    case 11: return 0x97A6;
    case 12: return 0x923C;
    case 13: return 0x8D32;
    case 14: return 0x887E;
    default: return 0x8417;
    }
}

uint16_t softfloat_approxRecip_1k1s( int index ) {
    switch ( index )
    {
    case 0: return 0xF0F1;
    case 1: return 0xD62C;
    case 2: return 0xBFA1;
    case 3: return 0xAC77;
    case 4: return 0x9C0A;
    case 5: return 0x8DDB;
    case 6: return 0x8185;
    case 7: return 0x76BA;
    case 8: return 0x6D3B;
    case 9: return 0x64D4;
    case 10: return 0x5D5C;
    case 11: return 0x56B1;
    case 12: return 0x50B6;
    case 13: return 0x4B55;
    case 14: return 0x4679;
    default: return 0x4211;
    }
}

