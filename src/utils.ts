import { BitStream } from "bit-buffer";
import fs from "fs";
import { type Body, Box, Circle, Vec2, type World } from "planck";

export const Objects = readJson("data/objects.json");
export const Maps = readJson("data/maps.json");
export const Items = readJson("data/items.json");
export const Weapons = readJson("data/weapons.json");
export const Bullets = readJson("data/bullets.json");
export const LootTables = readJson("data/lootTables.json");
export const AllowedSkins = readJson("data/allowedSkins.json");
export const AllowedMelee = readJson("data/allowedMelee.json");
export const AllowedEmotes = readJson("data/allowedEmotes.json");
export const AllowedHeal = readJson("data/allowedHeal.json");
export const AllowedBoost = readJson("data/allowedBoost.json");
export const TypeToId = readJson("data/typeToId.json");
export const Config = readJson("config.json");
Config.diagonalSpeed = Config.movementSpeed / Math.SQRT2;
export const Debug = Config.debug || {};

export class Item {
    type: string;
    count: number;

    constructor(type, count) {
        this.type = type;
        this.count = count;
    }
}

export const Constants = {
    protocolVersion: 76,
    Input: {
        MoveLeft: 0,
        MoveRight: 1,
        MoveUp: 2,
        MoveDown: 3,
        Fire: 4,
        Reload: 5,
        Cancel: 6,
        Interact: 7,
        Revive: 8,
        Use: 9,
        Loot: 10,
        EquipPrimary: 11,
        EquipSecondary: 12,
        EquipMelee: 13,
        EquipThrowable: 14,
        EquipFragGrenade: 15,
        EquipSmokeGrenade: 16,
        EquipNextWeap: 17,
        EquipPrevWeap: 18,
        EquipLastWeap: 19,
        EquipOtherGun: 20,
        EquipPrevScope: 21,
        EquipNextScope: 22,
        UseBandage: 23,
        UseHealthKit: 24,
        UseSoda: 25,
        UsePainkiller: 26,
        StowWeapons: 27,
        SwapWeapSlots: 28,
        ToggleMap: 29,
        CycleUIMode: 30,
        EmoteMenu: 31,
        TeamPingMenu: 32,
        Fullscreen: 33,
        HideUI: 34,
        TeamPingSingle: 35,
        Count: 36
    },
    EmoteSlot: {
        Top: 0,
        Right: 1,
        Bottom: 2,
        Left: 3,
        Win: 4,
        Death: 5,
        Count: 6
    },
    WeaponSlot: {
        Primary: 0,
        Secondary: 1,
        Melee: 2,
        Throwable: 3,
        Count: 4
    },
    WeaponType: ["gun", "gun", "melee", "throwable"],
    DamageType: {
        Player: 0,
        Bleeding: 1,
        Gas: 2,
        Airdrop: 3,
        Airstrike: 4
    },
    Action: {
        None: 0,
        Reload: 1,
        ReloadAlt: 2,
        UseItem: 3,
        Revive: 4
    },
    Anim: {
        None: 0,
        Melee: 1,
        Cook: 2,
        Throw: 3,
        CrawlForward: 4,
        CrawlBackward: 5,
        Revive: 6
    },
    GasMode: {
        Inactive: 0,
        Waiting: 1,
        Moving: 2
    },
    Plane: {
        Airdrop: 0,
        Airstrike: 1
    },
    map: {
        gridSize: 16,
        shoreVariation: 3,
        grassVariation: 2
    },
    player: {
        radius: 1,
        maxVisualRadius: 3.75,
        maxInteractionRad: 3.5,
        health: 100,
        reviveHealth: 24,
        boostBreakpoints: [1, 1, 1.5, .5],
        baseSwitchDelay: .25,
        freeSwitchCooldown: 1,
        bleedTickRate: 1,
        reviveDuration: 8,
        reviveRange: 5,
        crawlTime: .75,
        emoteSoftCooldown: 2,
        emoteHardCooldown: 6,
        emoteThreshold: 6,
        throwableMaxMouseDist: 18,
        cookTime: .1,
        throwTime: .3,
        meleeHeight: .25,
        touchLootRadMult: 1.4,
        medicHealRange: 8,
        medicReviveRange: 6
    },
    defaultEmoteLoadout: ["emote_happyface", "emote_thumbsup", "emote_surviv", "emote_sadface", "", ""],
    airdrop: {
        actionOffset: 0,
        fallTime: 8,
        crushDamage: 100,
        planeVel: 48,
        planeRad: 150,
        soundRangeMult: 2.5,
        soundRangeDelta: .25,
        soundRangeMax: 92,
        fallOff: 0
    },
    airstrike: {
        actionOffset: 0,
        bombJitter: 4,
        bombOffset: 2,
        bombVel: 3,
        bombCount: 20,
        planeVel: 350,
        planeRad: 120,
        soundRangeMult: 18,
        soundRangeDelta: 18,
        soundRangeMax: 48,
        fallOff: 1.25
    },
    bullet: {
        maxReflect: 3,
        reflectDistDecay: 1.5,
        height: .25
    },
    projectile: {
        maxHeight: 5
    },
    structureLayerCount: 2,
    scopeZoomRadius: {
        desktop: {
            "1xscope": 28,
            "2xscope": 36,
            "4xscope": 48,
            "8xscope": 68,
            "15xscope": 104
        },
        mobile: {
            "1xscope": 32,
            "2xscope": 40,
            "4xscope": 48,
            "8xscope": 64,
            "15xscope": 88
        }
    },
    bagSizes: {
        "9mm": [120, 240, 330, 420],
        "762mm": [90, 180, 240, 300],
        "556mm": [90, 180, 240, 300],
        "12gauge": [15, 30, 60, 90],
        "50AE": [49, 98, 147, 196],
        "308sub": [10, 20, 40, 80],
        flare: [2, 4, 6, 8],
        "45acp": [90, 180, 240, 300],
        frag: [3, 6, 9, 12],
        smoke: [3, 6, 9, 12],
        strobe: [2, 3, 4, 5],
        mirv: [2, 4, 6, 8],
        snowball: [10, 20, 30, 40],
        potato: [10, 20, 30, 40],
        bandage: [5, 10, 15, 30],
        healthkit: [1, 2, 3, 4],
        soda: [2, 5, 10, 15],
        painkiller: [1, 2, 3, 4],
        "1xscope": [1, 1, 1, 1],
        "2xscope": [1, 1, 1, 1],
        "4xscope": [1, 1, 1, 1],
        "8xscope": [1, 1, 1, 1],
        "15xscope": [1, 1, 1, 1]
    },
    chestDamageReductionPercentages: [0, 0.25, 0.38, 0.45, 0.60],
    helmetDamageReductionPercentages: [0, 0.075, 0.12, 0.165, 0.21],
    lootRadius: {
        outfit: 1,
        melee: 1.25,
        gun: 1.25,
        throwable: 1,
        ammo: 1.2,
        heal: 1,
        boost: 1,
        backpack: 1,
        helmet: 1,
        chest: 1,
        scope: 1,
        perk: 1.25,
        xp: 1
    }
};

export class Emote {
    playerId: number;
    position: Vec2;
    type: string;
    isPing: boolean;
    constructor(playerId, position, type, isPing) {
        this.playerId = playerId;
        this.position = position;
        this.type = type;
        this.isPing = isPing;
    }
}

export class Explosion {
    position: Vec2;
    type: string;
    layer: number;
    constructor(position, type, layer) {
        this.position = position;
        this.type = type;
        this.layer = layer;
    }
}

export enum ObjectKind {
    Invalid, Player, Obstacle, Loot,
    LootSpawner, DeadBody, Building, Structure,
    Decal, Projectile, Smoke, Airdrop, Npc,
    Skitternade
}

export enum MsgType {
    None, Join, Disconnect, Input, Edit,
    Joined, Update, Kill, GameOver, Pickup,
    Map, Spectate, DropItem, Emote, PlayerStats,
    AdStatus, Loadout, RoleAnnouncement, Stats,
    UpdatePass, AliveCounts, PerkModeRoleSelect,
    GamePlayerStats, BattleResults
}

export enum InputType {
    MoveLeft, MoveRight, MoveUp, MoveDown,
    Fire, Reload, Cancel, Interact, Revive,
    Use, Loot, EquipPrimary, EquipSecondary,
    EquipMelee, EquipThrowable, EquipFragGrenade,
    EquipSmokeGrenade, EquipNextWeap, EquipPrevWeap,
    EquipLastWeap, EquipOtherGun, EquipPrevScope,
    EquipNextScope, UseBandage, UseHealthKit,
    UseSoda, UsePainkiller, StowWeapons, SwapWeapSlots,
    ToggleMap, CycleUIMode, EmoteMenu, TeamPingMenu,
    Fullscreen, HideUI, TeamPingSingle, UseEventItem
}

export enum DamageType {
    Player, Bleeding, Gas, Airdrop, Airstrike,
    Freeze, Weather, Npc, Burning, Phoenix
}

export enum WeaponType {
    Gun, Melee, Throwable
}

export enum CollisionType {
    Circle, Rectangle
}

export enum CollisionCategory {
    Player = 2, Obstacle = 4, Loot = 8, Other = 16
}

export function removeFrom(array: any[], object: any): void {
    const index: number = array.indexOf(object);
    if(index !== -1) array.splice(index, 1);
}
export function log(message: string): void {
    const date: Date = new Date();
    console.log(`[${date.toLocaleDateString("en-US")} ${date.toLocaleTimeString("en-US")}] ${message}`);
}

export function randomFloat(min: number, max: number): number {
    return (Math.random() * (max - min) + min);
}

export function randomFloatSpecial(min: number, max: number): number {
    return (Math.random() < 0.5) ? randomFloat(min, max) : -randomFloat(min, max);
}

export function random(min: number, max: number): number { return Math.floor(randomFloat(min, max + 1)); }

export function randomVec(minX: number, maxX: number, minY: number, maxY: number): Vec2 { return Vec2(random(minX, maxX), random(minY, maxY)); }

// https://stackoverflow.com/a/55671924/5905216
export function weightedRandom(items: any[], weights: number[]): any {
    let i;
    for(i = 1; i < weights.length; i++) weights[i] += weights[i - 1];

    const random = Math.random() * weights[weights.length - 1];
    for(i = 0; i < weights.length; i++) { if(weights[i] > random) break; }
    return items[i];
}

export function distanceBetween(v1: Vec2, v2: Vec2): number { return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2)); }

export function circleCollision(pos1: Vec2, r1: number, pos2: Vec2, r2: number): boolean {
    const a = r1 + r2;
    const x = pos1.x - pos2.x;
    const y = pos1.y - pos2.y;
    return a * a > x * x + y * y;
}

/*export function rectCollision(min: Vec2, max: Vec2, circlePos: Vec2, circleRad: number): boolean {
    const distX = Math.max(min.x, Math.min(max.x, circlePos.x)) - circlePos.x;
    const distY = Math.max(min.y, Math.min(max.y, circlePos.y)) - circlePos.y;
    return distX * distX + distY * distY > circleRad * circleRad;
}*/

export function rectCollision(min: Vec2, max: Vec2, pos: Vec2, rad: number): boolean {
    var cpt = Vec2(clamp(pos.x, min.x, max.x), clamp(pos.y, min.y, max.y));
    var dstSqr = Vec2.lengthSquared(Vec2.sub(pos, cpt));
    return dstSqr < rad * rad || pos.x >= min.x && pos.x <= max.x && pos.y >= min.y && pos.y <= max.y;
}

export function clamp(a: number, min: number, max: number): number {
    return a < max ? a > min ? a : min : max;
}

export function rectRectCollision(min1: Vec2, max1: Vec2, min2: Vec2, max2: Vec2): boolean {
    return min2.x < max1.x && min2.y < max1.y && min1.x < max2.x && min1.y < max2.y;
}

export interface CollisionRecord { collided: boolean, distance: number }

export function distanceToCircle(pos1: Vec2, r1: number, pos2: Vec2, r2: number): CollisionRecord {
    const a = r1 + r2;
    const x = pos1.x - pos2.x;
    const y = pos1.y - pos2.y;
    const a2 = a * a;
    const xy = (x * x + y * y);
    return { collided: a2 > xy, distance: a2 - xy };
}

export function distanceToRect(min: Vec2, max: Vec2, circlePos: Vec2, circleRad: number): CollisionRecord {
    const distX = Math.max(min.x, Math.min(max.x, circlePos.x)) - circlePos.x;
    const distY = Math.max(min.y, Math.min(max.y, circlePos.y)) - circlePos.y;
    const radSquared = circleRad * circleRad;
    const distSquared = (distX * distX + distY * distY);
    return { collided: distSquared < radSquared, distance: radSquared - distSquared };
}

export function addOrientations(n1: number, n2: number): number {
    return (n1 + n2) % 4;
}

export function addAdjust(position1: Vec2, position2: Vec2, orientation: number): Vec2 {
    if(orientation === 0) return Vec2.add(position1, position2);
    let xOffset, yOffset;
    switch(orientation) {
        case 1:
            xOffset = -position2.y;
            // noinspection JSSuspiciousNameCombination
            yOffset = position2.x;
            break;
        case 2:
            xOffset = -position2.x;
            yOffset = -position2.y;
            break;
        case 3:
            // noinspection JSSuspiciousNameCombination
            xOffset = position2.y;
            yOffset = -position2.x;
            break;
    }
    return Vec2.add(position1, Vec2(xOffset, yOffset));
}

export function rotateRect(pos: Vec2, min: Vec2, max: Vec2, scale: number, orientation: number): { min: Vec2, max: Vec2 } {
    min = Vec2.mul(min, scale);
    max = Vec2.mul(max, scale);
    if(orientation !== 0) {
        const minX = min.x, minY = min.y,
              maxX = max.x, maxY = max.y;
        switch(orientation) {
            case 1:
                min = Vec2(minX, maxY);
                max = Vec2(maxX, minY);
                break;
            case 2:
                min = Vec2(maxX, maxY);
                max = Vec2(minX, minY);
                break;
            case 3:
                min = Vec2(maxX, minY);
                max = Vec2(minX, maxY);
                break;
        }
    }
    return {
        min: addAdjust(pos, min, orientation),
        max: addAdjust(pos, max, orientation)
    };
}

export function bodyFromCollisionData(world: World, data, position: Vec2, orientation = 0, scale = 1): Body | null {
    if(!data?.type) {
        // console.error("Missing collision data");
    }
    let body;
    if(data.type === CollisionType.Circle) {
        // noinspection TypeScriptValidateJSTypes
        body = world.createBody({
            type: "static",
            position,
            fixedRotation: true
        });
        body.createFixture({
            shape: Circle(data.rad * scale),
            filterCategoryBits: CollisionCategory.Obstacle,
            filterMaskBits: CollisionCategory.Player | CollisionCategory.Loot
        });
    } else if(data.type === CollisionType.Rectangle) {
        const rect = rotateRect(position, data.min, data.max, scale, orientation);
        const width = rect.max.x - rect.min.x, height = rect.max.y - rect.min.y;
        if(width === 0 || height === 0) return null;
        body = world.createBody({
            type: "static",
            position,
            fixedRotation: true
        });
        body.createFixture({
            shape: Box(width / 2, height / 2),
            filterCategoryBits: CollisionCategory.Obstacle,
            filterMaskBits: CollisionCategory.Player | CollisionCategory.Loot
        });
    }
    return body;
}

export function unitVecToRadians(v: Vec2): number {
    return Math.atan2(v.y, v.x);
}

export function vec2Rotate(v: Vec2, angle: number): Vec2 {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return Vec2(v.x * cos - v.y * sin, v.x * sin + v.y * cos);
}

export function degreesToRadians(degrees: number): number {
    return degrees * Math.PI / 180;
}

export function readJson(path: string): any {
    return JSON.parse(fs.readFileSync(path) as unknown as string);
}

/**
 * Helper function for reading a posted JSON body.
 * https://github.com/uNetworking/uWebSockets.js/blob/master/examples/JsonPost.js
 */
export function readPostedJson(res, cb, err): any {
    let buffer;
    /* Register data cb */
    res.onData((ab, isLast) => {
        const chunk = Buffer.from(ab);
        if(isLast) {
            let json;
            if(buffer) {
                try {
                    // @ts-expect-error JSON.parse can accept a Buffer as an argument
                    json = JSON.parse(Buffer.concat([buffer, chunk]));
                } catch (e) {
                    /* res.close calls onAborted */
                    res.close();
                    return;
                }
                cb(json);
            } else {
                try {
                    // @ts-expect-error JSON.parse can accept a Buffer as an argument
                    json = JSON.parse(chunk);
                } catch (e) {
                    /* res.close calls onAborted */
                    res.close();
                    return;
                }
                cb(json);
            }
        } else {
            if(buffer) {
                buffer = Buffer.concat([buffer, chunk]);
            } else {
                buffer = Buffer.concat([chunk]);
            }
        }
    });

    /* Register error cb */
    res.onAborted(err);
}

export function getContentType(filename: string): string {
    let contentType;
    if(filename.endsWith(".svg")) contentType = "image/svg+xml";
    else if(filename.endsWith(".mp3")) contentType = "audio/mpeg";
    else if(filename.endsWith(".html")) contentType = "text/html; charset=UTF-8";
    else if(filename.endsWith(".css")) contentType = "text/css";
    else if(filename.endsWith(".js")) contentType = "text/javascript";
    else if(filename.endsWith(".png")) contentType = "image/png";
    else if(filename.endsWith(".ico")) contentType = "image/vnd.microsoft.icon";
    else if(filename.endsWith(".jpg")) contentType = "image/jpeg";
    return contentType;
}

export class SurvivBitStream extends BitStream {

    constructor(source, byteOffset = 0, byteLength = 0) {
        super(source, byteOffset, byteLength);
    }

    static alloc(length: number): SurvivBitStream {
        return new SurvivBitStream(Buffer.alloc(length));
    }

    writeString(str): void { this.writeASCIIString(str); }
    writeStringFixedLength(str, len): void { this.writeASCIIString(str, len); }
    readString(): string { return this.readASCIIString(); }

    readStringFixedLength(len): string { return this.readASCIIString(len); }

    writeFloat(val: number, min: number, max: number, bitCount: number): void {
        const range = (1 << bitCount) - 1,
            x = val < max ? (val > min ? val : min) : max,
            t = (x - min) / (max - min);
        this.writeBits(t * range + 0.5, bitCount);
    }

    readFloat(min: number, max: number, bitCount: number): number {
        const range = (1 << bitCount) - 1;
        return min + (max - min) * this.readBits(bitCount) / range;
    }

    writeVec(vec: Vec2, minX: number, minY: number, maxX: number, maxY: number, bitCount: number): void {
        this.writeFloat(vec.x, minX, maxX, bitCount);
        this.writeFloat(vec.y, minY, maxY, bitCount);
    }

    readVec(minX: number, minY: number, maxX: number, maxY: number, bitCount: number): Vec2 {
        return Vec2(this.readFloat(minX, maxX, bitCount), this.readFloat(minY, maxY, bitCount));
    }

    writeUnitVec(vec: Vec2, bitCount): void {
        this.writeVec(vec, -1, -1, 1, 1, bitCount);
    }

    readUnitVec(bitCount): Vec2 {
        return this.readVec(-1, -1, 1, 1, bitCount);
    }

    writeVec32(vec: Vec2): void {
        this.writeFloat32(vec.x);
        this.writeFloat32(vec.y);
    }

    readVec32(): Vec2 {
        return Vec2(this.readFloat32(), this.readFloat32());
    }

    writeAlignToNextByte(): void {
        const offset = 8 - this.index % 8;
        if(offset < 8) this.writeBits(0, offset);
    }

    readAlignToNextByte(): void {
        const offset = 8 - this.index % 8;
        if(offset < 8) this.readBits(offset);
    }

    writeGameType(id): void {
        this.writeBits(id, 10);
    }

    readGameType(): number {
        return this.readBits(10);
    }

    writeMapType(id): void {
        this.writeBits(id, 12);
    }

    readMapType(): number {
        return this.readBits(12);
    }

}
