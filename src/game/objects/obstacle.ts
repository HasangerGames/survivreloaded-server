import { Body, type Vector } from "matter-js";

import { bodyFromCollisionData, Item, LootTables, ObjectKind, type SurvivBitStream, weightedRandom } from "../../utils";
import { type Game } from "../game";
import { type Player } from "./player";
import { Loot } from "./loot";
import { GameObject } from "../gameObject";

export class Obstacle extends GameObject {

    minScale: number;
    maxScale: number;

    health: number;
    maxHealth: number;
    healthT = 1;

    teamId = 0;

    isPuzzlePiece = false;
    isSkin = false;
    isButton = false;
    button: {
        onOff: boolean
        canUse: boolean
    };

    isDoor = false;
    door: {
        open: boolean
        canUse: boolean
        locked: boolean
    };

    showOnMap: boolean;

    collidable: boolean;
    reflectBullets: boolean;
    destructible: boolean;

    loot: Item[] = [];

    collision; // TODO Testing code, delete me

    constructor(id: number,
                typeString: string,
                position: Vector,
                layer: number,
                orientation: number,
                game: Game,
                scale: number,
                data) {
        super(id, typeString, position, layer, orientation, game);
        this.kind = ObjectKind.Obstacle;

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
        this.destructible = this.damageable = data.destructible;
        this.body = bodyFromCollisionData(data.collision, position, orientation, scale);
        if(this.body != null) {
            if(!this.collidable) this.body.isSensor = true;
            this.game!.addBody(this.body);
        }

        // TODO Testing code, delete me
        this.collision = data.collision;

        this.isDoor = data.door !== undefined;
        if(this.isDoor) {
            this.door = {
                open: false,
                canUse: data.door.canUse,
                locked: false
            };
            this.interactable = true;
            this.interactionRad = data.door.interactionRad;
            this.body!.isSensor = true; // TODO THIS DISABLES DOOR COLLISIONS; remove once door collisions are implemented
        }

        this.isButton = data.button !== undefined;
        if(this.isButton) {
            this.button = {
                onOff: false,
                canUse: data.button.canUse
            };
        }

        this.isPuzzlePiece = false;

        if(data.loot) {
            this.loot = [];
            for(const loot of data.loot) {
                const lootTable = LootTables[loot.tier];
                if(!lootTable) {
                    console.warn(`Warning: Loot table not found: ${loot.tier}`);
                    continue;
                }
                const items: string[] = [], weights: number[] = [];
                for(const item in lootTable) {
                    items.push(item);
                    weights.push(lootTable[item].weight);
                }
                const selectedItem = weightedRandom(items, weights);
                this.loot.push(new Item(selectedItem, lootTable[selectedItem].count));
            }
        }
    }

    get position(): Vector {
        return this._position;
    }

    damage(amount: number): void {
        this.health -= amount;
        if(this.health <= 0) {
            this.health = this.healthT = 0;
            this.dead = true;
            this.collidable = false;
            if(this.door) this.door.canUse = false;
            this.game!.removeBody(this.body);
            this.game!.fullDirtyObjects.push(this);
            for(const item of this.loot) {
                const loot: Loot = new Loot(this.game!.nextObjectId, item.type, this.position, 0, this.game!, item.count);
                this.game!.objects.push(loot);
                this.game!.fullDirtyObjects.push(loot);
            }
        } else {
            this.healthT = this.health / this.maxHealth;
            const oldScale: number = this.scale;
            if(this.minScale < 1) this.scale = this.healthT * (this.maxScale - this.minScale) + this.minScale;
            const scaleFactor: number = this.scale / oldScale;
            Body.scale(this.body!, scaleFactor, scaleFactor);
            this.game!.partialDirtyObjects.push(this);
        }
    }

    interact(p: Player): void {
        this.door.open = !this.door.open;
        // TODO Make the door push players out of the way when opened, not just when closed
        // When pushing, ensure that they won't get stuck in anything.
        // If they do, move them to the opposite side regardless of their current position.
        /* if(this.doorOpen) {
            if(p.isOnOtherSide(this)) {

            } else {

            }
        } else {

        } */
    }

    serializePartial(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeBits(this.orientation!, 2);
        stream.writeFloat(this.scale, 0.125, 2.5, 8);
        stream.writeBits(0, 6); // Padding
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeFloat(this.healthT, 0, 1, 8);
        stream.writeMapType(this.typeId);
        stream.writeString(this.typeString);
        stream.writeBits(this.layer, 2);
        stream.writeBoolean(this.dead);
        stream.writeBoolean(this.isDoor);
        stream.writeUint8(this.teamId);

        if(this.isDoor) {
            stream.writeBoolean(this.door.open);
            stream.writeBoolean(this.door.canUse);
            stream.writeBoolean(this.door.locked);
            stream.writeBits(0, 5); // door seq
        }
        stream.writeBoolean(this.isButton);
        if(this.isButton) {
            stream.writeBoolean(this.button.onOff);
            stream.writeBoolean(this.button.canUse);
            stream.writeBits(0, 6); // button seq
        }
        stream.writeBoolean(this.isPuzzlePiece);
        stream.writeBoolean(this.isSkin);
        stream.writeBits(0, 5); // Padding
    }

}
