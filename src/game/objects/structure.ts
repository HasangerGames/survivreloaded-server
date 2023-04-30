import { ObjectKind, type Orientation } from "../../utils/constants";
import type { SurvivBitStream } from "../../utils/survivBitStream";
import { GameObject } from "../gameObject";
import { type Vec2 } from "planck";
import { type Game } from "../game";

export class Structure extends GameObject {
    showOnMap = false;

    layerObjIds: number[];

    declare kind: ObjectKind.Structure;

    constructor (game: Game,
        typeString: string,
        position: Vec2,
        orientation: Orientation,
        layerObjIds: number[]) {
        super(game, typeString, position, 0, orientation);
        this.kind = ObjectKind.Structure;
        this.layerObjIds = layerObjIds;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    serializePartial (stream: SurvivBitStream): void {}

    serializeFull (stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeMapType(this.typeId);
        stream.writeBits(this.orientation, 2);
        stream.writeBoolean(true); // Interior sound enabled
        stream.writeBoolean(false); // Interior sound alt
        stream.writeUint16(this.layerObjIds[0]); // Layer 1 ID
        stream.writeUint16(this.layerObjIds[1]); // Layer 2 ID
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    damage (amount: number, source): void {}
}
