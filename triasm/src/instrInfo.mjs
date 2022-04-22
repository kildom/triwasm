/*!
 * Copyright (c) 2023 Dominik Kilian <kontakt@dominik.cc>
 *
 * This program is free software: you can redistribute it and/or modify it under the
 * terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License along with this
 * program. If not, see <https://www.gnu.org/licenses/>.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const instrInfoTextTable = `
#   |1             |2    |3   |4     |
#   |Name          |Args.|With|Cond- |
#   |              |num. |base|ition |
#   |              |     |    |      |

# Core instructions
~>   BRT            0-1   0    -
~>   BRF            0-1   0    -
~>   ADD            0-1   0    -
~>   SUB            0-1   0    -
~>   MUL            0-1   0    -
~>   AND            0-1   0    -
~>   OR             0-1   0    -
~>   XOR            0-1   0    -
~>   UDIV           0-1   0    -
~>   SDIV           0-1   0    -
~>   UMOD           0-1   0    -
~>   SMOD           0-1   0    -
~>   SHL            0-1   0    -
~>   EXTS           0-1   0    -
~>   USHR           0-1   0    -
~>   SSHR           0-1   0    -
~>   ULT            0-1   0    -
~>   UGT            0-1   0    -
~>   SLT            0-1   0    -
~>   SGT            0-1   0    -
~>   EQ             0-1   0    -
~>   NOT            0-1   0    -
~>   NEG            0-1   0    -
~>   CALL           0-1   0    -
~>   BR             0-1   0    -
~>   WRITESP        0-1   0    -
~>   READSP         0-0   0    -
~>   UNWIND         0-1   0    unwind
~>   HOST           0-1   0    -

# Read/Write instructions
~>   READ8S         0-1   1    -
~>   READ8          0-1   1    -
~>   READ16S        0-1   1    -
~>   READ16         0-1   1    -
~>   READ32         0-1   1    -
~>   READ64         0-1   1    mem64
~>   WRITE8         0-1   1    -
~>   WRITE16        0-1   1    -
~>   WRITE32        0-1   1    -
~>   WRITE64        0-1   1    mem64

# 64-bit integer instructions
~>   ADD64***       0-0   0    i64
~>   ADD64**        1-1   0    i64
~>   ADD64          0-1   0    i64
~>   SUB64***       0-0   0    i64
~>   SUB64**        1-1   0    i64
~>   SUB64          0-1   0    i64
~>   MUL64***       0-0   0    i64
~>   MUL64**        1-1   0    i64
~>   MUL64          0-1   0    i64
~>   AND64***       0-0   0    i64
~>   AND64**        1-1   0    i64
~>   AND64          0-1   0    i64
~>   UDIV64***      0-0   0    i64
~>   UDIV64**       1-1   0    i64
~>   UDIV64         0-1   0    i64
~>   SDIV64***      0-0   0    i64
~>   SDIV64**       1-1   0    i64
~>   SDIV64         0-1   0    i64
~>   UMOD64***      0-0   0    i64
~>   UMOD64**       1-1   0    i64
~>   UMOD64         0-1   0    i64
~>   SMOD64***      0-0   0    i64
~>   SMOD64**       1-1   0    i64
~>   SMOD64         0-1   0    i64
~>   SHL64***       0-0   0    i64
~>   SHL64**        1-1   0    i64
~>   SHL64          0-1   0    i64
~>   EXTS64***      0-0   0    i64
~>   EXTS64**       1-1   0    i64
~>   EXTS64         0-1   0    i64
~>   USHR64***      0-0   0    i64
~>   USHR64**       1-1   0    i64
~>   USHR64         0-1   0    i64
~>   SSHR64***      0-0   0    i64
~>   SSHR64**       1-1   0    i64
~>   SSHR64         0-1   0    i64
~>   ULT64***       0-0   0    i64
~>   ULT64**        1-1   0    i64
~>   ULT64          0-1   0    i64
~>   UGT64***       0-0   0    i64
~>   UGT64**        1-1   0    i64
~>   UGT64          0-1   0    i64
~>   SLT64***       0-0   0    i64
~>   SLT64**        1-1   0    i64
~>   SLT64          0-1   0    i64
~>   SGT64***       0-0   0    i64
~>   SGT64**        1-1   0    i64
~>   SGT64          0-1   0    i64
~>   EQ64***        0-0   0    i64
~>   EQ64**         1-1   0    i64
~>   EQ64           0-1   0    i64
~>   OR64***        0-0   0    i64
~>   OR64**         1-1   0    i64
~>   OR64           0-1   0    i64
~>   XOR64***       0-0   0    i64
~>   XOR64**        1-1   0    i64
~>   XOR64          0-1   0    i64
~>   NOT64LH        0-0   0    i64
~>   NOT64HL        0-0   0    i64
~>   NOT64H         1-1   0    i64
~>   NOT64          0-1   0    i64
~>   NEG64LH        0-0   0    i64
~>   NEG64HL        0-0   0    i64
~>   NEG64H         1-1   0    i64
~>   NEG64          0-1   0    i64

# 32-bit floating point instructions
~>   ADDF32         0-1   0    f32
~>   SUBF32         0-1   0    f32
~>   MULF32         0-1   0    f32
~>   DIVF32         0-1   0    f32
~>   LTF32          0-1   0    f32
~>   GTF32          0-1   0    f32
~>   LEF32          0-1   0    f32
~>   GEF32          0-1   0    f32
~>   EQF32          0-1   0    f32
~>   CEILF32        0-1   0    f32
~>   FLOORF32       0-1   0    f32
~>   TRUNCF32U64    0-1   0    f32
~>   TRUNCF32S64    0-1   0    f32
~>   TRUNCF32U      0-1   0    f32
~>   TRUNCF32S      0-1   0    f32
~>   TRUNCF32       0-1   0    f32
~>   NEARESTF32     0-1   0    f32
~>   SQRTF32        0-1   0    f32
~>   CONVF32U64     0-1   0    f32
~>   CONVF32S64     0-1   0    f32
~>   CONVF32U       0-1   0    f32
~>   CONVF32S       0-1   0    f32

# 64-bit floating point instructions
~>   ADDF64         0-1   0    f64
~>   SUBF64         0-1   0    f64
~>   MULF64         0-1   0    f64
~>   DIVF64         0-1   0    f64
~>   LTF64          0-1   0    f64
~>   GTF64          0-1   0    f64
~>   LEF64          0-1   0    f64
~>   GEF64          0-1   0    f64
~>   EQF64          0-1   0    f64
~>   CEILF64        0-1   0    f64
~>   FLOORF64       0-1   0    f64
~>   TRUNCF64U64    0-1   0    f64
~>   TRUNCF64S64    0-1   0    f64
~>   TRUNCF64       0-1   0    f64
~>   NEARESTF64     0-1   0    f64
~>   SQRTF64        0-1   0    f64
~>   DEMOTE         0-1   0    f32f64
~>   PROMOTE        0-1   0    f32f64
~>   CONVF64U64     0-1   0    f64
~>   CONVF64S64     0-1   0    f64

# Directives
~>   .DATA8         0-    0    -
~>   .DATA16        0-    0    -
~>   .DATA32        0-    0    -
~>   .DATA64        0-    0    -
~>   .ADDR          1-1   0    -
~>   .ALIGN         1-1   0    -
~>   .TRAMPOLINE    1-1   0    -
~>   .REF           0-    0    -
~>   .LOCAL         -     0    -
~>   .BEGIN         -     0    -
~>   .END           0-0   0    -
~>   .PRAGMA        -     0    -
~>   .ASSERT        -     0    -
~>   .UID           -     0    -
# .MTABLE unique_id, min_bits, max_bits, signed, ...
~>   .MTABLE        4-    0    -
`;


function createInstrById() {
    let res1 = instrInfoTextTable
        .split('\n')
        .filter(x => x.trim().length > 0 && !x.trim().startsWith('#'))
        .map(x => x.trim().split(/\s+/))
        .map((x, i) => ({
            name: x[1].toUpperCase(),
            args: x[2] == '-' ? null : x[2].split('-').map(y => y == '' ? 0x7FFFFFFF : parseInt(y)),
            withBase: !!parseInt(x[3]),
            condition: x[4],
            isDirective: x[1].startsWith('.'),
        }));
    let res2 = [];
    for (let instr of res1) {
        let variants;
        if (instr.name.endsWith('***')) {
            instr.name = instr.name.replace('***', '');
            variants = ['LLH', 'LHL', 'LHH', 'HLL', 'HLH', 'HHL'];
        } else if (instr.name.endsWith('**')) {
            instr.name = instr.name.replace('**', '');
            variants = ['LH', 'HL', 'HH'];
        } else {
            variants = [''];
        }
        for (let v of variants) {
            res2.push({ ...instr, id: res2.length, name: instr.name + v });
        }
    }
    return res2;
}


function createInstrByName() {
    return Object.fromEntries(instrInfoById.map(x => [x.name, x]));
}


function createInstr() {
    return Object.fromEntries(instrInfoById.map(x => [x.name.replace(/\./g, '_'), x.id]));
}


const instrInfoById = createInstrById();
const instrInfoByName = createInstrByName();
const INSTR = createInstr();

const BASE = {
    ZERO: 0,
    SP: 1,
    AMB0: 2,
    AMB1: 3,
    REG_MASK: 3,
    POP: 4,
};


export { instrInfoById, instrInfoByName, INSTR, BASE };
