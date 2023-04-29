import { readJson } from "./misc";
import { type JSONObjects } from "../jsonTypings";

// todo Give all of these actual typings
export const Objects = readJson<JSONObjects.JSON>("data/objects.json");
export const Maps = readJson<any>("data/maps.json");
export const Items = readJson<any>("data/items.json");
export const Weapons = Object.assign(readJson<any>("data/guns.json"), readJson<any>("data/melee.json"), readJson<any>("data/throwables.json"));
export const Bullets = readJson<any>("data/bullets.json");
export const Explosions = readJson<any>("data/explosions.json");
export const LootTables = readJson<any>("data/lootTables.json");
export const RedZoneStages = readJson<any>("data/redZoneStages.json");
export const AllowedSkins = readJson<any>("data/allowedSkins.json");
export const AllowedMelee = readJson<any>("data/allowedMelee.json");
export const AllowedEmotes = readJson<any>("data/allowedEmotes.json");
export const AllowedHeal = readJson<any>("data/allowedHeal.json");
export const AllowedBoost = readJson<any>("data/allowedBoost.json");
export const IdToMapType = readJson<any>("data/idToMapType.json");
export const IdToGameType = readJson<any>("data/idToGameType.json");
export const TypeToId = readJson<any>("data/typeToId.json");
export const Config = readJson<any>("config.json");
Config.diagonalSpeed = Config.movementSpeed / Math.SQRT2;
export const Debug = Config.debug || {};

export function IdToType (id: number): string {
    for (const type in TypeToId) {
        if (TypeToId[type] === id) return type;
    }
    return "";
}
