import { ReceivingPacket } from "../receivingPacket";
import { distanceBetween, InputType, type SurvivBitStream } from "../../utils";

export class InputPacket extends ReceivingPacket {

    readData(stream: SurvivBitStream): void {
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
            stream.readUnitVec(8); // Touch move dir
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
