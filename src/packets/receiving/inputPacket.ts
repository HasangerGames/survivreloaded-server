import { ReceivingPacket } from "../receivingPacket";
import { Config, distanceBetween, InputType, type SurvivBitStream } from "../../utils";
import { Vec2 } from "planck";

export class InputPacket extends ReceivingPacket {

    deserialize(stream: SurvivBitStream): void {
        const p = this.p;

        stream.readUint8(); // Discard second byte (this.seq)

        // Movement and shooting
        p.movingLeft = stream.readBoolean();
        p.movingRight = stream.readBoolean();
        p.movingUp = stream.readBoolean();
        p.movingDown = stream.readBoolean();

        const shootStart = stream.readBoolean();
        p.shootStart = p.shootStart ? true : shootStart;
        p.shootHold = stream.readBoolean();
        stream.readBoolean(); // Portrait
        const touchMoveActive = stream.readBoolean();
        if(touchMoveActive) {
            p.touchMoveDir = stream.readUnitVec(8);
            if(p.touchMoveDir.x === 1 && p.touchMoveDir.y > 0 && p.touchMoveDir.y < 0.01) {
                p.touchMoveDir = Vec2(0, 0);
                p.setVelocity(0, 0);
            } else {
                p.setVelocity(p.touchMoveDir.x * Config.movementSpeed, p.touchMoveDir.y * Config.movementSpeed);
            }
            stream.readUint8(); // Touch move len
        } else {
            const s = Config.movementSpeed;
            const ds = Config.diagonalSpeed;
            if(p.movingUp && p.movingLeft) p.setVelocity(-ds, ds);
            else if(p.movingUp && p.movingRight) p.setVelocity(ds, ds);
            else if(p.movingDown && p.movingLeft) p.setVelocity(-ds, -ds);
            else if(p.movingDown && p.movingRight) p.setVelocity(ds, -ds);
            else if(p.movingUp) p.setVelocity(0, s);
            else if(p.movingDown) p.setVelocity(0, -s);
            else if(p.movingLeft) p.setVelocity(-s, 0);
            else if(p.movingRight) p.setVelocity(s, 0);
            else p.setVelocity(0, 0);
        }

        // Direction
        const direction = stream.readUnitVec(10);
        if(p.direction !== direction) {
            p.direction = direction;
            p.moving = true;
        }
        console.log(p.moving);
        stream.readFloat(0, 64, 8); // Distance to mouse

        // Other inputs
        const inputCount = stream.readBits(4);
        for(let i = 0; i < inputCount; i++) {
            const input = stream.readUint8();
            switch(input) {
                case InputType.Interact: {
                    let minDist = Number.MAX_VALUE;
                    let minDistObject;
                    for(const object of p.visibleObjects) {
                        const distance: number = distanceBetween(p.position, object.position);
                        if(object.interactable && distance < 1 + object.interactionRad) {
                            if(distance < minDist) {
                                minDist = distance;
                                minDistObject = object;
                            }
                        }
                    }
                    if(minDistObject) {
                        minDistObject.interact(p);
                    }
                    break;
                }
            }
        }

        stream.readGameType(); // Item in use
        stream.readBits(5); // Padding
    }

}
