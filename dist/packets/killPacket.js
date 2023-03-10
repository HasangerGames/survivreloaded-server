"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KillPacket = void 0;
const packet_1 = require("./packet");
const utils_1 = require("../utils");
class KillPacket extends packet_1.Packet {
    killer;
    constructor(p, killer) {
        super(p);
        this.killer = killer;
        this.msgType = utils_1.MsgType.Kill;
        this.allocBytes = 32;
    }
    writeData(stream) {
        super.writeData(stream);
        stream.writeUint8(utils_1.DamageType.Player); // Damage type
        stream.writeGameType(this.killer.loadout.melee); // Item source type
        stream.writeMapType(0); // Map source type
        stream.writeUint16(this.p.id); // Target ID
        stream.writeUint16(this.killer.id); // Killer ID
        stream.writeUint16(this.killer.id); // Kill credit ID. Presumably set to, e.g. a barrel if a barrel dealt the final blow
        stream.writeUint8(this.killer.kills); // Killer kills
        stream.writeBoolean(false); // Downed
        stream.writeBoolean(true); // Killed
        stream.writeAlignToNextByte();
    }
}
exports.KillPacket = KillPacket;
//# sourceMappingURL=killPacket.js.map