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
    monitorBodygroup: number,
    chart: Chart,
    sort: number,
}

export const charts: Music[] = [];
