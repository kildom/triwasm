
import random
import defines
import importlib
from os.path import dirname
import subprocess

from struct import pack, unpack, pack_into, unpack_from

class Empty: pass

_ = Empty()

runs = []

def _load_compiler():
	global Compiler
	spec = importlib.util.spec_from_file_location('triasm', dirname(__file__) + '/../asm/triasm.py')
	module = importlib.util.module_from_spec(spec)
	spec.loader.exec_module(module)
	Compiler = module.Compiler

_load_compiler()

class TestException(Exception):
	pass

class VMInstance:
	_reg_names = {
		'tmp0': 0,
		'tmp1': 1,
		'tmp2': 2,
		'sp' : 3,
		'lp' : 4,
		'pc' : 5,
		'rom_base' : 6,
		'stack_limit': 7,
	}

	def __init__(self, ram_size = 128, rom_size = 128, rom_read_only = True):
		self.ram_size = ram_size
		self.rom_size = rom_size
		self.read_only_rom = rom_read_only
		self.ram = bytearray([random.randint(0, 255) for i in range(0, ram_size)])
		self.rom = bytearray([random.randint(0, 255) for i in range(0, rom_size)])
		self.sp = ram_size - defines.CODE_POP_MAX
		self.pc = 0
		self.stack_limit = defines.VM_REGS_RAM_SIZE + defines.FAULT_HANDLER_MAX_STACK

	def __getattr__(self, name):
		if name not in VMInstance._reg_names:
			raise AttributeError
		return unpack_from('<L', self.ram, 4 * VMInstance._reg_names[name])[0]

	def __setattr__(self, name, value):
		if name not in VMInstance._reg_names:
			return object.__setattr__(self, name, value)
		pack_into('<L', self.ram, 4 * VMInstance._reg_names[name], value)

	def write(self, addr, value):
		value = pack('<L', value & 0xFFFFFFFF)
		self.ram[addr:addr+4] = value

	def writeb(self, addr, value):
		self.ram[addr:addr+4] = value & 0xFF

	def write_file(self, file, data):
		f = open(file, 'wb')
		f.write(pack('<QLLL',
			data,
			self.rom_size,
			self.ram_size,
			1 if self.read_only_rom else 0))
		f.write(self.ram)
		f.write(self.rom)
		f.close()

	def read_file(self, file):
		f = open(file, 'rb')
		buf = f.read()
		(data, rom_size, ram_size, read_only_rom) = unpack_from('<QLLL', buf, 0)
		self.rom_size = rom_size
		self.ram_size = ram_size
		assert defines.HEADER_SIZE + ram_size + rom_size == len(buf)
		self.read_only_rom = (read_only_rom != 0)
		self.ram = bytearray(buf[defines.HEADER_SIZE:defines.HEADER_SIZE+ram_size])
		self.rom = bytearray(buf[defines.HEADER_SIZE+ram_size:defines.HEADER_SIZE+ram_size+rom_size])
		return data

	def copy(self, other = None):
		if other == None:
			src = self
			dst = VMInstance()
		else:
			src = other
			dst = self
		dst.ram_size = src.ram_size
		dst.rom_size = src.rom_size
		dst.read_only_rom = src.read_only_rom
		dst.ram = bytearray(src.ram)
		dst.rom = bytearray(src.rom)

	def __eq__(self, other):
		return (self.ram_size == other.ram_size and
			self.rom_size == other.rom_size and
			self.read_only_rom == other.read_only_rom and
			self.ram == other.ram and
			self.rom == other.rom)

	def _diff(self, text, a, b):
		if (a == b):
			return ''
		return f'{text}: 0x{a:#010x} != 0x{b:#010x}\n'

	def _mem_diff(self, text, offset, a, b, a_sp = -99, b_sp = -99):
		def _word_diff(offset, a, b):
			if a == b and not (a_sp - 8 <= offset <= a_sp + 8) and not (b_sp - 8 <= offset <= b_sp + 8):
				return ''
			diff_a = ''
			diff_b = ''
			for i in range(0, 4):
				if a[i] != b[i]:
					diff_a += f' -{a[i]:02X}-'
					diff_b += f' -{b[i]:02X}-'
				else:
					diff_a += f'  {a[i]:02X} '
					diff_b += f'  {b[i]:02X} '
			left = 'SP>' if offset == a_sp else '   '
			right = '   <SP' if offset == b_sp else ''
			return f'{left} {offset:6x} |{diff_a} |{diff_b}{right}\n'
		if a == b:
			return ''
		diff = f'{text}:\n'
		r = range(0, min(len(a), len(b)), 4)
		for i in r:
			diff += _word_diff(offset + i, a[i:i+4], b[i:i+4])
		return diff

	def get_diff(self, other):
		diff = ''
		diff += self._diff('ram_size', self.ram_size, other.ram_size)
		diff += self._diff('rom_size', self.rom_size, other.rom_size)
		diff += self._diff('read_only_rom', self.read_only_rom, other.read_only_rom)
		diff += self._diff('tmp0', self.tmp0, other.tmp0)
		diff += self._diff('tmp1', self.tmp1, other.tmp1)
		diff += self._diff('tmp2', self.tmp2, other.tmp2)
		diff += self._diff('sp', self.sp, other.sp)
		diff += self._diff('lp', self.lp, other.lp)
		diff += self._diff('pc', self.pc, other.pc)
		diff += self._diff('rom_base', self.rom_base, other.rom_base)
		diff += self._diff('stack_limit', self.stack_limit, other.stack_limit)
		diff += self._mem_diff('ROM', 0, self.rom, other.rom)
		diff += self._mem_diff('RAM',
			defines.VM_REGS_RAM_SIZE,
			self.ram[defines.VM_REGS_RAM_SIZE:],
			other.ram[defines.VM_REGS_RAM_SIZE:],
			self.sp,
			other.sp)
		return diff

def init(ram_size = 128, rom_size = 128, rom_read_only = True):
	global vm
	vm = VMInstance(ram_size, rom_size, rom_read_only)

def begin(steps, code):
	global vm, constants, runs
	# Add information about this run
	runs.append(Empty())
	runs[-1].id = len(runs)
	runs[-1].steps = steps
	runs[-1].code = code
	runs[-1].output = ''
	runs[-1].diff = ''
	# Compile the code
	compiler = Compiler()
	if compiler.compile(code, vm.pc):
		bytecode = compiler.get_bytecode()
	else:
		runs[-1].output = '\n'.join(compiler.get_errors())
		raise TestException('Compilation errors')
	# Write bytecode to vm state
	vm.rom[vm.pc:vm.pc+len(bytecode)] = bytecode
	# Write starting vm state to a file
	vm.write_file(dirname(__file__) + '/state.bin', steps)
	constants = compiler.get_constants()
	if 'final_pc' in constants:
		vm.pc = constants['final_pc']

def end(result):
	global vm, runs
	# Execute VM
	proc = subprocess.run([dirname(__file__) + '/test_main', dirname(__file__) + '/state.bin'], shell=False,
		stdout=subprocess.PIPE, stderr=subprocess.PIPE, encoding='utf-8')
	if proc.stdout != '':
		runs[-1].output += '--------------------- OUTPUT ---------------------\n'
		runs[-1].output += proc.stdout
	if proc.stderr != '':
		runs[-1].output += '--------------------- ERRORS ---------------------\n'
		runs[-1].output += proc.stderr
	runs[-1].output += '--------------------------------------------------\n'
	if proc.returncode != 0:
		raise TestException(f'Running triVM failed with code {proc.returncode}')
	vm2 = VMInstance()
	r = vm2.read_file(dirname(__file__) + '/state.bin')
	if vm != vm2:
		runs[-1].diff = vm.get_diff(vm2)
		raise TestException(f'Virtual machine state different than expected')
	expected_result = (r != 0)
	if result != expected_result:
		raise TestException(f'Result of running triVM is {r}, expected {expected_result}')

def full_stack(*args):
	sp_max = vm.ram_size - defines.CODE_POP_MAX
	vm.sp = sp_max - len(args) * defines.WORD_SIZE
	for i in range(0, len(args)):
		pack_into('<L', vm.ram, vm.sp + defines.WORD_SIZE * i, args[i])

def stack_change(*args):
	before = []
	after = []
	now = before
	for a in args:
		if a is _:
			now = after
		else:
			now.append(a)
	if now is before:
		after = before
		before = []
	for i in range(0, len(before)):
		vm.write(vm.sp - (len(before) - i) * defines.WORD_SIZE, before[i])
	for i in range(0, len(after)):
		vm.write(vm.sp + i * defines.WORD_SIZE, after[i])

def stack(delta):
	vm.sp -= delta * defines.WORD_SIZE
	return stack_change

def pc(delta):
	if type(delta) == str:
		vm.pc = constants[delta]
	else:
		vm.pc += delta

def tmp0(value):
	vm.tmp0 = value

def tmp1(value):
	vm.tmp1 = value

def tmp2(value):
	vm.tmp2 = value

def exception(ex_type, code, exception_pc = None):
	tmp0(ex_type)
	tmp1(code)
	vm.pc = defines.FAULT_ENTRY_OFFSET
	if exception_pc is not None:
		tmp2(exception_pc)
	elif 'exception_pc' in constants:
		tmp2(constants['exception_pc'])
