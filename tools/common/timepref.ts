
let startSeconds: number | undefined = undefined;

function getTime() {
    let [seconds, nanoseconds] = process.hrtime();
    if (startSeconds === undefined) {
        startSeconds = seconds;
    }
    return (seconds - startSeconds) * 1000 + nanoseconds / 1000000;
}

export class TimePref {

    public enabled: boolean = true;
    time: number;

    constructor() {
        this.time = getTime();
    }

    start() {
        this.time = getTime();
    }

    get() {
        return getTime() - this.time;
    }

    print(label?: string) {
        if (label) {
            console.log(label, this.get());
        } else {
            console.log(this.get());
        }
    }
}
