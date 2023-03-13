import { Bodies, type Vector } from "matter-js";

import { CollisionCategory, ObjectKind, removeFrom, type SurvivBitStream } from "../../utils";
import { type Game } from "../game";
import { GameObject } from "../gameObject";
import { Player } from "./player";
import { PickupMsgType, PickupPacket } from "../../packets/sending/pickupPacket";

export class Loot extends GameObject {

    count: number;
    interactable = true;
    interactionRad = -0.01;

    constructor(id: number,
                typeString: string,
                position: Vector,
                layer: number,
                game: Game,
                count: number) {
        super(id, typeString, position, layer, undefined, game);
        this.kind = ObjectKind.Loot;
        this.count = count;
        this.body = Bodies.circle(position.x, position.y, 1);
        this.body.collisionFilter.group = CollisionCategory.Loot;
        this.body.collisionFilter.category = CollisionCategory.Player;
        this.body.collisionFilter.mask = CollisionCategory.Obstacle | CollisionCategory.Player;
        this.game!.addBody(this.body);
    }

    get position(): Vector {
        return this.body!.position;
    }

    interact(p: Player): void {
        removeFrom(this.game!.objects, this);
        this.game!.deletedObjects.push(this);
        this.game!.removeBody(this.body);
        this.interactable = false;
        p.sendPacket(new PickupPacket(p, this.typeString!, this.count, PickupMsgType.Success));
    }

    serializePartial(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeGameType(this.typeId);
        stream.writeUint8(this.count);
        stream.writeBits(this.layer, 2);
        stream.writeBoolean(false); // Is old
        stream.writeBoolean(false); // Is preloaded gun
        stream.writeBoolean(false); // Has owner
    }

}
