import { ObjectKind, type SurvivBitStream } from "../../utils";
import { GameObject } from "../gameObject";

export class DeadBody extends GameObject {

    playerId: number;

    constructor(id, layer, position, playerId) {
        super(id, "", position, 0, layer);
        this.kind = ObjectKind.DeadBody;
        this.playerId = playerId;
    }

    serializePart(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeUint8(this.layer);
        stream.writeUint16(this.playerId);
    }

}
