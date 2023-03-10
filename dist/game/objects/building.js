"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Building = void 0;
const utils_1 = require("../../utils");
const gameObject_1 = require("./gameObject");
class Building extends gameObject_1.GameObject {
    showOnMap;
    occupied = false;
    ceilingDamaged = false;
    hasPuzzle = false;
    constructor(id, typeString, position, layer, orientation, showOnMap, data) {
        super(id, typeString, position, layer, orientation);
        this.kind = utils_1.ObjectKind.Building;
        this.showOnMap = showOnMap;
        if (data.mapObstacleBounds) {
            this.body = utils_1.Utils.bodyFromCollisionData(data.mapObstacleBounds[0], this.position);
        }
    }
    serializePart(stream) {
        stream.writeBoolean(this.dead); // Ceiling destroyed
        stream.writeBoolean(this.occupied);
        stream.writeBoolean(this.ceilingDamaged);
        stream.writeBoolean(this.hasPuzzle);
        stream.writeBits(0, 4); // Padding
    }
    serializeFull(stream) {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeMapType(this.typeId);
        stream.writeBits(this.orientation, 2);
        stream.writeBits(this.layer, 2);
    }
}
exports.Building = Building;
//# sourceMappingURL=building.js.map