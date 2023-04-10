import {
    addAdjust,
    bodyFromCollisionData,
    CollisionType,
    deepCopy,
    Item,
    LootTables,
    ObjectKind,
    Objects,
    random,
    rectCollision,
    rotateRect,
    type SurvivBitStream,
    Weapons,
    weightedRandom
} from "../../utils";
import { type Game } from "../game";
import { Loot } from "./loot";
import { GameObject } from "../gameObject";
import { Box, Vec2 } from "planck";
import { Player } from "./player";
import { Explosion } from "../explosion";
import { type Building } from "./building";

export class Obstacle extends GameObject {

    isPlayer = false;
    isObstacle = true;
    isBullet = false;
    isLoot = false;
    collidesWith = {
        player: true,
        obstacle: false,
        bullet: true,
        loot: true
    };

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
        hinge: Vec2
        closedOrientation: number
        openOrientation: number
        openAltOrientation: number
        openOneWay: number,
        openOnce: boolean,
        autoOpen: boolean,
        autoClose: boolean,
        autoCloseDelay: number,
        slideToOpen: boolean,
        slideOffset: number,
        closedPosition: Vec2,
        openPosition: Vec2,
    };

    showOnMap: boolean;

    collidable: boolean;
    reflectBullets: boolean;
    destructible: boolean;
    destroyType = "";
    explosion = "";

    loot: Item[] = [];

    collision;

    isWall: boolean;
    damageCeiling: boolean;
    parentBuilding: Building | undefined;

    bunkerWall: boolean;

    armorPlated = false;
    stonePlated = false;

    constructor(game: Game,
                typeString: string,
                position: Vec2,
                layer: number,
                orientation: number,
                scale: number,
                data,
                parentBuilding?: Building,
                bunkerWall = false) {
        super(game, typeString, position, layer, orientation);
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
        this.destructible = data.destructible;
        this.damageable = data.destructible;
        this.destroyType = data.destroyType;
        this.explosion = data.explosion;
        this.isDoor = data.door !== undefined;

        this.isWall = data.isWall;
        this.damageCeiling = data.damageCeiling;
        this.parentBuilding = parentBuilding;

        this.bunkerWall = bunkerWall;

        this.armorPlated = data.armorPlated;
        this.stonePlated = data.stonePlated;

        // Broken windows, club bar, etc.
        if(data.height <= 0.2) {
            this.collidesWith.bullet = false;
        }

        this.collision = deepCopy(data.collision);
        const collisionPos = this.isDoor ? addAdjust(position, data.hinge, this.orientation) : position;
        if(this.collidable) {
            this.body = bodyFromCollisionData(this.game.world, data.collision, collisionPos, orientation, scale, this);
        }
        if(this.collision.type === CollisionType.Rectangle) {
            const rotatedRect = rotateRect(position, data.collision.min, data.collision.max, this.scale, this.orientation);
            this.collision.min = this.collision.initialMin = rotatedRect.min;
            this.collision.max = this.collision.initialMax = rotatedRect.max;
        }

        if(this.isDoor) {
            this.door = {
                open: false,
                canUse: true, // TODO: Change to data.door.canUse after we add puzzles.
                locked: false,
                hinge: data.hinge,
                closedOrientation: this.orientation,
                openOrientation: 0,
                openAltOrientation: 0,
                openOneWay: data.door.openOneWay,
                openOnce: data.door.openOnce,
                autoOpen: data.door.autoOpen,
                autoClose: data.door.autoClose,
                autoCloseDelay: data.door.autoCloseDelay,
                slideToOpen: data.door.slideToOpen,
                slideOffset: data.door.slideOffset,
                closedPosition: this._position.clone(),
                openPosition: Vec2()
            };
            this.interactable = true;
            this.interactionRad = data.door.interactionRad;

            if(!this.door.slideToOpen) {
                switch(orientation) {
                    case 0:
                        this.door.openOrientation = 1;
                        this.door.openAltOrientation = 3;
                        break;
                    case 1:
                        this.door.openOrientation = 2;
                        this.door.openAltOrientation = 0;
                        break;
                    case 2:
                        this.door.openOrientation = 3;
                        this.door.openAltOrientation = 1;
                        break;
                    case 3:
                        this.door.openOrientation = 0;
                        this.door.openAltOrientation = 2;
                        break;
                }
                this.collision.doorOpen = rotateRect(
                    position,
                    data.collision.min,
                    data.collision.max,
                    this.scale,
                    this.door.openOrientation
                );
                this.collision.doorOpenAlt = rotateRect(
                    position,
                    data.collision.min,
                    data.collision.max,
                    this.scale,
                    this.door.openAltOrientation
                );
            } else {
                let offSet = Vec2();
                switch(this.orientation) {
                    case 0:
                        offSet = Vec2(0, -this.door.slideOffset);
                        break;
                    case 1:
                        offSet = Vec2(this.door.slideOffset, 0);
                        break;
                    case 2:
                        offSet = Vec2(0, this.door.slideOffset);
                        break;
                    case 3:
                        offSet = Vec2(-this.door.slideOffset, 0);
                        break;
                }
                this.door.openPosition = this.position.clone().add(offSet);
                this.collision.doorOpen = rotateRect(
                    this.door.openPosition,
                    data.collision.min,
                    data.collision.max,
                    this.scale,
                    this.orientation
                );
            }
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
                let count: number;
                if(loot.type && loot.type !== "outfitRoyalFortune") { // Hack to prevent Royal Fortune from spawning
                    count = loot.count;
                    for(let i = 0; i < count; i++) this.addLoot(loot.type, count);
                } else {
                    count = random(loot.min, loot.max);
                    for(let i = 0; i < count; i++) this.getLoot(loot.tier);
                }
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
            items.push(item);
            weights.push(lootTable[item].weight);
        }
        const selectedItem = weightedRandom(items, weights);
        if(selectedItem.startsWith("tier_")) {
            this.getLoot(selectedItem);
        } else {
            this.addLoot(selectedItem, lootTable[selectedItem].count);
        }
    }

    private addLoot(type: string, count: number): void {
        if(type === "8xscope") this.game.has8x = true;
        else if(type === "15xscope") this.game.has15x = true;
        if(type === "nothing") return;
        this.loot.push(new Item(type, count));
        const weapon = Weapons[type];
        if(weapon?.ammo) {
            if(weapon.ammoSpawnCount === 1) {
                this.loot.push(new Item(weapon.ammo, 1));
            } else {
                const count: number = weapon.ammoSpawnCount / 2;
                this.loot.push(new Item(weapon.ammo, count));
                this.loot.push(new Item(weapon.ammo, count));
            }
        }
    }

    get position(): Vec2 {
        return this._position;
    }

    damage(amount: number, source): void {
        if(this.health === 0) return;
        if(this.armorPlated && source instanceof Player && source.activeWeaponInfo.armorPiercing) {
            this.health -= amount;
        } else if(this.stonePlated && source instanceof Player && source.activeWeaponInfo.stonePiercing) {
            this.health -= amount;
        } else if(!this.armorPlated && !this.stonePlated) {
            this.health -= amount;
        }
        if(this.health <= 0) {
            this.health = this.healthT = 0;
            this.dead = true;
            this.collidable = false;
            if(this.door) this.door.canUse = false;
            if(this.destroyType) {
                const replacementObject: Obstacle = new Obstacle(
                    this.game,
                    this.destroyType,
                    this.position,
                    this.layer,
                    this.orientation!,
                    1,
                    Objects[this.destroyType]
                );
                this.game.dynamicObjects.add(replacementObject);
                this.game.fullDirtyObjects.add(replacementObject);
                this.game.updateObjects = true;
            }
            if(this.explosion) {
                const explosion: Explosion = new Explosion(this.position, this.explosion, this.layer, source, this);
                this.game.explosions.add(explosion);
            }
            if(this.body) this.game.world.destroyBody(this.body!);

            this.game.fullDirtyObjects.add(this);
            for(const item of this.loot) {
                const loot: Loot = new Loot(this.game, item.type, this.position, this.layer, item.count);
                this.game.dynamicObjects.add(loot);
                this.game.fullDirtyObjects.add(loot);
                this.game.updateObjects = true;
            }
            if(this.parentBuilding) {
                this.parentBuilding.onObstacleDestroyed(this);
            }

        } else {
            this.healthT = this.health / this.maxHealth;
            const oldScale: number = this.scale;
            if(this.minScale < 1) this.scale = this.healthT * (this.maxScale - this.minScale) + this.minScale;
            const scaleFactor: number = this.scale / oldScale;
            if (this.body) {
                const shape: any = this.body!.getFixtureList()!.getShape();
                if(this.collision.type === CollisionType.Circle) {
                    shape.m_radius = shape.m_radius * scaleFactor;
                } else if(this.collision.type === CollisionType.Rectangle) {
                    for(let i = 0; i < shape.m_vertices.length; i++) {
                        shape.m_vertices[i] = shape.m_vertices[i].clone().mul(scaleFactor);
                    }
                }
            }
            if (this.collision.type === CollisionType.Circle) {
                this.collision.rad *= scaleFactor;
            } else if (this.collision.type === CollisionType.Rectangle) {
                const rotatedRect = rotateRect(this.position,
                            Vec2.sub(this.collision.min, this.position),
                            Vec2.sub(this.collision.max, this.position),
                            scaleFactor, 0);
                this.collision.min = rotatedRect.min;
                this.collision.max = rotatedRect.max;
            }
            this.game.partialDirtyObjects.add(this);
        }
    }

    interact(p: Player): void {
        if(this.dead) return;
        if (this.isDoor && this.door.canUse) {
            this.toggleDoor(p);
        }
    }

    toggleDoor(p?: Player) {
        this.door.open = !this.door.open;
        if (this.door.openOnce) {
            this.door.canUse = false;
        }
        if(!this.door.slideToOpen) {
            if(this.door.open) {
                if(p && p.isOnOtherSide(this) && !this.door.openOneWay) {
                    this.orientation = this.door.openAltOrientation;
                    this.collision.min = this.collision.doorOpenAlt.min;
                    this.collision.max = this.collision.doorOpenAlt.max;
                } else {
                    this.orientation = this.door.openOrientation;
                    this.collision.min = this.collision.doorOpen.min;
                    this.collision.max = this.collision.doorOpen.max;
                }
            } else {
                this.orientation = this.door.closedOrientation;
                this.collision.min = this.collision.initialMin;
                this.collision.max = this.collision.initialMax;
            }
        } else {
            if (this.door.open) {
                this.collision.min = this.collision.doorOpen.min;
                this.collision.max = this.collision.doorOpen.max;

                this._position = this.door.openPosition;
            } else {
                this.collision.min = this.collision.initialMin;
                this.collision.max = this.collision.initialMax;

                this._position = this.door.closedPosition;
            }
        }
        // TODO Make the door push players out of the way when opened, not just when closed
        // When pushing, ensure that they won't get stuck in anything.
        // If they do, move them to the opposite side regardless of their current position.
        if(p && rectCollision(this.collision.min, this.collision.max, p.position, p.scale)) {
            const newPosition = p.position;
            if(p.isOnOtherSide(this)) {
                switch(this.orientation) {
                    case 0:
                        newPosition.x = this.collision.min.x - p.scale;
                        break;
                    case 1:
                        newPosition.y = this.collision.min.y - p.scale;
                        break;
                    case 2:
                        newPosition.x = this.collision.max.x as number + p.scale;
                        break;
                    case 3:
                        newPosition.y = this.collision.max.y as number + p.scale;
                        break;
                }
            } else {
                switch(this.orientation) {
                    case 0:
                        newPosition.x = this.collision.max.x as number + p.scale;
                        break;
                    case 1:
                        newPosition.y = this.collision.max.y as number + p.scale;
                        break;
                    case 2:
                        newPosition.x = this.collision.min.x - p.scale;
                        break;
                    case 3:
                        newPosition.y = this.collision.min.y - p.scale;
                        break;
                }
            }
            p.body!.setPosition(newPosition);
        }
        this.body!.setPosition(addAdjust(this.position, this.door.hinge, this.orientation!));
        this.body!.destroyFixture(this.body!.getFixtureList()!);
        const flip: boolean = this.orientation !== this.door.closedOrientation;
        this.body!.createFixture({
            shape: Box(flip ? this.collision.halfHeight : this.collision.halfWidth, flip ? this.collision.halfWidth : this.collision.halfHeight),
            userData: this
        });
        this.game.fullDirtyObjects.add(this);
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
            stream.writeBits(this.door.open ? 1 : 0, 5); // door seq
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
