import { Instance } from "cs_script/point_script";
import { createEntity } from "./entity";

export interface SoundEffect {
    play: () => void;
    stop: () => void;
    kill: () => void;
}

const sounds = new Map<number, SoundEffect>();
let seIndex = 0;

export async function createSoundEvent(soundName: string, startOnSpawn: boolean = false): Promise<SoundEffect> {
    const target = await createEntity(undefined, 'point_soundevent', {
        soundName, startOnSpawn,
    });
    const index = seIndex++;

    const se = {
        play: () => {
            Instance.EntFireAtTarget({ target, input: "StartSound" });
        },
        stop: () => {
            Instance.EntFireAtTarget({ target, input: "StopSound" });
        },
        kill: () => {
            Instance.EntFireAtTarget({ target, input: "StopSound" });
            target.Kill();
            sounds.delete(index);
        },
    };

    if (startOnSpawn) {
        se.play();
    }

    sounds.set(index, se);
    return se;
}

export function stopAllSound() {
    sounds.forEach(v => {
        v.stop();
    });
}
