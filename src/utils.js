global.DEBUG_MODE = false;

const fs = require('fs');
const BitStream = require('bit-buffer').BitStream;

function readJSON(path) {
    return JSON.parse(fs.readFileSync(path));
}

const Objects = readJSON("data/objects.json");
const Maps = readJSON("data/maps.json");
const Items = readJSON("data/items.json");
const Melees = readJSON("data/melee.json");
const Guns = readJSON("data/guns.json");
const Bullets = readJSON("data/bullets.json");

const GameOptions = readJSON("data/game.json");
const typeToId = readJSON("data/ids.json");

const ObjectKind = {
    Invalid: 0,
    Player: 1,
    Obstacle: 2,
    Loot: 3,
    LootSpawner: 4,
    DeadBody: 5,
    Building: 6,
    Structure: 7,
    Decal: 8,
    Projectile: 9,
    Smoke: 10,
    Airdrop: 11,
    Npc: 12,
    Skitternade: 13
};

const MsgType = {
    None: 0,
    Join: 1,
    Disconnect: 2,
    Input: 3,
    Edit: 4,
    Joined: 5,
    Update: 6,
    Kill: 7,
    GameOver: 8,
    Pickup: 9,
    Map: 10,
    Spectate: 11,
    DropItem: 12,
    Emote: 13,
    PlayerStats: 14,
    AdStatus: 15,
    Loadout: 16,
    RoleAnnouncement: 17,
    Stats: 18,
    UpdatePass: 19,
    AliveCounts: 20,
    PerkModeRoleSelect: 21,
    GamePlayerStats: 22,
    BattleResults: 23
};

const InputType = {
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
};

const CollisionType = {Circle: 0, Rectangle: 1};

class Utils {

    static createStream(length) {
        return new BitStream(Buffer.alloc(length));
    }

    static truncate(stream) {
        const oldArray = new Uint8Array(stream.buffer);
        const newArray = new Uint8Array(Math.ceil(stream.index / 8));
        for(let i = 0; i < newArray.length; i++)
            newArray[i] = oldArray[i];
        return newArray;
    }

    static truncateToBitStream(stream) {
        return new BitStream(Utils.truncate(stream).buffer);
    }

    static send(socket, packet) {
        socket.send(Utils.truncate(packet));
    }

    static randomBase(min, max) {
        return Math.random() * (max - min) + min;
    }

    static random(min, max) {
        return Math.floor(Utils.randomBase(min, max + 1));
    }

    static randomVec(minX, maxX, minY, maxY) {
        return Vector.create(Utils.random(minX, maxX), Utils.random(minY, maxY));
    }

    static randomFloat(min, max) {
        return Utils.randomBase(min, max).toFixed(3);
    }

    // https://stackoverflow.com/a/55671924/5905216
    static weightedRandom(items, weights) {
        var i;

        for (i = 1; i < weights.length; i++)
            weights[i] += weights[i - 1];
        
        var random = Math.random() * weights[weights.length - 1];
        
        for (i = 0; i < weights.length; i++)
            if (weights[i] > random)
                break;
        
        return items[i];
    }

    static distanceBetween(v1, v2) {
        return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2));
    }

    static typeToId(type) {
        return typeToId[type];
    }

    static getBuildingByType(type) {
        for(const building of Buildings) {
            if(building.type == type) return building;
        }
    }

    static intersectSegmentCircle(pos1, pos2, pos3, rad) {
        var lengthVec = Vector.sub(pos2, pos1),
            length = Math.max(Vector.length(lengthVec), 0);
        lengthVec = Vector.div(lengthVec, length);

        var distToCircleCenter = Vector.sub(pos1, pos3);
        var dot1 = Vector.dot(distToCircleCenter, lengthVec);
        var dot2 = Vector.dot(distToCircleCenter, distToCircleCenter) - rad * rad;

        if(dot2 > 0 && dot1 > 0) return null;

        var dot3 = dot1 * dot1 - dot2;
        if(dot3 < 0) return null;

        var dot4 = Math.sqrt(dot3),
            dot5 = -dot1 - dot4;

        if(dot5 < 0) dot5 = -dot1 + dot4;

        if(dot5 <= length) {
            var point = Vector.add(pos1, Vector.mul(lengthVec, dot5));
            return {point: point, normal: Vector.normalize(Vector.sub(point, pos3))};
        }

        return null;
    }

    static intersectSegmentAabb(_0x23ceb6, _0x59a5d7, _0x4f0246, _0x5a5053) {
        var _0x43f30b = 0, _0x18dcc1 = Number.MAX_VALUE, _0x8d825d = 0.000009999999974752427, _0x5380e0 = _0x23ceb6, _0x975673 = Vector.sub(_0x59a5d7, _0x23ceb6), _0x227528 = Vector.length(_0x975673);
        _0x975673 = _0x227528 > _0x8d825d ? Vector.div(_0x975673, _0x227528) : Vector.create(1, 0);
        var _0x28a8a0 = Math.abs(_0x975673.x), _0x102e1e = Math.abs(_0x975673.y);
        _0x28a8a0 < _0x8d825d && (_0x975673.x = _0x8d825d * 2, _0x28a8a0 = _0x975673.x);
        _0x102e1e < _0x8d825d && (_0x975673.y = _0x8d825d * 2, _0x102e1e = _0x975673.y);
        if (_0x28a8a0 > _0x8d825d) {
        var _0x195ecd = (_0x4f0246.x - _0x5380e0.x) / _0x975673.x, _0x3ab551 = (_0x5a5053.x - _0x5380e0.x) / _0x975673.x;
        _0x43f30b = _0x32d8cb.max(_0x43f30b, _0x32d8cb.min(_0x195ecd, _0x3ab551)), _0x18dcc1 = _0x32d8cb.min(_0x18dcc1, _0x32d8cb.max(_0x195ecd, _0x3ab551));
        if (_0x43f30b > _0x18dcc1) return null;
        }
        if (_0x102e1e > _0x8d825d) {
        var _0x3e33f4 = (_0x4f0246.y - _0x5380e0.y) / _0x975673.y, _0x3a1fad = (_0x5a5053.y - _0x5380e0.y) / _0x975673.y;
        _0x43f30b = _0x32d8cb.max(_0x43f30b, _0x32d8cb.min(_0x3e33f4, _0x3a1fad)), _0x18dcc1 = _0x32d8cb.min(_0x18dcc1, _0x32d8cb.max(_0x3e33f4, _0x3a1fad));
        if (_0x43f30b > _0x18dcc1) return null;
        }
        if (_0x43f30b > _0x227528) return null;
        var _0x38d1b4 = Vector.add(_0x23ceb6, Vector.mul(_0x975673, _0x43f30b)), _0x6fd575 = Vector.add(_0x4f0246, Vector.mul(Vector.sub(_0x5a5053, _0x4f0246), 0.5)), _0x3bce35 = Vector.sub(_0x38d1b4, _0x6fd575), _0x4903d4 = Vector.mul(Vector.sub(_0x4f0246, _0x5a5053), 0.5), _0x4dc6ec = _0x3bce35.x / Math.abs(_0x4903d4.x) * 1.0010000000002037, _0x41741c = _0x3bce35.y / Math.abs(_0x4903d4.y) * 1.0010000000002037, _0x5691aa = Vector.normalizeSafe(Vector.create(_0x4dc6ec < 0 ? Math.ceil(_0x4dc6ec) : Math.floor(_0x4dc6ec), _0x41741c < 0 ? Math.ceil(_0x41741c) : Math.floor(_0x41741c)), Vector.create(1, 0));
        return {point: _0x38d1b4, normal: _0x5691aa};
    }

    static getLine(origin, length, angle) {
        return Vector.create(origin.x + length * Math.cos(angle), origin.y + length * Math.sin(angle));
    }

    static circleCollision(pos1, r1, pos2, r2) {
        var a = r1 + r2;
        var x = pos1.x - pos2.x;
        var y = pos1.y - pos2.y;
        return a > Math.sqrt((x * x) + (y * y));
    }

    static rectCollision(min, max, circlePos, circleRad) {
        // TODO Replace this collision detection function with a more efficient one from the surviv code
        var rectWidth = max.x - min.x - 0.1;
        var rectHeight = max.y - min.y - 0.2;
        min = Vector.add2(min, rectWidth/2, rectHeight/2);
        var distx = Math.abs(circlePos.x - min.x);
        var disty = Math.abs(circlePos.y - min.y);

        if (distx > (rectWidth/2 + circleRad)) { return false; }
        if (disty > (rectHeight/2 + circleRad)) { return false; }

        if (distx <= (rectWidth/2)) { return true; }
        if (disty <= (rectHeight/2)) { return true; }

        var hypot = (distx - rectWidth/2)*(distx- rectWidth/2) +
                             (disty - rectHeight/2)*(disty - rectHeight/2);

        return (hypot <= (circleRad*circleRad));
    }

    static addAdjust(pos1, pos2, ori) {
        if(ori == 0) return Vector.add(pos1, pos2);
        let xOffset, yOffset;
        switch(ori) {
            case 1:
                xOffset = -pos2.y;
                yOffset = pos2.x;
                break;
            case 2:
                xOffset = -pos2.x;
                yOffset = -pos2.y;
                break;
            case 3:
                xOffset = pos2.y;
                yOffset = -pos2.x;
                break;
        }
        return Vector.add2(pos1, xOffset, yOffset);
    }

    static rotateRect(pos, min, max, scale, ori) {
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

    static create(x, y) {
        return {x: x, y: y};
    }

    static add(v1, v2) {
        return Vector.create(v1.x + v2.x, v1.y + v2.y);
    }

    static add2(v, x, y) {
        return Vector.create(v.x + x, v.y + y);
    }

    static sub(v1, v2) {
        return Vector.create(v1.x - v2.x, v1.y - v2.y);
    }

    static mul(v, n) {
        return Vector.create(v.x * n, v.y * n);
    }

    static div(v, n) {
        return Vector.create(v.x / n, v.y / n);
    }

    static mul2(v1, v2) {
        return Vector.create(v1.x * v2.x, v1.y * v2.y);
    }

    static div2(v1, v2) {
        return Vector.create(v1.x / v2.x, v1.y / v2.y);
    }

    static dot(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y;
    }

    static length(v) {
        return Math.sqrt(Vector.lengthSqr(v));
    }

    static lengthSqr(v) {
        return v.x * v.x + v.y * v.y;
    }

    static rotate(v, angle) {
        const cos = Math.cos(angle), sin = Math.sin(angle);
        return Vector.create(v.x * cos - v.y * sin, v.x * sin + v.y * cos);
    }

    static normalize(v) {
        var len = Vector.length(v);
        return Vector.create(len > 0 ? v.x / len : v.x, len > 0 ? v.y / len : v.y);
    }

    static unitVecToRadians(v) {
        return Math.atan2(v.y, v.x);
    }

}

// TODO: Add writeTruncatedBitStream(stream), sendTo(socket), alloc(length)
BitStream.prototype.writeString = BitStream.prototype.writeASCIIString;
BitStream.prototype.readString = BitStream.prototype.readASCIIString;
BitStream.prototype.writeBytes = function(_0x10f494, _0x214f81, _0x22472f) {
    var arr = new Uint8Array(_0x10f494._view._view.buffer, _0x214f81, _0x22472f);
    this._view._view.set(arr, this._index / 8);
    this._index += _0x22472f * 8;
};
BitStream.prototype.writeFloat = function(val, min, max, bitCount) {
    var _0x450456 = (1 << bitCount) - 1,
        _0x200bc9 = val < max ? (val > min ? val : min) : max,
        _0x32aa59 = (_0x200bc9 - min) / (max - min),
        _0x40e184 = _0x32aa59 * _0x450456 + 0.5;
    this.writeBits(_0x40e184, bitCount);
};
BitStream.prototype.readFloat = function(min, max, bitCount) {
    var divisor = (1 << bitCount) - 1,
        val = this.readBits(bitCount),
        divided = val / divisor;
    return min + divided * (max - min);
};
BitStream.prototype.writeVec = function(vec, minX, minY, maxX, maxY, bitCount) {
    this.writeFloat(vec.x, minX, maxX, bitCount), this.writeFloat(vec.y, minY, maxY, bitCount);
};
BitStream.prototype.readVec = function(minX, minY, maxX, maxY, bitCount) {
    return Vector.create(this.readFloat(minX, maxX, bitCount), this.readFloat(minY, maxY, bitCount));
};
BitStream.prototype.writeUnitVec = function(vec, bitCount) {
    this.writeVec(vec, -1, -1, 1, 1, bitCount);
};
BitStream.prototype.readUnitVec = function(bitCount) {
    return this.readVec(-1, -1, 1, 1, bitCount);
};
BitStream.prototype.writeVec32 = function(vec) {
    this.writeFloat32(vec.x);
    this.writeFloat32(vec.y);
};
BitStream.prototype.readVec32 = function() {
    return Vector.create(this.readFloat32(), this.readFloat32());
};
BitStream.prototype.writeAlignToNextByte = function() {
    var offset = 8 - this.index % 8;
    if(offset < 8) this.writeBits(0, offset);
};
BitStream.prototype.readAlignToNextByte = function() {
    var offset = 8 - this.index % 8;
    if(offset < 8) this.readBits(offset);
};
BitStream.prototype.writeGameType = function(id) {
    this.writeBits(id, 11);
};
BitStream.prototype.readGameType = function() {
    return this.readBits(11);
};
BitStream.prototype.writeMapType = function(id) {
    this.writeBits(id, 12);
};
BitStream.prototype.readMapType = function() {
    return this.readBits(12);
};

Array.prototype.remove = function(o) {
    return this.filter(o2 => o2 !== o);
};

module.exports.Objects = Objects;
module.exports.Maps = Maps;
module.exports.Items = Items;
module.exports.Melees = Melees;
module.exports.Guns = Guns;
module.exports.Bullets = Bullets;
module.exports.GameOptions = GameOptions;
module.exports.ObjectKind = ObjectKind;
module.exports.MsgType = MsgType;
module.exports.InputType = InputType;
module.exports.CollisionType = CollisionType;
module.exports.Utils = Utils;
module.exports.Vector = Vector;
