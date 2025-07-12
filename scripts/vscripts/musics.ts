export interface NoteData {
    Time: number;
    LaneId: number;
}

export interface Chart {
    NoteDataList: NoteData[];
    BarLineList: number[];
}

export interface Music {
    name: string,
    charter: string,
    sndEvent: string,
    monitorBodygroup: number,
    chart: Chart,
    sort: number,
}

export const charts: Music[] = [];
