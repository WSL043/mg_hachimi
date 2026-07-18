import { Instance } from "cs_script/point_script";

export class JudgeTipController {
    lastSetTime = 0;
    private visible = false;

    constructor(
        private targetname: string,
    ) {
        Instance.EntFireAtName({
            name: this.targetname,
            input: "Disable",
        });
    }

    onTick() {
        if (this.visible && Instance.GetGameTime() - this.lastSetTime > 1) {
            Instance.EntFireAtName({
                name: this.targetname,
                input: "Disable",
            });
            this.visible = false;
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
            input: "Enable",
        });
        this.visible = true;
    }
}
