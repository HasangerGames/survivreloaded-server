"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Packet = void 0;
class Packet {
    allocBytes = 0;
    msgType;
    p;
    constructor(p) {
        this.p = p;
    }
    writeData(stream) {
        stream.writeUint8(this.msgType);
    }
}
exports.Packet = Packet;
//# sourceMappingURL=packet.js.map