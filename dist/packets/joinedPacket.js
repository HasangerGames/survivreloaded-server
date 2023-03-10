"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JoinedPacket = void 0;
const packet_1 = require("./packet");
const utils_1 = require("../utils");
class JoinedPacket extends packet_1.Packet {
    constructor(p) {
        super(p);
        this.allocBytes = 512;
    }
    writeData(stream) {
        stream.writeUint8(utils_1.MsgType.Joined);
        stream.writeUint8(1); // Team mode
        stream.writeUint16(this.p.id); // Player ID
        stream.writeBoolean(false); // Game started
        stream.writeUint8(6); // Emote count
        for (let i = 0; i < 6; i++)
            stream.writeGameType(this.p.loadout.emotes[i]);
    }
}
exports.JoinedPacket = JoinedPacket;
//# sourceMappingURL=joinedPacket.js.map