const fs = require('fs');
const { cpus } = require('os');
const { execSync } = require('child_process');


function testCase(name) {
    execSync(`make clean`, { stdio: 'inherit' });
    try {
        execSync(`make -j${cpus().length} TEST_BUILD_ERROR=${name}`, { stdio: 'inherit' });
        console.error(`Setting ${name} should break the test compilation!`);
        process.exit(1);
    } catch (ex) {
        if (ex.status > 0) {
            return;
        }
        console.error(`Unexpected compilation error!`);
        throw ex;
    }
}


function title(text) {
    console.log('\n\n===============================================================================');
    console.log(' '.repeat(Math.floor((79 - text.length) / 2)) + text);
    console.log('===============================================================================\n');
}


function checkFile(file) {
    if (!file.endsWith('.cpp') && !file.endsWith('.h')) return;
    let content = fs.readFileSync(file, {'encoding': 'utf-8'});
    const regexp = /#\s*if\s+(BUILD_ERROR_[A-Z_0-9]+)/ig;
    let m;
    while ((m = regexp.exec(content)) !== null) {
        cases[m[1]] = file;
    }
}


function walkDir(path) {
    for (let f of fs.readdirSync(path, { withFileTypes: true }))
    {
        if (f.name.startsWith('.')) continue;
        if (f.isDirectory()) {
            walkDir(`${path}/${f.name}`);
        } else if (f.isFile()) {
            checkFile(`${path}/${f.name}`);
        }
    }
}

let cases = {};

title('Verify correct build')
try {
    execSync(`make clean`, { stdio: 'inherit' });
    execSync(`make -j${cpus().length}`, { stdio: 'inherit' });
} catch (ex) {
    console.error('Cannot build valid case!');
    process.exit(2);
}

walkDir('.');

for (let [name, file] of Object.entries(cases)) {
    title(`${name} from ${file}`);
    testCase(name);
}

title('Done');

process.exit(0);
