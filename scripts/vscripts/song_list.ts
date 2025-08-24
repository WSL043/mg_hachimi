import { Instance } from "cspointscript";
import { HachimiGame } from "./hachimi";
import { charts } from "./musics";
import { createSoundEvent, SoundEffect } from "./sound";
import { game, runServerCommand } from "s2ts/counter-strike";

export class SongList {
    COUNT = 12;

    index: number = 0;

    _displayIndex: number = -999;
    _lastDisplayIndex: number = -999;

    targetArray = charts;

    _se: SoundEffect;
    _preview: SoundEffect | undefined = undefined;
    _previewStarted = false;

    _lastChangeTime = 0;

    constructor(
        private readonly game: HachimiGame
    ) {
        this._se = createSoundEvent("effect.music_list_scoll");
    }

    private setItemProgress(index: number, progress: number) {
        Instance.EntFireAtName("animgraph_ctrl", "SetSongItem", `song_item_${index}`);
        Instance.EntFireAtName("animgraph_ctrl", 'SetSongItemProgress', progress);
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

    private setItemChart(index: number, chart: string) {
        Instance.EntFireAtName(`song_chart_${index}`, "SetMessage", chart);
    }

    private setItemChartScale(index: number, scale: number) {
        Instance.EntFireAtName(`song_chart_${index}`, "SetScale", scale);
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

    onTick() {
        if (this._displayIndex == this.index) {
            if (Instance.GetGameTime() - this._lastChangeTime > 1.0 && !this._previewStarted) {
                this._previewStarted = true;
                this._preview = createSoundEvent(this.game.music.sndEvent);
                game.runNextTick(() => {
                    this._preview?.play();
                });
            }

            return;
        }

        this.stopPreview();

        const velocity = (this.index - this._displayIndex) / 10;
        this._displayIndex += velocity;

        if (Math.round(this._displayIndex) != this._lastDisplayIndex) {
            this._lastDisplayIndex = Math.round(this._displayIndex);
            this._se.play();

            this._previewStarted = false;
            this.game.musicIndex = this.realDisplayIndex;
            this.game.updateMusic();
        }

        if (Math.abs(this._displayIndex - this.index) < 0.01) {
            this._displayIndex = this.index;
            this.game.musicIndex = this.realIndex;
            this.game.updateMusic();

            this._lastChangeTime = Instance.GetGameTime();
            runServerCommand("say " + this.game.music.name);
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
                this.setItemText(i, charts[index].name);
                this.setItemChart(i, charts[index].charter);

                if (progress > 0.45 && progress < 0.55) {
                    this.setItemChartScale(i, (1.0 - (Math.abs(0.5 - progress) / 0.05)));
                } else {
                    this.setItemChartScale(i, 0);
                }

                this.setItemTextScale(i, 1);
            }

            this.setItemProgress(i, progress);
        }
    }
}
