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
#   |1             |2    |3   |4     |5       | 6    |
#   |Name          |Args.|With|Cond- |Compiler|Opcode|
#   |              |num. |base|ition |class   |      |
#   |              |     |    |      |        |      |

# Core instructions
~>   BRT            0-1   0    -       -       0x00                                        
~>   BRF            0-1   0    -       -       0x01                                        
~>   ADD            0-1   0    -       sc      0x02                                        
~>   SUB            0-1   0    -       sc      0x03                                        
~>   MUL            0-1   0    -       sc      0x04                                        
~>   AND            0-1   0    -       sc      0x05                                        
~>   OR             0-1   0    -       sc      0x06                                        
~>   XOR            0-1   0    -       sc      0x07                                        
~>   UDIV           0-1   0    -       sc      0x08                                        
~>   SDIV           0-1   0    -       sc      0x09                                        
~>   UMOD           0-1   0    -       sc      0x0A                                        
~>   SMOD           0-1   0    -       sc      0x0B                                        
~>   SHL            0-1   0    -       sc      0x0C                                        
~>   EXTS           0-1   0    -       sc      0x0D                                        
~>   USHR           0-1   0    -       sc      0x0E                                        
~>   SSHR           0-1   0    -       sc      0x0F                                        
~>   ULT            0-1   0    -       sc      0x10                                        
~>   UGT            0-1   0    -       sc      0x11                                        
~>   SLT            0-1   0    -       sc      0x12                                        
~>   SGT            0-1   0    -       sc      0x13                                        
~>   EQ             0-1   0    -       sc      0x14                                        
~>   NOT            0-1   0    -       sc      0x15                                        
~>   NEG            0-1   0    -       sc      0x16                                        
~>   CALL           0-1   0    -       -       0x17                                        
~>   BR             0-1   0    -       -       0x18                                        
~>   WRITESP        0-1   0    -       sc      0x1A                                        
~>   READSP         0-0   0    -       -       0x1B                                        
~>   UNWIND         0-2   0    unwind  -       0x1C                                        
~>   HOST           0-1   0    -       sc      0x1D                                        

# Read/Write instructions
~>   READ8S         0-1   1    -       -       0                                                                                                  
~>   READ8          0-1   1    -       -       0                                                                                                  
~>   READ16S        0-1   1    -       -       0                                                                                                  
~>   READ16         0-1   1    -       -       0                                                                                                  
~>   READ32         0-1   1    -       -       0                                                                                                  
~>   READ64         0-1   1    mem64   -       0                                                                                                      
~>   WRITE8         0-1   1    -       -       0                                                                                                  
~>   WRITE16        0-1   1    -       -       0                                                                                                  
~>   WRITE32        0-1   1    -       -       0                                                                                                  
~>   WRITE64        0-1   1    mem64   -       0                                                                                                      

# 64-bit integer instructions
~>   ADD64***       0-0   0    i64     -       0                                                                                                    
~>   ADD64**        1-1   0    i64     -       0                                                                                                    
~>   ADD64          0-1   0    i64     -       0                                                                                                    
~>   SUB64***       0-0   0    i64     -       0                                                                                                    
~>   SUB64**        1-1   0    i64     -       0                                                                                                    
~>   SUB64          0-1   0    i64     -       0                                                                                                    
~>   MUL64***       0-0   0    i64     -       0                                                                                                    
~>   MUL64**        1-1   0    i64     -       0                                                                                                    
~>   MUL64          0-1   0    i64     -       0                                                                                                    
~>   AND64***       0-0   0    i64     -       0                                                                                                    
~>   AND64**        1-1   0    i64     -       0                                                                                                    
~>   AND64          0-1   0    i64     -       0                                                                                                    
~>   UDIV64***      0-0   0    i64     -       0                                                                                                    
~>   UDIV64**       1-1   0    i64     -       0                                                                                                    
~>   UDIV64         0-1   0    i64     -       0                                                                                                    
~>   SDIV64***      0-0   0    i64     -       0                                                                                                    
~>   SDIV64**       1-1   0    i64     -       0                                                                                                    
~>   SDIV64         0-1   0    i64     -       0                                                                                                    
~>   UMOD64***      0-0   0    i64     -       0                                                                                                    
~>   UMOD64**       1-1   0    i64     -       0                                                                                                    
~>   UMOD64         0-1   0    i64     -       0                                                                                                    
~>   SMOD64***      0-0   0    i64     -       0                                                                                                    
~>   SMOD64**       1-1   0    i64     -       0                                                                                                    
~>   SMOD64         0-1   0    i64     -       0                                                                                                    
~>   SHL64***       0-0   0    i64     -       0                                                                                                    
~>   SHL64**        1-1   0    i64     -       0                                                                                                    
~>   SHL64          0-1   0    i64     -       0                                                                                                    
~>   EXTS64***      0-0   0    i64     -       0                                                                                                    
~>   EXTS64**       1-1   0    i64     -       0                                                                                                    
~>   EXTS64         0-1   0    i64     -       0                                                                                                    
~>   USHR64***      0-0   0    i64     -       0                                                                                                    
~>   USHR64**       1-1   0    i64     -       0                                                                                                    
~>   USHR64         0-1   0    i64     -       0                                                                                                    
~>   SSHR64***      0-0   0    i64     -       0                                                                                                    
~>   SSHR64**       1-1   0    i64     -       0                                                                                                    
~>   SSHR64         0-1   0    i64     -       0                                                                                                    
~>   ULT64***       0-0   0    i64     -       0                                                                                                    
~>   ULT64**        1-1   0    i64     -       0                                                                                                    
~>   ULT64          0-1   0    i64     -       0                                                                                                    
~>   UGT64***       0-0   0    i64     -       0                                                                                                    
~>   UGT64**        1-1   0    i64     -       0                                                                                                    
~>   UGT64          0-1   0    i64     -       0                                                                                                    
~>   SLT64***       0-0   0    i64     -       0                                                                                                    
~>   SLT64**        1-1   0    i64     -       0                                                                                                    
~>   SLT64          0-1   0    i64     -       0                                                                                                    
~>   SGT64***       0-0   0    i64     -       0                                                                                                    
~>   SGT64**        1-1   0    i64     -       0                                                                                                    
~>   SGT64          0-1   0    i64     -       0                                                                                                    
~>   EQ64***        0-0   0    i64     -       0                                                                                                    
~>   EQ64**         1-1   0    i64     -       0                                                                                                    
~>   EQ64           0-1   0    i64     -       0                                                                                                    
~>   OR64***        0-0   0    i64     -       0                                                                                                    
~>   OR64**         1-1   0    i64     -       0                                                                                                    
~>   OR64           0-1   0    i64     -       0                                                                                                    
~>   XOR64***       0-0   0    i64     -       0                                                                                                    
~>   XOR64**        1-1   0    i64     -       0                                                                                                    
~>   XOR64          0-1   0    i64     -       0                                                                                                    
~>   NOT64LH        0-0   0    i64     -       0                                                                                                    
~>   NOT64HL        0-0   0    i64     -       0                                                                                                    
~>   NOT64H         1-1   0    i64     -       0                                                                                                    
~>   NOT64          0-1   0    i64     -       0                                                                                                    
~>   NEG64LH        0-0   0    i64     -       0                                                                                                    
~>   NEG64HL        0-0   0    i64     -       0                                                                                                    
~>   NEG64H         1-1   0    i64     -       0                                                                                                    
~>   NEG64          0-1   0    i64     -       0                                                                                                    

# 32-bit floating point instructions
~>   ADDF32         0-1   0    f32     -       0                                                                                                    
~>   SUBF32         0-1   0    f32     -       0                                                                                                    
~>   MULF32         0-1   0    f32     -       0                                                                                                    
~>   DIVF32         0-1   0    f32     -       0                                                                                                    
~>   LTF32          0-1   0    f32     -       0                                                                                                    
~>   GTF32          0-1   0    f32     -       0                                                                                                    
~>   LEF32          0-1   0    f32     -       0                                                                                                    
~>   GEF32          0-1   0    f32     -       0                                                                                                    
~>   EQF32          0-1   0    f32     -       0                                                                                                    
~>   CEILF32        0-1   0    f32     -       0                                                                                                    
~>   FLOORF32       0-1   0    f32     -       0                                                                                                    
~>   TRUNCF32U64    0-1   0    f32     -       0                                                                                                    
~>   TRUNCF32S64    0-1   0    f32     -       0                                                                                                    
~>   TRUNCF32U      0-1   0    f32     -       0                                                                                                    
~>   TRUNCF32S      0-1   0    f32     -       0                                                                                                    
~>   TRUNCF32       0-1   0    f32     -       0                                                                                                    
~>   NEARESTF32     0-1   0    f32     -       0                                                                                                    
~>   SQRTF32        0-1   0    f32     -       0                                                                                                    
~>   CONVF32U64     0-1   0    f32     -       0                                                                                                    
~>   CONVF32S64     0-1   0    f32     -       0                                                                                                    
~>   CONVF32U       0-1   0    f32     -       0                                                                                                    
~>   CONVF32S       0-1   0    f32     -       0                                                                                                    

# 64-bit floating point instructions
~>   ADDF64         0-1   0    f64     -       0                                                                                                    
~>   SUBF64         0-1   0    f64     -       0                                                                                                    
~>   MULF64         0-1   0    f64     -       0                                                                                                    
~>   DIVF64         0-1   0    f64     -       0                                                                                                    
~>   LTF64          0-1   0    f64     -       0                                                                                                    
~>   GTF64          0-1   0    f64     -       0                                                                                                    
~>   LEF64          0-1   0    f64     -       0                                                                                                    
~>   GEF64          0-1   0    f64     -       0                                                                                                    
~>   EQF64          0-1   0    f64     -       0                                                                                                    
~>   CEILF64        0-1   0    f64     -       0                                                                                                    
~>   FLOORF64       0-1   0    f64     -       0                                                                                                    
~>   TRUNCF64U64    0-1   0    f64     -       0                                                                                                    
~>   TRUNCF64S64    0-1   0    f64     -       0                                                                                                    
~>   TRUNCF64       0-1   0    f64     -       0                                                                                                    
~>   NEARESTF64     0-1   0    f64     -       0                                                                                                    
~>   SQRTF64        0-1   0    f64     -       0                                                                                                    
~>   DEMOTE         0-1   0    f32f64  -       0                                                                                                       
~>   PROMOTE        0-1   0    f32f64  -       0                                                                                                       
~>   CONVF64U64     0-1   0    f64     -       0                                                                                                    
~>   CONVF64S64     0-1   0    f64     -       0                                                                                                    

# Directives
~>   .DATA8         0-    0    -       -       0                                                                                                  
~>   .DATA16        0-    0    -       -       0                                                                                                  
~>   .DATA32        0-    0    -       -       0                                                                                                  
~>   .DATA64        0-    0    -       -       0                                                                                                  
~>   .ADDR          1-1   0    -       -       0                                                                                                  
~>   .ALIGN         1-1   0    -       -       0                                                                                                  
~>   .TRAMPOLINE    1-1   0    -       -       0                                                                                                  
~>   .REF           0-    0    -       -       0                                                                                                  
~>   .LOCAL         -     0    -       -       0                                                                                                  
~>   .BEGIN         -     0    -       -       0                                                                                                  
~>   .END           0-0   0    -       -       0                                                                                                  
~>   .PRAGMA        -     0    -       -       0                                                                                                  
~>   .ASSERT        -     0    -       -       0                                                                                                  
~>   .UID           -     0    -       -       0                                                                                                  
# .MTABLE unique_id, min_bits, max_bits, signed, ...
~>   .MTABLE        4-    0    -       -       0                                                                                                  
`;


function createInstrById() {
    let res1 = instrInfoTextTable
        .split('\n')
        .filter(x => x.trim().length > 0 && !x.trim().startsWith('#'))
        .map(x => x.trim().split(/\s+/))
        .map((x, i) => ({
            id: i,
            name: x[1].toUpperCase(),
            args: x[2] == '-' ? null : x[2].split('-').map(y => y == '' ? 0x7FFFFFFF : parseInt(y)),
            withBase: !!parseInt(x[3]),
            condition: x[4],
            isDirective: x[1].startsWith('.'),
            instrClass: x[5].split('-')[0],
            instrClassParams: x[5].split('-').slice(1),
            opcode: parseInt(x[6]),
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
