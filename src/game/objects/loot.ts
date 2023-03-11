import { Bodies, type Vector } from "matter-js";

import { ObjectKind, type SurvivBitStream } from "../../utils";
import { type Game } from "../game";
import { GameObject } from "../gameObject";

export class Loot extends GameObject {

    count: number;

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
        this.game!.addBody(this.body);
    }

    get position(): Vector {
        return this.body!.position;
    }

    serializePart(stream: SurvivBitStream): void {
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
