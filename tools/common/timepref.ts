
import { platform } from './platform';

export class TimePref {

    public enabled: boolean = true;
    time: number;

    constructor() {
        this.time = platform.getHRTimer();
    }

    start() {
        this.time = platform.getHRTimer();
    }

    get() {
        return platform.getHRTimer() - this.time;
    }

    print(label?: string) {
        if (label) {
            console.log(label, this.get());
        } else {
            console.log(this.get());
        }
    }
}
