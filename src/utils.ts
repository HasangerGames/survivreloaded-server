import fs from "fs";
import { BitStream } from "bit-buffer";
import { Bodies, Body, Vector } from "matter-js";

function readJSON(path: string) {
    return JSON.parse(fs.readFileSync(path) as unknown as string);
}

export const Objects = readJSON("data/objects.json");
export const Maps = readJSON("data/maps.json");
export const Items = readJSON("data/items.json");
export const Weapons = readJSON("data/weapons.json");
export const Bullets = readJSON("data/bullets.json");
export const TypeToId = readJSON("data/ids.json");

export const ServerOptions = readJSON("config/server.json");
export const GameOptions = readJSON("config/game.json");
GameOptions.diagonalSpeed = GameOptions.movementSpeed / Math.SQRT2;

export type IntersectResult = { point: Vector, normal: Vector };

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

export class Utils {

    static log(message: string): void {
        const date: Date = new Date();
        console.log(`[${date.toLocaleDateString("en-US")} ${date.toLocaleTimeString("en-US")}] ${message}`);
    }

    static randomFloat(min: number, max: number): number { return Math.random() * (max - min) + min; }
    static random(min: number, max: number): number { return Math.floor(Utils.randomFloat(min, max + 1)); }
    static randomVec(minX: number, maxX: number, minY: number, maxY: number): Vector { return Vector.create(Utils.random(minX, maxX), Utils.random(minY, maxY)); }

    // https://stackoverflow.com/a/55671924/5905216
    static weightedRandom(items: any[], weights: number[]) {
        let i;

        for (i = 1; i < weights.length; i++)  weights[i] += weights[i - 1];

        let random = Math.random() * weights[weights.length - 1];

        for (i = 0; i < weights.length; i++) { if (weights[i] > random) break; }
        
        return items[i];
    }

    static distanceBetween(v1: Vector, v2: Vector): number { return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2)); }


    static intersectSegmentCircle(position1: Vector, position2: Vector, position3: Vector, rad: number): IntersectResult | null {
        let lengthVec = Vector.sub(position2, position1),
            length = Math.max(Vector.magnitude(lengthVec), 0);
        lengthVec = Vector.div(lengthVec, length);

        const distToCircleCenter = Vector.sub(position1, position3);
        const dot1 = Vector.dot(distToCircleCenter, lengthVec);
        const dot2 = Vector.dot(distToCircleCenter, distToCircleCenter) - rad * rad;

        if(dot2 > 0 && dot1 > 0) return null;

        const dot3 = dot1 * dot1 - dot2;
        if(dot3 < 0) return null;

        let dot4 = Math.sqrt(dot3),
            dot5 = -dot1 - dot4;

        if(dot5 < 0) dot5 = -dot1 + dot4;

        if(dot5 <= length) {
            const point = Vector.add(position1, Vector.mult(lengthVec, dot5));
            return {point: point, normal: Vector.normalize(Vector.sub(point, position3))};
        }

        return null;
    }

    static addOrientations(n1: number, n2: number) {
        const sum: number = n1 + n2;
        if(sum <= 3) return sum;
        switch(sum) {
            case 4:
                return 0;
            case 5:
                return 1;
            case 6:
                return 2;
        }
    }

    static addAdjust(position1: Vector, position2: Vector, orientation: number): Vector {
        if(orientation == 0) return Vector.add(position1, position2);
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

    static rotateRect(pos: Vector, min: Vector, max: Vector, scale: number, orientation: number) {
        min = Vector.mult(min, scale);
        max = Vector.mult(max, scale);
        if(orientation != 0) {
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
            min: Utils.addAdjust(pos, min, orientation),
            max: Utils.addAdjust(pos, max, orientation)
        };
    }

    static bodyFromCollisionData(data, pos: Vector, orientation: number = 0, scale: number = 1): Body {
        if(!data || !data.type) {
            //console.error("Missing collision data");
        }
        let body: Body;
        if(data.type == CollisionType.Circle) {
            // noinspection TypeScriptValidateJSTypes
            body = Bodies.circle(pos.x, pos.y, data.rad * scale, { isStatic: true });
        } else if(data.type == CollisionType.Rectangle) {
            let rect = Utils.rotateRect(pos, data.min, data.max, scale, orientation);
            const width = rect.max.x - rect.min.x, height = rect.max.y - rect.min.y;
            const x = rect.min.x + width / 2, y = rect.min.y + height / 2;
            body = Bodies.rectangle(x, y, width, height, { isStatic: true });
        }
        //if(scale != 1) Body.scale(body, scale, scale);
        body.collisionFilter.category = CollisionCategory.Obstacle;
        body.collisionFilter.mask = CollisionCategory.Player;
        return body;
    }

    static unitVecToRadians(v: Vector): number {
        return Math.atan2(v.y, v.x);
    }
    
}


export class SurvivBitStream extends BitStream {
    constructor(source, byteOffset: number = 0, byteLength: number = null) {
        super(source, byteOffset, byteLength);
    }

    static alloc(length: number) {
        return new SurvivBitStream(Buffer.alloc(length));
    }

    writeString(str) { this.writeASCIIString(str); }
    writeStringFixedLength(str, len) { this.writeASCIIString(str, len); }
    readString() { return this.readASCIIString(); }

    writeFloat(val, min, max, bitCount) {
        const range = (1 << bitCount) - 1,
                  x = val < max ? (val > min ? val : min) : max,
                  t = (x - min) / (max - min);
        this.writeBits(t * range + 0.5, bitCount);
    }
    readFloat(min, max, bitCount) {
        const range = (1 << bitCount) - 1;
        return min + (max - min) * this.readBits(bitCount) / range;
    }


    writeVec(vec: Vector, minX: number, minY: number, maxX: number, maxY: number, bitCount: number) {
        this.writeFloat(vec.x, minX, maxX, bitCount);
        this.writeFloat(vec.y, minY, maxY, bitCount);
    }

    readVec(minX: number, minY: number, maxX: number, maxY: number, bitCount: number) {
        return Vector.create(this.readFloat(minX, maxX, bitCount), this.readFloat(minY, maxY, bitCount));
    }

    writeUnitVec(vec: Vector, bitCount) {
        this.writeVec(vec, -1, -1, 1, 1, bitCount);
    }
    readUnitVec(bitCount) {
        return this.readVec(-1, -1, 1, 1, bitCount);
    }

    writeVec32(vec: Vector) {
        this.writeFloat32(vec.x);
        this.writeFloat32(vec.y);
    }
    readVec32() {
        return Vector.create(this.readFloat32(), this.readFloat32());
    }

    writeAlignToNextByte() {
        const offset = 8 - this.index % 8;
        if(offset < 8) this.writeBits(0, offset);
    }
    readAlignToNextByte() {
        const offset = 8 - this.index % 8;
        if(offset < 8) this.readBits(offset);
    }

    writeGameType(id) {
        this.writeBits(id, 11);
    }
    readGameType() {
        return this.readBits(11);
    }

    writeMapType(id) {
        this.writeBits(id, 12);
    }
    readMapType() {
        return this.readBits(12);
    }

}
