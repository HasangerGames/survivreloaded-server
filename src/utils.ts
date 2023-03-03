declare global {
    var DEBUG_MODE: boolean;
    var Buildings: any[];
}

global.DEBUG_MODE = false;

import fs from "fs";
import { BitStream } from "bit-buffer";

function readJSON(path: string) {
    return JSON.parse(fs.readFileSync(path) as unknown as string);
}

const Objects = readJSON("data/objects.json");
const Maps = readJSON("data/maps.json");
const Items = readJSON("data/items.json");
const Weapons = readJSON("data/weapons.json");
const Bullets = readJSON("data/bullets.json");
const typeToId = readJSON("data/ids.json");

const ServerOptions = readJSON("config/server.json");
const GameOptions = readJSON("config/game.json");

type Point = { x: number, y: number };
type IntersectResult = { point: Point, normal: Point };

class Emote {
    playerId: number;
    pos: Point;
    type: string;
    isPing: boolean;
    constructor(playerId, pos, type, isPing) {
        this.playerId = playerId;
        this.pos = pos;
        this.type = type;
        this.isPing = isPing;
    }
}

class Explosion {
    pos: Point;
    type: string;
    layer: number;
    constructor(pos, type, layer) {
        this.pos = pos;
        this.type = type;
        this.layer = layer;
    }
}

enum ObjectKind {
    Invalid, Player, Obstacle, Loot,
    LootSpawner, DeadBody, Building, Structure,
    Decal, Projectile, Smoke, Airdrop, Npc,
    Skitternade
}

enum MsgType {
    None, Join, Disconnect, Input, Edit,
    Joined, Update, Kill, GameOver, Pickup,
    Map, Spectate, DropItem, Emote, PlayerStats,
    AdStatus, Loadout, RoleAnnouncement, Stats,
    UpdatePass, AliveCounts, PerkModeRoleSelect,
    GamePlayerStats, BattleResults
}

enum InputType {
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

enum CollisionType {
    Circle, Rectangle
}

class Utils {

    static truncate(stream) {
        const oldArray = new Uint8Array(stream.buffer);
        const newArray = new Uint8Array(Math.ceil(stream.index / 8));
        for(let i = 0; i < newArray.length; i++) newArray[i] = oldArray[i];
        return newArray;
    }

    static createStream(length): SurvivBitStream { return new SurvivBitStream(Buffer.alloc(length)); }
    static truncateToBitStream(stream): SurvivBitStream { return new SurvivBitStream(Utils.truncate(stream).buffer); }

    static send(socket, packet): void { socket.send(Utils.truncate(packet)); }

    static randomBase(min: number, max: number): number { return Math.random() * (max - min) + min; }
    static random(min: number, max: number): number { return Math.floor(Utils.randomBase(min, max + 1)); }
    static randomVec(minX: number, maxX: number, minY: number, maxY: number): Vector { return Vector.create(Utils.random(minX, maxX), Utils.random(minY, maxY)); }
    static randomFloat(min: number, max: number) { return Utils.randomBase(min, max).toFixed(3); }
    // https://stackoverflow.com/a/55671924/5905216
    static weightedRandom(items: any[], weights: number[]) {
        let i;

        for (i = 1; i < weights.length; i++)  weights[i] += weights[i - 1];

        let random = Math.random() * weights[weights.length - 1];

        for (i = 0; i < weights.length; i++) { if (weights[i] > random) break; }
        
        return items[i];
    }

    static distanceBetween(v1: Point, v2: Point): number { return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2)); }

    static typeToId(type: string): number { return typeToId[type]; }
    static getBuildingByType(type: string) { for(const building of Buildings) if(building.type == type) return building; }

    static intersectSegmentCircle(pos1: Point, pos2: Point, pos3: Point, rad: number): IntersectResult | null {
        let lengthVec = Vector.sub(pos2, pos1),
            length = Math.max(Vector.magnitude(lengthVec), 0);
        lengthVec = Vector.div(lengthVec, length);

        const distToCircleCenter = Vector.sub(pos1, pos3);
        const dot1 = Vector.dot(distToCircleCenter, lengthVec);
        const dot2 = Vector.dot(distToCircleCenter, distToCircleCenter) - rad * rad;

        if(dot2 > 0 && dot1 > 0) return null;

        const dot3 = dot1 * dot1 - dot2;
        if(dot3 < 0) return null;

        let dot4 = Math.sqrt(dot3),
            dot5 = -dot1 - dot4;

        if(dot5 < 0) dot5 = -dot1 + dot4;

        if(dot5 <= length) {
            const point = Vector.add(pos1, Vector.mul(lengthVec, dot5));
            return {point: point, normal: Vector.normalize(Vector.sub(point, pos3))};
        }

        return null;
    }

    static getLine(origin: Point, length: number, angle: number) {
        return Vector.create(origin.x + length * Math.cos(angle), origin.y + length * Math.sin(angle));
    }

    static circleCollision(pos1: Point, r1: number, pos2: Point, r2: number) {
        const a = r1 + r2;
        const x = pos1.x - pos2.x;
        const y = pos1.y - pos2.y;
        return a > Math.sqrt((x * x) + (y * y));
    }

    static rectCollision(min: Point, max: Point, circlePos: Point, circleRad: number): boolean {
        // TODO Replace this collision detection function with a more efficient one from the surviv code
        const rectWidth = max.x - min.x - 0.1;
        const rectHeight = max.y - min.y - 0.2;
        min = Vector.add2(min, rectWidth/2, rectHeight/2);
        const distx = Math.abs(circlePos.x - min.x);
        const disty = Math.abs(circlePos.y - min.y);

        if (distx > (rectWidth/2 + circleRad)) { return false; }
        if (disty > (rectHeight/2 + circleRad)) { return false; }

        if (distx <= (rectWidth/2)) { return true; }
        if (disty <= (rectHeight/2)) { return true; }

        const hypot = (distx - rectWidth / 2) * (distx - rectWidth / 2) +
            (disty - rectHeight / 2) * (disty - rectHeight / 2);

        return (hypot <= (circleRad*circleRad));
    }

    static addAdjust(pos1: Point, pos2: Point, ori: number): Point {
        if(ori == 0) return Vector.add(pos1, pos2);
        let xOffset, yOffset;
        switch(ori) {
            case 1:
                xOffset = -pos2.y;
                // noinspection JSSuspiciousNameCombination
                yOffset = pos2.x;
                break;
            case 2:
                xOffset = -pos2.x;
                yOffset = -pos2.y;
                break;
            case 3:
                // noinspection JSSuspiciousNameCombination
                xOffset = pos2.y;
                yOffset = -pos2.x;
                break;
        }
        return Vector.add2(pos1, xOffset, yOffset);
    }

    static rotateRect(pos: Point, min: Point, max: Point, scale: number, ori: number) {
        min = Vector.mul(min, scale);
        max = Vector.mul(max, scale);

        if(ori != 0) {
            const minX = min.x, minY = min.y,
                  maxX = max.x, maxY = max.y;
            switch(ori) {
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
            min: Utils.addAdjust(pos, min, ori),
            max: Utils.addAdjust(pos, max, ori)
        };
    }
    
}

class Vector {

    static create(x: number, y: number): Point {
        return {x: x, y: y};
    }

    static add(v1: Point, v2: Point): Point {
        return Vector.create(v1.x + v2.x, v1.y + v2.y);
    }

    static add2(v: Point, x: number, y: number): Point {
        return Vector.create(v.x + x, v.y + y);
    }

    static sub(v1: Point, v2: Point): Point {
        return Vector.create(v1.x - v2.x, v1.y - v2.y);
    }

    static sub2(v: Point, x: number, y: number): Point {
        return Vector.create(v.x - x, v.y - y);
    }

    static mul(v: Point, n: number): Point {
        return Vector.create(v.x * n, v.y * n);
    }

    static div(v: Point, n: number): Point {
        return Vector.create(v.x / n, v.y / n);
    }

    static mul2(v1: Point, v2: Point): Point {
        return Vector.create(v1.x * v2.x, v1.y * v2.y);
    }

    static div2(v1: Point, v2: Point): Point {
        return Vector.create(v1.x / v2.x, v1.y / v2.y);
    }

    static dot(v1: Point, v2: Point): number {
        return v1.x * v2.x + v1.y * v2.y;
    }

    static magnitude(v: Point): number {
        return Math.sqrt(Vector.lengthSqr(v));
    }

    static lengthSqr(v: Point): number {
        return v.x * v.x + v.y * v.y;
    }

    static rotate(v: Point, angle: number): Point {
        const cos = Math.cos(angle), sin = Math.sin(angle);
        return Vector.create(v.x * cos - v.y * sin, v.x * sin + v.y * cos);
    }

    static normalize(v: Point): Point {
        const len = Vector.magnitude(v);
        return Vector.create(len > 0 ? v.x / len : v.x, len > 0 ? v.y / len : v.y);
    }

    static unitVecToRadians(v: Point): number {
        return Math.atan2(v.y, v.x);
    }

}

// TODO: Add writeTruncatedBitStream(stream), sendTo(socket), alloc(length)

class SurvivBitStream extends BitStream {
    constructor(source, byteOffset: number = 0, byteLength: number = null) {
        super(source, byteOffset, byteLength);
    }

    writeString(str) { this.writeASCIIString(str); }
    writeStringFixedLength(str, len) { this.writeASCIIString(str, len); }
    readString() { return this.readASCIIString(); }
    // writeBytes(_0x10f494, _0x214f81, _0x22472f) {
    //     let arr = new Uint8Array(_0x10f494._view._view.buffer, _0x214f81, _0x22472f);
    //     this._view._view.set(arr, this.dex /_in 8);
    //     this._index += _0x22472f * 8;
    // }
    writeFloat(val, min, max, bitCount) {
        const _0x450456 = (1 << bitCount) - 1,
            _0x200bc9 = val < max ? (val > min ? val : min) : max,
            _0x32aa59 = (_0x200bc9 - min) / (max - min);
        this.writeBits(_0x32aa59 * _0x450456, bitCount);
    }
    readFloat(min, max, bitCount) {
        const _0x450456 = (1 << bitCount) - 1;
        return min + (max - min) * this.readBits(bitCount) / _0x450456;
    }
    writeInt(val, min, max, bitCount) {
        const _0x450456 = (1 << bitCount) - 1;
        this.writeBits(val - min, bitCount);
    }
    readInt(min, max, bitCount) {
        const _0x450456 = (1 << bitCount) - 1;
        return min + this.readBits(bitCount);
    }

    writeVec(vec, minX, minY, maxX, maxY, bitCount) {
        this.writeFloat(vec.x, minX, maxX, bitCount), this.writeFloat(vec.y, minY, maxY, bitCount);
    }

    readVec(min: Point, max: Point, bitCount) {
        return Vector.create(this.readFloat(min.x, max.x, bitCount), this.readFloat(min.y, max.y, bitCount));
    }
    writeUnitVec(vec: Point, bitCount) {
        this.writeVec(vec, -1, -1, 1, 1, bitCount);
    }
    readUnitVec(bitCount) {
        return this.readVec(Vector.create(-1, -1), Vector.create(1, 1), bitCount);
    }
    writeVec32(vec: Point) {
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

export {
    Objects, Maps, Items, Weapons, Bullets,
    ServerOptions, GameOptions,
    ObjectKind, MsgType, InputType, CollisionType,
    Utils, Vector, SurvivBitStream,
    Point, IntersectResult, Emote, Explosion
};
