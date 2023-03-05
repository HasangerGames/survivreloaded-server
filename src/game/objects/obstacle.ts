import { ObjectKind, Point, TypeToId, Utils } from "../../utils";
import { Game } from "../game";
import { Player } from "./player";
import { Body } from "matter-js";

export class Obstacle {
    readonly kind: ObjectKind = ObjectKind.Obstacle;

    id: number;

    game: Game;

    _position: Point;
    orientation: number;
    initialOrientation: number;

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

    body: Body;

    constructor(id: number,
                game: Game,
                data,
                type: string,
                position: Point,
                orientation: number,
                scale: number,
                layer: number = 0) {
        this.id = id;
        this.game = game;
        this._position = position;
        this.orientation = orientation;
        this.scale = scale; // Min: 0.125, max: 2.5
        this.minScale = data.scale.destroy;
        this.maxScale = this.scale;

        this.health = data.health;
        this.maxHealth = data.health;

        this.type = type;
        this.mapType = TypeToId[type];

        this.layer = layer;
        this.isSkin = false;
        this.showOnMap = data.map ? data.map.display : false;

        this.collidable = data.collidable;
        this.reflectBullets = data.reflectBullets;
        this.destructible = data.destructible;
        this.body = Utils.bodyFromCollisionData(data.collision, position, orientation, scale);
        if(this.body != null) {
            if(!this.collidable) this.body.isSensor = true;
            this.game.addBody(this.body);
        }

        this.isDoor = data.door != undefined;
        if(this.isDoor) {
            this.doorOpen = false;
            this.doorCanUse = data.door.canUse;
            this.doorLocked = false;
            this.interactionRad = data.door.interactionRad;
            this.body.isSensor = true; // TODO THIS DISABLES DOOR COLLISIONS; remove once door collisions are implemented
        }

        this.isButton = data.button != undefined;
        if(this.isButton) {
            this.buttonOnOff = false;
            this.buttonCanUse = data.button.canUse;
        }

        this.isPuzzlePiece = false;
    }

    get position(): Point {
        return this._position;
    }

    damage(source, amount: number): void {
        this.health -= amount;
        if(this.health <= 0) {
            this.health = this.healthT = 0;
            this.dead = true;
            this.collidable = false;
            this.doorCanUse = false;
            this.game.removeBody(this.body);
        } else {
            this.healthT = this.health / this.maxHealth;
            const oldScale: number = this.scale;
            if(this.minScale < 1) this.scale = this.healthT * (this.maxScale - this.minScale) + this.minScale;
            const scaleFactor: number = this.scale / oldScale;
            Body.scale(this.body, scaleFactor, scaleFactor);
        }
    }

    interact(p: Player): void {
        this.doorOpen = !this.doorOpen;
        // TODO Make the door push players out of the way when opened, not just when closed
        // When pushing, ensure that they won't get stuck in anything.
        // If they do, move them to the opposite side regardless of their current position.
        if(this.doorOpen) {
            if(p.isOnOtherSide(this)) {

            } else {

            }
        } else {

        }
    }

}
