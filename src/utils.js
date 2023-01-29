const fs = require('fs');
const Settings = JSON.parse(fs.readFileSync('settings.json'));
const MapObjects = JSON.parse(fs.readFileSync('mapObjects.json'));
const BitStream = require('bit-buffer').BitStream;

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
        return new BitStream(this.truncate(stream).buffer);
    }

    static send(socket, packet) {
        socket.send(Utils.truncate(packet));
    }

	static random(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    static randomVec(minX, maxX, minY, maxY) {
        return new Vector(Utils.random(minX, maxX), Utils.random(minY, maxY));
    }

    static randomFloat(min, max) {
        const str = (Math.random() * (max - min + 1) + min).toFixed(2);
        return parseFloat(str);
    }

    static distanceBetween(v1, v2) {
        return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2));
    }

    static mapTypeToId(type) {
        for(const object of MapObjects) {
            if(object.type == type) return object.id;
        }
    }
    
}

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

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
    return new Vector(this.readFloat(minX, maxX, bitCount), this.readFloat(minY, maxY, bitCount));
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
    return new Vector(this.readFloat32(), this.readFloat32());
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

module.exports.Settings = Settings;
module.exports.Vector = Vector;
module.exports.Utils = Utils;
module.exports.MsgType = MsgType;
module.exports.ObjectKind = ObjectKind;
