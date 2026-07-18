import { BaseModelEntity, Instance } from "cs_script/point_script";
import { HachimiGame } from "./hachimi";
import { charts } from "./musics";
import { createSoundEvent, SoundEffect } from "./utils/sound";
import { nextTick, scheduleTick } from "./utils/scheduler";
import { GetPlayerSave } from "./player_save";
import { C } from "./constants";
import { Vec } from "./utils/type_helper";

// AnimGraph2 no longer updates this model's animated attachment hierarchy.
// Reproduce the old 24-frame root motion so row spacing and the center marker
// stay aligned with the model's title/chart attachments.
const SONG_ITEM_ORIGIN = new Vec(767.4844970703, 355.125, 398.375);
const SONG_ITEM_TRAVEL = new Vec(6.8190979, 3.937008, 78.740158);

export class SongList {
    COUNT = 12;

    index: number = 0;

    _displayIndex: number = -999;
    _lastDisplayIndex: number = -999;

    targetArray = charts;

    _se: SoundEffect | undefined = undefined;
    _preview: SoundEffect | undefined = undefined;
    _previewStarted = false;

    _lastChangeTime = 0;
    _items: (BaseModelEntity | undefined)[] = [];
    _itemEnabled: (boolean | undefined)[] = [];

    constructor(
        private readonly game: HachimiGame
    ) {
        createSoundEvent("effect.music_list_scoll")
            .then(v => this._se = v);

        scheduleTick(this.onTick.bind(this));
    }

    private setItemProgress(index: number, progress: number) {
        let item = this._items[index];
        if (!item?.IsValid()) {
            item = Instance.FindEntityByName(`song_item_${index}`) as BaseModelEntity | undefined;
            this._items[index] = item;
        }

        item?.Teleport({
            position: SONG_ITEM_ORIGIN.add(SONG_ITEM_TRAVEL.mul(progress)),
        });
    }

    private setItemAlpha(index: number, alpha: number) {
        const enabled = alpha >= 254.5;
        if (this._itemEnabled[index] == enabled) {
            return;
        }
        this._itemEnabled[index] = enabled;

        Instance.EntFireAtName({
            name: `song_item_${index}`,
            input: enabled ? "Enable" : "Disable",
        });
    }

    private setItemText(index: number, text: string) {
        Instance.EntFireAtName({
            name: `song_text_${index}`,
            input: "SetMessage",
            value: text,
        });
    }

    private setItemTextScale(index: number, scale: number) {
        Instance.EntFireAtName({
            name: `song_text_${index}`,
            input: "SetScale",
            value: scale,
        });
    }

    private setItemChart(index: number, chart: string) {
        Instance.EntFireAtName({
            name: `song_chart_${index}`,
            input: "SetMessage",
            value: chart,
        });
    }

    private setItemChartScale(index: number, scale: number) {
        Instance.EntFireAtName({
            name: `song_chart_${index}`,
            input: "SetScale",
            value: scale,
        });
    }

    private mod(n: number, m: number): number {
        return ((n % m) + m) % m;
    }

    calcIndexForItem(item: number) {
        const itemPos = this.mod(Math.floor(item + this._displayIndex), this.COUNT);
        const center = this.COUNT / 2 - 1;

        const offset = center - itemPos;
        return this.mod(Math.floor(this._displayIndex + offset) + 1, this.targetArray.length);
    }

    get realIndex() {
        return this.mod(this.index, this.targetArray.length);
    }

    get realDisplayIndex() {
        return this.mod(this._lastDisplayIndex, this.targetArray.length);
    }

    setIndex(targetReal: number) {
        const currentReal = this.realIndex;
        const total = this.targetArray.length;
        if (total === 0) return;

        let diff = targetReal - currentReal;

        if (diff > total / 2) {
            diff -= total;
        } else if (diff < -total / 2) {
            diff += total;
        }
        this.index += diff;
    }

    stopPreview() {
        if (this._preview) {
            this._preview.kill();
            this._preview = undefined;
        }
    }

    updateSavedDataText() {
        const chart = charts[this.realDisplayIndex];
        const save = GetPlayerSave();
        let lastScoreText = 'SAVED DATA:\n\n';

        const record = save.records[chart.hash];

        if (record) {
            const maxScore = chart.chart.NoteDataList.length * 4;
            const percent = record.bestScore / maxScore;
            const rate = C.RATE_PRECENTS.find(v => v.percent < percent || Math.abs(v.percent - percent) < 0.001)!.rate;

            let statusMarks = [];
            if (record.comboBreak == 0) {
                statusMarks.push('FC');
            }

            if (record.bestHeadshotCount == chart.chart.NoteDataList.length) {
                statusMarks.push('AHS');
            }

            if (!statusMarks.length) {
                if (percent >= 0.5) {
                    statusMarks.push('CLEAR');
                } else {
                    statusMarks.push('FAILED');
                }
            }

            lastScoreText += `STATUS  : ${statusMarks.join(' ')}\n`;
            lastScoreText += `RATING  : ${rate}\n`;
            lastScoreText += `SCORE   : ${record.bestScore} / ${maxScore}\n`;
            lastScoreText += `RETRIES : ${record.playCount}\n`;
        } else {
            lastScoreText += 'STATUS  : NO PLAY';
        }

        Instance.EntFireAtName({
            name: `last_score_text`,
            input: "SetMessage",
            value: lastScoreText,
        });

        Instance.EntFireAtName({
            name: `last_score_text_shadow`,
            input: "SetMessage",
            value: lastScoreText,
        });
    }

    async onTick() {
        if (this._displayIndex == this.index) {
            if (this.game.canStart &&
                Instance.GetGameTime() - this._lastChangeTime > 1.0 &&
                !this._previewStarted
            ) {
                this._previewStarted = true;
                this._preview = await createSoundEvent(this.game.music.sndEvent);
                this._preview.play();
            }

            return;
        }

        this.stopPreview();

        const velocity = (this.index - this._displayIndex) / 10;
        this._displayIndex += velocity;

        if (Math.round(this._displayIndex) != this._lastDisplayIndex) {
            this._lastDisplayIndex = Math.round(this._displayIndex);
            this._se?.play();

            this._previewStarted = false;
            this.game.musicIndex = this.realDisplayIndex;
            this.game.updateMusic();
            this.updateSavedDataText();
        }

        if (Math.abs(this._displayIndex - this.index) < 0.01) {
            this._displayIndex = this.index;
            this.game.musicIndex = this.realIndex;
            this.game.updateMusic();

            this._lastChangeTime = Instance.GetGameTime();
        }

        for (let i = 0; i < this.COUNT; i++) {
            const index = this.calcIndexForItem(i);

            const itemPos = this.mod(i + this._displayIndex, this.COUNT);
            const progress = itemPos * (1 / this.COUNT);

            if (progress < 0.2) {
                this.setItemAlpha(i, 255 * progress / 0.2);
                this.setItemTextScale(i, 0);
                this.setItemChartScale(i, 0);
            } else if (progress > 0.8) {
                this.setItemAlpha(i, 255 * (1.0 - progress) / 0.2);
                this.setItemTextScale(i, 0);
                this.setItemChartScale(i, 0);
            } else {
                this.setItemAlpha(i, 255);

                const chart = charts[index];

                if (chart) {
                    this.setItemText(i, chart.name);
                    this.setItemChart(i, chart.charter);
                }

                // AnimGraph2 no longer supplies the old chart attachment offset,
                // so the charter sublabel overlaps the song title at the center.
                this.setItemChartScale(i, 0);

                this.setItemTextScale(i, 1);
            }

            this.setItemProgress(i, progress);
        }
    }
}
