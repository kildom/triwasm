/*

The author disclaims copyright to this source code.

*/

const https = require('https');
const fs = require('fs');

const userAgent = 'Simple-Download-Script/1.0';
const apiTags = 'https://api.github.com/repos/sqlite/sqlite/git/refs/tags';
const lemon = 'https://raw.githubusercontent.com/sqlite/sqlite/$$$/tool/lemon.c';
const lempar = 'https://raw.githubusercontent.com/sqlite/sqlite/$$$/tool/lempar.c';


async function getURL(url) {
    return new Promise((resolve, reject) => {
        let result = [];
        let done = false;
        let req = https.request(url, { headers: { 'user-agent': userAgent } }, res => {
            if (res.statusCode != 200) {
                if (!done) reject(Error(`Invalid HTTPS code ${res.statusCode}`));
                done = true;
            }
            res.on('data', d => {
                result.push(d);
            });
            res.on('end', () => {
                if (!done) resolve(Buffer.concat(result).toString());
                done = true;
            });
        });
        req.on('error', error => {
            if (!done) reject(error);
            done = true;
        });
        req.end();
    });
}

async function update() {
    let tags = JSON.parse(await getURL(apiTags));
    let refs = [];
    for (let tag of tags) {
        let m = tag.ref.match(/^refs\/tags\/version-([0-9]+(?:\.[0-9]+)+)$/i);
        if (m) {
            refs.push([m[1], tag]);
        }
    }
    refs.sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true, sensitivity: 'base' }));
    let latest = refs[0][1].object.sha;
    console.log(`Latest version: ${refs[0][1].ref}`);
    console.log(`Latest sha: ${latest}`);
    let lemonSrc = await getURL(lemon.replace('$$$', latest));
    let lemparSrc = await getURL(lempar.replace('$$$', latest));
    let lemonDst = fs.readFileSync('lemon.c', 'utf-8');
    let lemparDst = fs.readFileSync('lempar.c', 'utf-8');
    if (lemonSrc == lemonDst && lemparSrc == lemparDst) {
        console.log('The lemon is up to date.');
        process.exit(0);
    }
    console.log('The lemon is changed.');
    fs.writeFileSync('lemon.c', lemonSrc);
    fs.writeFileSync('lempar.c', lemparSrc);
    process.exit(1);
}

async function main() {
    try {
        await update();
    } catch (ex) {
        console.error(ex);
    }
    process.exit(2);
}

main();
