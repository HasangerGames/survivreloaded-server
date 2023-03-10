"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AliveCountsPacket = void 0;
const packet_1 = require("./packet");
const utils_1 = require("../utils");
class AliveCountsPacket extends packet_1.Packet {
    constructor(p) {
        super(p);
        this.allocBytes = 3;
    }
    writeData(stream) {
        stream.writeUint8(utils_1.MsgType.AliveCounts);
        stream.writeUint8(1); // Team count (2 for 50v50, 1 for everything else)
        stream.writeUint8(this.p.game.aliveCount);
    }
}
exports.AliveCountsPacket = AliveCountsPacket;
//# sourceMappingURL=aliveCountsPacket.js.map