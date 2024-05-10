
import * as fs from 'node:fs';
import { globSync } from 'glob';


/* cre`
    begin-of-text
    repeat whitespace
    {
        // empty line
    } or {
        ">"
        variant: repeat any
    } or {
        repeat whitespace
        "#"
        repeat any
    } or {
        glob: lazy-repeat any
        optional {
            ":"
            prefix: lazy-repeat any
            "=>"
            replacement: lazy-repeat any
        }
    }
    end-of-text
`*/
const globFileLineRe = /^\s*(?:|>(?<variant>.*)|\s*#.*|(?<glob>.*?)(?::(?<prefix>.*?)=>(?<replacement>.*?))?)$/su;

interface GlobFileLine {
    glob?: string;
    prefix?: string;
    replacement?: string;
    variant?: string;
}

let copyList = Object.create(null) as { [key: string]: string; };
let commonList = copyList;
let variants = Object.create(null) as { [key: string]: { [key: string]: string; }; };

for (let line of fs.readFileSync('devtools/pack/globs.txt', 'utf-8').split('\n')) {
    let groups = line.match(globFileLineRe)?.groups as unknown as GlobFileLine;
    if (!groups) {
        console.error('Invalid glob file in line: ' + line);
        process.exit(1);
    }
    groups.glob = groups.glob?.trim();
    groups.prefix = groups.prefix?.trim();
    groups.replacement = groups.replacement?.trim();
    groups.variant = groups.variant?.trim();
    if (groups.variant) {
        copyList = Object.create(null);
        for (let name in commonList) {
            copyList[name] = commonList[name];
        }
        variants[groups.variant] = copyList;
        continue;
    }
    if (!groups.glob) {
        continue;
    }
    if (groups.glob.startsWith('!')) {
        for (let file of globSync(groups.glob.substring(1), {dot: true})) {
            file = file.replace(/\\/g, '/');
            delete copyList[file];
        }
    } else {
        for (let file of globSync(groups.glob, {dot: true})) {
            file = file.replace(/\\/g, '/');
            if (!groups.prefix) {
                copyList[file] = file;
            } else if (groups.prefix.startsWith('!')) {
                let counter = parseInt(groups.prefix.substring(1));
                let fileRel = file;
                while (counter > 0) {
                    let pos = fileRel.indexOf('/');
                    if (pos < 0) {
                        console.error(`Invalid prefix "${groups.prefix}" for file "${file}" in line: ${line}`);
                        process.exit(1);
                    }
                    fileRel = fileRel.substring(pos + 1);
                    counter--;
                    copyList[file] = groups.replacement + fileRel;
                }
            } else {
                if (!file.startsWith(groups.prefix)) {
                    console.error(`Invalid prefix "${groups.prefix}" for file "${file}" in line: ${line}`);
                    process.exit(1);
                }
                copyList[file] = groups.replacement + file.substring(groups.prefix.length);
            }
        }
    }
}

let packageData = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

console.log('#!/bin/bash');
console.log('set -e');
console.log('rm -Rf temp/dist || true');
for (let [variant, list] of Object.entries(variants)) {
    console.log(`echo Processing ${variant}...`);
    console.log('rm -Rf temp/pack');
    console.log('mkdir temp/pack');
    for (let [from, to] of Object.entries(list)) {
        if (fs.statSync(from).isDirectory()) {
            console.log(`mkdir -p "temp/pack/${to}"`);
        }
    }
    for (let [from, to] of Object.entries(list)) {
        if (fs.statSync(from).isFile()) {
            console.log(`mkdir -p \`dirname "temp/pack/${to}"\` && cp "${from}" "temp/pack/${to}"`);
        }
    }
    console.log(`devtools/pack/create_zip.sh ${variant} ${packageData.version} ${variant === 'any' ? 'zip' : '7z'}`);
}
