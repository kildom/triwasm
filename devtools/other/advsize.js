const fs = require('fs');
const path = require('path');

let map = fs.readFileSync('blinky.map', 'utf-8');

let flashFiles = {};
let ramFiles = {};
let flashSymbols = {};
let ramSymbols = {};
let flashPadding = 0;
let ramPadding = 0;
let flashSize = 0;
let ramSize = 0;

let ops = 0;

function addSymbol(files, symbols, sec, addr, size, basename) {

	if (sec.startsWith('.bss.')) sec = sec.substr(5);
	if (sec.startsWith('.text.')) sec = sec.substr(6);
	if (sec.startsWith('.data.')) sec = sec.substr(6);
	if (sec.startsWith('.rodata.')) sec = sec.substr(8);
	name = `${sec} [${basename}]`;

	if (!(sec in symbols)) {
		symbols[sec] = { name: name, sec: sec, addr: addr, size: 0 };
	}

	let s = symbols[sec];
	s.addr = Math.min(s.addr, addr);
	s.size += size;

	if (!(basename in files)) {
		files[basename] = { name: basename, size: 0, items: [] };
	}

	let f = files[basename];
	f.size += size;
	f.items.push(s);
}

map.replace(/\n[\t ]+([^\s]+)\r?\n?[\t ]+(0x00000000[0-9A-F]{8})\s+(0x[0-9A-F]+)([\t ]+[^\r\n]+)?/img, (str, sec, addrStr, sizeStr, file) => {
	addr = Number.parseInt(addrStr);
	size = Number.parseInt(sizeStr);
	if (sec.startsWith('.debug')) return;
	if (sec.startsWith('.comment')) return;
	if (sec.startsWith('.ARM.attributes')) return;
	if (addr == 0) return;
	if (size == 0) return;
	if (addr >= 0x30000000) return;
	let isRam = (addr >= 0x20000000);
	let isFlash = (sec.startsWith('.data') || !isRam);
	if (sec == "*fill*") {
		if (isFlash) flashPadding += size;
		if (isRam) ramPadding += size;
		return;
	}
	let basename = path.basename(file);
	if (isFlash) {
		addSymbol(flashFiles, flashSymbols, sec, addr, size, basename);
		flashSize += size;
	}
	if (isRam) {
		addSymbol(ramFiles, ramSymbols, sec, addr, size, basename);
		ramSize += size;
	}
});

function printStats(name, files, symbols, size, padding)
{
	let ops = 0;
	console.log(`${name} SYMBOLS:`);
	let list = Object.values(symbols).sort((a, b) => (b.size - a.size));
	for (let symbol of list) {
		console.log(`${symbol.size}    ${symbol.name}`);
		if (symbol.name.startsWith('op_')) {
			ops += symbol.size;
		}
	}
	console.log(`${name} FILES:`);
	list = Object.values(files).sort((a, b) => (b.size - a.size));
	for (let file of list) {
		console.log(`${file.size}    ${file.name}`);
		let list2 = file.items.sort((a, b) => (b.size - a.size));
		for (let i = 0; i < 5 && i < list2.length; i++) {
			symbol = list2[i];
			console.log(`    ${symbol.size}    ${symbol.sec}`);
		}
		if (list2.length > 5)
		{
			console.log('    ...');
		}
	}
	console.log(`${name} SIZE:`);
	console.log(`    used size:    ${size}`);
	console.log(`    padding size: ${padding}`);
	console.log(`    total size:   ${size + padding}`);
	console.log(`    ops:          ${ops}`);
}

printStats("FLASH", flashFiles, flashSymbols, flashSize, flashPadding);
printStats("RAM", ramFiles, ramSymbols, ramSize, ramPadding);
