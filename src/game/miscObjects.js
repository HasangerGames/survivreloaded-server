const {Objects, ObjectKind, GameOptions, Utils, Vector} = require("../utils.js");

class River {
    constructor(width, looped, points) {
        this.width = width;
        this.looped = looped;
        this.points = points;
    }
}

class Place {
    constructor(name, pos) {
        this.name = name;
        this.pos = pos;
    }
}

class Obstacle {

    constructor(id, data, type, pos, ori, scale, layer) {
        this.isPlayer = false;
        this.kind = ObjectKind.Obstacle;

        this.id = id;
        this.pos = pos;
        this.initialPos = pos;
        this.ori = ori;
        this.initialOri = ori;
        this.scale = scale; // Min: 0.125, max: 2.5

        this.health = data.health;
        this.maxHealth = data.health;
        this.healthT = 1;

        this.type = type;
        this.mapType = Utils.typeToId(type);

        this.layer = layer ? layer : 0;
        this.dead = false;
        this.teamId = 0;
        this.isButton = false;
        this.isPuzzlePiece = false;
        this.isSkin = false;
        this.showOnMap = data.map ? data.map.display : false;

        this.collidable = data.collidable;
        this.reflectBullets = data.reflectBullets;
        this.destructible = data.destructible;
        this.collision = JSON.parse(JSON.stringify(data.collision));
        if(this.collision.type == 1) {
            const rotated = Utils.rotateRect(
                this.pos,
                this.collision.min,
                this.collision.max,
                this.scale,
                this.ori
            );
            this.collisionMin = this.collision.min = rotated.min;
            this.collisionMax = this.collision.max = rotated.max;
        }

        this.isDoor = data.door != undefined;
        if(this.isDoor) {
            this.doorOpen = false;
            this.doorCanUse = data.door.canUse;
            this.doorLocked = false;
            this.interactionRad = data.door.interactionRad;

            switch(ori) {
                case 0:
                    this.doorOpenOri = 1;
                    this.doorOpenAltOri = 3;
                    break;
                case 1:
                    this.doorOpenOri = 2;
                    this.doorOpenAltOri = 0;
                    break;
                case 2:
                    this.doorOpenOri = 3;
                    this.doorOpenAltOri = 1;
                    break;
                case 3:
                    this.doorOpenOri = 0;
                    this.doorOpenAltOri = 2;
                    break;
            }

            const rotated = Utils.rotateRect(
                this.pos,
                data.collision.min,
                data.collision.max,
                this.scale,
                this.doorOpenOri
            );
            this.collision.doorOpen = rotated;

            const rotatedAlt = Utils.rotateRect(
                this.pos,
                data.collision.min,
                data.collision.max,
                this.scale,
                this.doorOpenAltOri
            );
            this.collision.doorOpenAlt = rotatedAlt;
        }
    }

    damage(amount) {
        this.health -= amount;
        if(this.health <= 0) {
            this.health = 0;
            this.dead = true;
            this.collidable = false;
            this.doorCanUse = false;
        }
        this.healthT = this.health / this.maxHealth;
    }

    interact(p) {
        this.doorOpen = !this.doorOpen;
        // TODO Make the door push players out of the way when opened, not just when closed
        if(this.doorOpen) {
            if(p.isOnOtherSide(this)) {
                this.ori = this.doorOpenAltOri;
                this.collisionMin = this.collision.doorOpenAlt.min;
                this.collisionMax = this.collision.doorOpenAlt.max;
            } else {
                this.ori = this.doorOpenOri;
                this.collisionMin = this.collision.doorOpen.min;
                this.collisionMax = this.collision.doorOpen.max;
            }
        } else {
            this.ori = this.initialOri;
            this.collisionMin = this.collision.min;
            this.collisionMax = this.collision.max;
            if(Utils.rectCollision(this.collisionMin, this.collisionMax, p.pos, 1)) {
                if(p.isOnOtherSide(this)) {
                    switch(this.ori) {
                        case 0:
                            p.pos.x = this.collisionMin.x - 1;
                            break;
                        case 1:
                            p.pos.y = this.collisionMin.y - 1;
                            break;
                        case 2:
                            p.pos.x = this.collisionMax.x + 1;
                            break;
                        case 3:
                            p.pos.y = this.collisionMax.y + 1;
                            break;
                    }
                } else {
                    switch(this.ori) {
                        case 0:
                            p.pos.x = this.collisionMax.x + 1;
                            break;
                        case 1:
                            p.pos.y = this.collisionMax.y + 1;
                            break;
                        case 2:
                            p.pos.x = this.collisionMin.x - 1;
                            break;
                        case 3:
                            p.pos.y = this.collisionMin.y - 1;
                            break;
                    }
                }
            }
        }
    }

}

class Building {
    constructor(id, pos, type, ori, layer, showOnMap) {
        this.isPlayer = false;
        this.showOnMap = showOnMap;
        this.kind = ObjectKind.Building;

        this.id = id;
        this.mapType = Utils.typeToId(type);
        this.pos = pos;
        this.type = type;
        this.ori = ori;
        this.scale = 1;
        this.layer = layer;

        this.ceilingDead = false;
        this.occupied = false;
        this.ceilingDamaged = false;
        this.hasPuzzle = false;
    }
}

class GroundPatch {
    constructor(min, max, color, roughness, offsetDist, order, useAsMapShape) {
        this.min = min; // vector
        this.max = max; // vector
        this.color = color; // uint32
        this.roughness = roughness; // float32
        this.offsetDist = offsetDist; // float32
        this.order = order; // 7-bit integer
        this.useAsMapShape = useAsMapShape; // boolean (1 bit)
    }
}

module.exports.River = River;
module.exports.Place = Place;
module.exports.Obstacle = Obstacle;
module.exports.Building = Building;
module.exports.GroundPatch = GroundPatch;
