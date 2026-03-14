import { Instance } from "cs_script/point_script";
import { HachimiGame } from "./hachimi";
import { C, JudgeOpt, Opt } from "./constants";
import { AlterPlayerSave } from "./player_save";

function onSongItemHit(index: number) {
    return () => {
        const inst = HachimiGame.instance;
        if (!inst || !inst.postInited || !inst.musicStopped) {
            return;
        }

        const mindex = inst.songList.calcIndexForItem(index);
        inst.songList.setIndex(mindex);
        inst.clearStatus();

        AlterPlayerSave(s => s.selectedMusicIndex = mindex);
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

    AlterPlayerSave(s => s.trackTime = inst.trackTime);
    inst.updateOptionTexts();
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

    AlterPlayerSave(s => s.judgeOffset = inst.judgeOffset);
    inst.updateOptionTexts();
}

export function initButtonActions() {
    for (let i = 0; i < 12; i++) {
        const item = Instance.FindEntityByName(`song_item_${i}`);
        if (!item) {
            continue;
        }

        Instance.ConnectOutput(item, "Use", onSongItemHit(i));
        Instance.ConnectOutput(item, "OnTakeDamage", onSongItemHit(i));
    }

    Instance.OnScriptInput("ToggleWeaponSpread", () => {
        const ctx = AlterPlayerSave(s => s.weaponSpread = !s.weaponSpread);

        Instance.ServerCommand("weapon_accuracy_nospread " + (ctx.weaponSpread ? '0' : '1'));

        HachimiGame.instance?.updateOptionTexts();
    });

    Instance.OnScriptInput("ToggleHitmarker", () => {
        const inst = HachimiGame.instance;
        if (!inst) {
            return;
        }

        inst.hitmarker = !inst.hitmarker;
        AlterPlayerSave(s => s.hitmarker = inst.hitmarker);
        inst.updateOptionTexts();
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
            inst.judgeOption = inst.judgeOption + 1;
        }

        AlterPlayerSave(s => s.judgeOption = inst.judgeOption);
        inst.updateOptionTexts();
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

        AlterPlayerSave(s => s.chartOption = inst.option);
        inst.updateOptionTexts();
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
