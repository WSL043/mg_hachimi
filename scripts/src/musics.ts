import { createHash } from "sha1-uint8array";

export interface NoteData {
    Time: number;
    LaneId: number;
}

export interface SoflanData {
    Time: number;
    Speed: number;
}

export interface WeaponData {
    Time: number;
    Weapon: string;
}

export interface Chart {
    NoteDataList: NoteData[];
    BarLineList: number[];
    SoflanDataList: SoflanData[];
    WeaponDataList: WeaponData[];
}

export interface Music {
    name: string,
    bv: string,
    charter: string,
    sndEvent: string,
    monitorMaterialGroup: string,
    chart: Chart,
    sort: number,
    hash: string,
}

export const charts: Music[] = [];
export const hashToMusic: Record<string, Music> = {};

export function hashChart(chart: Chart) {
    return createHash('sha1')
        .update(JSON.stringify(chart))
        .digest('hex');
}
