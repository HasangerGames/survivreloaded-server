"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameObject = void 0;
const utils_1 = require("../../utils");
class GameObject {
    kind;
    id;
    typeString;
    typeId;
    _position;
    layer;
    orientation;
    scale = 1;
    dead = false;
    game;
    body;
    constructor(id, typeString, position, layer, orientation, game) {
        this.id = id;
        this.typeString = typeString;
        if (this.typeString)
            this.typeId = utils_1.TypeToId[typeString];
        this._position = position;
        this.layer = layer;
        this.orientation = orientation;
        this.game = game;
    }
    get position() {
        return this._position;
    }
}
exports.GameObject = GameObject;
//# sourceMappingURL=gameObject.js.map