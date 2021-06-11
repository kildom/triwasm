#ifndef _INSTR_DESC_HH_
#define _INSTR_DESC_HH_

#include "common.hh"

#include "WasmData.hh"

extern Array$<InstrDesc$> instrDescTable;
extern Array$<InstrDesc$> extInstrDescTable;

static const u32 INSTR_CODE_BLOCK = 0x02;
static const u32 INSTR_CODE_LOOP = 0x03;
static const u32 INSTR_CODE_IF = 0x04;
static const u32 INSTR_CODE_ELSE = 0x05;
static const u32 INSTR_CODE_END = 0x0B;
static const u32 INSTR_CODE_BR_TABLE = 0x0E;
static const u32 INSTR_CODE_SELECT_ANNOTATED = 0x1C;
static const u32 INSTR_CODE_EXT = 0xFC;

#endif /* _INSTR_DESC_HH_ */
