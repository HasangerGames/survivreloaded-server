import { Vec2 } from "planck";
import { distanceBetween, Explosions, objectCollision, randomFloat, sameLayer, TypeToId } from "../utils";
import { Bullet } from "./bullet";
import { Decal } from "./objects/decal";
import { type Game } from "./game";

export class Explosion {
    position: Vec2;
    typeString: string;
    typeId: number;
    layer: number;
    source: any;
    objectUsed: any;
    constructor(
        position: Vec2,
        typeSting: string,
        layer: number,
        source: any,
        objectUsed?: any
    ) {
        this.position = position;
        this.typeId = TypeToId[typeSting];
        this.typeString = typeSting;
        this.layer = layer;
        this.source = source;
        this.objectUsed = objectUsed;
    }

    explode(game: Game): void {
        const explosionData = Explosions[this.typeString];
        const radius = explosionData.rad.max;

        // TODO: check if the object / player is behind a wall, and better algorithm to calculate the damage
        const visibleObjects = game.visibleObjects[28][Math.round(this.position.x / 10) * 10][Math.round(this.position.y / 10) * 10];
        for(const object of visibleObjects) {
            if(object.damageable && !object.dead && sameLayer(this.layer, object.layer)) {
                const record = objectCollision(object, this.position, radius);
                if (record.collided) {
                    let damage =
                        explosionData.damage * explosionData.obstacleDamage;
                    const distance = distanceBetween(
                        object.position,
                        this.position
                    );
                    if (distance > explosionData.rad.min) {
                        const damagePercent = Math.abs(
                            distance / explosionData.rad.max - 1
                        );
                        damage *= damagePercent;
                    }
                    object.damage(damage, this.source);
                }
            }
        }

        for(const player of game.livingPlayers) {
            if(sameLayer(this.layer, player.layer)) {
                const record = objectCollision(player, this.position, radius);
                if(record.collided) {
                    let damage = explosionData.damage;
                    const distance = distanceBetween(player.position, this.position);
                    if(distance > explosionData.rad.min) {
                        const damagePercent = Math.abs(distance / explosionData.rad.max - 1);
                        damage *= damagePercent;
                    }
                    player.damage(damage, this.source, this.objectUsed);
                }
            }
        }

        for(let i = 0; i < explosionData.shrapnelCount; i++) {
            const angle = randomFloat(0, Math.PI * 2);
            const direction = Vec2(Math.cos(angle), Math.sin(angle));
            const bullet = new Bullet(
                this.source,
                this.position,
                direction,
                explosionData.shrapnelType,
                this.objectUsed,
                false,
                this.layer,
                game
            );
            game.bullets.add(bullet);
            game.newBullets.add(bullet);
        }
        if(explosionData.decalType) {
            const decal = new Decal(
                explosionData.decalType,
                game,
                this.position,
                this.layer
            );
            game.dynamicObjects.add(decal);
            game.fullDirtyObjects.add(decal);
            game.updateObjects = true;
        }
    }

}
