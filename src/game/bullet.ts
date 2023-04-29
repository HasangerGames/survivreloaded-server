import { type Body, Circle, Vec2 } from "planck";
import { Bullets, distanceBetween, randomFloat, TypeToId } from "../utils";
import { type Game } from "./game";
import { type Gun, type Player } from "./objects/player";

// this class should probably extend GameObject
export class Bullet {
    isPlayer = false;
    isObstacle = false;
    isBullet = true;
    isLoot = false;
    collidesWith = {
        player: true,
        obstacle: true,
        bullet: false,
        loot: false
    };

    body: Body;

    shooter: Player;

    initialPosition: Vec2;
    direction: Vec2;

    typeString: string;
    typeId: number;

    layer: number;

    varianceT = 0;

    distAdjIdx = 0;

    clipDistance = false;

    shotFx: boolean;
    shotSource: Gun;
    shotOffhand = false;
    lastShot = false;

    reflect = false;
    reflectCount = 0;
    reflectObjId: number;

    splinter = false;
    splinterSmall = false;

    trailFx = false;
    trailSaturated = false;
    trailThick = false;

    maxDistance: number;

    dead = false;

    constructor (shooter: Player,
                position: Vec2,
                direction: Vec2,
                typeString: string,
                shotSource: Gun,
                shotFx: boolean,
                layer: number,
                game: Game) {
        const bulletData = Bullets[typeString];
        this.shooter = shooter;
        this.initialPosition = position;
        this.direction = direction;
        this.typeString = typeString;
        this.typeId = TypeToId[typeString];
        this.shotSource = shotSource;
        this.shotFx = shotFx;
        // explosion shrapnel variance
        this.varianceT = randomFloat(0, bulletData.variance);
        this.maxDistance = bulletData.distance * (this.varianceT + 1);
        this.layer = layer;
        this.body = game.world.createBody({
            type: "dynamic",
            position,
            fixedRotation: true,
            bullet: true
        });
        this.body.createFixture({
            shape: Circle(0),
            friction: 0.0,
            density: 0.0,
            restitution: 0.0,
            userData: this
        });
        this.body.setMassData({
            I: 0,
            center: Vec2(0, 0),
            mass: 0.0
        });
        this.body.setLinearVelocity(direction.clone().mul((bulletData.speed / 1000) * (this.varianceT + 1)));
    }

    get position (): Vec2 {
        return this.initialPosition;
    }

    get distance (): number {
        return distanceBetween(this.initialPosition, this.body.getPosition());
    }
}
