import { type Body, Circle, Vec2 } from "planck";
import { Bullets, distanceBetween, TypeToId } from "../utils";
import { type Game } from "./game";
import { type Player } from "./objects/player";

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
    shotSourceType: number;
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

    constructor(shooter: Player,
                position: Vec2,
                direction: Vec2,
                typeString: string,
                shotSourceType: number,
                shotFx: boolean,
                layer: number,
                game: Game) {
        const bulletData = Bullets[typeString];
        this.shooter = shooter;
        this.initialPosition = position;
        this.direction = direction;
        this.typeString = typeString;
        this.typeId = TypeToId[typeString];
        this.shotSourceType = shotSourceType;
        this.shotFx = shotFx;
        this.maxDistance = bulletData.distance;
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
        this.body.setLinearVelocity(direction.clone().mul(bulletData.speedMultiplier ?? 1));
    }

    get position(): Vec2 {
        return this.initialPosition;
    }

    get distance(): number {
        return distanceBetween(this.initialPosition, this.body.getPosition());
    }

}
