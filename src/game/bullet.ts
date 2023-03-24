import { type Body, Circle, Vec2 } from "planck";
import { CollisionCategory, ObjectKind, TypeToId, unitVecToRadians } from "../utils";
import { type Game } from "./game";
import { Player } from "./objects/player";

export class Bullet {
    isBullet = true;

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
    distance = 0;

    shotFx = true;
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

    constructor(shooter: Player,
                position: Vec2,
                direction: Vec2,
                typeString: string,
                shotSourceType: number,
                layer: number,
                game: Game) {
        this.shooter = shooter;
        this.initialPosition = position;
        this.direction = direction;
        this.typeString = typeString;
        this.typeId = TypeToId[typeString];
        this.shotSourceType = shotSourceType;
        this.layer = layer;
        this.body = game.world.createBody({
            type: "dynamic",
            position,
            bullet: true,
            fixedRotation: true
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
        this.body.setLinearVelocity(direction);
    }

    get position(): Vec2 {
        return this.initialPosition;
    }

}
