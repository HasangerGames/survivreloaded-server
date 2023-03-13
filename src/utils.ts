import { BitStream } from "bit-buffer";
import { Bodies, type Body, Vector } from "matter-js";
import fs from "fs";
export const Objects = readJson("data/objects.json");
export const Maps = readJson("data/maps.json");
export const Items = readJson("data/items.json");
export const Weapons = readJson("data/weapons.json");
export const Bullets = readJson("data/bullets.json");
export const LootTables = readJson("data/lootTables.json");
export const TypeToId = readJson("data/ids.json");
export const Config = readJson("config.json");
export const DebugFeatures = Config.debugFeatures || {};
Config.diagonalSpeed = Config.movementSpeed / Math.SQRT2;
export interface IntersectResult { point: Vector, normal: Vector }
export class Item {
    type: string;
    count: number;

    constructor(type, count) {
        this.type = type;
        this.count = count;
    }
}

export const Constants = {
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
        UseEventItem: 36,
        Count: 37
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
        Airstrike: 4,
        Freeze: 5,
        Weather: 6,
        Npc: 7,
        Burning: 8,
        Phoenix: 9
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
        Revive: 6,
        ChangePose: 7
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
    HasteType: {
        None: 0,
        Windwalk: 1,
        Takedown: 2,
        Inspire: 3
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
        "40mm": [10, 20, 30, 40],
        "45acp": [90, 180, 240, 300],
        mine: [3, 6, 9, 12],
        frag: [3, 6, 9, 12],
        heart_frag: [3, 6, 9, 12],
        smoke: [3, 6, 9, 12],
        strobe: [2, 3, 4, 5],
        mirv: [2, 4, 6, 8],
        snowball: [10, 20, 30, 40],
        water_balloon: [10, 20, 30, 40],
        skitternade: [10, 20, 30, 40],
        antiFire: [10, 20, 30, 40],
        potato: [10, 20, 30, 40],
        bandage: [5, 10, 15, 30],
        healthkit: [1, 2, 3, 4],
        soda: [2, 5, 10, 15],
        chocolateBox: [2, 5, 10, 15],
        bottle: [2, 5, 10, 15],
        gunchilada: [2, 5, 10, 15],
        watermelon: [2, 5, 10, 15],
        nitroLace: [2, 5, 10, 15],
        flask: [2, 5, 10, 15],
        pulseBox: [2, 5, 10, 15],
        painkiller: [1, 2, 3, 4],
        "1xscope": [1, 1, 1, 1],
        "2xscope": [1, 1, 1, 1],
        "4xscope": [1, 1, 1, 1],
        "8xscope": [1, 1, 1, 1],
        "15xscope": [1, 1, 1, 1],
        rainbow_ammo: [1, 1, 1, 1]
    },
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
    position: Vector;
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
    position: Vector;
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

export enum CollisionType {
    Circle, Rectangle
}

export enum CollisionCategory {
    Player = 1, Obstacle = 2, Loot = 4, Other = 8
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

export function randomVec(minX: number, maxX: number, minY: number, maxY: number): Vector { return Vector.create(random(minX, maxX), random(minY, maxY)); }

// https://stackoverflow.com/a/55671924/5905216
export function weightedRandom(items: any[], weights: number[]): any {
    let i;
    for (i = 1; i < weights.length; i++) weights[i] += weights[i - 1];

    const random = Math.random() * weights[weights.length - 1];
    for (i = 0; i < weights.length; i++) { if (weights[i] > random) break; }
    return items[i];
}

export function distanceBetween(v1: Vector, v2: Vector): number { return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2)); }

export function intersectSegmentCircle(position1: Vector, position2: Vector, position3: Vector, rad: number): IntersectResult | null {
    let lengthVec = Vector.sub(position2, position1);
    const length = Math.max(Vector.magnitude(lengthVec), 0);
    lengthVec = Vector.div(lengthVec, length);

    const distToCircleCenter = Vector.sub(position1, position3);
    const dot1 = Vector.dot(distToCircleCenter, lengthVec);
    const dot2 = Vector.dot(distToCircleCenter, distToCircleCenter) - rad * rad;

    if(dot2 > 0 && dot1 > 0) return null;

    const dot3 = dot1 * dot1 - dot2;
    if(dot3 < 0) return null;

    const dot4 = Math.sqrt(dot3);
    let dot5 = -dot1 - dot4;

    if(dot5 < 0) dot5 = -dot1 + dot4;

    if(dot5 <= length) {
        const point = Vector.add(position1, Vector.mult(lengthVec, dot5));
        return { point, normal: Vector.normalise(Vector.sub(point, position3)) };
    }

    return null;
}

export function circleCollision(pos1: Vector, r1: number, pos2: Vector, r2: number): boolean {
    const a = r1 + r2;
    const x = pos1.x - pos2.x;
    const y = pos1.y - pos2.y;
    return a * a > x * x + y * y;
}

export function rectCollision(min: Vector, max: Vector, circlePos: Vector, circleRad: number): boolean {
    const distX = Math.max(min.x, Math.min(max.x, circlePos.x)) - circlePos.x;
    const distY = Math.max(min.y, Math.min(max.y, circlePos.y)) - circlePos.y;
    return distX * distX + distY * distY < circleRad * circleRad;
}

export function addOrientations(n1: number, n2: number): number {
    return (n1 + n2) % 4;
}

export function addAdjust(position1: Vector, position2: Vector, orientation: number): Vector {
    if(orientation === 0) return Vector.add(position1, position2);
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
    return Vector.add(position1, Vector.create(xOffset, yOffset));
}

export function rotateRect(pos: Vector, min: Vector, max: Vector, scale: number, orientation: number): { min: Vector, max: Vector } {
    min = Vector.mult(min, scale);
    max = Vector.mult(max, scale);
    if(orientation !== 0) {
        const minX = min.x, minY = min.y,
              maxX = max.x, maxY = max.y;
        switch(orientation) {
            case 1:
                min = Vector.create(minX, maxY);
                max = Vector.create(maxX, minY);
                break;
            case 2:
                min = Vector.create(maxX, maxY);
                max = Vector.create(minX, minY);
                break;
            case 3:
                min = Vector.create(maxX, minY);
                max = Vector.create(minX, maxY);
                break;
        }
    }
    return {
        min: addAdjust(pos, min, orientation),
        max: addAdjust(pos, max, orientation)
    };
}

export function bodyFromCollisionData(data, pos: Vector, orientation = 0, scale = 1): Body | null {
    if(!data?.type) {
        // console.error("Missing collision data");
    }
    let body: Body;
    if(data.type === CollisionType.Circle) {
        // noinspection TypeScriptValidateJSTypes
        body = Bodies.circle(pos.x, pos.y, data.rad * scale * 1.1, { isStatic: true });
    } else if(data.type === CollisionType.Rectangle) {
        const rect = rotateRect(pos, data.min, data.max, scale, orientation);
        const width = rect.max.x - rect.min.x, height = rect.max.y - rect.min.y;
        const x = rect.min.x + width / 2, y = rect.min.y + height / 2;
        if(width === 0 || height === 0) return null;
        body = Bodies.rectangle(x, y, width, height, { isStatic: true });
    }

    // @ts-expect-error body will always be assigned when the code gets to this point
    body.collisionFilter.category = CollisionCategory.Obstacle;
    // @ts-expect-error body will always be assigned when the code gets to this point
    body.collisionFilter.mask = CollisionCategory.Player;
    // @ts-expect-error body will always be assigned when the code gets to this point
    return body;
}

export function unitVecToRadians(v: Vector): number {
    return Math.atan2(v.y, v.x);
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

export async function streamToBuffer(stream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return await new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on("error", (err) => reject(err));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
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

    writeVec(vec: Vector, minX: number, minY: number, maxX: number, maxY: number, bitCount: number): void {
        this.writeFloat(vec.x, minX, maxX, bitCount);
        this.writeFloat(vec.y, minY, maxY, bitCount);
    }

    readVec(minX: number, minY: number, maxX: number, maxY: number, bitCount: number): Vector {
        return Vector.create(this.readFloat(minX, maxX, bitCount), this.readFloat(minY, maxY, bitCount));
    }

    writeUnitVec(vec: Vector, bitCount): void {
        this.writeVec(vec, -1, -1, 1, 1, bitCount);
    }

    readUnitVec(bitCount): Vector {
        return this.readVec(-1, -1, 1, 1, bitCount);
    }

    writeVec32(vec: Vector): void {
        this.writeFloat32(vec.x);
        this.writeFloat32(vec.y);
    }

    readVec32(): Vector {
        return Vector.create(this.readFloat32(), this.readFloat32());
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
        this.writeBits(id, 11);
    }

    readGameType(): number {
        return this.readBits(11);
    }

    writeMapType(id): void {
        this.writeBits(id, 12);
    }

    readMapType(): number {
        return this.readBits(12);
    }

}
