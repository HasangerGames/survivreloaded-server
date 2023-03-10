"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Obstacle = void 0;
const matter_js_1 = require("matter-js");
const utils_1 = require("../../utils");
const loot_1 = require("./loot");
const gameObject_1 = require("./gameObject");
class Obstacle extends gameObject_1.GameObject {
    initialOrientation;
    minScale;
    maxScale;
    health;
    maxHealth;
    healthT = 1;
    teamId = 0;
    isPuzzlePiece = false;
    isSkin = false;
    isButton = false;
    button;
    isDoor = false;
    door;
    interactionRad;
    showOnMap;
    collidable;
    reflectBullets;
    destructible;
    body;
    collision; // TODO Testing code, delete me
    constructor(id, typeString, position, layer, orientation, game, scale, data) {
        super(id, typeString, position, layer, orientation, game);
        this.kind = utils_1.ObjectKind.Obstacle;
        this._position = position;
        this.orientation = orientation;
        this.scale = scale; // Min: 0.125, max: 2.5
        this.minScale = data.scale.destroy;
        this.maxScale = this.scale;
        this.health = data.health;
        this.maxHealth = data.health;
        this.layer = layer;
        this.isSkin = false;
        this.showOnMap = data.map ? data.map.display : false;
        this.collidable = data.collidable;
        this.reflectBullets = data.reflectBullets;
        this.destructible = data.destructible;
        this.body = utils_1.Utils.bodyFromCollisionData(data.collision, position, orientation, scale);
        if (this.body != null) {
            if (!this.collidable)
                this.body.isSensor = true;
            this.game.addBody(this.body);
        }
        // TODO Testing code, delete me
        this.collision = data.collision;
        this.isDoor = data.door != undefined;
        if (this.isDoor) {
            this.door = {
                open: false,
                canUse: data.door.canUse,
                locked: false
            };
            this.interactionRad = data.door.interactionRad;
            this.body.isSensor = true; // TODO THIS DISABLES DOOR COLLISIONS; remove once door collisions are implemented
        }
        this.isButton = data.button != undefined;
        if (this.isButton) {
            this.button = {
                onOff: false,
                canUse: data.button.canUse
            };
        }
        this.isPuzzlePiece = false;
    }
    get position() {
        return this._position;
    }
    damage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = this.healthT = 0;
            this.dead = true;
            this.collidable = false;
            if (this.door)
                this.door.canUse = false;
            this.game.removeBody(this.body);
            this.game.fullDirtyObjects.push(this.id);
            const loot = new loot_1.Loot(this.game.map.objects.length, "15xscope", this.position, 0, this.game, 1);
            this.game.map.objects.push(loot);
            this.game.fullDirtyObjects.push(loot.id);
        }
        else {
            this.healthT = this.health / this.maxHealth;
            const oldScale = this.scale;
            if (this.minScale < 1)
                this.scale = this.healthT * (this.maxScale - this.minScale) + this.minScale;
            const scaleFactor = this.scale / oldScale;
            matter_js_1.Body.scale(this.body, scaleFactor, scaleFactor);
            this.game.partialDirtyObjects.push(this.id);
        }
    }
    interact(p) {
        this.door.open = !this.door.open;
        // TODO Make the door push players out of the way when opened, not just when closed
        // When pushing, ensure that they won't get stuck in anything.
        // If they do, move them to the opposite side regardless of their current position.
        /*if(this.doorOpen) {
            if(p.isOnOtherSide(this)) {

            } else {

            }
        } else {

        }*/
    }
    serializePart(stream) {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeBits(this.orientation, 2);
        stream.writeFloat(this.scale, 0.125, 2.5, 8);
        stream.writeBits(0, 6); // Padding
    }
    serializeFull(stream) {
        stream.writeFloat(this.healthT, 0, 1, 8);
        stream.writeMapType(this.typeId);
        stream.writeString(this.typeString);
        stream.writeBits(this.layer, 2);
        stream.writeBoolean(this.dead);
        stream.writeBoolean(this.isDoor);
        stream.writeUint8(this.teamId);
        if (this.isDoor) {
            stream.writeBoolean(this.door.open);
            stream.writeBoolean(this.door.canUse);
            stream.writeBoolean(this.door.locked);
            stream.writeBits(0, 5); // door seq
        }
        stream.writeBoolean(this.isButton);
        if (this.isButton) {
            stream.writeBoolean(this.button.onOff);
            stream.writeBoolean(this.button.canUse);
            stream.writeBits(0, 6); // button seq
        }
        stream.writeBoolean(this.isPuzzlePiece);
        stream.writeBoolean(this.isSkin);
        stream.writeBits(0, 5); // Padding
    }
}
exports.Obstacle = Obstacle;
//# sourceMappingURL=obstacle.js.map