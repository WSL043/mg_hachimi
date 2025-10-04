import { Entity, Instance } from "cs_script/point_script";
import { Ang, Col, Vec } from "./type_helper";
import { nextTick } from "./scheduler";

// requires sv_cheats 1
Instance.ServerCommand("sv_cheats 1");

let tmpIndex = 0;
const createdEntites: Entity[] = [];

export async function createEntity<T extends Entity>(
    targetName: string | undefined, className: string, keyvalues: Record<string, string | number | boolean | Vec | Col | Ang> = {}
): Promise<T> {
    const tmpName = "TMP_" +
        Math.floor(Instance.GetGameTime() * 1000).toString() + "_" +
        (tmpIndex++).toString();

    keyvalues["targetname"] = tmpName;
    const kvStr = Object.entries(keyvalues)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => {
            if (typeof value === "boolean") {
                return [key, value ? "1" : "0"]
            }

            return [key, value]
        })
        .map(([key, value]) => `"${key}" "${value}"`)
        .join(" ")

    Instance.ServerCommand(`ent_create ${className} { ${kvStr} }`);

    let ent: Entity | undefined = undefined;
    do
        await nextTick();
    while ((ent = Instance.FindEntityByName(tmpName)) === undefined)

    if (targetName)
        ent.SetEntityName(targetName);

    createdEntites.push(ent);
    return ent as T;
}

export async function removeAllEntities() {
    for (const ent of createdEntites) {
        if (ent.IsAlive())
            ent.Kill();
    }
}
