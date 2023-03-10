"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Structure = void 0;
const utils_1 = require("../../utils");
const gameObject_1 = require("./gameObject");
class Structure extends gameObject_1.GameObject {
    showOnMap = false;
    layerObjIds;
    constructor(id, typeString, position, orientation, layerObjIds) {
        super(id, typeString, position, 0, orientation);
        this.kind = utils_1.ObjectKind.Structure;
        this.layerObjIds = layerObjIds;
    }
    serializePart(stream) { }
    serializeFull(stream) {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeMapType(this.typeId);
        stream.writeBits(this.orientation, 2);
        stream.writeBoolean(true); // Interior sound enabled
        stream.writeBoolean(false); // Interior sound alt
        stream.writeUint16(this.layerObjIds[0]); // Layer 1 ID
        stream.writeUint16(this.layerObjIds[1]); // Layer 2 ID
    }
}
exports.Structure = Structure;
//# sourceMappingURL=structure.js.map