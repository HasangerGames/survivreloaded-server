import Matter from "matter-js";

import { Objects, ObjectKind, CollisionType, GameOptions, Utils, Vector } from "../utils";
import { Point } from "../utils";
import { Game } from "./game";

class River {
    width: number;
    looped: boolean;
    points: Point[];

    constructor(width, looped, points) {
        this.width = width;
        this.looped = looped;
        this.points = points;
    }
}

class Place {
    name: string;
    pos: Point;

    constructor(name, pos) {
        this.name = name;
        this.pos = pos;
    }
}

class Obstacle {
    readonly isPlayer: boolean = false;
    readonly kind: ObjectKind = ObjectKind.Obstacle;

    id: number;

    game: Game;

    pos: Point;
    initialPos: Point;

    ori: number;
    initialOri: number;

    scale: number;
    minScale: number;
    maxScale: number;

    health: number;
    maxHealth: number;
    healthT: number = 1;

    type: string;

    layer: number;
    dead: boolean = false;
    teamId: number = 0;

    mapType: number;
    isPuzzlePiece: boolean = false;
    isSkin: boolean = false;

    isButton: boolean = false;
    buttonOnOff?: boolean;
    buttonCanUse?: boolean;

    isDoor: boolean = false;
    doorOpen?: boolean;
    doorCanUse?: boolean;
    doorLocked?: boolean;
    interactionRad?: number;

    showOnMap: boolean;

    collidable: boolean;
    reflectBullets: boolean;
    destructible: boolean;

    collisionMin?: Point;
    collisionMax?: Point;
    collisionPos?: Point;
    collisionRad?: number;
    collision: {
        type: CollisionType;
        initialMin: Point;
        initialMax: Point;
        min: Point;
        max: Point;
        rad?: number;
        pos?: Point;

        doorOpen?: {
            min: Point;
            max: Point;
        }

        doorOpenAlt?: {
            min: Point;
            max: Point;
        }
    };
    body: Matter.Body;

    doorOpenOri: number;
    doorOpenAltOri: number;

    constructor(id, game, data, type, pos, ori, scale, layer) {
        this.id = id;
        this.game = game;
        this.pos = pos;
        this.initialPos = pos;
        this.ori = ori;
        this.initialOri = ori;
        this.scale = scale; // Min: 0.125, max: 2.5
        this.minScale = data.scale.destroy;
        this.maxScale = this.scale;

        this.health = data.health;
        this.maxHealth = data.health;

        this.type = type;
        this.mapType = Utils.typeToId(type);

        this.layer = layer ? layer : 0;
        this.isButton = false;
        this.isPuzzlePiece = false;
        this.isSkin = false;
        this.showOnMap = data.map ? data.map.display : false;

        this.collidable = data.collidable;
        this.reflectBullets = data.reflectBullets;
        this.destructible = data.destructible;
        this.collision = JSON.parse(JSON.stringify(data.collision));
        if(this.collision.type == CollisionType.Rectangle) {
            this.collision.initialMin = this.collision.min;
            this.collision.initialMax = this.collision.max;
        }
        if(this.collision.type == CollisionType.Circle) {
            this.body = Matter.Bodies.circle(this.pos.x, this.pos.y, this.collision.rad, { isStatic: true });
            this.game.addBody(this.body);
        }
        this.recalculateCollisionPos();

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

        this.isButton = data.button != undefined;
        if(this.isButton) {
            this.buttonOnOff = false;
            this.buttonCanUse = data.button.canUse;
        }
    }

    damage(amount) {
        this.health -= amount;
        if(this.health <= 0) {
            this.health = this.healthT = 0;
            this.dead = true;
            this.collidable = false;
            this.doorCanUse = false;
        } else {
            this.healthT = this.health / this.maxHealth;
            if(this.minScale < 1) this.scale = this.healthT * (this.maxScale - this.minScale) + this.minScale;
            this.recalculateCollisionPos();
        }
    }

    interact(p) {
        this.doorOpen = !this.doorOpen;
        // TODO Make the door push players out of the way when opened, not just when closed
        // When pushing, ensure that they won't get stuck in anything.
        // If they do, move them to the opposite side regardless of their current position.
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

    recalculateCollisionPos() {
        if(this.collision.type == CollisionType.Circle) {
            this.collisionPos = Vector.add(this.pos, this.collision.pos);
            this.collisionRad = this.collision.rad * this.scale;
        } else if(this.collision.type == CollisionType.Rectangle) {
            const rotated = Utils.rotateRect(
                this.pos,
                this.collision.initialMin,
                this.collision.initialMax,
                this.scale,
                this.ori
            );
            this.collisionMin = this.collision.min = rotated.min;
            this.collisionMax = this.collision.max = rotated.max;
        }
    }

}

class Building {
    readonly isPlayer = false;
    readonly kind: ObjectKind = ObjectKind.Building;

    showOnMap: boolean;

    id: any;
    layer: number;
    mapType: number;

    pos: Point;
    type: string;
    ori: number;
    scale: number = 1;

    ceilingDead: boolean = false;
    occupied: boolean = false;
    ceilingDamaged: boolean = false;
    hasPuzzle: boolean = false;


    constructor(id: any, pos: Point, type: string, ori, layer: number, showOnMap: boolean) {
        this.showOnMap = showOnMap;

        this.id = id;
        this.mapType = Utils.typeToId(type);
        this.pos = pos;
        this.type = type;
        this.ori = ori;
        this.layer = layer;
    }
}

class Structure {
    readonly isPlayer: boolean = false;
    readonly kind: ObjectKind = ObjectKind.Structure;
    showOnMap: boolean = false;

    id: any;
    mapType: number;
    pos: Point;
    type: string;
    ori: number;
    scale: number = 1;
    layerObjIds: any[];

    constructor(id: any, pos: Point, type, ori, layerObjIds) {
        this.id = id;
        this.mapType = Utils.typeToId(type);
        this.pos = pos;
        this.type = type;
        this.ori = ori;
        this.layerObjIds = layerObjIds;
    }
}

class GroundPatch {
    min: Point;
    max: Point;
    color: number;
    roughness: number;
    offsetDist: number;
    order: number;
    useAsMapShape: boolean;

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

export { River, Place, Obstacle, Building, Structure, GroundPatch };
