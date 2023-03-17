import { ReceivingPacket } from "../receivingPacket";
import { distanceBetween, InputType, type SurvivBitStream } from "../../utils";
import { Vec2 } from "planck";

export class InputPacket extends ReceivingPacket {

    deserialize(stream: SurvivBitStream): void {
        const p = this.p;
        if(p.dead) return;

        stream.readUint8(); // Discard second byte (this.seq)

        // Movement
        p.movingLeft = stream.readBoolean();
        p.movingRight = stream.readBoolean();
        p.movingUp = stream.readBoolean();
        p.movingDown = stream.readBoolean();

        // Shooting
        const shootStart = stream.readBoolean();
        p.shootStart = p.shootStart ? true : shootStart;
        p.shootHold = stream.readBoolean();

        // Mobile stuff
        stream.readBoolean(); // Portrait
        const touchMoveActive = stream.readBoolean();
        if(touchMoveActive) {
            p.touchMoveDir = stream.readUnitVec(8);

            // Detect when the player isn't moving
            if(p.touchMoveDir.x === 1 && p.touchMoveDir.y > 0 && p.touchMoveDir.y < 0.01) {
                p.touchMoveDir = Vec2(0, 0);
            }

            stream.readUint8(); // Touch move len
        }

        // Direction
        const direction = stream.readUnitVec(10);
        if(p.direction !== direction) {
            p.direction = direction;
            p.moving = true;
        }
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
