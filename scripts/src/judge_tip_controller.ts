import { Instance } from "cs_script/point_script";

export class JudgeTipController {
    lastSetTime = 0;

    constructor(
        private targetname: string,
    ) {
        Instance.EntFireAtName({
            name: this.targetname,
            input: "SetScale",
            value: 0
        });
    }

    onTick() {
        const now = Instance.GetGameTime();
        if (now - this.lastSetTime > 1) {
            if (now - this.lastSetTime < 1.2) {
                const scale = 1.0 - ((now - this.lastSetTime - 1) / 0.2);
                Instance.EntFireAtName({
                    name: this.targetname,
                    input: "SetScale",
                    value: scale
                });
            } else if (now - this.lastSetTime < 1.3) {
                Instance.EntFireAtName({
                    name: this.targetname,
                    input: "SetScale",
                    value: 0
                });
            }
        }
    }

    setText(text: string) {
        this.lastSetTime = Instance.GetGameTime();
        Instance.EntFireAtName({
            name: this.targetname,
            input: 'SetMessage',
            value: text
        });
        Instance.EntFireAtName({
            name: this.targetname,
            input: 'SetScale',
            value: 1
        });
    }
}
