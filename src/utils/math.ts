import { type Body, Box, Circle, Vec2, type World } from "planck";
import type { Point2D } from "../jsonTypings";
import { CollisionType, type Orientation } from "./constants";
import { type GameObject } from "../game/gameObject";
import { Obstacle } from "../game/objects/obstacle";
import { Player } from "../game/objects/player";
import { Loot } from "../game/objects/loot";

/*
Game objects can belong to the following layers:
   0: ground layer
   1: bunker layer
   2: ground and stairs (both)
   3: bunker and stairs (both)

Objects on the same layer should interact with one another.
*/

export function sameLayer (a: number, b: number): boolean {
    return !!((1 & a) === (1 & b) || (2 & a && 2 & b));
}

export function toGroundLayer (a: number): number {
    return 1 & a;
}

export function toStairsLayer (a: number): number {
    return 2 | a;
}

export function randomFloat (min: number, max: number): number {
    return (Math.random() * (max - min) + min);
}

export function randomFloatSpecial (min: number, max: number): number {
    return (Math.random() < 0.5) ? randomFloat(min, max) : -randomFloat(min, max);
}

export interface MinMax<T> {
    min: T
    max: T
}

export function random (min: number, max: number): number {
    return Math.floor(randomFloat(min, max + 1));
}

export function randomVec (minX: number, maxX: number, minY: number, maxY: number): Vec2 {
    return Vec2(random(minX, maxX), random(minY, maxY));
}

// https://stackoverflow.com/a/55671924/5905216
export function weightedRandom<T> (items: T[], weights: number[]): T {
    let i: number;
    for (i = 1; i < weights.length; i++) weights[i] += weights[i - 1];

    const random = Math.random() * weights[weights.length - 1];
    for (i = 0; i < weights.length; i++) { if (weights[i] > random) break; }
    return items[i];
}

export function randomBoolean (): boolean {
    return Math.random() < 0.5;
}

export function distanceBetween (v1: Point2D, v2: Point2D): number {
    return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2));
}

export function circleCollision (pos1: Point2D, r1: number, pos2: Point2D, r2: number): boolean {
    const a = r1 + r2;
    const x = pos1.x - pos2.x;
    const y = pos1.y - pos2.y;
    return a * a > x * x + y * y;
}

/* export function rectCollision(min: Vec2, max: Vec2, circlePos: Vec2, circleRad: number): boolean {
    const distX = Math.max(min.x, Math.min(max.x, circlePos.x)) - circlePos.x;
    const distY = Math.max(min.y, Math.min(max.y, circlePos.y)) - circlePos.y;
    return distX * distX + distY * distY > circleRad * circleRad;
} */

export function rectCollision (min: Point2D, max: Point2D, pos: Vec2, rad: number): boolean {
    const cpt = Vec2(clamp(pos.x, min.x, max.x), clamp(pos.y, min.y, max.y));
    const dstSqr = Vec2.lengthSquared(Vec2.sub(pos, cpt));
    return (dstSqr < rad * rad) || (pos.x >= min.x && pos.x <= max.x && pos.y >= min.y && pos.y <= max.y);
}

export function clamp (a: number, min: number, max: number): number {
    return a < max ? a > min ? a : min : max;
}

export function rectRectCollision (min1: Point2D, max1: Point2D, min2: Point2D, max2: Point2D): boolean {
    return min2.x < max1.x && min2.y < max1.y && min1.x < max2.x && min1.y < max2.y;
}

export interface CollisionRecord { collided: boolean, distance: number }

export function distanceToCircle (pos1: Point2D, r1: number, pos2: Point2D, r2: number): CollisionRecord {
    const a = r1 + r2;
    const x = pos1.x - pos2.x;
    const y = pos1.y - pos2.y;
    const a2 = a * a;
    const xy = (x * x + y * y);
    return { collided: a2 > xy, distance: a2 - xy };
}

export function distanceToRect (min: Point2D, max: Point2D, circlePos: Point2D, circleRad: number): CollisionRecord {
    const distX = Math.max(min.x, Math.min(max.x, circlePos.x)) - circlePos.x;
    const distY = Math.max(min.y, Math.min(max.y, circlePos.y)) - circlePos.y;
    const radSquared = circleRad * circleRad;
    const distSquared = (distX * distX + distY * distY);
    return { collided: distSquared < radSquared, distance: radSquared - distSquared };
}

export function objectCollision (object: GameObject, position: Point2D, radius: number): CollisionRecord {
    let record: CollisionRecord;
    if (object instanceof Obstacle) {
        if (object.collision.type === CollisionType.Circle) {
            record = distanceToCircle(object.position, object.collision.rad, position, radius);
        } else if (object.collision.type === CollisionType.Rectangle) {
            record = distanceToRect(object.collision.min, object.collision.max, position, radius);
        }
    } else if (object instanceof Player) {
        record = distanceToCircle(object.position, object.scale, position, radius);
    } else if (object instanceof Loot) {
        record = distanceToCircle(object.position, 0, position, radius);
    }
    // bug this if-else chain isn't necessarily exhaustive
    return record!;
}

export function addOrientations (n1: Orientation, n2: Orientation): Orientation {
    return (n1 + n2) % 4 as Orientation;
}

export function addAdjust (position1: Vec2, position2: Vec2, orientation: Orientation): Vec2 {
    if (orientation === 0) return Vec2.add(position1, position2);
    let xOffset: number, yOffset: number;
    switch (orientation) {
        case 1:
            xOffset = -position2.y;
            // noinspection JSSuspiciousNameCombination
            yOffset = position2.x;
            break;
        case 2:
            xOffset = -position2.x;
            yOffset = -position2.y;
            break;
        case 3:
            // noinspection JSSuspiciousNameCombination
            xOffset = position2.y;
            yOffset = -position2.x;
            break;
    }
    return Vec2.add(position1, Vec2(xOffset!, yOffset!));
}

export function rotateRect (pos: Vec2, min: Vec2, max: Vec2, scale: number, orientation: Orientation): MinMax<Vec2> {
    min = Vec2.mul(min, scale);
    max = Vec2.mul(max, scale);
    if (orientation !== 0) {
        const minX = min.x; const minY = min.y;
        const maxX = max.x; const maxY = max.y;
        switch (orientation) {
            case 1:
                min = Vec2(minX, maxY);
                max = Vec2(maxX, minY);
                break;
            case 2:
                min = Vec2(maxX, maxY);
                max = Vec2(minX, minY);
                break;
            case 3:
                min = Vec2(maxX, minY);
                max = Vec2(minX, maxY);
                break;
        }
    }
    return {
        min: addAdjust(pos, min, orientation),
        max: addAdjust(pos, max, orientation)
    };
}

export function orientationToRad (orientation: Orientation): number {
    return (orientation % 4) * 0.5 * Math.PI;
}

export function splitRect (rect: MinMax<Vec2>, axis: Vec2): [MinMax<Vec2>, MinMax<Vec2>] {
    const e = Vec2.mul(Vec2.sub(rect.max, rect.min), 0.5);
    const c = Vec2.add(rect.min, e);
    const left = {
        min: Vec2(rect.min).clone(),
        max: Vec2(rect.max).clone()
    };
    const right = {
        min: Vec2(rect.min).clone(),
        max: Vec2(rect.max).clone()
    };
    if (Math.abs(axis.y) > Math.abs(axis.x)) {
        left.max = Vec2(rect.max.x, c.y);
        right.min = Vec2(rect.min.x, c.y);
    } else {
        left.max = Vec2(c.x, rect.max.y);
        right.min = Vec2(c.x, rect.min.y);
    }
    const dir = Vec2.sub(rect.max, rect.min);
    return Vec2.dot(dir, axis) > 0.0
        ? [right, left]
        : [left, right];
}

export function angleBetween (a: Vec2, b: Vec2): number {
    const dy = a.y - b.y;
    const dx = a.x - b.x;
    return Math.atan2(dy, dx);
}

export function bodyFromCollisionData (
    world: World,
    data: { type: CollisionType, rad: number, min: Vec2, max: Vec2 },
    position: Vec2,
    orientation: Orientation = 0,
    scale = 1,
    obstacle: Obstacle
): Body | null {
    let body: Body;
    if (data.type === CollisionType.Circle) {
        // noinspection TypeScriptValidateJSTypes
        body = world.createBody({
            type: "static",
            position,
            fixedRotation: true
        });
        body.createFixture({
            shape: Circle(data.rad * scale),
            userData: obstacle
        });
    } else if (data.type === CollisionType.Rectangle) {
        const rect = rotateRect(position, data.min, data.max, scale, orientation);
        const width = (rect.max.x - rect.min.x) / 2; const height = (rect.max.y - rect.min.y) / 2;
        if (width === 0 || height === 0) return null;
        obstacle.collision.halfWidth = width;
        obstacle.collision.halfHeight = height;
        body = world.createBody({
            type: "static",
            position,
            fixedRotation: true
        });
        body.createFixture({
            shape: Box(width, height),
            userData: obstacle
        });
    }
    // this should use a switch statement because we're dealing with enums
    return body!;
}

/**
 * Get the angle, in radians, formed by a vector.
 * @param v The vector to calculate against.
 */
export function unitVecToRadians (v: Point2D): number {
    return Math.atan2(v.y, v.x);
}

export function vec2Rotate (v: Point2D, angle: number): Vec2 {
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    return Vec2(v.x * cos - v.y * sin, v.x * sin + v.y * cos);
}

/**
 * Convert degrees to radians.
 * @param degrees The angle, in degrees.
 */
export function degreesToRadians (degrees: number): number {
    return degrees * (Math.PI / 180);
}

// https://stackoverflow.com/a/51727716/5905216
export function randomPointInsideCircle (position: Vec2, radius: number): Vec2 {
    /*
        Easier method:

        Use the Pythagorean theorem:
        x*x + y*y = 1

        Isolate y
        y = ±√(1 - x*x)

        So for some x, the expression above yields y coordinates
        which lie on the unit circle
        Thus,

        const randomSign = () => Math.random() > 0.5 ? -1 : 1;
        const x = randomSign() * Math.random();

        return Vec2(x * radius, randomSign() * Math.sqrt(1 - x*x)).add(position);
    */

    let x: number, y: number;
    do {
        x = 2 * Math.random() - 1.0; // range [-1, +1)
        y = 2 * Math.random() - 1.0;
    } while ((x * x + y * y) >= 1); // check unit circle

    // scale and translate the points
    return Vec2(x * radius + position.x, y * radius + position.y);
}

export function vecLerp (t: number, a: Vec2, b: Vec2): Vec2 {
    return Vec2.add(Vec2.mul(a, 1.0 - t), Vec2.mul(b, t));
}

export function lerp (t: number, a: number, b: number): number {
    return a * (1.0 - t) + b * t;
}
