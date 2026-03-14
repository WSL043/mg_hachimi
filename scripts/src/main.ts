import { Instance } from "cs_script/point_script";
import { delay, nextTick, scheduleTick, tickCallback } from "./utils/scheduler";
import { charts, hashChart, hashToMusic, Music } from "./musics";
import { initButtonActions } from "./button_actions";
import { checkTime } from "./cheat_detection";
import { removeAllEntities } from "./utils/entity";
import { HachimiGame } from "./hachimi";
import { stopAllSound } from "./utils/sound";
import { Vec } from "./utils/type_helper";
import { GetPlayerSave, LoadOrCreatePlayerSave } from "./player_save";

let scrInsConnection: undefined | number = undefined;
let reloaded = false;

let offset = 0;
let index = 0;
let currentMusic: Music = null!;

const instructions: Record<string, (param: string) => void> = {
    Begin: () => {
        currentMusic = {
            name: '',
            bv: '',
            charter: '',
            sndEvent: '',
            monitorMaterialGroup: '0',
            sort: 99999999,
            chart: {
                BarLineList: [],
                NoteDataList: [],
                SoflanDataList: [{
                    Time: -60,
                    Speed: 1,
                }],
                WeaponDataList: []
            },
            hash: '',
        };

        offset = 0;
        Instance.Msg("Clear currentMusic");
    },
    End: () => {
        currentMusic.hash = hashChart(currentMusic.chart);

        Instance.Msg(`Add Music: ${currentMusic.name} ${currentMusic.charter}, Note count: ${currentMusic.chart.NoteDataList.length}`);

        let index = charts.findIndex(v => v.name == currentMusic.name && v.charter == currentMusic.charter);
        if (index > 0) {
            charts[index] = currentMusic;
        } else {
            charts.push(currentMusic);
            index = charts.length;
        }

        charts.sort((a, b) => a.sort - b.sort);
        hashToMusic[currentMusic.hash] = currentMusic;
    },
    Next: async () => {
        await nextTick();
        Instance.ServerCommand(`exec _m_${++index}`);
    },
    SetName: (name) => {
        currentMusic.name = name;
    },
    SetBV: (bv) => {
        currentMusic.bv = bv;
    },
    SetCharter: (charter) => {
        currentMusic.charter = charter;
    },
    SetSoundEvent: (se) => {
        currentMusic.sndEvent = se;
    },
    SetCover: (cover) => {
        currentMusic.monitorMaterialGroup = cover;
    },
    SetSort: (sort) => {
        currentMusic.sort = parseInt(sort);
    },
    SetOffset: (offsetStr) => {
        offset = parseInt(offsetStr);
    },
    SetBarLines: (barLines) => {
        currentMusic.chart.BarLineList = (JSON.parse(barLines) as number[]).map(v => v + offset);
    },
    AddNote: (note) => {
        const [LaneId, Time] = JSON.parse(note) as number[];
        currentMusic.chart.NoteDataList.push({ LaneId: LaneId!, Time: Time! + offset });
    },
    AddSoflan: (soflan) => {
        const [Time, Speed] = JSON.parse(soflan) as number[];
        currentMusic.chart.SoflanDataList.push({ Time: Time!, Speed: Speed! });
    },
    WeaponSwitch: (sw) => {
        const [Time, Weapon] = JSON.parse(sw.replaceAll('\'', '"')) as any[];
        currentMusic.chart.WeaponDataList.push({ Time, Weapon });
    },
};

let superJumpEnabled = false;
async function enableSuperJump() {
    if (superJumpEnabled) {
        return;
    }

    superJumpEnabled = true;

    await nextTick();
    Instance.ServerCommand("say \"MORE MORE JUMP\"");
    Instance.OnPlayerJump(async ({ player }) => {
        await nextTick();
        const velocity = player.GetAbsVelocity();
        player.Teleport({
            velocity: Vec.from(velocity).mul(2),
        });
    });
}

function main() {
    Instance.ServerCommand("mp_maxmoney 90000");
    Instance.ServerCommand("mp_buytime 65535");

    const pulseent = Instance.FindEntityByName("pulseent");
    if (!pulseent) {
        return;
    }

    scrInsConnection = Instance.ConnectOutput(pulseent, "Instruction", ({ value }) => {
        if (reloaded) {
            return;
        }

        const [action, params] = (<string>value).split('|');

        if (action! in instructions) {
            instructions[action!]!(params!);
            return;
        }

        Instance.Msg(`unknown action ${action}`);
    });

    LoadOrCreatePlayerSave();

    Instance.SetThink(() => {
        tickCallback();
        Instance.SetNextThink(Instance.GetGameTime() + 1.0 / 64);
    });

    Instance.SetNextThink(Instance.GetGameTime() + 1.0 / 64);
    Instance.ServerCommand(`exec _m_0`);

    Instance.OnRoundStart(() => {
        initButtonActions();
        const inst = HachimiGame.init();
        const playerSave = GetPlayerSave();

        if (playerSave.weaponSpread) {
            Instance.ServerCommand("weapon_accuracy_nospread 0");
        } else {
            Instance.ServerCommand("weapon_accuracy_nospread 1");
        }

        scheduleTick(inst.onTick.bind(inst));

        inst.trackTime = playerSave.trackTime;
        inst.judgeOffset = playerSave.judgeOffset;
        inst.judgeOption = playerSave.judgeOption;
        inst.option = playerSave.chartOption;
        inst.hitmarker = playerSave.hitmarker;

        inst.updateOptionTexts();

        if (playerSave.selectedMusicIndex >= 0 && playerSave.selectedMusicIndex < charts.length) {
            inst.songList.setIndex(playerSave.selectedMusicIndex);
            inst.clearStatus();
        }
    });

    Instance.OnPlayerReset(({ player }) => {
        player.SetArmor(100);
        Instance.EntFireAtName({
            name: "money",
            input: "AddMoneyPlayer",
            activator: player,
        });

        const controller = player.GetPlayerController();
        if (controller) {
            Instance.ClientCommand(controller.GetPlayerSlot(), "gpu_mem_level 2");
        }
    });


    Instance.OnPlayerChat(({ player, text }) => {
        if (text === "jump") {
            enableSuperJump();
        }
    });

    checkTime();
}

function cleanUp() {
    Instance.Msg("Clean up");
    reloaded = true;

    if (scrInsConnection !== undefined) {
        // not working
        Instance.DisconnectOutput(scrInsConnection);
    }

    stopAllSound();
    removeAllEntities();

    scrInsConnection = undefined;
}

Instance.OnActivate(main);
Instance.OnScriptReload({
    before: cleanUp,
    after: () => {
        Instance.ServerCommand("endround");
        main();
    },
});
