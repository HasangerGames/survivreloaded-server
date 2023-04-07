import { ObjectKind, TypeToId, type SurvivBitStream } from "../../utils";
import { GameObject } from "../gameObject";
import { type Vec2 } from "planck";
import { type Game } from "../game";

// TODO: decal life time
export class Decal extends GameObject {
    type: number;

    // club pool
    goreKills = 0;

    constructor(
        type: string,
        game: Game,
        position: Vec2,
        layer: number,
        orientation?: number,
        scale?: number
    ) {
        super(game, "", position, layer, orientation);
        this.kind = ObjectKind.Decal;
        this.type = TypeToId[type];
        this.scale = scale || 1;
    }

    serializePartial(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeFloat(this.scale, 0.125, 2.5, 8);
        stream.writeMapType(this.type);
        stream.writeBits(this.orientation!, 2);
        stream.writeBits(this.layer, 2);
        stream.writeUint8(this.goreKills);
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    damage(amount: number, source): void {}
}
