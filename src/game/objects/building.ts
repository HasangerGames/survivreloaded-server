import { Vector } from "matter-js";

import { ObjectKind, SurvivBitStream, Utils } from "../../utils";
import { GameObject } from "./gameObject";

export class Building extends GameObject {

    showOnMap: boolean;

    occupied: boolean = false;
    ceilingDamaged: boolean = false;
    hasPuzzle: boolean = false;


    constructor(id: number,
                typeString: string,
                position: Vector,
                layer: number,
                orientation: number,
                showOnMap: boolean,
                data) {
        super(id, typeString, position, layer, orientation);
        this.kind = ObjectKind.Building;

        this.showOnMap = showOnMap;
        if(data.mapObstacleBounds) {
            this.body = Utils.bodyFromCollisionData(data.mapObstacleBounds[0], this.position);
        }
    }

    serializePart(stream: SurvivBitStream) {
        stream.writeBoolean(this.dead); // Ceiling destroyed
        stream.writeBoolean(this.occupied);
        stream.writeBoolean(this.ceilingDamaged);
        stream.writeBoolean(this.hasPuzzle);
        stream.writeBits(0, 4); // Padding
    }

    serializeFull(stream: SurvivBitStream) {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeMapType(this.typeId);
        stream.writeBits(this.orientation, 2);
        stream.writeBits(this.layer, 2);
    }

}
