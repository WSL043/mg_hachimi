/// <reference types="s2ts/types/cspointscript" />
import { Instance } from "cspointscript"
import { runServerCommand, game, addOutputByName, createEntity, uniqueId, Vector } from "s2ts/counter-strike"
import { Chart, charts, NoteData } from './musics';
import { C, JudgeOpt, Opt } from "./constants";
import { SoundEffect, createSoundEvent } from "./sound";
import { JudgeTipController } from "./judge_tip_controller";
import { HitmarkerController } from "./hitmarker_controller";
import { Frame, JUDGE_POINT, Note, NotePool } from "./note";

function prependSpace(value: { toString: () => string }, count: number = 12) {
    return value.toString().padStart(count, ' ');
}

export class HachimiGame {
    static instance: HachimiGame | undefined = undefined;
    static init() {
        return this.instance = new HachimiGame();
    }

    trackTime = 1.25;
    musicIndex = 0;

    get speed() {
        return (C.TRACK_LENGTH - C.JUDGE_LINE) / this.trackTime;
    }

    get music() {
        return charts[this.musicIndex];
    }

    autoplay = false;
    option: Opt = Opt.Off;
    judgeOption: JudgeOpt = JudgeOpt.Normal;

    _lastMusicIndex = -1;
    _lastOption: Opt = Opt.Off;
    _moddedChart: Chart | undefined;
    _noteFrames: { frames: Frame[], note: number }[] | undefined = []

    _pool = new NotePool();

    calculateNoteFrames(noteIndex: number, noteData: NoteData) {
        const self = this;
        const noteTime = noteData.Time;

        const playerSpeed = JUDGE_POINT / this.trackTime;

        let time = noteTime;
        let progress = JUDGE_POINT;

        // Generate all frames until first soflan data
        // soflan data is ordered in descending
        let frames: Frame[] = [];

        for (let i = this.soflans.findIndex(s => s.Time < noteTime); i < this.soflans.length; i++) {
            frames.push({
                time,
                progress,
            });

            const soflanData = this.soflans[i];
            let speed = playerSpeed * soflanData.Speed;

            progress -= speed * (time - soflanData.Time);
            time = soflanData.Time;
        }

        frames.push({
            time,
            progress,
        });

        frames.sort((a, b) => a.time - b.time);

        const strippedFrames: Frame[] = [];

        // find the first appear time (progress in [0, 1]) from generated frames
        for (let i = 0; i < frames.length - 1; i++) {
            const f1 = frames[i];
            const f2 = frames[i + 1];

            const p1 = f1.progress!;
            const p2 = f2.progress!;

            const s = p2 - p1;
            const t = f2.time - f1.time;

            if (p1 < 0 && p2 > 0) {
                strippedFrames.push({
                    time: f1.time + ((0 - p1) / s) * t,
                    progress: 0,
                });
            } else if (p1 > 1 && p2 < 1) {
                strippedFrames.push({
                    time: f1.time + ((1 - p1) / s) * t,
                    progress: 1,
                });
            } else {
                continue;
            }

            strippedFrames.push(...frames.slice(i + 1));
            break;
        }

        // merge frames that space < 0.016 (1 frame)
        for(let i = strippedFrames.length - 2; i >= 0; i--) {
            const f1 = strippedFrames[i];
            const f2 = strippedFrames[i + 1];

            if (f2.time - f1.time > 0.016) {
                continue;
            }

            // remove f1
            strippedFrames.splice(i, 1);
        }

        // generate additional frames
        for (let i = strippedFrames.length - 2; i >= 0; i--) {
            const f1 = strippedFrames[i];
            const f2 = strippedFrames[i + 1];
            const p1 = f1.progress!;
            const p2 = f2.progress!;

            const s = p2 - p1;
            const t = f2.time - f1.time;
            const v = s / t;

            // show
            if (p1 <= 0 && p2 > 0) {
                strippedFrames.push({
                    time: f1.time + ((0 - p1) / s) * t - C.WAIT_TIME,
                    isUp: true,
                    callback: function () {
                        this.show();
                    },
                });
            }

            if (p1 >= 1 && p2 < 1) {
                strippedFrames.push({
                    time: f1.time + ((1 - p1) / s) * t - C.WAIT_TIME,
                    isUp: true,
                    callback: function () {
                        this.show();
                    },
                });
            }

            // hide
            if (p2 <= 0 && p1 > 0) {
                strippedFrames.push({
                    time: f1.time + ((0 - p1) / s) * t - C.WAIT_TIME,
                    isUp: false,
                    callback: function () {
                        this.hide();
                    },
                });
            }

            if (p2 >= 1 && p1 < 1) {
                strippedFrames.push({
                    time: f1.time + ((1 - p1) / s) * t - C.WAIT_TIME,
                    isUp: false,
                    callback: function () {
                        this.hide();
                    },
                });
            }

            if (f2.time == noteTime) {
                // stop
                if (this.autoplay) {
                    f2.callback = function () {
                        self.processKilledTarget({
                            index: noteIndex,
                            where: 0,
                            note: this,
                        });
                    };
                } else {
                    strippedFrames.push({
                        time: f2.time + C.JUDGE_RANGE_SETS[this.judgeOption].POOR,
                        progress: p2 + v * C.JUDGE_RANGE_SETS[this.judgeOption].POOR,
                        callback: function () {
                            self.haEffect.play();
                            self.processKilledTarget({
                                index: noteIndex,
                                where: 2,
                                note: this,
                            });
                        }
                    });
                }
                // change material
                strippedFrames.push({
                    time: noteTime - C.JUDGE_RANGE_SETS[this.judgeOption].GOOD,
                    bodygroup: 2,
                });
            }
        }

        strippedFrames.sort((a, b) => a.time - b.time);
        return strippedFrames;
    }

    applyChartOptions() {
        this._moddedChart = JSON.parse(JSON.stringify(this.music.chart)) as Chart;
        this._moddedChart.NoteDataList = this._moddedChart.NoteDataList.sort((a, b) => a.Time - b.Time);
        this._moddedChart.SoflanDataList = this._moddedChart.SoflanDataList.sort((a, b) => b.Time - a.Time);
        this._moddedChart.WeaponDataList = this._moddedChart.WeaponDataList.sort((a, b) => b.Time - a.Time);

        const notes = this._moddedChart.NoteDataList;
        this._noteFrames = [];
        for (let i = 0; i < notes.length; i++) {
            const frames = this.calculateNoteFrames(i, notes[i]);
            this._noteFrames.push({ frames, note: i });
        }

        this._noteFrames.sort((a, b) => a.frames[0].time - b.frames[0].time);
        
        if (!this.option) {
            return;
        }

        this._lastMusicIndex = this.musicIndex;
        this._lastOption = this.option;

        if (this.option < Opt.S_Random) {
            let laneMap: number[] = [0, 1, 2, 3, 4, 5, 6];

            if (this.option == Opt.Mirror) {
                laneMap.reverse();
            } else if (this.option == Opt.Random) {
                let i = 7;
                while (i > 0) {
                    const j = Math.floor(Math.random() * i);
                    i--;

                    [laneMap[i], laneMap[j]] = [laneMap[j], laneMap[i]];
                }
            } else if (this.option == Opt.R_Random) {
                const shift = 1 + Math.floor(Math.random() * 6);

                for (let i = 0; i < shift; i++) {
                    laneMap.push(laneMap.shift()!)
                }
            }

            for (const note of notes) {
                note.LaneId = laneMap[note.LaneId];
            }

            runServerCommand("say \"" + C.OPTION_TO_TEXT[this.option] + ": " + [0, 1, 2, 3, 4, 5, 6]
                .map(v => laneMap[v] + 1)
                .join('') + "\""
            );
        } else if (this.option == Opt.S_Random) {
            for (const note of notes) {
                note.LaneId = Math.floor(Math.random() * 7);
            }
        }

        runServerCommand("say Applyed " + C.OPTION_TO_TEXT[this.option]);
    }

    get chart() {
        if (!this._moddedChart) {
            throw new Error("using chart before apply options.");
        }


        return this._moddedChart;
    }

    get notes() {
        return this.chart.NoteDataList;
    }

    get soflans() {
        return this.chart.SoflanDataList;
    }

    get weapons() {
        return this.chart.WeaponDataList;
    }

    get musicName() {
        return this.music.name;
    }

    get musicSndEvent() {
        return this.music.sndEvent;
    }

    static lastTemplateSuffix = 1;
    lastTrySuffix = HachimiGame.lastTemplateSuffix;

    postInited = false;

    killedObjects: { index: number, where: number, note: Note }[] = [];
    lastNoteTimes = new Map<number, number>();
    noteObjs: Note[] = [];

    lastTime = 0;

    musicStartTime = 0;
    lastNoteIndex = 0;
    lastWeaponIndex = 0;
    musicStarted = false;
    musicStopped = true;
    canStart = false;
    hardStopped = false;

    noteProgress = 0;

    gameplayStatus = {
        perfect: 0,
        great: 0,
        good: 0,
        bad: 0,
        poor: 0,
        headshot: 0,
        bodyshot: 0,
        combo: 0,
        maxcombo: 0,
        offset: 0,
        late: 0,
        early: 0,
    };

    judgeTipControllers: JudgeTipController[] = [];

    combobreakEffect: SoundEffect;
    comboEffects: SoundEffect[];

    haEffect: SoundEffect;

    hitmarkerEffect: SoundEffect;
    headshotHitmarkerEffect: SoundEffect;
    hitmarkerController: HitmarkerController = new HitmarkerController("hitmarker_particle");
    headshotHitmarkerController: HitmarkerController = new HitmarkerController("hitmarker_particle_headshot");

    constructor() {
    }

    postInit() {
        this.postInited = true;

        game.runNextTick(() => {
            Instance.EntFireAtName('maodie_start_text', 'SetMessage', "PRESS TO START");

            for (let i = 0; i < 7; i++) {
                this.judgeTipControllers.push(new JudgeTipController('maodie_judge_tip_' + i));
            }

            this.haEffect = createSoundEvent('effect.maodie_ha');
            this.hitmarkerEffect = createSoundEvent('effect.hitmarker');
            this.headshotHitmarkerEffect = createSoundEvent('effect.hitmarker_headshot');
            this.combobreakEffect = createSoundEvent('effect.siren_laugh');
            this.comboEffects = ['effect.wow', 'effect.manbo', 'effect.oye'].map(v => createSoundEvent(v));

            runServerCommand("exec music_list.cfg");
            this.updateText();
            this.updateMusic();

            this.canStart = true;
            runServerCommand("say Ready");
        });
    }

    get time() {
        return Instance.GetGameTime() - this.musicStartTime;
    }

    spawnMaodie(spawnPoint: number, noteIndex: number, frames: Frame[]) {
        if (spawnPoint < 0 || spawnPoint > 6) {
            Instance.Msg("invalid spawn point " + spawnPoint);

            return;
        }

        const note = this._pool.rent(spawnPoint);

        frames.forEach(f => note.addFrame(f));
        note.setupFrames();

        if (!this.autoplay) {
            note.onhit = (where: number) => {
                this.onTargetKilled(noteIndex, where, note);
            };
        }

        this.noteObjs.push(note);
    }

    onTick() {
        this._pool.onTick();

        this.processKilledTargets();

        this.noteObjs.forEach(v => v.onTick(this.time));
        this.judgeTipControllers.forEach(v => v.onTick());
        this.hitmarkerController.onTick();
        this.headshotHitmarkerController.onTick();

        if (!this.postInited || this.musicStopped || !this._noteFrames) {
            return;
        }

        const musicTime = this.time;

        if (musicTime > 0 && !this.musicStarted) {
            this.musicStarted = true;

            Instance.EntFireAtName('maodie_sound_player', 'StartSound');
            runServerCommand("say play");
        }

        for (let i = this.lastNoteIndex; i < this.notes.length; i++) {
            const note = this._noteFrames[i];
            const firstTime = note.frames[0].time;
            const noteData = this.notes[note.note];

            if (musicTime < firstTime - 0.1) {
                break;
            }

            this.spawnMaodie(noteData.LaneId, i, note.frames);
            this.lastNoteIndex++;
        }

        for (let i = this.lastWeaponIndex; i < this.weapons.length; i++) {
            const weapon = this.weapons[i];

            if (musicTime < weapon.Time) {
                break;
            }

            this.switchPlayerWeapon(weapon.Weapon);
            this.lastWeaponIndex++;
        }

        if (this.lastNoteIndex >= this.notes.length) {
            this.stop(true);
        }
    }

    stop(soft: boolean = false) {
        if (this.musicStopped) {
            return;
        }

        Instance.EntFireAtName("stop_button", "Alpha", 0);
        Instance.EntFireAtName('maodie_start_text', 'SetMessage', "PRESS TO START");

        if (!soft) {
            runServerCommand("ent_fire logic_relay FireUser2");
            runServerCommand("ent_fire func_tracktrain Stop");
            Instance.EntFireBroadcast('maodie_sound_player', 'StopSound');
            Instance.EntFireBroadcast('maodie_sound_player', 'Kill');

            this.noteObjs.forEach(v => this._pool.returnNote(v));
            this.noteObjs = [];

            this.hardStopped = true;
        }

        this.musicStopped = true;
        this.canStart = true;
    }

    clearStatus() {
        this.noteProgress = 0;
        this.gameplayStatus = {
            perfect: 0,
            great: 0,
            good: 0,
            bad: 0,
            poor: 0,
            headshot: 0,
            bodyshot: 0,
            combo: 0,
            maxcombo: 0,
            offset: 0,
            late: 0,
            early: 0,
        };

        this.updateText();
    }

    start() {
        if (!this.postInited) {
            runServerCommand("say Not ready yet.");
            return;
        }

        if (!this.musicStopped) {
            return;
        }

        if (!this.canStart) {
            return;
        }

        this.canStart = false;

        this.applyChartOptions();

        runServerCommand("ent_fire logic_relay FireUser2");
        Instance.EntFireBroadcast('maodie_sound_player', 'StopSound');
        Instance.EntFireBroadcast('maodie_sound_player', 'Kill');
        Instance.EntFireAtName('maodie_start_text', 'SetMessage', "GET READY");

        const barTime = this.chart.BarLineList[1] - this.chart.BarLineList[0];
        const tickTime = barTime / 4;
        let blankTime = -(this.chart.BarLineList[0] - (barTime * 2));

        while (blankTime < 0 ||
            blankTime < barTime * 2 ||
            blankTime < this.trackTime + C.WAIT_TIME
        ) {
            blankTime += barTime;
        }

        this.clearStatus();

        this.lastNoteTimes.clear();
        const lastLaneNoteTimes = [-1, -1, -1, -1, -1, -1, -1];
        for (let i = 0; i < this.notes.length; i++) {
            const note = this.notes[i];
            this.lastNoteTimes.set(i, lastLaneNoteTimes[note.LaneId]);
            lastLaneNoteTimes[note.LaneId] = note.Time;
        }

        Instance.EntFireAtName("fc_indicator", "Enable");
        Instance.EntFireAtName("ah_indicator", "Enable");

        game.runNextTick(() => {
            createEntity({
                class: 'point_soundevent',
                keyValues: {
                    targetName: 'maodie_sound_player',
                    soundName: this.musicSndEvent,
                },
            });

            this.musicStartTime = Instance.GetGameTime() + blankTime;
            this.musicStopped = false;
            this.musicStarted = false;
            this.hardStopped = false;
            this.lastNoteIndex = 0;
            this.lastWeaponIndex = 0;

            this.updateText();

            for (let i = 1; i <= 4; i++) {
                game.runAfterDelaySeconds(() => {
                    if (this.hardStopped) {
                        return;
                    }

                    this.haEffect.play();
                }, blankTime - (tickTime * i));
            }

            Instance.EntFireAtName("stop_button", "Alpha", 255);
        });
    }

    onTargetKilled(index: number, where: number, note: Note) {
        if (this.killedObjects.find(v => v.index == index)) {
            return;
        }

        this.killedObjects.push({ index, where, note });
    }

    processKilledTargets() {
        const sorted = this.killedObjects
            .sort((a, b) => {
                return this.notes[a.index].Time -
                    this.notes[b.index].Time;
            });

        for (const obj of sorted) {
            if (this.processKilledTarget(obj)) {
                break;
            }
        }

        this.killedObjects = [];
    }

    processKilledTarget({ index, where, note: noteObj }: { index: number, where: number, note: Note }) {
        const note = this.notes[index];
        const lastNoteTime = this.lastNoteTimes.get(index);

        const offset = note.Time - this.time;

        if (offset > C.JUDGE_RANGE_SETS[this.judgeOption].POOR) {
            return false;
        }

        const judgeDelta = Math.abs(offset);

        if (judgeDelta > C.JUDGE_RANGE_SETS[JudgeOpt.Normal].PGREAT && lastNoteTime && lastNoteTime != -1) {
            const minJudgeTime = lastNoteTime + (note.Time - lastNoteTime) / 2;

            if (this.time < minJudgeTime) {
                return false;
            }
        }

        const judgement = (() => {
            if (judgeDelta < C.JUDGE_RANGE_SETS[this.judgeOption].PGREAT) {
                this.gameplayStatus.perfect++;
                return 0;
            } else if (judgeDelta < C.JUDGE_RANGE_SETS[this.judgeOption].GREAT) {
                this.gameplayStatus.great++;
                return 1;
            } else if (judgeDelta < C.JUDGE_RANGE_SETS[this.judgeOption].GOOD) {
                this.gameplayStatus.good++;
                return 2;
            } else if (judgeDelta < C.JUDGE_RANGE_SETS[this.judgeOption].BAD) {
                this.gameplayStatus.bad++;
                return 3;
            }

            this.gameplayStatus.poor++;
            return 4;
        })();

        if (judgement != 4) {
            this.gameplayStatus.offset = (this.gameplayStatus.offset + offset) / 2;
        }

        if (judgement > 0 && judgement < 4) {
            if (offset > 0) {
                this.gameplayStatus.early++;
            } else {
                this.gameplayStatus.late++;
            }
        }

        if (where == 0) {
            this.gameplayStatus.headshot++;
        } else if (where == 1) {
            this.gameplayStatus.bodyshot++;
        }

        if (judgement <= 2) {
            if (where == 0) {
                this.headshotHitmarkerController.show();
                this.headshotHitmarkerEffect.play();
            } else {
                this.hitmarkerController.show();
                this.hitmarkerEffect.play();
            }

            this.gameplayStatus.combo++;

            if (this.gameplayStatus.combo > this.gameplayStatus.maxcombo) {
                this.gameplayStatus.maxcombo = this.gameplayStatus.combo;
            }
        } else {
            if (this.gameplayStatus.combo > 10) {
                this.combobreakEffect.play();
            }

            this.gameplayStatus.combo = 0;
        }

        if (this.gameplayStatus.combo > 5) {
            this.judgeTipControllers[note.LaneId].setText(`${this.gameplayStatus.combo}\n${C.JUDGE_TO_TEXT[judgement]}`);

            if ((this.gameplayStatus.combo % 20) == 0) {
                this.comboEffects[Math.floor(Math.random() * this.comboEffects.length)].play();
            }
        } else {
            this.judgeTipControllers[note.LaneId].setText(`${C.JUDGE_TO_TEXT[judgement]}`);
        }

        this.updateText();

        noteObj.bodygroup = 1;
        noteObj.up = false;
        noteObj.onhit = undefined;
        noteObj.clearFrames();

        const noteIndex = this.noteObjs.indexOf(noteObj);
        if (noteIndex != -1) {
            this.noteObjs.splice(noteIndex, 1);
        }

        game.runAfterDelaySeconds(() => {
            this._pool.returnNote(noteObj);
        }, C.WAIT_TIME);

        this.noteProgress++;

        if (judgement > 2) {
            return false;
        }

        return true;
    }

    updateText() {
        let headshotRate = this.gameplayStatus.headshot / (this.gameplayStatus.headshot + this.gameplayStatus.bodyshot);
        if (Number.isNaN(headshotRate)) {
            headshotRate = 0;
        }

        const text = 'STATUS\n\n' +
            `PERFECT: ${prependSpace(this.gameplayStatus.perfect)}\n` +
            `GREAT: ${prependSpace(this.gameplayStatus.great)}\n` +
            `GOOD: ${prependSpace(this.gameplayStatus.good)}\n` +
            `BAD: ${prependSpace(this.gameplayStatus.bad)}\n` +
            `POOR: ${prependSpace(this.gameplayStatus.poor)}\n` +
            '\n' +
            `HEADSHOT: ${prependSpace(`${this.gameplayStatus.headshot} (${Math.floor(headshotRate * 100)}%)`)}\n` +
            `MAX COMBO: ${prependSpace(this.gameplayStatus.maxcombo)}\n\n` +
            `L: ${this.gameplayStatus.late} | E: ${this.gameplayStatus.early} | ${(this.gameplayStatus.offset * 1000).toFixed(2)}ms`;

        Instance.EntFireAtName('maodie_judge_text', 'SetMessage', text);

        const totalScore = this.music.chart.NoteDataList.length * 4;
        const score = this.gameplayStatus.perfect * 3 +
            this.gameplayStatus.great * 2 +
            this.gameplayStatus.good * 1 +
            this.gameplayStatus.headshot;
        const percent = score / totalScore;
        const rate = this.autoplay ? 'AUTOPLAY' : C.RATE_PRECENTS.find(v => v.percent <= percent)!.rate;

        Instance.EntFireAtName("game_score", "SetMessage", score.toString());
        Instance.EntFireAtName("game_score_percent", "SetMessage", (percent * 100).toFixed(2) + '%');
        Instance.EntFireAtName("game_rate", "SetMessage", rate);

        const status: string[] = [];

        if (this.gameplayStatus.headshot == this.gameplayStatus.poor +
            this.gameplayStatus.bad +
            this.gameplayStatus.good +
            this.gameplayStatus.great +
            this.gameplayStatus.perfect) {
            status.push("ALL HEADSHOT");
            Instance.EntFireAtName("ah_indicator", "Enable");
        } else {
            Instance.EntFireAtName("ah_indicator", "Disable");
        }

        if (this.gameplayStatus.bad == 0 && this.gameplayStatus.poor == 0) {
            status.push('FULL COMBO');
            Instance.EntFireAtName("fc_indicator", "Enable");
        } else {
            Instance.EntFireAtName("fc_indicator", "Disable");
        }

        const optionText = C.OPTION_TO_TEXT[this.option];
        const judgeOptText = C.JUDGE_OPTION_TO_TEXT[this.judgeOption];

        if (optionText || judgeOptText) {
            status.push('USE OPTION: ' + [optionText, judgeOptText].filter(v => v).join(', '));
        }

        Instance.EntFireAtName("game_indicator", "SetMessage", status.join('\n'));

        const progress = (this.noteProgress + 1) / this.music.chart.NoteDataList.length;
        const progressText = new Array(Math.floor(progress * 45))
            .fill('▉')
            .join('');

        const progressLast = (p => {
            if (p >= 0.875) return '▉';
            if (p >= 0.75) return '▊';
            if (p >= 0.625) return '▋';
            // if (p >= 0.5) return '▌';
            if (p >= 0.375) return '▍';
            if (p >= 0.25) return '▎';
            if (p >= 0.125) return '▏';
            return '';
        })(progress * 45 - progressText.length);

        Instance.EntFireAtName("game_progress", "SetMessage", progressText + progressLast);
    }

    updateMusic() {
        runServerCommand("say " + this.music.name);
        Instance.EntFireAtName("hachimi_monitor", "SetBodyGroup", "cover," + this.music.monitorBodygroup);
        Instance.EntFireAtName("maodie_title_text", "SetMessage", this.music.name);
        Instance.EntFireAtName("maodie_charter_text", "SetMessage", this.music.charter);
    }

    switchPlayerWeapon(name: string) {
        for (let i = 0; i < 8; i++) {
            const pawn = Instance.GetPlayerPawn(i);
            if (!pawn) {
                break;
            }

            pawn.DestroyWeapons();
            pawn.GiveNamedItem(name);

            game.runNextTick(() => {
                const weapon = pawn.FindWeapon(name);

                if (weapon) {
                    pawn.SwitchToWeapon(weapon);
                }
            });
        }
    }
}
