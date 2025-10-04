import { Instance } from "cs_script/point_script";

export class HitmarkerController {
    constructor(
        private readonly targetName: string
    ) { }

    started = false;
    requestedStart = false;

    show() {
        this.requestedStart = true;
    }

    onTick() {
        if (this.started) {
            Instance.EntFireAtName({
                name: this.targetName,
                input: "Stop"
            });
            this.started = false;
            return;
        }

        if (this.requestedStart) {
            this.requestedStart = false;
            Instance.EntFireAtName({
                name: this.targetName,
                input: "Start",
            });
            this.started = true;
        }
    }
}
