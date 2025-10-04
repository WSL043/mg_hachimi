import { Instance } from "cs_script/point_script";

interface DelayAction {
    targetTime: number;
    resolve: () => void;
}

const onTicks: Array<() => void> = [];
let delayActions: DelayAction[] = [];

export function tickCallback() {
    for (const cb of onTicks) {
        cb();
    }

    delayActions = delayActions.filter(act => {
        if (act.targetTime > Instance.GetGameTime())
            return true;

        act.resolve();
        return false;
    });
}

export function scheduleTick(callback: () => void) {
    onTicks.push(callback);
}

export function delaySec(sec: number) {
    const targetTime = Instance.GetGameTime() + sec;
    return new Promise<void>((resolve) => {
        delayActions.push({ targetTime, resolve });
    });
}

export function delay(msec: number) {
    return delaySec(msec / 1000);
}

export function nextTick() {
    return new Promise<void>((resolve) => {
        delayActions.push({ targetTime: 0, resolve });
    });
}
