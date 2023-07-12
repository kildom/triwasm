import { platform } from "./platform";


export class Path {
    private parts: string[];
    private root: string | undefined;
    private sep: string;
    public constructor(path?: string);
    public constructor(root: string | undefined, parts: string[]);
    public constructor(path_or_root?: string, parts?: string[]) {
        this.sep = platform.isWindows ? '\\' : '/';
        if (parts !== undefined) {
            this.root = path_or_root;
            this.parts = parts;
        } else {
            let p = path_or_root || platform.scriptFile;
            p = p.replace(/[\\\/]+$/, '');
            this.parts = p.split(/[\\\/]+/);
            let isAbsolute = (platform.isWindows ? /^[A-Z]:$/i : /^$/).test(this.parts[0]);
            if (isAbsolute) {
                this.root = this.parts[0];
                this.parts.splice(0, 1);
            } else {
                this.root = undefined;
            }
        }
        this.normalize();
    }
    private normalize(): void {
        let result: string[] = [];
        for (let part of this.parts) {
            if (part == '.') {
                // skip current dir
            } else if (part == '..' && result.length) {
                result.splice(result.length - 1);
            } else {
                result.push(part);
            }
        }
        this.parts = result;
    }
    public parent(): Path {
        return this.join('..');
    }
    public join(...newParts: string[]): Path {
        let all: string[] = [];
        for (let part of newParts) {
            all.push(...part.split(/[\\\/]+/).filter(x => x.length));
        }
        return new Path(this.root, [...this.parts, ...all]);
    }
    public toString(): string {
        if (this.root !== undefined) {
            return this.parts.length ? [this.root, ...this.parts].join(this.sep) : this.root + this.sep;
        } else {
            return this.parts.length ? this.parts.join(this.sep) : '.';
        }
    }
}

console.log(new Path('/usr/bin/').toString());
console.log(new Path('usr/bin/').parent().toString());
console.log(new Path('./usr/../../bin/').toString());
console.log(new Path('a/..').toString());
console.log(new Path('.').toString());
console.log(new Path('/').toString());
console.log(new Path('/bin\\..').toString());
console.log(new Path('/..').toString());

console.log(new Path().toString());
console.log(new Path().parent().toString());
