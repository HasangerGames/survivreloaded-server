import { Constants, distanceToRect, orientationToRad, rotateRect, splitRect, vec2Rotate } from "../utils";
import { type Vec2 } from "planck";
import { type GameObject } from "./gameObject";

export class Stair {

    orientation: number;
    collision: any;

    downDir: Vec2;

    downCollider: any;
    upCollider: any;

    constructor(position: Vec2, orientation: number, data: any) {
        this.orientation = orientation;
        this.collision = rotateRect(position, data.collision.min, data.collision.max, 1, this.orientation);

        this.downDir = vec2Rotate(data.downDir, orientationToRad(this.orientation));

        const childColliders = splitRect(this.collision, this.downDir);

        this.downCollider = childColliders[0];
        this.upCollider = childColliders[1];
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
