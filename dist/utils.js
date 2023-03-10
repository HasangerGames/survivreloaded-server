"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurvivBitStream = exports.Utils = exports.removeFrom = exports.CollisionCategory = exports.CollisionType = exports.DamageType = exports.InputType = exports.MsgType = exports.ObjectKind = exports.Explosion = exports.Emote = exports.GameOptions = exports.ServerOptions = exports.TypeToId = exports.Bullets = exports.Weapons = exports.Items = exports.Maps = exports.Objects = void 0;
const fs_1 = __importDefault(require("fs"));
const bit_buffer_1 = require("bit-buffer");
const matter_js_1 = require("matter-js");
function readJSON(path) {
    return JSON.parse(fs_1.default.readFileSync(path));
}
exports.Objects = readJSON("data/objects.json");
exports.Maps = readJSON("data/maps.json");
exports.Items = readJSON("data/items.json");
exports.Weapons = readJSON("data/weapons.json");
exports.Bullets = readJSON("data/bullets.json");
exports.TypeToId = readJSON("data/ids.json");
exports.ServerOptions = readJSON("config/server.json");
exports.GameOptions = readJSON("config/game.json");
exports.GameOptions.diagonalSpeed = exports.GameOptions.movementSpeed / Math.SQRT2;
class Emote {
    playerId;
    position;
    type;
    isPing;
    constructor(playerId, position, type, isPing) {
        this.playerId = playerId;
        this.position = position;
        this.type = type;
        this.isPing = isPing;
    }
}
exports.Emote = Emote;
class Explosion {
    position;
    type;
    layer;
    constructor(position, type, layer) {
        this.position = position;
        this.type = type;
        this.layer = layer;
    }
}
exports.Explosion = Explosion;
var ObjectKind;
(function (ObjectKind) {
    ObjectKind[ObjectKind["Invalid"] = 0] = "Invalid";
    ObjectKind[ObjectKind["Player"] = 1] = "Player";
    ObjectKind[ObjectKind["Obstacle"] = 2] = "Obstacle";
    ObjectKind[ObjectKind["Loot"] = 3] = "Loot";
    ObjectKind[ObjectKind["LootSpawner"] = 4] = "LootSpawner";
    ObjectKind[ObjectKind["DeadBody"] = 5] = "DeadBody";
    ObjectKind[ObjectKind["Building"] = 6] = "Building";
    ObjectKind[ObjectKind["Structure"] = 7] = "Structure";
    ObjectKind[ObjectKind["Decal"] = 8] = "Decal";
    ObjectKind[ObjectKind["Projectile"] = 9] = "Projectile";
    ObjectKind[ObjectKind["Smoke"] = 10] = "Smoke";
    ObjectKind[ObjectKind["Airdrop"] = 11] = "Airdrop";
    ObjectKind[ObjectKind["Npc"] = 12] = "Npc";
    ObjectKind[ObjectKind["Skitternade"] = 13] = "Skitternade";
})(ObjectKind = exports.ObjectKind || (exports.ObjectKind = {}));
var MsgType;
(function (MsgType) {
    MsgType[MsgType["None"] = 0] = "None";
    MsgType[MsgType["Join"] = 1] = "Join";
    MsgType[MsgType["Disconnect"] = 2] = "Disconnect";
    MsgType[MsgType["Input"] = 3] = "Input";
    MsgType[MsgType["Edit"] = 4] = "Edit";
    MsgType[MsgType["Joined"] = 5] = "Joined";
    MsgType[MsgType["Update"] = 6] = "Update";
    MsgType[MsgType["Kill"] = 7] = "Kill";
    MsgType[MsgType["GameOver"] = 8] = "GameOver";
    MsgType[MsgType["Pickup"] = 9] = "Pickup";
    MsgType[MsgType["Map"] = 10] = "Map";
    MsgType[MsgType["Spectate"] = 11] = "Spectate";
    MsgType[MsgType["DropItem"] = 12] = "DropItem";
    MsgType[MsgType["Emote"] = 13] = "Emote";
    MsgType[MsgType["PlayerStats"] = 14] = "PlayerStats";
    MsgType[MsgType["AdStatus"] = 15] = "AdStatus";
    MsgType[MsgType["Loadout"] = 16] = "Loadout";
    MsgType[MsgType["RoleAnnouncement"] = 17] = "RoleAnnouncement";
    MsgType[MsgType["Stats"] = 18] = "Stats";
    MsgType[MsgType["UpdatePass"] = 19] = "UpdatePass";
    MsgType[MsgType["AliveCounts"] = 20] = "AliveCounts";
    MsgType[MsgType["PerkModeRoleSelect"] = 21] = "PerkModeRoleSelect";
    MsgType[MsgType["GamePlayerStats"] = 22] = "GamePlayerStats";
    MsgType[MsgType["BattleResults"] = 23] = "BattleResults";
})(MsgType = exports.MsgType || (exports.MsgType = {}));
var InputType;
(function (InputType) {
    InputType[InputType["MoveLeft"] = 0] = "MoveLeft";
    InputType[InputType["MoveRight"] = 1] = "MoveRight";
    InputType[InputType["MoveUp"] = 2] = "MoveUp";
    InputType[InputType["MoveDown"] = 3] = "MoveDown";
    InputType[InputType["Fire"] = 4] = "Fire";
    InputType[InputType["Reload"] = 5] = "Reload";
    InputType[InputType["Cancel"] = 6] = "Cancel";
    InputType[InputType["Interact"] = 7] = "Interact";
    InputType[InputType["Revive"] = 8] = "Revive";
    InputType[InputType["Use"] = 9] = "Use";
    InputType[InputType["Loot"] = 10] = "Loot";
    InputType[InputType["EquipPrimary"] = 11] = "EquipPrimary";
    InputType[InputType["EquipSecondary"] = 12] = "EquipSecondary";
    InputType[InputType["EquipMelee"] = 13] = "EquipMelee";
    InputType[InputType["EquipThrowable"] = 14] = "EquipThrowable";
    InputType[InputType["EquipFragGrenade"] = 15] = "EquipFragGrenade";
    InputType[InputType["EquipSmokeGrenade"] = 16] = "EquipSmokeGrenade";
    InputType[InputType["EquipNextWeap"] = 17] = "EquipNextWeap";
    InputType[InputType["EquipPrevWeap"] = 18] = "EquipPrevWeap";
    InputType[InputType["EquipLastWeap"] = 19] = "EquipLastWeap";
    InputType[InputType["EquipOtherGun"] = 20] = "EquipOtherGun";
    InputType[InputType["EquipPrevScope"] = 21] = "EquipPrevScope";
    InputType[InputType["EquipNextScope"] = 22] = "EquipNextScope";
    InputType[InputType["UseBandage"] = 23] = "UseBandage";
    InputType[InputType["UseHealthKit"] = 24] = "UseHealthKit";
    InputType[InputType["UseSoda"] = 25] = "UseSoda";
    InputType[InputType["UsePainkiller"] = 26] = "UsePainkiller";
    InputType[InputType["StowWeapons"] = 27] = "StowWeapons";
    InputType[InputType["SwapWeapSlots"] = 28] = "SwapWeapSlots";
    InputType[InputType["ToggleMap"] = 29] = "ToggleMap";
    InputType[InputType["CycleUIMode"] = 30] = "CycleUIMode";
    InputType[InputType["EmoteMenu"] = 31] = "EmoteMenu";
    InputType[InputType["TeamPingMenu"] = 32] = "TeamPingMenu";
    InputType[InputType["Fullscreen"] = 33] = "Fullscreen";
    InputType[InputType["HideUI"] = 34] = "HideUI";
    InputType[InputType["TeamPingSingle"] = 35] = "TeamPingSingle";
    InputType[InputType["UseEventItem"] = 36] = "UseEventItem";
})(InputType = exports.InputType || (exports.InputType = {}));
var DamageType;
(function (DamageType) {
    DamageType[DamageType["Player"] = 0] = "Player";
    DamageType[DamageType["Bleeding"] = 1] = "Bleeding";
    DamageType[DamageType["Gas"] = 2] = "Gas";
    DamageType[DamageType["Airdrop"] = 3] = "Airdrop";
    DamageType[DamageType["Airstrike"] = 4] = "Airstrike";
    DamageType[DamageType["Freeze"] = 5] = "Freeze";
    DamageType[DamageType["Weather"] = 6] = "Weather";
    DamageType[DamageType["Npc"] = 7] = "Npc";
    DamageType[DamageType["Burning"] = 8] = "Burning";
    DamageType[DamageType["Phoenix"] = 9] = "Phoenix";
})(DamageType = exports.DamageType || (exports.DamageType = {}));
var CollisionType;
(function (CollisionType) {
    CollisionType[CollisionType["Circle"] = 0] = "Circle";
    CollisionType[CollisionType["Rectangle"] = 1] = "Rectangle";
})(CollisionType = exports.CollisionType || (exports.CollisionType = {}));
var CollisionCategory;
(function (CollisionCategory) {
    CollisionCategory[CollisionCategory["Player"] = 1] = "Player";
    CollisionCategory[CollisionCategory["Obstacle"] = 2] = "Obstacle";
    CollisionCategory[CollisionCategory["Loot"] = 4] = "Loot";
    CollisionCategory[CollisionCategory["Other"] = 8] = "Other";
})(CollisionCategory = exports.CollisionCategory || (exports.CollisionCategory = {}));
function removeFrom(array, object) {
    const index = array.indexOf(object);
    if (index != -1)
        array.splice(index, 1);
}
exports.removeFrom = removeFrom;
class Utils {
    static log(message) {
        const date = new Date();
        console.log(`[${date.toLocaleDateString("en-US")} ${date.toLocaleTimeString("en-US")}] ${message}`);
    }
    static randomBase(min, max) {
        return (Math.random() * (max - min) + min);
    }
    static random(min, max) { return Math.floor(Utils.randomBase(min, max + 1)); }
    static randomVec(minX, maxX, minY, maxY) { return matter_js_1.Vector.create(Utils.random(minX, maxX), Utils.random(minY, maxY)); }
    // https://stackoverflow.com/a/55671924/5905216
    static weightedRandom(items, weights) {
        let i;
        for (i = 1; i < weights.length; i++)
            weights[i] += weights[i - 1];
        let random = Math.random() * weights[weights.length - 1];
        for (i = 0; i < weights.length; i++) {
            if (weights[i] > random)
                break;
        }
        return items[i];
    }
    static distanceBetween(v1, v2) { return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2)); }
    static intersectSegmentCircle(position1, position2, position3, rad) {
        let lengthVec = matter_js_1.Vector.sub(position2, position1), length = Math.max(matter_js_1.Vector.magnitude(lengthVec), 0);
        lengthVec = matter_js_1.Vector.div(lengthVec, length);
        const distToCircleCenter = matter_js_1.Vector.sub(position1, position3);
        const dot1 = matter_js_1.Vector.dot(distToCircleCenter, lengthVec);
        const dot2 = matter_js_1.Vector.dot(distToCircleCenter, distToCircleCenter) - rad * rad;
        if (dot2 > 0 && dot1 > 0)
            return null;
        const dot3 = dot1 * dot1 - dot2;
        if (dot3 < 0)
            return null;
        let dot4 = Math.sqrt(dot3), dot5 = -dot1 - dot4;
        if (dot5 < 0)
            dot5 = -dot1 + dot4;
        if (dot5 <= length) {
            const point = matter_js_1.Vector.add(position1, matter_js_1.Vector.mult(lengthVec, dot5));
            return { point: point, normal: matter_js_1.Vector.normalize(matter_js_1.Vector.sub(point, position3)) };
        }
        return null;
    }
    static circleCollision(pos1, r1, pos2, r2) {
        const a = r1 + r2;
        const x = pos1.x - pos2.x;
        const y = pos1.y - pos2.y;
        return a > Math.sqrt((x * x) + (y * y));
    }
    static rectCollision(min, max, circlePos, circleRad) {
        // TODO Replace this collision detection function with a more efficient one from the surviv code
        const rectWidth = max.x - min.x;
        const rectHeight = max.y - min.y;
        min = matter_js_1.Vector.add(min, matter_js_1.Vector.create(rectWidth / 2, rectHeight / 2));
        const distX = Math.abs(circlePos.x - min.x);
        const distY = Math.abs(circlePos.y - min.y);
        if (distX > (rectWidth / 2 + circleRad)) {
            return false;
        }
        if (distY > (rectHeight / 2 + circleRad)) {
            return false;
        }
        if (distX <= (rectWidth / 2)) {
            return true;
        }
        if (distY <= (rectHeight / 2)) {
            return true;
        }
        const hypot = (distX - rectWidth / 2) * (distX - rectWidth / 2) +
            (distY - rectHeight / 2) * (distY - rectHeight / 2);
        return (hypot <= (circleRad * circleRad));
    }
    static addOrientations(n1, n2) {
        const sum = n1 + n2;
        if (sum <= 3)
            return sum;
        switch (sum) {
            case 4:
                return 0;
            case 5:
                return 1;
            case 6:
                return 2;
        }
    }
    static addAdjust(position1, position2, orientation) {
        if (orientation == 0)
            return matter_js_1.Vector.add(position1, position2);
        let xOffset, yOffset;
        switch (orientation) {
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
        return matter_js_1.Vector.add(position1, matter_js_1.Vector.create(xOffset, yOffset));
    }
    static rotateRect(pos, min, max, scale, orientation) {
        min = matter_js_1.Vector.mult(min, scale);
        max = matter_js_1.Vector.mult(max, scale);
        if (orientation != 0) {
            const minX = min.x, minY = min.y, maxX = max.x, maxY = max.y;
            switch (orientation) {
                case 1:
                    min = matter_js_1.Vector.create(minX, maxY);
                    max = matter_js_1.Vector.create(maxX, minY);
                    break;
                case 2:
                    min = matter_js_1.Vector.create(maxX, maxY);
                    max = matter_js_1.Vector.create(minX, minY);
                    break;
                case 3:
                    min = matter_js_1.Vector.create(maxX, minY);
                    max = matter_js_1.Vector.create(minX, maxY);
                    break;
            }
        }
        return {
            min: Utils.addAdjust(pos, min, orientation),
            max: Utils.addAdjust(pos, max, orientation)
        };
    }
    static bodyFromCollisionData(data, pos, orientation = 0, scale = 1) {
        if (!data || !data.type) {
            //console.error("Missing collision data");
        }
        let body;
        if (data.type == CollisionType.Circle) {
            // noinspection TypeScriptValidateJSTypes
            body = matter_js_1.Bodies.circle(pos.x, pos.y, data.rad * scale, { isStatic: true });
        }
        else if (data.type == CollisionType.Rectangle) {
            let rect = Utils.rotateRect(pos, data.min, data.max, scale, orientation);
            const width = rect.max.x - rect.min.x, height = rect.max.y - rect.min.y;
            const x = rect.min.x + width / 2, y = rect.min.y + height / 2;
            if (width == 0 || height == 0)
                return null;
            body = matter_js_1.Bodies.rectangle(x, y, width, height, { isStatic: true });
        }
        //if(scale != 1) Body.scale(body, scale, scale);
        body.collisionFilter.category = CollisionCategory.Obstacle;
        body.collisionFilter.mask = CollisionCategory.Player;
        return body;
    }
    static unitVecToRadians(v) {
        return Math.atan2(v.y, v.x);
    }
}
exports.Utils = Utils;
class SurvivBitStream extends bit_buffer_1.BitStream {
    constructor(source, byteOffset = 0, byteLength = 0) {
        super(source, byteOffset, byteLength);
    }
    static alloc(length) {
        return new SurvivBitStream(Buffer.alloc(length));
    }
    writeString(str) { this.writeASCIIString(str); }
    writeStringFixedLength(str, len) { this.writeASCIIString(str, len); }
    readString() { return this.readASCIIString(); }
    writeFloat(val, min, max, bitCount) {
        const range = (1 << bitCount) - 1, x = val < max ? (val > min ? val : min) : max, t = (x - min) / (max - min);
        this.writeBits(t * range + 0.5, bitCount);
    }
    readFloat(min, max, bitCount) {
        const range = (1 << bitCount) - 1;
        return min + (max - min) * this.readBits(bitCount) / range;
    }
    writeVec(vec, minX, minY, maxX, maxY, bitCount) {
        this.writeFloat(vec.x, minX, maxX, bitCount);
        this.writeFloat(vec.y, minY, maxY, bitCount);
    }
    readVec(minX, minY, maxX, maxY, bitCount) {
        return matter_js_1.Vector.create(this.readFloat(minX, maxX, bitCount), this.readFloat(minY, maxY, bitCount));
    }
    writeUnitVec(vec, bitCount) {
        this.writeVec(vec, -1, -1, 1, 1, bitCount);
    }
    readUnitVec(bitCount) {
        return this.readVec(-1, -1, 1, 1, bitCount);
    }
    writeVec32(vec) {
        this.writeFloat32(vec.x);
        this.writeFloat32(vec.y);
    }
    readVec32() {
        return matter_js_1.Vector.create(this.readFloat32(), this.readFloat32());
    }
    writeAlignToNextByte() {
        const offset = 8 - this.index % 8;
        if (offset < 8)
            this.writeBits(0, offset);
    }
    readAlignToNextByte() {
        const offset = 8 - this.index % 8;
        if (offset < 8)
            this.readBits(offset);
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
exports.SurvivBitStream = SurvivBitStream;
//# sourceMappingURL=utils.js.map