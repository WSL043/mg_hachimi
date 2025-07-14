/// <reference types="s2ts/types/cspointscript" />
import { Instance } from "cspointscript";
import { HachimiGame } from "./hachimi";
import { NoteData } from "./musics";
import { createEntity, game, runServerCommand, uniqueId } from "s2ts/counter-strike";
import { C } from "./constants";

export interface Frame {
    time: number;
    progress?: number;
    bodygroup?: number;
    isUp?: boolean;
    callback?: () => void;
}

const LANE_START = 1929;
const LANE_HEIGHT = 740;
const LEFT_LANE = 896;
const SPACE = 64;
export const JUDGE_POINT = 0.93;

function setAnimgraphParam(targetname: string, paramName: string, param: number | boolean | string) {
    runServerCommand(`ent_animgraph_setvar ${paramName}=${param} ${targetname}`);
}

export class Note {
    _targetname: string;
    _targetname_head: string;

    teleporter: string = '';

    constructor() {
        const id = uniqueId();
        this._targetname = "maodie_target_" + id
        this._targetname_head = "maodie_target_head_" + id;

        createEntity({
            class: 'prop_dynamic',
            keyValues: {
                targetName: this._targetname,
                model: 'models/maodie_target.vmdl',
                origin: { x: 0, y: 0, z: 0 },
                solid: 'vphysics',
                // @ts-expect-error
                use_animgraph: true,
                scales: '0 0 0',
            },
            outputs: {
                onTakeDamage: () => {
                    if (this._cb) this._cb(1);
                }
            },
        });

        createEntity({
            class: 'prop_dynamic',
            keyValues: {
                targetName: this._targetname_head,
                model: 'models/maodie_target_head.vmdl',
                origin: { x: 0, y: 0, z: 0 },
                solid: 'vphysics',
                // @ts-expect-error
                use_animgraph: true,
                scales: '0 0 0',
            },
            outputs: {
                onTakeDamage: () => {
                    if (this._cb) this._cb(0);
                }
            },
        });

        game.runAfterDelaySeconds(() => {
            Instance.EntFireAtName(this._targetname_head, "SetParent", this._targetname);
            Instance.EntFireAtName(this._targetname_head, "SetParentAttachment", "target", 0.01);
        }, C.WAIT_TIME);
    }

    private _up = false;
    get up() {
        return this._up;
    }

    set up(value: boolean) {
        setAnimgraphParam(this._targetname, "IsUp", value);
        this._up = value;
    }

    private _positon = 0.0;
    get positon() {
        return this._positon;
    }

    set positon(value: number) {
        setAnimgraphParam(this._targetname, "Position", value);
        this._positon = value;
    }

    set bodygroup(value: number) {
        Instance.EntFireAtName(this._targetname_head, 'SetBodyGroup', 'maodie,' + value);
    }

    private _cb: ((number) => void) | undefined = undefined;
    set onhit(cb: ((number) => void) | undefined) {
        this._cb = cb;
    }

    _keyframes: Frame[] = [];
    _frame = -1;

    reset() {
        this.up = false;
        this.positon = 0;
        this.bodygroup = 0;
        this._cb = undefined;

        this._keyframes = [];
        this._frame = -1;
    }

    hide() {
        Instance.EntFireAtName(this._targetname, "SetScale", "0");
        Instance.EntFireAtName(this._targetname_head, "SetScale", "0");
    }

    show() {
        Instance.EntFireAtName(this._targetname, "SetScale", "1");
        Instance.EntFireAtName(this._targetname_head, "SetScale", "1");

        Instance.EntFireAtName(this.teleporter, "TeleportEntity", this._targetname);
    }

    addFrame(keyframe: Frame) {
        this._keyframes.push(keyframe);
    }

    setupFrames() {
        this._keyframes.sort((a, b) => a.time - b.time);

        let lastProgressFrame: Frame | null = null;

        for (let i = 0; i < this._keyframes.length; i++) {
            const frame = this._keyframes[i];
            if (frame.progress !== undefined) {
                // fill null progress before this frame
                if (!lastProgressFrame) {
                    for (let j = i - 1; j >= 0; j--) {
                        this._keyframes[j].progress = frame.progress;
                    }
                }

                lastProgressFrame = frame;
                continue;
            }

            if (!lastProgressFrame) {
                continue;
            }

            const nextframe = this._keyframes
                .slice(i + 1)
                .find(f => f.progress);

            // if next frame not exists then use progress from last frame 
            if (!nextframe) {
                frame.progress = lastProgressFrame.progress;
                continue;
            }

            const ratio = (frame.time - lastProgressFrame.time) / (nextframe.time - lastProgressFrame.time);
            const additive = (nextframe.progress! - lastProgressFrame.progress!) * ratio;
            frame.progress = lastProgressFrame.progress! + additive;

            continue;
        }
    }

    clearFrames() {
        this._keyframes = [];
    }

    onTick(time: number) {
        if (!this._keyframes.length) {
            // 请输入文本
            return;
        }

        if (this._frame >= this._keyframes.length) {
            return;
        }

        if (time < this._keyframes[0].time) {
            const [frame] = this._keyframes;
            this.positon = frame.progress!;
            this._frame = -1;
            return;
        }

        let frameIndex = this._frame;

        for (let i = Math.max(0, frameIndex); i < this._keyframes.length; i++) {
            const frame = this._keyframes[i];

            if (time < frame.time) {
                frameIndex = i - 1;
                break;
            }

            frameIndex = i;

            if (i != this._frame) {
                if (frame.isUp !== undefined) {
                    this.up = frame.isUp;
                }

                if (frame.bodygroup !== undefined) {
                    this.bodygroup = frame.bodygroup;
                }

                if (frame.callback) {
                    frame.callback();
                }
            }
        }

        this._frame = frameIndex;
        const frame = this._keyframes[frameIndex];
        if (!frame) {
            return;
        }

        const nextframe = this._keyframes[frameIndex + 1];

        // reach end of keyframes
        if (!nextframe) {
            this.positon = frame.progress!;

            // use lastIndex + 1 to mark all frame has reached
            this._frame = this._keyframes.length;

            return;
        }

        const timediff = nextframe.time - frame.time;
        const ratio = timediff ? (time - frame.time) / (nextframe.time - frame.time) : 0;
        const additive = (nextframe.progress! - frame.progress!) * ratio;

        this.positon = Math.min(Math.max(frame.progress! + additive, 0), 1);
    }
}

export class NotePool {
    _pool: Note[] = [];
    _teleports = new Map<number, string>();

    rent(lane: number): Note {
        const targetName = "maodie_spawnpoint_" + lane;

        if (!this._teleports.has(lane)) {
            this._teleports.set(lane, targetName);

            createEntity({
                // @ts-expect-error
                class: "point_teleport",
                keyValues: {
                    targetName,
                    origin: { x: LEFT_LANE + lane * SPACE, y: LANE_START, z: LANE_HEIGHT },
                }
            });
        }

        const existing = this._pool.pop() ?? new Note();
        existing.teleporter = targetName;

        return existing;
    }

    returnNote(note: Note) {
        note.hide();
        note.reset();
        this._pool.push(note);
    }
}
