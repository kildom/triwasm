
import test_utils
from test_utils import _, init, begin, end, stack, pc, exception

def _TODO_test_ext_calls():
	init()
	# initial state
	begin(vm_steps)  # ==> state.bin
	# state expected before ext call
	ext_begin(expected_id) # ==? ext1.bin
	# state changed by ext call
	ext_end(return_value) # ==> ext1.bin
	# state expected at the end
	end(expected_exit) # ==? state.bin

def test_empty():
	init()
	begin(0, '')
	end(True)

def test_neg():
	init()

	begin(1, '''
		NEG -12345678
		final_pc:
	''')
	stack(+1)(12345678)
	end(True)
	
	begin(1, '''
		NEG 895623
		final_pc:
	''')
	stack(+1)(-895623)
	end(True)
	
	begin(1, '''
		NEG
		final_pc:
	''')
	stack(0)(895623)
	end(True)
	
	begin(3, '''
		NEG -128
		NEG -0x8000
		NEG -0x80000000
	''')
	stack(+3)(0x80000000, 0x8000, 128)
	pc(+10)
	end(True)

	begin(3, '''
		NEG 128
		NEG 0x8000
		NEG 0x80000000
	''')
	stack(+3)(-0x80000000, -0x8000, -128)
	pc(+13)
	end(True)

	begin(3, '''
		NEG 127
		NEG 0x7FFF
		NEG 0x7FFFFFFF
	''')
	stack(+3)(-0x7FFFFFFF, -0x7FFF, -127)
	pc(+10)
	end(True)

def test_add():
	init()

	begin(2, '''
		NEG -12345678
		ADD 32919343
		final_pc:
	''')
	stack(+1)(12345678 + 32919343)
	end(True)

	begin(3, '''
		NEG -489923
		NEG 90349
		ADD
		final_pc:
	''')
	stack(+1)(-90349, _, 489923 - 90349)
	end(True)

def test_sub():
	init()

	begin(2, '''
		NEG -12345678
		SUB 32919343
		final_pc:
	''')
	stack(+1)(12345678 - 32919343)
	end(True)

	begin(3, '''
		NEG -489923
		NEG 90349
		SUB
		final_pc:
	''')
	stack(+1)(-90349, _, 489923 + 90349)
	end(True)


def test_div0():
	init()
	pc(+10)
	begin(3, '''
		NEG -12345678
		NEG 0
		UDIV
		exception_pc:
	''')
	stack(+1)(0, _, 12345678)
	exception(7, 12345678)
	end(True)

def test_call():
	init()
	begin(1, f'''
		CALL final_pc
		return_addr:
		FILL 10
		final_pc:
	''')
	stack(+1)(test_utils.constants['return_addr'])
	end(True)

def test_cond_jumps():
	init()

	def test_single(value, cond, exp):
		begin(2, f'''
			NEG -{value}
			BR{cond} pc_J
			pc_N:
			FILL 10
			pc_J:
		''')
		stack(0)(value, _)
		pc(f'pc_{exp}')
		end(True)

	test_single(0, 'T', 'N')
	test_single(0, 'F', 'J')
	test_single(1, 'T', 'J')
	test_single(1, 'F', 'N')
	test_single(-1, 'T', 'J')
	test_single(-1, 'F', 'N')
	test_single(0x80000000, 'T', 'J')
	test_single(0x80000000, 'F', 'N')

def test_long_jumps():
	DUMMY_START = 7823

	def test_single(fill_size):
		init(128, 128 * 1024)
		pc(DUMMY_START)
		begin(1, f'''
			BR final_pc
			FILL {fill_size}
			final_pc:
		''')
		end(True)
		init(128, 128 * 1024)
		pc(DUMMY_START)
		begin(2, f'''
			BR instr_start
			final_pc:
			FILL {fill_size}
			instr_start:
			BR final_pc
		''')
		end(True)

	test_single(127)
	test_single(128)
	test_single(129)
	test_single(0x7FFF)
	test_single(0x8000)
	test_single(0x8001)
	test_single(0xC2A1)

def test_cond_long_jumps():
	DUMMY_START = 7823

	def test_single(fill_size, cond):
		init(128, 128 * 1024)
		pc(DUMMY_START)
		begin(2, f'''
			NEG 1
			BR{cond} final_pc_T
			final_pc_F:
			FILL {fill_size}
			final_pc_T:
		''')
		stack(0)(-1, _)
		pc(f'final_pc_{cond}')
		end(True)
		init(128, 128 * 1024)
		pc(DUMMY_START)
		begin(3, f'''
			NEG 1
			BR instr_start
			final_pc_T:
			FILL {fill_size}
			instr_start:
			BR{cond} final_pc_T
			final_pc_F:
		''')
		stack(0)(-1, _)
		pc(f'final_pc_{cond}')
		end(True)

	test_single(127, 'T')
	test_single(128, 'T')
	test_single(129, 'T')
	test_single(0x7FFF, 'T')
	test_single(0x8000, 'T')
	test_single(0x8001, 'T')
	test_single(0xC2A1, 'T')
	test_single(127, 'F')
	test_single(128, 'F')
	test_single(129, 'F')
	test_single(0x7FFF, 'F')
	test_single(0x8000, 'F')
	test_single(0x8001, 'F')
	test_single(0xC2A1, 'F')
