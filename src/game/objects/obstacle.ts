import {
    bodyFromCollisionData,
    CollisionType,
    distanceBetween,
    Explosion,
    Item,
    LootTables,
    ObjectKind,
    Objects,
    type SurvivBitStream,
    TypeToId,
    weightedRandom
} from "../../utils";
import { type Game } from "../game";
import { type Player } from "./player";
import { Loot } from "./loot";
import { GameObject } from "../gameObject";
import { Vec2 } from "planck";

enum DoorOpenState { Closed, Open, OpenAlt }

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
    destroyType = "";
    explosion = "";

    loot: Item[] = [];

    collision;

    constructor(id: number,
                typeString: string,
                position: Vec2,
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

        this.isDoor = data.door !== undefined;
        if(this.isDoor) {
            this.door = {
                open: false,
                canUse: data.door.canUse,
                locked: false
            };
            this.interactable = true;
            this.interactionRad = data.door.interactionRad;
        }

        this.isButton = data.button !== undefined;
        if(this.isButton) {
            this.button = {
                onOff: false,
                canUse: data.button.canUse
            };
        }

        this.isPuzzlePiece = false;

        this.collidable = data.collidable && !this.isDoor; // TODO THIS DISABLES DOOR COLLISIONS
        this.reflectBullets = data.reflectBullets;
        this.destructible = data.destructible;
        this.damageable = data.destructible;
        this.destroyType = data.destroyType;
        this.explosion = data.explosion;
        if(this.collidable) {
            this.body = bodyFromCollisionData(this.game!.world, data.collision, position, orientation, scale);
        }

        this.collision = JSON.parse(JSON.stringify(data.collision)); // JSON.parse(JSON.stringify(x)) to deep copy object
        if(this.collision.type === CollisionType.Rectangle) {
            this.collision.min = this.position.clone().add(Vec2.mul(this.collision.min, this.scale));
            this.collision.max = this.position.clone().add(Vec2.mul(this.collision.max, this.scale));
        }

        if(data.loot) {
            this.loot = [];
            for(const loot of data.loot) {
                this.getLoot(loot.tier);
            }
        }
    }

    private getLoot(tier: string): void {
        const lootTable = LootTables[tier];
        if(!lootTable) {
            //console.warn(`Warning: Loot table not found: ${tier}`);
            return;
        }
        const items: string[] = [], weights: number[] = [];
        for(const item in lootTable) {
            if(item === "metaTier") continue;
            items.push(item);
            weights.push(lootTable[item].weight);
        }
        const selectedItem = weightedRandom(items, weights);
        if(lootTable.metaTier) this.getLoot(selectedItem);
        else this.loot.push(new Item(selectedItem, lootTable[selectedItem].count));
    }

    get position(): Vec2 {
        return this._position;
    }

    damage(amount: number, source): void {
        this.health -= amount;
        if(this.health <= 0) {
            this.health = this.healthT = 0;
            this.dead = true;
            this.collidable = false;
            if(this.door) this.door.canUse = false;
            if(this.destroyType) {
                const replacementObject: Obstacle = new Obstacle(
                    this.game!.nextObjectId,
                    this.destroyType,
                    this.position,
                    this.layer,
                    this.orientation!,
                    this.game!,
                    1,
                    Objects[this.destroyType]
                );
                this.game!.objects.push(replacementObject);
                this.game!.fullDirtyObjects.push(replacementObject);
            }
            if(this.explosion) {
                const explosion: Explosion = new Explosion(this.position, TypeToId[this.explosion], 0);
                this.game!.explosions.push(explosion);
                for(const player of this.game!.players) {
                    if(distanceBetween(player.position, this.position) < 5) player.damage(100, source, this);
                }
            }
            this.game!.world.destroyBody(this.body!);
            this.game!.fullDirtyObjects.push(this);
            for(const item of this.loot) {
                const loot: Loot = new Loot(this.game!.nextObjectId, item.type, this.position, 0, this.game!, item.count);
                this.game!.objects.push(loot);
                //this.game!.loot.push(loot);
                this.game!.fullDirtyObjects.push(loot);
            }
        } else {
            this.healthT = this.health / this.maxHealth;
            const oldScale: number = this.scale;
            if(this.minScale < 1) this.scale = this.healthT * (this.maxScale - this.minScale) + this.minScale;
            const scaleFactor: number = this.scale / oldScale;
            const shape: any = this.body!.getFixtureList()!.getShape();
            if(this.collision.type === CollisionType.Circle) {
                shape.m_radius = shape.m_radius * scaleFactor;
            } else if(this.collision.type === CollisionType.Rectangle) {
                for(let i = 0; i < shape.m_vertices.length; i++) {
                    shape.m_vertices[i] = shape.m_vertices[i].clone().mul(scaleFactor);
                }
            }
            //Body.scale(this.body!, scaleFactor, scaleFactor);
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
        stream.writeBits(this.layer, 2);
        stream.writeBoolean(this.dead);

        stream.writeBoolean(this.isDoor);
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
