import { BitStream } from "bit-buffer";
import fs from "fs";
import { type Body, Box, Circle, Vec2, type World } from "planck";
import { Obstacle } from "./game/objects/obstacle";
import { type GameObject } from "./game/gameObject";
import { type Bullet } from "./game/bullet";
import { Player } from "./game/objects/player";
import { Loot } from "./game/objects/loot";

export const Objects = readJson("data/objects.json");
export const Maps = readJson("data/maps.json");
export const Items = readJson("data/items.json");
export const Weapons = Object.assign(readJson("data/guns.json"), readJson("data/melee.json"));
export const Bullets = readJson("data/bullets.json");
export const Explosions = readJson("data/explosions.json");
export const LootTables = readJson("data/lootTables.json");
export const RedZoneStages = readJson("data/redZoneStages.json");
export const AllowedSkins = readJson("data/allowedSkins.json");
export const AllowedMelee = readJson("data/allowedMelee.json");
export const AllowedEmotes = readJson("data/allowedEmotes.json");
export const AllowedHeal = readJson("data/allowedHeal.json");
export const AllowedBoost = readJson("data/allowedBoost.json");
export const IdToMapType = readJson("data/idToMapType.json");
export const IdToGameType = readJson("data/idToGameType.json");
export const TypeToId = readJson("data/typeToId.json");
export const Config = readJson("config.json");
Config.diagonalSpeed = Config.movementSpeed / Math.SQRT2;
export const Debug = Config.debug || {};

export const AmmoTypes = ["9mm", "762mm", "556mm", "12gauge", "50AE", "308sub", "flare", "45acp"];
export const MedTypes = ["bandage", "healthkit", "soda", "painkiller"];
export const ScopeTypes = ["1xscope", "2xscope", "4xscope", "8xscope", "15xscope"];

export class Item {
    type: string;
    count: number;

    constructor(type, count) {
        this.type = type;
        this.count = count;
    }
}

export const Constants = {
    BasePack: TypeToId.backpack00 as number,
    BaseHelmet: TypeToId.helmet01 - 1 as number,
    BaseChest: TypeToId.chest01 - 1 as number,
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
        boostBreakpoints: [1, 1, 1.5, 0.5],
        baseSwitchDelay: 0.25,
        freeSwitchCooldown: 1,
        bleedTickRate: 1,
        reviveDuration: 8,
        reviveRange: 5,
        crawlTime: 0.75,
        emoteSoftCooldown: 2,
        emoteHardCooldown: 6,
        emoteThreshold: 6,
        throwableMaxMouseDist: 18,
        cookTime: 0.1,
        throwTime: 0.3,
        meleeHeight: 0.25,
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
        soundRangeDelta: 0.25,
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
        height: 0.25
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

export class DamageRecord {
    damaged: GameObject;
    damager: Player;
    bullet: Bullet;

    constructor(damaged: GameObject, damager: Player, bullet: Bullet) {
        this.damaged = damaged;
        this.damager = damager;
        this.bullet = bullet;
    }

}

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

export enum ObjectKind {
    Invalid, Player, Obstacle, Loot,
    LootSpawner, DeadBody, Building, Structure,
    Decal, Projectile, Smoke, Airdrop
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
}

export enum WeaponType {
    Gun, Melee, Throwable
}

export enum ItemSlot {
    Primary, Secondary, Melee, Throwable
}

export enum CollisionType {
    Circle, Rectangle
}

export enum CollisionCategory {
    Player = 2, Obstacle = 4, Loot = 8, Other = 16
}

/*
Game objects can belong to the following layers:
   0: ground layer
   1: bunker layer
   2: ground and stairs (both)
   3: bunker and stairs (both)

Objects on the same layer should interact with one another.
*/
export function sameLayer(a: number, b: number): boolean {
    return Boolean((1 & a) === (1 & b) || (2 & a && 2 & b));
}

export function toGroundLayer(a: number): number {
    return 1 & a;
}

export function toStairsLayer(a: number): number {
    return 2 | a;
}

export function removeFrom(array: any[], object: any): void {
    const index: number = array.indexOf(object);
    if(index !== -1) array.splice(index, 1);
}
export function log(message: string): void {
    const date: Date = new Date();
    console.log(`[${date.toLocaleDateString("en-US")} ${date.toLocaleTimeString("en-US")}] ${message}`);
}

export function IdToType(id: number): string {
    for(const type in TypeToId) {
        if(TypeToId[type] === id) return type;
    }
    return "";
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

export function randomBoolean(): boolean {
    return Math.random() < 0.5;
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
    const cpt = Vec2(clamp(pos.x, min.x, max.x), clamp(pos.y, min.y, max.y));
    const dstSqr = Vec2.lengthSquared(Vec2.sub(pos, cpt));
    return (dstSqr < rad * rad) || (pos.x >= min.x && pos.x <= max.x && pos.y >= min.y && pos.y <= max.y);
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

export function objectCollision(object: GameObject, position: Vec2, radius: number): CollisionRecord {
    let record;
    if(object instanceof Obstacle) {
        if(object.collision.type === CollisionType.Circle) {
            record = distanceToCircle(object.position, object.collision.rad, position, radius);
        } else if(object.collision.type === CollisionType.Rectangle) {
            record = distanceToRect(object.collision.min, object.collision.max, position, radius);
        }
    } else if(object instanceof Player) {
        record = distanceToCircle(object.position, object.scale, position, radius);
    } else if(object instanceof Loot) {
        record = distanceToCircle(object.position, 0, position, radius);
    }
    return record;
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

export function orientationToRad(orientation: number): number {
    return (orientation % 4) * 0.5 * Math.PI;
}

export function splitRect(rect: any, axis: Vec2): any {
    const e = Vec2.mul(Vec2.sub(rect.max, rect.min), 0.5);
    const c = Vec2.add(rect.min, e);
    const left = {
        min: Vec2(rect.min).clone(),
        max: Vec2(rect.max).clone()
    };
    const right = {
        min: Vec2(rect.min).clone(),
        max: Vec2(rect.max).clone()
    };
    if (Math.abs(axis.y) > Math.abs(axis.x)) {
        left.max = Vec2(rect.max.x, c.y);
        right.min = Vec2(rect.min.x, c.y);
    } else {
        left.max = Vec2(c.x, rect.max.y);
        right.min = Vec2(c.x, rect.min.y);
    }
    const dir = Vec2.sub(rect.max, rect.min);
    return Vec2.dot(dir, axis) > 0.0
        ? [right, left]
        : [left, right];
}

export function bodyFromCollisionData(world: World, data, position: Vec2, orientation = 0, scale = 1, obstacle: Obstacle): Body | null {
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
            userData: obstacle
        });
    } else if(data.type === CollisionType.Rectangle) {
        const rect = rotateRect(position, data.min, data.max, scale, orientation);
        const width = (rect.max.x - rect.min.x) / 2, height = (rect.max.y - rect.min.y) / 2;
        if(width === 0 || height === 0) return null;
        obstacle.collision.halfWidth = width;
        obstacle.collision.halfHeight = height;
        body = world.createBody({
            type: "static",
            position,
            fixedRotation: true
        });
        body.createFixture({
            shape: Box(width, height),
            userData: obstacle
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

// https://stackoverflow.com/a/51727716/5905216
export function randomPointInsideCircle(position: Vec2, radius: number): Vec2 {
    let x: number, y: number;
    do {
        x = 2 * Math.random() - 1.0; // range [-1, +1)
        y = 2 * Math.random() - 1.0;
    } while ((x * x + y * y) >= 1); // check unit circle

    // scale and translate the points
    return Vec2(x * radius + position.x, y * radius + position.y);
}

export function vecLerp(t, a, b): Vec2 {
    return Vec2.add(Vec2.mul(a, 1.0 - t), Vec2.mul(b, t));
}

export function lerp(t, a, b): number {
    return a * (1.0 - t) + b * t;
}

export function deepCopy(object): any {
    return JSON.parse(JSON.stringify(object));
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
