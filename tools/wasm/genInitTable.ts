/*
Special pseudo-directives for the memory initialization table:
..skip N - skip N bytes
..skip N, EXP - skip EXP bytes, maximum value of expression is N
..part N - start unbreakable part of the table with maximum size of N bytes
..part discardable N - start unbreakable discardable part of the table with maximum size of N bytes
..end - end part
..finalize - finalize memory initialization table pseudo-directives and set $_mem_init_final_skip
             to remaining number of skip bytes for the next block.
*/

import { CodeOutput } from './codeOutput';

const MAX_BLOCK_SKIP_BYTES = 253;
const MAX_BLOCK_SIZE = 255;

function* generateLines(input: string[]) {
    let index = 0;
    let line: string = '';
    do {
        let pos = line.indexOf('\n');
        if (pos < 0) {
            if (index >= input.length) {
                break;
            }
            line += input[index++];
        } else if (pos === line.length - 1) {
            yield line;
            line = '';
        } else {
            yield line.substring(0, pos + 1);
            line = line.substring(pos + 1);
        }
    } while (true);
}

export class InitTableGenerator {

    public output = new CodeOutput();

    private skipMax = 0;
    private skipExp = '0';
    private block: string[] = [];
    private blockMaxSize = 0;

    generate(input: string[]) {
        this.output = new CodeOutput();
        this.skipMax = 0;
        this.skipExp = '0';
        this.block = [];
        this.blockMaxSize = 0;

        let inBlock = false;
        let finalized = false;
        let discardable = false;

        for (let line of generateLines(input)) {
            let lineTrimmed = line.trim();
            if (!lineTrimmed.startsWith('..')) {
                if (inBlock) {
                    this.block.push(line);
                } else {
                    this.output.outputRaw(line);
                }
                continue;
            }
            let m: RegExpMatchArray | null;
            if ((m = lineTrimmed.match(/^\.\.skip\s+([0-9a-fx]+)(?:\s*,\s*([^#]+?))?\s*(?:#.*)?$/i))) {
                if (inBlock || finalized) {
                    throw new Error('Unexpected ..skip pseudo-directive');
                }
                this.finalizeBlock();
                this.skipMax += parseInt(m[1]);
                this.skipExp += ` + (${m[2] || m[1]})`;
            } else if ((m = lineTrimmed.match(/^\.\.part\s+(?:(discardable)\s+)?([0-9a-fx]+)\s*(?:#.*)?$/i))) {
                if (inBlock || finalized) {
                    throw new Error('Unexpected ..part pseudo-directive');
                }
                discardable = !!m[1];
                let maxSize = parseInt(m[2]);
                if (this.blockMaxSize + maxSize > MAX_BLOCK_SIZE) {
                    this.finalizeBlock();
                }
                if (discardable) {
                    this.output.output('.begin discardable');
                }
                inBlock = true;
            } else if ((m = lineTrimmed.match(/^\.\.end\s*(?:#.*)?$/i))) {
                if (!inBlock || finalized) {
                    throw new Error('Unexpected ..end pseudo-directive');
                }
                if (discardable) {
                    this.output.output('.end');
                }
                inBlock = false;
            } else if ((m = lineTrimmed.match(/^\.\.finalize\s*(?:#.*)?$/i))) {
                if (inBlock || finalized) {
                    throw new Error('Unexpected ..finalize pseudo-directive');
                }
                this.finalizeBlock();
                this.output.output(`$_mem_init_final_skip = ${this.skipExp}`);
            }
        }
        return '';
    }

    private finalizeBlock() {
        if (this.block.length > 0) {
            this.output.output('.begin movable $_memory_init_table');
            if (this.skipMax > MAX_BLOCK_SKIP_BYTES) {
                this.output.output(['.data8 255', `.data32 ${this.skipExp}`]);
            } else {
                this.output.output(`.data8 ${this.skipExp}`);
            }
            this.output.output([
                '.begin',
                '.data8 block_size() - 1',
                ...this.block,
                '.end',
                '.end']);
            this.skipMax = 0;
            this.skipExp = '0';
            this.block.splice(0);
            this.blockMaxSize = 0;
        }
    }

}
