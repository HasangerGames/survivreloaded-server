import { ObjectKind, type SurvivBitStream } from "../../utils";
import { GameObject } from "../gameObject";
import { type Vec2 } from "planck";

export class Structure extends GameObject {
    showOnMap = false;

    layerObjIds: number[];

    constructor(id: number,
                typeString: string,
                position: Vec2,
                orientation: number,
                layerObjIds: number[]) {
        super(id, typeString, position, 0, orientation);
        this.kind = ObjectKind.Structure;
        this.layerObjIds = layerObjIds;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    serializePartial(stream: SurvivBitStream): void {}

    serializeFull(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeMapType(this.typeId);
        stream.writeBits(this.orientation!, 2);
        stream.writeBoolean(true); // Interior sound enabled
        stream.writeBoolean(false); // Interior sound alt
        stream.writeUint16(this.layerObjIds[0]); // Layer 1 ID
        stream.writeUint16(this.layerObjIds[1]); // Layer 2 ID
    }

}
