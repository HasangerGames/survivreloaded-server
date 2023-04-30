import { ObjectKind, type Orientation, Constants } from "../../utils/constants";
import type { SurvivBitStream } from "../../utils/survivBitStream";
import { GameObject } from "../gameObject";
import { type Vec2 } from "planck";
import { type Game } from "../game";

// TODO: decal life time
export class Decal extends GameObject {
    // club pool
    goreKills = 0;

    declare kind: ObjectKind.Decal;

    constructor (
        typeString: string,
        game: Game,
        position: Vec2,
        layer: number,
        orientation?: Orientation,
        scale?: number
    ) {
        super(game, typeString, position, layer, orientation);
        this.kind = ObjectKind.Decal;
        this.scale = scale ?? 1;
    }

    serializePartial (stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
    }

    serializeFull (stream: SurvivBitStream): void {
        stream.writeFloat(this.scale, Constants.MapObjectMinScale, Constants.MapObjectMaxScale, 8);
        stream.writeMapType(this.typeId);
        stream.writeBits(this.orientation, 2);
        stream.writeBits(this.layer, 2);
        stream.writeUint8(this.goreKills);
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    damage (amount: number, source): void {}
}
