
import * as fs from 'node:fs';
import * as path from 'node:path';

let source = '/* eslint-disable max-len */\n/* eslint-disable quotes */\n';
let outputFile = process.argv[2];
for (let i = 3; i < process.argv.length; i++) {
    let inputFile = process.argv[i];
    let data = fs.readFileSync(inputFile, 'utf8');
    let name = path.basename(inputFile).replace(/[^a-z0-9]+/gi, '_').toUpperCase();
    source += `export const ${name} = ${JSON.stringify(data)};\n`;
}
fs.writeFileSync(outputFile, source);
