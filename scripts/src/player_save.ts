import { Instance } from "cs_script/point_script";
import { Col } from "./utils/type_helper";

interface MusicResult {
    playCount: number;
    bestCombo: number;
    bestScore: number;
    comboBreak: number;
    bestHeadshotCount: number;
}

interface SaveData {
    records: Record<string, MusicResult>;
    trackTime: number;
    judgeOffset: number;
    weaponSpread: boolean;
    hitmarker: boolean;
    judgeOption: number;
    chartOption: number;
    selectedMusicIndex: number;
}

let playerSave: SaveData | undefined;

export function LoadOrCreatePlayerSave(): SaveData {
    const saveDataStr = Instance.GetSaveData();
    if (saveDataStr && saveDataStr.length > 0) {
        playerSave = JSON.parse(saveDataStr) as SaveData;
    } else {
        playerSave = {
            records: {},
            trackTime: 1.25,
            judgeOffset: 0,
            weaponSpread: false,
            hitmarker: true,
            judgeOption: 0,
            chartOption: 0,
            selectedMusicIndex: 0,
        }
    }

    Instance.Msg("Player save data loaded:");
    Instance.Msg(JSON.stringify(playerSave, undefined, 2));

    return playerSave;
}

export function GetPlayerSave(): SaveData {
    if (!playerSave) {
        throw new Error("Player save data is not loaded");
    }
    return playerSave;
}

export function AlterPlayerSave(modifier: (save: SaveData) => void): SaveData {
    if (!playerSave) {
        throw new Error("Player save data is not loaded");
    }

    modifier(playerSave);
    Instance.SetSaveData(JSON.stringify(playerSave));

    Instance.DebugScreenText({
        text: JSON.stringify(playerSave, undefined, 2),
        x: 100,
        y: 100,
        color: new Col(255, 255, 255),
        duration: 0.5,
    })

    return playerSave;
}
