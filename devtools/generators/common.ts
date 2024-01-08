import * as fs from 'node:fs';
import * as path from 'node:path';

const tempPath = 'temp';

const filesProcessed = new Set<string>();

function replaceOutput(text: string, content: string, indent: string, title: string): string {
    let header = `// ---- ${title} - begin - generated with help of script ----`;
    let footer = `// ---- ${title} - end - generated with help of script ----`;
    content = content.replace(/^(\s*\n)+/, '').trimEnd();
    try {
        let [a, b, c] = text.split(header);
        if (!b || c) throw null;
        let [d, e, f] = text.split(footer);
        if (!e || f) throw null;
        let begin = a + header;
        let end = footer + e;
        return begin + '\n\n' + content + '\n\n' + indent + end;
    } catch (ex) {
        console.error(`Cannot fit "${title}" to the output.`);
        console.error('Add following lines:');
        console.error(`    ${header}`);
        console.error(`    ${footer}`);
        process.exit(1);
    }
}

export function writeOutput(origFile: string, manual: boolean, content: string, indent: string, title: string) {
    let manualFile = path.join(tempPath, path.basename(origFile));
    fs.mkdirSync(tempPath, { 'recursive': true });
    if (manual) {
        let text: string;
        if (filesProcessed.has(origFile)) {
            text = fs.readFileSync(manualFile, 'utf8');
        } else {
            text = fs.readFileSync(origFile, 'utf8');
            filesProcessed.add(origFile);
        }
        text = replaceOutput(text, content, indent, title);
        fs.writeFileSync(manualFile, text);
    } else {
        let text = fs.readFileSync(origFile, 'utf8');
        text = replaceOutput(text, content, indent, title);
        fs.writeFileSync(origFile, text);
        if (filesProcessed.has(origFile)) {
            text = fs.readFileSync(manualFile, 'utf8');
            text = replaceOutput(text, content, indent, title);
            fs.writeFileSync(manualFile, text);
        }
    }
}

