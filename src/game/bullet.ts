import { type Body, Circle, type Vec2 } from "planck";
import { CollisionCategory, TypeToId } from "../utils";
import { type Game } from "./game";

export class Bullet {

    body: Body;

    playerId: number;

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

    constructor(playerId: number,
                position: Vec2,
                direction: Vec2,
                typeString: string,
                shotSourceType: number,
                layer: number,
                game: Game) {
        this.initialPosition = position;
        this.direction = direction;
        this.typeString = typeString;
        this.typeId = TypeToId[typeString];
        this.shotSourceType = shotSourceType;
        /*this.body = game.world.createBody({
            type: "dynamic",
            position,
            bullet: true
        });
        this.body.createFixture({
            shape: Circle(0.1),
            friction: 0.0,
            density: 1.0,
            restitution: 1.0,
            filterCategoryBits: CollisionCategory.Player,
            filterMaskBits: CollisionCategory.Obstacle
        });*/
    }

    get position(): Vec2 {
        return this.initialPosition;
    }

}
