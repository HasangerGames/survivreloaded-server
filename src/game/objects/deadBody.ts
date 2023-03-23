import { ObjectKind, type SurvivBitStream } from "../../utils";
import { GameObject } from "../gameObject";
import { Vec2 } from "planck";
import { Game } from "../game";

export class DeadBody extends GameObject {

    playerId: number;

    constructor(game: Game, layer: number, position: Vec2, playerId: number) {
        super(game, "", position, 0, layer);
        this.kind = ObjectKind.DeadBody;
        this.playerId = playerId;
    }

    serializePartial(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeUint8(this.layer);
        stream.writeUint16(this.playerId);
    }

}
