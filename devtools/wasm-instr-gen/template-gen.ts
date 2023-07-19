
import * as fs from 'node:fs';
import * as path from 'node:path';

function templateToCode(text: string): string {
    let code = ('%>' + text.trim() + '<%').replace(/%>([\s\S]*?)<%(?!=)/g, (_, m) => {
        let concat = ('%>' + m + '<%=').replace(/\s*%>([\s\S]*?)<%=\s*/g, (_, m2) => {
            return ')+' + JSON.stringify(m2) + '+(';
        });
        while (concat.at(-1) != '"') {
            concat = concat.substring(0, concat.length - 1);
        }
        while (concat[0] != '"') {
            concat = concat.substring(1);
        }
        if (concat != '""') {
            return `output.push(${concat});`;
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
