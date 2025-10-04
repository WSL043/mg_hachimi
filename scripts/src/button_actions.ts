import { Instance } from "cs_script/point_script";
import { HachimiGame } from "./hachimi";
import { C, JudgeOpt, Opt } from "./constants";

function onSongItemHit(index: number) {
    return () => {
        const inst = HachimiGame.instance;
        if (!inst || !inst.postInited || !inst.musicStopped) {
            return;
        }

        const mindex = inst.songList.calcIndexForItem(index);
        inst.songList.setIndex(mindex);
        inst.clearStatus();
    }
}

function greenNumberAdd(num: number) {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    inst.trackTime += num;

    if (inst.trackTime < 0.01) {
        inst.trackTime = 0.01;
    } else if (inst.trackTime > 5) {
        inst.trackTime = 5;
    }

    const greenNumber = Math.floor((inst.trackTime * 1000 * 3) / 5);
    Instance.EntFireAtName({
        name: "maodie_green_num_text",
        input: "SetMessage",
        value: `${greenNumber}F`
    });
    Instance.EntFireAtName({
        name: "maodie_speed_text",
        input: "SetMessage",
        value: `${(inst.speed / 10).toFixed(2)} inch/s`
    });
}

function judgeOffsetAdd(num: number) {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    inst.judgeOffset += num;

    if (inst.judgeOffset < -1) {
        inst.judgeOffset = -1;
    } else if (inst.judgeOffset > 1) {
        inst.judgeOffset = 1;
    }

    const ms = Math.floor(inst.judgeOffset * 1000);
    Instance.EntFireAtName({
        name: "maodie_judge_offset_text",
        input: "SetMessage",
        value: `${ms}ms`
    });
}

export function initButtonActions(ctx: Context) {
    for (let i = 0; i < 12; i++) {
        const item = Instance.FindEntityByName(`song_item_${i}`);
        if (!item) {
            continue;
        }

        Instance.ConnectOutput(item, "Use", onSongItemHit(i));
        Instance.ConnectOutput(item, "OnTakeDamage", onSongItemHit(i));
    }

    Instance.OnScriptInput("ToggleWeaponSpread", () => {
        ctx.spread = !ctx.spread;

        Instance.ServerCommand("weapon_accuracy_nospread " + (ctx.spread ? '0' : '1'));
        Instance.EntFireAtName({
            name: "weapon_spread_display",
            input: "SetMessage",
            value: ctx.spread ? 'ON' : 'OFF'
        });
    });

    Instance.OnScriptInput("ToggleHitmarker", () => {
        const inst = HachimiGame.instance;
        if (!inst) {
            return;
        }

        inst.hitmarker = !inst.hitmarker;
        Instance.EntFireAtName({
            name: "hitmarker_display",
            input: "SetMessage",
            value: inst.hitmarker ? 'ON' : 'OFF'
        });
    });

    Instance.OnScriptInput("ToggleAutoPlay", () => {
        const inst = HachimiGame.instance;
        if (!inst || !inst.musicStopped) {
            return;
        }

        inst.autoplay = !inst.autoplay;
        Instance.EntFireAtName({
            name: "autoplay_display",
            input: "SetMessage",
            value: inst.autoplay ? 'ON' : 'OFF'
        });
    });

    Instance.OnScriptInput("ToggleJudgeOption", () => {
        const inst = HachimiGame.instance;
        if (!inst || !inst.postInited || !inst.musicStopped) {
            return;
        }

        if (inst.judgeOption + 1 > JudgeOpt.Easy) {
            inst.judgeOption = JudgeOpt.Normal;
        } else {
            inst.judgeOption = inst.option + 1;
        }

        Instance.EntFireAtName({
            name: "judge_opt_display",
            input: "SetMessage",
            value: C.JUDGE_OPTION_TO_TEXT[inst.judgeOption] ?? 'NORMAL'
        });
    });

    Instance.OnScriptInput("ToggleOption", () => {
        const inst = HachimiGame.instance;
        if (!inst || !inst.postInited || !inst.musicStopped) {
            return;
        }

        if (inst.option + 1 > Opt.S_Random) {
            inst.option = Opt.Off;
        } else {
            inst.option = inst.option + 1;
        }

        Instance.EntFireAtName({
            name: "option_display",
            input: "SetMessage",
            value: C.OPTION_TO_TEXT[inst.option] ?? 'OFF'
        });
    });

    Instance.OnScriptInput("HachimiStart", () => {
        const inst = HachimiGame.instance;
        if (!inst) {
            return;
        }

        inst.start();
    });

    Instance.OnScriptInput("StopMusic", () => {
        const inst = HachimiGame.instance;
        if (!inst || !inst.postInited || inst.musicStopped) {
            return;
        }

        inst.stop();
    });

    Instance.OnScriptInput("HachimiGreenNumSub", () => {
        greenNumberAdd(-0.05);
    });

    Instance.OnScriptInput("HachimiGreenNumPlus", () => {
        greenNumberAdd(0.05);
    });

    Instance.OnScriptInput("HachimiJudgeOffsetSub", () => {
        judgeOffsetAdd(-0.002);
    });

    Instance.OnScriptInput("HachimiJudgeOffsetPlus", () => {
        judgeOffsetAdd(0.002);
    });
}
