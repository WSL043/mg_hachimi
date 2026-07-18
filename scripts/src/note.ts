import { BaseModelEntity, Instance } from "cs_script/point_script";
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

// The July 2026 AnimGraph2 update no longer instantiates the legacy graph used
// by this model. Its old Position graph was only a two-frame linear path, so
// drive that same path directly from point_script instead.
const TARGET_TRAVEL = new Vec(0, -1351.6422, -418.3654);
const TARGET_UP_ANGLES = { pitch: 0, yaw: 0, roll: 90 };
const TARGET_DOWN_ANGLES = { pitch: 0, yaw: 0, roll: 0 };
// The old flip animation pivoted around the target's lower edge. Rotating the
// whole prop pivots around its center instead, so lift it by half its height.
const TARGET_UP_OFFSET = new Vec(0, 0, 44);

export class Note {
    _body: BaseModelEntity = null!;
    _head: BaseModelEntity = null!;
    _blocker: BaseModelEntity = null!;
    targetPos: Vec = Vec.zero();

    private updateTransform() {
        if (!this._body?.IsValid()) {
            return;
        }

        const position = this.targetPos
            .add(TARGET_TRAVEL.mul(this._positon))
            .add(this._up ? TARGET_UP_OFFSET : Vec.zero());
        const angles = this._up ? TARGET_UP_ANGLES : TARGET_DOWN_ANGLES;
        for (const entity of [this._body, this._head, this._blocker]) {
            if (entity?.IsValid()) {
                entity.Teleport({ position, angles });
            }
        }
    }

    private updateFlip() {
        if (!this._body?.IsValid()) {
            return;
        }

        // AnimGraph2 no longer applies the old tag.target flip. Rotate all
        // three independent props together so their visible and collision
        // planes stay aligned.
        const angles = this._up ? TARGET_UP_ANGLES : TARGET_DOWN_ANGLES;
        for (const entity of [this._body, this._head, this._blocker]) {
            if (entity?.IsValid()) {
                entity.Teleport({ angles });
            }
        }
    }

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
        Instance.ConnectOutput(this._head, "OnTakeDamage", () => this._cb ? this._cb(0) : undefined);
        Instance.ConnectOutput(this._body, "OnTakeDamage", () => this._cb ? this._cb(1) : undefined);
        this.updateFlip();
    }

    private _up = false;
    get up() {
        return this._up;
    }

    set up(value: boolean) {
        if (value == this._up) {
            return;
        }

        this._up = value;
        this.updateTransform();
    }

    private _positon = 0.0;
    get positon() {
        return this._positon;
    }

    set positon(value: number) {
        if (Math.abs(value - this._positon) < 0.001) {
            return;
        }

        this._positon = value;
        this.updateTransform();
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
        
        for (const entity of [this._body, this._head, this._blocker]) {
            entity.Teleport({ position: Vec.zero() });
        }
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

        this.updateTransform();
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

        result.targetPos = new Vec(LEFT_LANE + lane * SPACE, LANE_START, LANE_HEIGHT);
        result.reset();
        return result;
    }

    returnNote(note: Note) {
        note.hide();
        note.reset();
        this._pool.push(note);
    }
}
