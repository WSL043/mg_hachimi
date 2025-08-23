/// <reference types="s2ts/types/cspointscript" />
import { Instance } from "cspointscript"
import { runServerCommand, game } from "s2ts/counter-strike"
import { charts, Music } from './musics';
import { HachimiGame } from "./hachimi";
import { C, JudgeOpt, Opt } from "./constants";

Instance.PublicMethod("HachimiInit", (suffix: string) => {
    const inst = HachimiGame.instance;
    if (!inst) {
        return;
    }

    inst.postInit();
    inst.updateMusic();
});

Instance.PublicMethod("HachimiStart", () => {
    const inst = HachimiGame.instance;
    if (!inst) {
        return;
    }

    inst.start();
});

class SongList {
    COUNT = 12;

    index: number = 0;

    _displayIndex: number = 0;
    _indexOffset: number = 0;

    targetArray = charts;

    private setItemProgress(index: number, progress: number) {
        Instance.EntFireAtName("animgraph_ctrl", "SetSongItem", `song_item_${index}`);
        Instance.EntFireAtName("animgraph_ctrl", 'SetSongItemProgress', progress);

        Instance.Msg(`set ${index} to ${progress}`);
    }

    private setItemAlpha(index: number, alpha: number) {
        Instance.EntFireAtName(`song_item_${index}`, "Alpha", alpha);
    }

    private setItemText(index: number, text: string) {
        Instance.EntFireAtName(`song_text_${index}`, "SetMessage", text);
    }

    private setItemTextScale(index: number, scale: number) {
        Instance.EntFireAtName(`song_text_${index}`, "SetScale", scale);
    }

    private calcIndexForItem(item: number) {
        let itemPos = Math.floor(item + this._displayIndex) % this.COUNT;
        const center = this.COUNT / 2 - 1;

        const offset = center - itemPos;
        let index = Math.floor(this._displayIndex + offset) + 1;

        if (index >= this.targetArray.length) {
            index %= this.targetArray.length;
        } else if (index < 0) {
            index = this.targetArray.length - (-index % this.targetArray.length);
        }

        return index;
    }

    onTick() {
        if (this._displayIndex == this.index) {
            return;
        }

        const velocity = (this.index - this._displayIndex) / 10;
        this._displayIndex += velocity;

        if (Math.abs(this._displayIndex - this.index) < 0.01) {
            this._displayIndex = this.index;
        }

        for (let i = 0; i < this.COUNT; i++) {
            const index = this.calcIndexForItem(i);

            let itemPos = (i + this._displayIndex) % this.COUNT;
            let progress = itemPos * (1 / this.COUNT);

            if (progress < 0.075) {
                this.setItemAlpha(i, 255 * progress / 0.075);
                this.setItemTextScale(i, 0);
            } else if (progress > 0.925) {
                this.setItemAlpha(i, 255 * (1.0 - progress) / 0.075);
                this.setItemTextScale(i, 0);
            } else {
                this.setItemAlpha(i, 255);
                this.setItemText(i, charts[index].name);

                if (progress > 0.45 && progress < 0.55) {
                    this.setItemTextScale(i, 1.0 + (1.0 - (Math.abs(0.5 - progress) / 0.05)) * 0.4);
                } else {
                    this.setItemTextScale(i, 1);
                }
            }

            this.setItemProgress(i, progress);
        }
    }
}

const list = new SongList();

Instance.PublicMethod("HachimiMusicPrev", () => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited || !inst.musicStopped) {
        return;
    }

    if (inst.musicIndex - 1 < 0) {
        inst.musicIndex = charts.length - 1;
    } else {
        inst.musicIndex--;
    }

    list.index = inst.musicIndex;

    inst.updateMusic();
    inst.clearStatus();
});

Instance.PublicMethod("HachimiMusicNext", () => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited || !inst.musicStopped) {
        return;
    }

    if (inst.musicIndex + 1 >= charts.length) {
        inst.musicIndex = 0;
    } else {
        inst.musicIndex++;
    }

    list.index = inst.musicIndex;

    inst.updateMusic();
    inst.clearStatus();
});

function updateSpeedUI(inst: HachimiGame) {
    const greenNumber = Math.floor((inst.trackTime * 1000 * 3) / 5);
    Instance.EntFireAtName("maodie_green_num_text", "SetMessage", `${greenNumber}F`);
    Instance.EntFireAtName("maodie_speed_text", "SetMessage", `${(inst.speed / 10).toFixed(2)} inch/s`);
};

Instance.PublicMethod("HachimiGreenNumAdd", (numStr: string) => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    inst.trackTime += parseFloat(numStr);

    if (inst.trackTime < 0.01) {
        inst.trackTime = 0.01;
    } else if (inst.trackTime > 5) {
        inst.trackTime = 5;
    }

    updateSpeedUI(inst);
});

function updateJudgeOffset(inst: HachimiGame) {
    const ms = Math.floor(inst.judgeOffset * 1000);
    Instance.EntFireAtName("maodie_judge_offset_text", "SetMessage", `${ms}ms`);
};

Instance.PublicMethod("HachimiJudgeOffsetAdd", (numStr: string) => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    inst.judgeOffset += parseFloat(numStr);

    if (inst.judgeOffset < -1) {
        inst.judgeOffset = -1;
    } else if (inst.judgeOffset > 1) {
        inst.judgeOffset = 1;
    }

    updateJudgeOffset(inst);
});

let currentMusic: Music = null!;
let offset = 0.0;

Instance.PublicMethod("Music_Begin", () => {
    currentMusic = {
        name: '',
        charter: '',
        sndEvent: '',
        monitorBodygroup: 0,
        sort: 99999999,
        chart: {
            BarLineList: [],
            NoteDataList: [],
            SoflanDataList: [{
                Time: -60,
                Speed: 1,
            }],
            WeaponDataList: []
        }
    };

    offset = 0;

    Instance.Msg("Clear currentMusic");
});

Instance.PublicMethod("Music_SetName", (name: string) => {
    currentMusic.name = name;
});

Instance.PublicMethod("Music_SetCharter", (name: string) => {
    currentMusic.charter = name;
});

Instance.PublicMethod("Music_SetSoundEvent", (name: string) => {
    currentMusic.sndEvent = name;
});

Instance.PublicMethod("Music_SetCover", (cover: string) => {
    currentMusic.monitorBodygroup = parseInt(cover);
});

Instance.PublicMethod("Music_SetBarLines", (barLines: string) => {
    currentMusic.chart.BarLineList = (JSON.parse(barLines) as number[]).map(v => v + offset);
});

Instance.PublicMethod("Music_SetOffset", (offsetStr: string) => {
    offset = parseInt(offsetStr);
});

Instance.PublicMethod("Music_AddNote", (note: string) => {
    const [LaneId, Time] = JSON.parse(note) as number[];

    currentMusic.chart.NoteDataList.push({ LaneId, Time: Time + offset });
});

Instance.PublicMethod("Music_AddSoflan", (soflan: string) => {
    const [Time, Speed] = JSON.parse(soflan) as number[];
    currentMusic.chart.SoflanDataList.push({ Time, Speed });
});

Instance.PublicMethod("Music_WeaponSwitch", (sw: string) => {
    const [Time, Weapon] = JSON.parse(sw.replaceAll('\'', '"')) as any[];
    currentMusic.chart.WeaponDataList.push({ Time, Weapon });
})

Instance.PublicMethod("Music_SetSort", (sort: number) => {
    currentMusic.sort = sort;
});

Instance.PublicMethod("Music_End", () => {
    Instance.Msg(`Add Music: ${currentMusic.name} ${currentMusic.charter}, Note count: ${currentMusic.chart.NoteDataList.length}`);

    const existingIndex = charts.findIndex(v => v.name == currentMusic.name && v.charter == currentMusic.charter);
    if (existingIndex > 0) {
        charts[existingIndex] = currentMusic;
    } else {
        charts.push(currentMusic);
    }

    charts.sort((a, b) => a.sort - b.sort);
});

Instance.PublicMethod("UpdateMusicUI", () => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    inst.updateMusic();
});

Instance.PublicMethod("StopMusic", () => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited || inst.musicStopped) {
        return;
    }

    inst.stop();
});

Instance.PublicMethod("ToggleOption", () => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited || !inst.musicStopped) {
        return;
    }

    if (inst.option + 1 > Opt.S_Random) {
        inst.option = Opt.Off;
    } else {
        inst.option = inst.option + 1;
    }

    Instance.EntFireAtName("option_display", "SetMessage", C.OPTION_TO_TEXT[inst.option] ?? 'OFF');
});

Instance.PublicMethod("ToggleJudgeOption", () => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited || !inst.musicStopped) {
        return;
    }

    if (inst.judgeOption + 1 > JudgeOpt.Easy) {
        inst.judgeOption = JudgeOpt.Normal;
    } else {
        inst.judgeOption = inst.option + 1;
    }

    Instance.EntFireAtName("judge_opt_display", "SetMessage", C.JUDGE_OPTION_TO_TEXT[inst.judgeOption] ?? 'NORMAL');
});

game.onTick(() => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.postInited) {
        return;
    }

    inst.onTick();
    list.onTick();
});

let lastCfgSuffix = 0;
let maxCfgSuffix = 0;

const loadNextPart = () => {
    Instance.Msg("Loading music list part " + lastCfgSuffix);
    runServerCommand("exec _m_" + lastCfgSuffix);

    if (++lastCfgSuffix < maxCfgSuffix) {
        game.runNextTick(loadNextPart);
    } else {
        Instance.Msg("Musics from cfg are all loaded");
    }
};

Instance.PublicMethod("_LoadBuiltin", (n: number) => {
    maxCfgSuffix = n;
    lastCfgSuffix = 0;
    game.runNextTick(loadNextPart);
});

game.runNextTick(() => {
    runServerCommand("exec _builtin");
});

game.on('round_start', () => {
    const inst = HachimiGame.init();
    Instance.EntFireAtName("stop_button", "Alpha", 0);

    updateSpeedUI(inst);
    inst.postInit();
});

// simple timescale cheat detection
let lastTimeReal = 0;
let lastTimeGame = 0;

const checkTime = () => {
    const now = new Date();

    const timeReal = now.valueOf() / 1000;
    const timeGame = Instance.GetGameTime();

    const deltaReal = timeReal - lastTimeReal;
    const deltaGame = timeGame - lastTimeGame;

    const timeScale = deltaGame / deltaReal;

    // toLocalTimeString crashes the game, fuck Valve
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    Instance.EntFireAtName("game_timer", "SetMessage", `${timeString}\n${timeScale < 0.98 ? ' (CHEATING)' : ''}`);

    lastTimeReal = timeReal;
    lastTimeGame = timeGame;

    game.runAfterDelaySeconds(checkTime, 1);
};

checkTime();

runServerCommand("sv_cheats 1");
runServerCommand("mp_maxmoney 65535");
runServerCommand("mp_startmoney 65535");
runServerCommand("mp_buytime 65535");
runServerCommand("weapon_accuracy_nospread 1");

let spread = false;
Instance.PublicMethod("ToggleWeaponSpread", () => {
    spread = !spread;

    runServerCommand("weapon_accuracy_nospread " + (spread ? '0' : '1'));
    Instance.EntFireAtName("weapon_spread_display", "SetMessage", spread ? 'ON' : 'OFF');
});


Instance.PublicMethod("ToggleAutoPlay", () => {
    const inst = HachimiGame.instance;
    if (!inst || !inst.musicStopped) {
        return;
    }

    inst.autoplay = !inst.autoplay;
    Instance.EntFireAtName("autoplay_display", "SetMessage", inst.autoplay ? 'ON' : 'OFF');
});

Instance.PublicMethod("ToggleHitmarker", () => {
    const inst = HachimiGame.instance;
    if (!inst) {
        return;
    }

    inst.hitmarker = !inst.hitmarker;
    Instance.EntFireAtName("hitmarker_display", "SetMessage", inst.hitmarker ? 'ON' : 'OFF');
});
