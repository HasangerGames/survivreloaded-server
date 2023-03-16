import { ReceivingPacket } from "../receivingPacket";
import { distanceBetween, InputType, type SurvivBitStream } from "../../utils";

export class InputPacket extends ReceivingPacket {

    readData(stream: SurvivBitStream): void {
        stream.readUint8(); // Discard second byte (this.seq)

        // Movement and shooting
        this.p.movingLeft = stream.readBoolean();
        this.p.movingRight = stream.readBoolean();
        this.p.movingUp = stream.readBoolean();
        this.p.movingDown = stream.readBoolean();

        const shootStart = stream.readBoolean();
        this.p.shootStart = this.p.shootStart ? true : shootStart;
        this.p.shootHold = stream.readBoolean();
        stream.readBoolean(); // Portrait
        stream.readBoolean(); // Touch move active

        // Direction
        const direction = stream.readUnitVec(10);
        if(this.p.direction !== direction) {
            this.p.direction = direction;
            this.p.moving = true;
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
                    for(const object of this.p.visibleObjects) {
                        const distance: number = distanceBetween(this.p.position, object.position);
                        if(object.interactable && distance < 1 + object.interactionRad) {
                            if(distance < minDist) {
                                minDist = distance;
                                minDistObject = object;
                            }
                        }
                    }
                    if(minDistObject) {
                        minDistObject.interact(this.p);
                    }
                    break;
                }
            }
        }

        stream.readGameType(); // Item in use
        stream.readBits(5); // Padding
    }

}
