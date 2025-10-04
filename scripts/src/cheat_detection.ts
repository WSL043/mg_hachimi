import { Instance } from "cs_script/point_script";
import { delay, nextTick } from "./utils/scheduler";

export async function checkTime() {
    await nextTick();

    let lastTimeReal = 0;
    let lastTimeGame = 0;

    while (true) {
        const now = new Date();

        const timeReal = now.valueOf() / 1000;
        const timeGame = Instance.GetGameTime();

        const deltaReal = timeReal - lastTimeReal;
        const deltaGame = timeGame - lastTimeGame;

        const timeScale = deltaGame / deltaReal;

        // toLocalTimeString crashes the game, fuck Valve
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

        Instance.EntFireAtName({
            name: "game_timer",
            input: "SetMessage",
            value: `${timeString}\n${timeScale < 0.98 ? ' (CHEATING)' : ''}`
        });

        lastTimeReal = timeReal;
        lastTimeGame = timeGame;

        await delay(1000);
    }
}
