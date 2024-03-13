
import { writeOutput } from './common';

interface Best {
    value: bigint;
    mem: number;
    math: number;
    memMax: bigint;
    negative: boolean;
    fallback?: boolean;
}

let bestPositive: Best[] = [];
let bestNegative: Best[] = [];

function bigIntMax(...args: bigint[]) { return args.reduce((m, e) => e > m ? e : m); }
function bigIntMin(...args: bigint[]) { return args.reduce((m, e) => e < m ? e : m); }

function processCase(align: number, postfixSize: number, memInstrBytes: number, mathInstrBytes: number) {
    let memInstrBits = (memInstrBytes - 1) * 7 - postfixSize;
    let memInstrMax = (memInstrBytes === 1) ? 5n : (1n << BigInt(memInstrBits)) - 1n;
    let mathInstrBits = (mathInstrBytes - 1) * 8;
    let mathInstrMax =
        (mathInstrBytes === 5) ? 0xFFFFFFFFn :
            (mathInstrBytes === 0) ? 0n :
                1n << BigInt(mathInstrBits - 1);
    let max = bigIntMin(0xFFFFFFFFn, BigInt(align) * memInstrMax + mathInstrMax);
    let totalCodeBytes = memInstrBytes + mathInstrBytes;
    let currentBest = bestPositive[totalCodeBytes];
    if (currentBest.value < max) {
        currentBest.value = max;
        currentBest.mem = memInstrBytes;
        currentBest.math = mathInstrBytes;
        currentBest.memMax =  bigIntMin(0xFFFFFFFFn, BigInt(align) * memInstrMax);
    }

    if (mathInstrBytes < 5) {
        currentBest = bestNegative[totalCodeBytes];
        let min = bigIntMax(-0xFFFFFFFFn, -(mathInstrMax - 1n));
        if (currentBest.value > min) {
            currentBest.value = min;
            currentBest.mem = memInstrBytes;
            currentBest.math = mathInstrBytes;
            currentBest.memMax = 0n;
        }
    }
}

let output = 'const unalignedSizes: Dict<UnalignedInstrSizeDesc[]> = {\n';

function formatItem(best: Best) {
    output += `        { value: ${best.value}n, mem: ${best.mem}, math: ${best.math}, memMax: ${best.memMax}n, `;
    if (best.negative) {
        output += 'negative: true, ';
    }
    if (best.fallback) {
        output += 'fallback: true, ';
    }
    output += '},\n';
}

function createEntry(short: boolean, align: number, postfixSize: number, aligned: boolean) {
    let id = `${short ? 'short' : 'long'}Align${align}Postfix${postfixSize}${aligned ? 'Aligned' : 'Unaligned'}`;
    output += `    ${id}: [\n`;
    bestPositive = bestPositive
        .filter((best, i, arr) => best.value !== 0n && best.value > bigIntMax(...arr.slice(0, i).map(x => x.value)));
    let index = 0;
    while (bestPositive[index].value < 0xFFFFFFFFn) {
        let best = bestPositive[index++];
        formatItem({ ...best });
    }
    let fullRange = bestPositive[index];
    bestNegative = bestNegative
        .filter((best, i, arr) => best.value !== 0n &&
            best.math + best.mem < fullRange.math + fullRange.mem &&
            best.value < bigIntMin(...arr.slice(0, i).map(x => x.value)));
    bestNegative.reverse();
    let prev = fullRange;
    for (let best of bestNegative) {
        formatItem({ ...prev, value: 0xFFFFFFFFn + best.value, fallback: (prev === fullRange) });
        prev = best;
    }
    formatItem({ ...prev, value: 0xFFFFFFFFn });
    output += '    ],\n';
}

for (let short of [false, true]) {
    for (let align of [1, 2, 4]) {
        for (let postfixSize of [1, 2, 3]) {
            for (let aligned of [false, true]) {
                bestPositive = new Array(6 + 5 + 1)
                    .fill(undefined).map(() => ({ value: 0n, mem: 0, math: 0, memMax: 0n, negative: false }));
                bestNegative = new Array(6 + 5 + 1)
                    .fill(undefined).map(() => ({ value: 0n, mem: 0, math: 0, memMax: 0n, negative: true }));
                for (let memInstrBytes of short ? [6, 5, 4, 3, 2, 1] : [6, 5, 4, 3, 2]) {
                    for (let mathInstrBytes of aligned ? [0, 2, 3, 5] : [2, 3, 5]) {
                        processCase(align, postfixSize, memInstrBytes, mathInstrBytes);
                    }
                }
                createEntry(short, align, postfixSize, aligned);
            }
        }
    }
}

output += '};\n';

writeOutput('tools/asm/instructions.ts', false, output, '', 'Unaligned memory access optimal instruction sizes');
