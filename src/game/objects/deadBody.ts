import { ObjectKind, SurvivBitStream } from "../../utils";
import { GameObject } from "./gameObject";

export class DeadBody extends GameObject {

    playerId: number;

    constructor(id, layer, position, playerId) {
        super(id, null, position, 0, layer);
        this.kind = ObjectKind.DeadBody;
        this.playerId = playerId;
    }

    serializePart(stream: SurvivBitStream) {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
    }

    serializeFull(stream: SurvivBitStream) {
        stream.writeUint8(this.layer);
        stream.writeUint16(this.playerId);
    }

}
