"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Loot = void 0;
const matter_js_1 = require("matter-js");
const utils_1 = require("../../utils");
const gameObject_1 = require("./gameObject");
class Loot extends gameObject_1.GameObject {
    count;
    constructor(id, typeString, position, layer, game, count) {
        super(id, typeString, position, layer, undefined, game);
        this.kind = utils_1.ObjectKind.Loot;
        this.count = count;
        this.body = matter_js_1.Bodies.circle(position.x, position.y, 1);
        this.game.addBody(this.body);
    }
    get position() {
        return this.body.position;
    }
    serializePart(stream) {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
    }
    serializeFull(stream) {
        stream.writeGameType(this.typeId);
        stream.writeUint8(this.count);
        stream.writeBits(this.layer, 2);
        stream.writeBoolean(false); // Is old
        stream.writeBoolean(false); // Is preloaded gun
        stream.writeBoolean(false); // Has owner
    }
}
exports.Loot = Loot;
//# sourceMappingURL=loot.js.map