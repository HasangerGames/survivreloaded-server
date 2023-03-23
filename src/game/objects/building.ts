import { ObjectKind, rotateRect, type SurvivBitStream } from "../../utils";
import { GameObject } from "../gameObject";
import { Vec2 } from "planck";
import { Game } from "../game";

export class Building extends GameObject {

    showOnMap: boolean;

    occupied = false;
    ceilingDamaged = false;
    hasPuzzle = false;

    mapObstacleBounds: any[] = [];

    constructor(game: Game,
                typeString: string,
                position: Vec2,
                layer: number,
                orientation: number,
                showOnMap: boolean,
                data) {
        super(game, typeString, position, layer, orientation);
        this.kind = ObjectKind.Building;

        this.showOnMap = showOnMap;
        if(data.mapObstacleBounds) {
            for(const bounds of data.mapObstacleBounds) {
                this.mapObstacleBounds.push(rotateRect(position, bounds.min, bounds.max, 1, this.orientation!));
            }
        } else {
            console.warn(`No obstacle bounds specified for building: ${typeString}`);
        }
    }

    serializePartial(stream: SurvivBitStream): void {
        stream.writeBoolean(this.dead); // Ceiling destroyed
        stream.writeBoolean(this.occupied);
        stream.writeBoolean(this.ceilingDamaged);
        stream.writeBoolean(this.hasPuzzle);
        stream.writeBits(0, 4); // Padding
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeMapType(this.typeId);
        stream.writeBits(this.orientation!, 2);
        stream.writeBits(this.layer, 2);
    }

}
