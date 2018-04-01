export default class CountDownTimer {
    constructor(duration, granularity) {
        this.duration = duration;
        this.granularity = granularity;
        this.tickFns = [];
        this.running = false;
    }

    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        var tickerFn = () => {
            let diff = this.duration - (Date.now() - this.start);
            if (diff > 0) {
                setTimeout(tickerFn, this.granularity);
            } else {
                diff = 0;
                this.running = false;
            }
            this.tickFns.forEach((fn) => {
                fn(diff);
            });
        }
        this.start = Date.now();
        tickerFn();
    }

    get expired() {
        return !this.running();
    }

    addTickFn(fn) {
        this.tickFns.push(fn);
    }

}
