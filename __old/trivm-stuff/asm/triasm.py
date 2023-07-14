
import sys
import os
import binascii
import textwrap
import argparse
import re
from struct import pack

import jinja2
import jinja2.sandbox
import jinja2.exceptions
import jinja2.utils

VERSION = 'triVM asm v. 0.1.0'

simple_instr = {
	'ADD':   2, 'SUB':   3, 'MUL':   4, 'AND':   5,
	'OR':    6, 'XOR':   7, 'UDIV':  8, 'SDIV':  9,
	'UMOD': 10, 'SMOD': 11, 'SHL':  12, 'USHR': 13,
	'SSHR': 14, 'EXTS': 15, 'EQ':   16, 'ULT':  17,
	'SLT':  18, 'READQ':19, 'WRITEQ':20,'NOT':  21,
	'NEG':  22, 'EXT':  29,
}

jump_instr = {
	'BRT': 0, 'BRF': 1, 'BR': 23, 'CALL': 24,
}

predefined_constants = {
	'TMP0': 0, 'TMP00': 0, 'TMP01': 1, 'TMP02':     2, 'TMP03':        3,
	'TMP1': 4, 'TMP10': 4, 'TMP11': 5, 'TMP12':     6, 'TMP13':        7,
	'TMP2': 8, 'TMP20': 8, 'TMP21': 9, 'TMP22':    10, 'TMP23':       11,
	'SP':  12, 'LP':   16, 'PC':   20, 'ROM_BASE': 24, 'STACK_LIMIT': 28,
}


CODE_INSTR_FLAG  = (1 << 7)
CODE_INSTR_ARG_4B = 0
CODE_INSTR_ARG_2B = 1
CODE_INSTR_ARG_1B = 2
CODE_INSTR_ARG_POP = 3 

CODE_MEM_EXT_FLAG = (1 << 2)
CODE_MEM_WORD_FLAG = (1 << 5)
CODE_MEM_WRITE_FLAG = (1 << 6)

CODE_MEM_BASE_SP = (3 << 3)
CODE_MEM_BASE_LP = (1 << 3)
CODE_MEM_BASE_ZERO = (0 << 3)
CODE_MEM_BASE_POP = (2 << 3)


class CompilerException(Exception):
	def __init__(self, text):
		super().__init__(text)


class GenericInstr:
	def __init__(self, compiler, line_no, initial_size):
		self.compiler = compiler
		self.line_no = line_no
		self.addr = 0
		self.initial_size = initial_size
		self.opcode = b''
		self.end_addr = -1

	def _get_opcode(self, min_size):
		raise Exception('Call of Abstract method')

	def generate(self, addr):
		self.addr = addr
		self.opcode = self._get_opcode(max(0, self.end_addr - self.addr))
		self.end_addr = addr + len(self.opcode)
		return len(self.opcode)


class OneByteInstr(GenericInstr):
	def __init__(self, compiler, line_no, code):
		super().__init__(compiler, line_no, 1)
		self.code = code

	def _get_opcode(self, min_size):
		return pack('<B', CODE_INSTR_FLAG | (self.code << 2) | CODE_INSTR_ARG_POP)


class SimpleInstr(GenericInstr):
	def __init__(self, compiler, line_no, code, param):
		super().__init__(compiler, line_no, 2)
		self.code = code
		self.param = param

	def _get_opcode(self, min_size):
		param = self.compiler.eval_expression(self.param)
		if -128 <= param and param <= 127 and min_size <= 2:
			arg = CODE_INSTR_ARG_1B
			result = pack('<b', param)
		elif -32768 <= param and param <= 32767 and min_size <= 3:
			arg = CODE_INSTR_ARG_2B
			result = pack('<h', param)
		elif min_size <= 5:
			arg = CODE_INSTR_ARG_4B
			result = pack('<L', param & 0xFFFFFFFF)
		else:
			raise Exception('Internal error')
		result = pack('<B', CODE_INSTR_FLAG | (self.code << 2) | arg) + result
		return result


class JumpInstr(GenericInstr):
	def __init__(self, compiler, line_no, code, param):
		super().__init__(compiler, line_no, 2)
		self.code = code
		self.param = param

	def _get_opcode(self, min_size):
		param_abs = self.compiler.eval_expression(self.param)
		prev_base = -1
		base = self.addr + min_size
		while prev_base != base:
			param = param_abs - base
			if -128 <= param and param <= 127 and min_size <= 2:
				arg = CODE_INSTR_ARG_1B
				result = pack('<b', param)
			elif -32768 <= param and param <= 32767 and min_size <= 3:
				arg = CODE_INSTR_ARG_2B
				result = pack('<h', param)
			elif min_size <= 5:
				arg = CODE_INSTR_ARG_4B
				result = pack('<L', param & 0xFFFFFFFF)
			else:
				raise Exception('Internal error')
			result = pack('<B', CODE_INSTR_FLAG | (self.code << 2) | arg) + result
			prev_base = base
			min_size = len(result)
			base = self.addr + min_size
		return result


class MemInstr(GenericInstr):
	def __init__(self, compiler, line_no, code, base, param):
		super().__init__(compiler, line_no, 1)
		self.code = code
		self.base = base
		self.param = param

	def _get_opcode(self, min_size):
		param = self.compiler.eval_expression(self.param)
		if self.base == CODE_MEM_BASE_ZERO:
			limits = (-512, 511)
		else:
			limits = (0, 1023)
		if self.code & CODE_MEM_WORD_FLAG:
			limits = (4 * limits[0], 4 * limits[1])
		if limits[0] > param or param > limits[1]:
			raise CompilerException(f'Invalid range for memory access {param:X}')
		if self.code & CODE_MEM_WORD_FLAG:
			if param & 3:
				raise CompilerException(f'Memory word access offset {param:X} must be word aligned')
			param >>= 2
		param &= 0x3FF

		if param <= 3 and min_size <= 1:
			return pack('<B', self.code | self.base | param)
		else:
			return pack('<BB', self.code | self.base | CODE_MEM_EXT_FLAG | (param & 3), param >> 2)


class AddressPseudoInstr(GenericInstr):
	def __init__(self, compiler, line_no, param):
		super().__init__(compiler, line_no, 0)
		self.param = param

	def _get_opcode(self, min_size):
		param = self.compiler.eval_expression(self.param)
		if param < self.addr:
			raise CompilerException(f'Address cannot be moved backwars, expected 0x{param:X}, current 0x{self.addr:X}')
		if param - self.addr < min_size:
			raise CompilerException(f'Internal error')
		return b'\0' * (param - self.addr)


class FillPseudoInstr(GenericInstr):
	def __init__(self, compiler, line_no, param):
		super().__init__(compiler, line_no, 0)
		self.param = param

	def _get_opcode(self, min_size):
		param = self.compiler.eval_expression(self.param)
		return b'\0' * param


class Compiler:
	def __init__(self):
		self._instructions = []
		self._labels = []
		self._assignments = []
		self._errors = []
		self._constants = predefined_constants.copy()

	def _check_name_used(self, name):
		for (n, _, _) in self._labels:
			if name == n:
				raise CompilerException('Name already in use by a label')
		for (n, _, _) in self._assignments:
			if name == n:
				raise CompilerException('Name already in use by an assignment')
		for n in self._constants.keys():
			if name == n:
				raise CompilerException('Name already in use by a build-in constant')

	def _add_label(self, m, line_no):
		self._check_name_used(m.group(1))
		self._labels.append((m.group(1), len(self._instructions), line_no))

	def _add_assign(self, m, line_no):
		self._check_name_used(m.group(1))
		self._assignments.append((m.group(1), m.group(2), line_no))

	def _add_one_byte_instr(self, m, line_no):
		name = m.group(1).upper()
		if name in simple_instr:
			code = simple_instr[name]
		else:
			code = jump_instr[name]
		self._instructions.append(OneByteInstr(self, line_no, code))

	def _add_simple_instr(self, m, line_no):
		code = simple_instr[m.group(1).upper()]
		param = m.group(2)
		self._instructions.append(SimpleInstr(self, line_no, code, param))

	def _add_exit_instr(self, m, line_no):
		self._instructions.append(SimpleInstr(self, line_no, 30, '0'))

	def _add_jump_instr(self, m, line_no):
		code = jump_instr[m.group(1).upper()]
		param = m.group(2)
		self._instructions.append(JumpInstr(self, line_no, code, param))

	def _add_mem_instr(self, m, line_no):
		code = CODE_MEM_WRITE_FLAG if m.group(1).upper() == 'WRITE' else 0
		code |= CODE_MEM_WORD_FLAG if m.group(2).upper() == '' else 0
		if m.group(3) is None:
			base = CODE_MEM_BASE_ZERO
		elif m.group(3).upper() == 'SP':
			base = CODE_MEM_BASE_SP
		elif m.group(3).upper() == 'LP':
			base = CODE_MEM_BASE_LP
		else:
			base = CODE_MEM_BASE_POP
		self._instructions.append(MemInstr(self, line_no, code, base, m.group(4)))

	def _add_address_pseudo_instr(self, m, line_no):
		self._instructions.append(AddressPseudoInstr(self, line_no, m.group(1)))

	def _add_fill_pseudo_instr(self, m, line_no):
		self._instructions.append(FillPseudoInstr(self, line_no, m.group(1)))

	def _skip_comment(self, m, line_no):
		pass

	def _handle_exception(self, err, line_no = None):
		if isinstance(err, CompilerException) or isinstance(err, jinja2.exceptions.TemplateError):
			if line_no is None:
				self._errors.append(str(err))
			else:
				self._errors.append(f'{str(err)} on line {line_no}')
		else:
			if line_no is None:
				self._errors.append(f'Unhandled exception `{str(err)}`')
			else:
				self._errors.append(f'Unhandled exception `{str(err)}` on line {line_no}')

	def _parse(self, source_code):
		match_list = [
			(self._skip_comment,             r'^#|$'),
			(self._add_label,                r'^([A-Z_0-9]+)\s*:$'),
			(self._add_assign,               r'^([A-Z_0-9]+)\s*=\s*(.+)$'),
			(self._add_one_byte_instr,       r'^(' + '|'.join(list(simple_instr.keys()) + list(jump_instr.keys())) + r')$'),
			(self._add_simple_instr,         r'^(' + '|'.join(simple_instr.keys()) + r')\s+(.+)$'),
			(self._add_jump_instr,           r'^(' + '|'.join(jump_instr.keys()) + r')\s+(.+)$'),
			(self._add_exit_instr,           r'^EXIT$'),
			(self._add_mem_instr,            r'^(READ|WRITE)(B?)\s+(?:\[(SP|LP|POP)\]\s*\+\s*)?([^\[\]]+)$'),
			(self._add_address_pseudo_instr, r'^ADDRESS\s+(.+)$'),
			(self._add_fill_pseudo_instr,    r'^FILL\s+(.+)$'),
		]
		line_no = 0
		for line in source_code.splitlines():
			line_no += 1
			try:
				line = line.strip()
				for match in match_list:
					m = re.match(match[1], line, re.I)
					if m:
						match[0](m, line_no)
						break
				else:
					raise CompilerException(f'Unknown command')
			except Exception as err:
				self._handle_exception(err, line_no)

	def _prepare(self):
		# Assign addresses to operations based on their initial sizes
		addr = self.base
		for instr in self._instructions:
			instr.addr = addr
			addr += instr.initial_size

	def _get_addr_of_instr(self, index):
		if index == len(self._instructions):
			instr = self._instructions[len(self._instructions) - 1]
			if instr.end_addr >= 0:
				return instr.end_addr
			else:
				return instr.addr + instr.initial_size
		else:
			return self._instructions[index].addr


	def _build(self):
		# Reset contants to initial state
		self._constants = predefined_constants.copy()
		# Add address of each label based on its assumed address
		for (name, value, line_no) in self._labels:
			self._constants[name] = self._get_addr_of_instr(value)
		# Evaluate expression for each assign
		for (name, expr, line_no) in self._assignments:
			try:
				self._constants[name] = self.eval_expression(expr)
			except Exception as err:
				self._handle_exception(err, line_no)
		# Generate code for each operation
		addr = self.base
		for instr in self._instructions:
			try:
				addr += instr.generate(addr)
			except Exception as err:
				self._handle_exception(err, instr.line_no)
		# Check if all assumed label addresses were correct
		labels_valid = True
		for (name, value, line_no) in self._labels:
			if self._constants[name] != self._get_addr_of_instr(value):
				labels_valid = False
				break
		# Return True if no more reruns are needed
		return labels_valid

	def compile(self, source_code, base=None):
		try:
			self.base = base or 0
			self._parse(source_code)
			self._prepare()
			for i in range (0, 128):
				if self._build() or len(self._errors):
					break
			else:
				raise CompilerException('Cannot resolve labels')
		except Exception as err:
			self._handle_exception(err)
		return len(self._errors) == 0

	def get_errors(self):
		return self._errors

	def get_bytecode(self):
		return b''.join([instr.opcode for instr in self._instructions])

	def get_constants(self):
		return self._constants

	def eval_expression(self, expr):
		expr = re.sub(r'0x[0-9A-F]+', lambda m: str(int(m.group(0), base=0)), expr, flags=re.I)
		env = jinja2.sandbox.SandboxedEnvironment(undefined=jinja2.StrictUndefined)
		template = env.from_string('{{ (' + expr + ') }}')
		text = template.render(**self._constants)
		return int(text)

def write_c(bytecode, file):
	(_, file_name) = os.path.split(file)
	(file_base_name, _) = os.path.splitext(file_name)
	name = file_base_name.upper()
	name = re.compile('[^a-z0-9]', re.IGNORECASE).sub('_', name)
	name = f'{name}_BYTES'
	head_def = file_name.upper()
	head_def = re.compile('[^a-z0-9]', re.IGNORECASE).sub('_', head_def)
	new_line = '\r\n'
	indent = '    '
	text = binascii.hexlify(bytecode).decode("utf-8")
	src = f"#ifndef {head_def}{new_line}"
	src += f"#define {head_def}{new_line}{new_line}"
	src += f"#define {name}"
	for line in textwrap.wrap(text, 16):
		src += f' \\{new_line}{indent}'
		src2 = ''
		for byte in textwrap.wrap(line, 2):
			src2 += f'0x{byte}, '
		src += src2[0:-1]
	src += f"{new_line}{new_line}#endif /* {head_def} */{new_line}"
	f = open(file, 'w')
	f.write(src)
	f.close()

def main():
	parser = argparse.ArgumentParser(description='Do a triVM assembly.', add_help=False)
	parser.add_argument('input', type=str, help='Input source file')
	parser.add_argument('-b', '--output-bin', metavar='file', type=str, help='Output raw binary file')
	parser.add_argument('-c', '--output-c', metavar='file', type=str, help='Output C header file')
	parser.add_argument('-o', '--base', metavar='address', type=str, help='Base address where bytecode should start')
	parser.add_argument('--version', action='version', version=VERSION, help='Show version information')
	parser.add_argument('--help', action='help', help='Show this help message and exit')
	args = parser.parse_args()
	#args = parser.parse_args(['/dk/baremetal/asm/test.trivm'])

	try:
		f = open(args.input, 'r')
		source_code = f.read()
		f.close()
	except:
		print(f'Cannot read from `{args.input}`', file=sys.stderr)
		exit(3)

	try:
		c = Compiler()
		if c.compile(source_code, args.base):
			bytecode = c.get_bytecode()
		else:
			for e in c.get_errors():
				print(e, file=sys.stderr)
			exit(1)
	except Exception as err:
		print(f'Internal compilation error `{str(err)}`', file=sys.stderr)
		exit(4)

	if args.output_bin is not None:
		try:
			f = open(args.output_bin, 'wb')
			f.write(bytecode)
			f.close()
		except:
			print(f'Cannot write to `{args.output_bin}`', file=sys.stderr)
			exit(2)

	if args.output_c is not None:
		try:
			write_c(bytecode, args.output_c)
		except:
			print(f'Cannot write to `{args.output_c}`', file=sys.stderr)
			exit(2)

	if args.output_bin is None and args.output_c is None:
		print('\n'.join(textwrap.wrap(binascii.hexlify(bytecode).decode("utf-8"), 32)))


if __name__ == "__main__":
	main()

