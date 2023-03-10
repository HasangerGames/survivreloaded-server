"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeadBody = void 0;
const utils_1 = require("../../utils");
const gameObject_1 = require("./gameObject");
class DeadBody extends gameObject_1.GameObject {
    playerId;
    constructor(id, layer, position, playerId) {
        super(id, "", position, 0, layer);
        this.kind = utils_1.ObjectKind.DeadBody;
        this.playerId = playerId;
    }
    serializePart(stream) {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
    }
    serializeFull(stream) {
        stream.writeUint8(this.layer);
        stream.writeUint16(this.playerId);
    }
}
exports.DeadBody = DeadBody;
//# sourceMappingURL=deadBody.js.map