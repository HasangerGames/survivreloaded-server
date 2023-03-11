import { ReceivingPacket } from "../receivingPacket";
import { InputType, type SurvivBitStream } from "../../utils";
import { Obstacle } from "../../game/objects/obstacle";
import { Bodies, type Body, Collision } from "matter-js";

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
            this.p.skipObjectCalculations = false;
        }
        stream.readFloat(0, 64, 8); // Distance to mouse

        // Other inputs
        const inputCount = stream.readBits(4);
        for(let i = 0; i < inputCount; i++) {
            const input = stream.readUint8();
            switch(input) {
                case InputType.Interact: {
                    for(const id of this.p.visibleObjects) {
                        const object = this.p.map.objects[id];
                        if(object instanceof Obstacle && object.isDoor && !object.dead) {
                            const interactionBody: Body = Bodies.circle(this.p.position.x, this.p.position.y, 1 + object.interactionRad!);
                            // @ts-expect-error The 3rd argument for Collision.collides is optional
                            const collisionResult = Collision.collides(interactionBody, object.body);
                            if(collisionResult?.collided) {
                                object.interact(this.p);
                                this.p.game!.partialDirtyObjects.push(id);
                            }
                        }
                    }
                    break;
                }
            }
        }

        stream.readGameType(); // Item in use
        stream.readBits(5); // Padding
    }

}
