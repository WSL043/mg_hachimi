import { Instance } from "cs_script/point_script";
import { delay, nextTick, scheduleTick, tickCallback } from "./utils/scheduler";
import { charts, Music } from "./musics";
import { initButtonActions } from "./button_actions";
import { checkTime } from "./cheat_detection";
import { removeAllEntities } from "./utils/entity";
import { HachimiGame } from "./hachimi";
import { stopAllSound } from "./utils/sound";
import { Vec } from "./utils/type_helper";

let scrInsConnection: undefined | number = undefined;
let reloaded = false;

let ctx: Context = {
    spread: false,
}

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
            }
        };

        offset = 0;
        Instance.Msg("Clear currentMusic");
    },
    End: () => {
        Instance.Msg(`Add Music: ${currentMusic.name} ${currentMusic.charter}, Note count: ${currentMusic.chart.NoteDataList.length}`);

        let index = charts.findIndex(v => v.name == currentMusic.name && v.charter == currentMusic.charter);
        if (index > 0) {
            charts[index] = currentMusic;
        } else {
            charts.push(currentMusic);
            index = charts.length;
        }

        charts.sort((a, b) => a.sort - b.sort);
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

function main(memory?: Context) {
    Instance.Msg("Main");
    if (memory) {
        ctx = memory;
    }

    Instance.ServerCommand("mp_maxmoney 90000");
    Instance.ServerCommand("mp_buytime 65535");
    Instance.ServerCommand("weapon_accuracy_nospread 1");

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

    Instance.SetThink(() => {
        tickCallback();
        Instance.SetNextThink(Instance.GetGameTime() + 1.0 / 64);
    });

    Instance.SetNextThink(Instance.GetGameTime() + 1.0 / 64);
    Instance.ServerCommand(`exec _m_0`);

    Instance.OnRoundStart(() => {
        initButtonActions(ctx);
        const inst = HachimiGame.init();
        scheduleTick(inst.onTick.bind(inst));
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
    return ctx;
}

Instance.OnActivate(main);
Instance.OnScriptReload({
    before: cleanUp,
    after: () => {
        Instance.ServerCommand("endround");
        main();
    },
});
