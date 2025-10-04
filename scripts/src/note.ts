import { BaseModelEntity, Entity, Instance } from "cs_script/point_script";
import { C } from "./constants";
import { createEntity } from "./utils/entity";
import { Vec } from "./utils/type_helper";

export interface Frame {
    time: number;
    progress?: number;
    bodygroup?: number;
    isUp?: boolean;
    callback?: (this: Note) => void;
}

const LANE_START = 1929;
const LANE_HEIGHT = 740;
const LEFT_LANE = 896;
const SPACE = 64;
export const JUDGE_POINT = 0.93;

let lastTargetName: string = '';
function setAnimgraphParam(targetname: string, paramName: string, param: number | boolean | string) {
    if (targetname != lastTargetName) {
        Instance.EntFireAtName({
            name: "pulseent",
            input: "SetTarget",
            value: targetname
        });
        lastTargetName = targetname;
    }

    Instance.EntFireAtName({
        name: "pulseent",
        input: `Set${paramName}`,
        value: param,
    });
}

export class Note {
    _body: BaseModelEntity = null!;
    _head: BaseModelEntity = null!;
    _blocker: BaseModelEntity = null!;
    targetPos: Vec = Vec.zero();

    async init(id: number) {
        const targetname = "mt_" + id
        const targetname_head = "mt_h_" + id;
        const targetname_blocker = "mt_bl_" + id;

        [this._body, this._head, this._blocker] = await Promise.all([
            createEntity<BaseModelEntity>(targetname, "prop_dynamic", {
                origin: new Vec(1000, 9999, -100),
                model: 'models/maodie_target.vmdl',
                solid: 6,
            }),
            createEntity<BaseModelEntity>(targetname_head, "prop_dynamic", {
                origin: new Vec(1000, 9999, -100),
                model: 'models/maodie_target_head.vmdl',
                solid: 6,
            }),
            createEntity<BaseModelEntity>(targetname_blocker, "prop_dynamic", {
                origin: new Vec(1000, 9999, -100),
                model: 'models/maodie_target_bullet_blocker.vmdl',
                solid: 6,
            }),
        ]);


        this._head.SetParent(this._body);
        this._blocker.SetParent(this._body);

        Instance.EntFireAtTarget({
            target: this._head,
            input: 'SetParentAttachment',
            value: 'target',
        });

        Instance.EntFireAtTarget({
            target: this._blocker,
            input: 'SetParentAttachment',
            value: 'target',
        });

        Instance.ConnectOutput(this._head, "OnTakeDamage", () => this._cb ? this._cb(0) : undefined);
        Instance.ConnectOutput(this._body, "OnTakeDamage", () => this._cb ? this._cb(1) : undefined);
    }

    private _up = false;
    get up() {
        return this._up;
    }

    set up(value: boolean) {
        if (value == this._up) {
            return;
        }

        setAnimgraphParam(this._body.GetEntityName(), "IsUp", value);
        this._up = value;
    }

    private _positon = 0.0;
    get positon() {
        return this._positon;
    }

    set positon(value: number) {
        if (Math.abs(value - this._positon) < 0.001) {
            return;
        }

        setAnimgraphParam(this._body.GetEntityName(), "Position", value);
        this._positon = value;
    }

    set bodygroup(value: number) {
        Instance.EntFireAtTarget({
            target: this._head,
            input: 'SetBodyGroup',
            value: 'maodie,' + value,
        })
    }

    private _cb: ((where: number) => void) | undefined = undefined;
    set onhit(cb: ((where: number) => void) | undefined) {
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
        Instance.EntFireAtTarget({
            target: this._body,
            input: "SetScale",
            value: "0",
        });
        Instance.EntFireAtTarget({
            target: this._head,
            input: "SetScale",
            value: "0",
        });
        Instance.EntFireAtTarget({
            target: this._blocker,
            input: "SetScale",
            value: "0",
        });
        
        this._body.Teleport({
            position: Vec.zero(),
        });
    }

    show() {
        Instance.EntFireAtTarget({
            target: this._body,
            input: "SetScale",
            value: "1",
        });
        Instance.EntFireAtTarget({
            target: this._head,
            input: "SetScale",
            value: "1",
        });
        Instance.EntFireAtTarget({
            target: this._blocker,
            input: "SetScale",
            value: "1",
        });

        this._body.Teleport({
            position: this.targetPos,
        });
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
                    frame.callback.bind(this)();
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
    _lastNoteIndex = 0;
    _pool: Note[] = [];

    async rent(lane: number): Promise<Note> {
        let result = this._pool.pop();
        if (!result) {
            result = new Note();
            await result.init(this._lastNoteIndex++);
        }

        result.reset();
        result.targetPos = new Vec(LEFT_LANE + lane * SPACE, LANE_START, LANE_HEIGHT);
        return result;
    }

    returnNote(note: Note) {
        note.hide();
        note.reset();
        this._pool.push(note);
    }
}
