import { readJSON } from "./misc";
import { type JSONObjects } from "../jsonTypings";

// todo Give all of these actual typings
export const Objects = readJSON<JSONObjects.JSON>("data/objects.json");
export const Maps = readJSON<any>("data/maps.json");
export const Items = readJSON<any>("data/items.json");
export const Weapons = Object.assign(readJSON<any>("data/guns.json"), readJSON<any>("data/melee.json"), readJSON<any>("data/throwables.json"));
export const Bullets = readJSON<any>("data/bullets.json");
export const Explosions = readJSON<any>("data/explosions.json");
export const LootTables = readJSON<any>("data/lootTables.json");
export const RedZoneStages = readJSON<any>("data/redZoneStages.json");
export const AllowedSkins = readJSON<any>("data/allowedSkins.json");
export const AllowedMelee = readJSON<any>("data/allowedMelee.json");
export const AllowedEmotes = readJSON<any>("data/allowedEmotes.json");
export const AllowedHeal = readJSON<any>("data/allowedHeal.json");
export const AllowedBoost = readJSON<any>("data/allowedBoost.json");
export const IdToMapType = readJSON<any>("data/idToMapType.json");
export const IdToGameType = readJSON<any>("data/idToGameType.json");
export const TypeToId = readJSON<any>("data/typeToId.json");
export const Config = readJSON<any>("config.json");

export const Debug = Config.debug ?? {};

Config.diagonalSpeed = Config.movementSpeed / Math.SQRT2;

/**
 * Return the type assigned to an ID.
 * @param id The ID to check for.
 */
export function IdToType (id: number): string {
    for (const type in TypeToId) if (TypeToId[type] === id) return type;
    return "";
}
