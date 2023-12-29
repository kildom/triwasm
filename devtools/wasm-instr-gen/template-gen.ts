
import * as fs from 'node:fs';
import * as path from 'node:path';

function templateToCode(text: string): string {
    let code = ('%>' + text.trim() + '<%').replace(/%>([\s\S]*?)<%(?!=)/g, (_, m) => {
        let code2 = m
            .split(/<%=(.*?)%>/)
            .map((v: string, i: number) => (i % 2) === 0 ? `print(${JSON.stringify(v)});` : `print(${v});`)
            .join('\n');
        if (code2 !== 'print("");') {
            return code2;
        } else {
            return '';
        }
    });
    return code;
}

let inputFile = process.argv[2];
let template = fs.readFileSync(inputFile, 'utf-8');
let code = templateToCode(template);
let resultFile = path.join(path.dirname(inputFile), path.basename(inputFile, path.extname(inputFile)) + '.ts');
fs.writeFileSync(resultFile, code);
