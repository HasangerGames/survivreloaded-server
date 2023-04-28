import {
    Constants,
    type Orientation,
    distanceToRect,
    orientationToRad,
    rotateRect,
    splitRect,
    vec2Rotate,
    type MinMax
} from "../utils";
import { Vec2 } from "planck";
import { type GameObject } from "./gameObject";
import { type JSONObjects } from "../jsonTypings";

export class Stair {

    orientation: Orientation;
    collision: MinMax<Vec2>;

    downDir: Vec2;

    downCollider: MinMax<Vec2>;
    upCollider: MinMax<Vec2>;

    constructor(position: Vec2, orientation: Orientation, data: (JSONObjects.Structure["stairs"] & unknown[])[number]) {
        this.orientation = orientation;
        this.collision = rotateRect(position, Vec2(data.collision.min!), Vec2(data.collision.max!), 1, this.orientation);

        this.downDir = vec2Rotate(data.downDir, orientationToRad(this.orientation));

        [this.downCollider, this.upCollider] = splitRect(this.collision, this.downDir);
    }

    check(object: GameObject): boolean {
        const collides = distanceToRect(this.collision.min, this.collision.max, object.position, Constants.player.radius).collided;
        if(collides) {
            const collidesUp = distanceToRect(this.upCollider.min, this.upCollider.max, object.position, Constants.player.radius).collided;
            const collidesDown = distanceToRect(this.downCollider.min, this.downCollider.max, object.position, Constants.player.radius).collided;

            if(collidesUp && !collidesDown) {
                object.layer = 2;
            }
            if(!collidesUp && collidesDown) {
                object.layer = 3;
            }
        }
        return collides;
    }

}
