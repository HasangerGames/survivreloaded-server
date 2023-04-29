import { ObjectKind, type SurvivBitStream } from "../../utils";
import { GameObject } from "../gameObject";
import { type Vec2 } from "planck";
import { type Game } from "../game";

export class DeadBody extends GameObject {
    playerId: number;

    declare kind: ObjectKind.DeadBody;

    constructor (game: Game, layer: number, position: Vec2, playerId: number) {
        super(game, "", position, layer, 0);
        this.kind = ObjectKind.DeadBody;
        this.playerId = playerId;
    }

    serializePartial (stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
    }

    serializeFull (stream: SurvivBitStream): void {
        stream.writeUint8(this.layer);
        stream.writeUint16(this.playerId);
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    damage (amount: number, source): void {}
}
