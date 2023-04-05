import { ObjectKind, rotateRect, type SurvivBitStream } from "../../utils";
import { GameObject } from "../gameObject";
import { type Vec2 } from "planck";
import { type Game } from "../game";

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
        if(data.mapObstacleBounds?.length) {
            for(const bounds of data.mapObstacleBounds) {
                this.mapObstacleBounds.push(rotateRect(position, bounds.min, bounds.max, 1, this.orientation!));
            }
        } else if (data.ceiling && data.ceiling.zoomRegions.length > 0) {
            // use the zoom regions as a fallback
            for (const zoomRegion of data.ceiling.zoomRegions) {
               this.mapObstacleBounds.push(rotateRect(position, zoomRegion.zoomIn.min, zoomRegion.zoomIn.max, 1, this.orientation!));
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

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    damage(amount: number, source): void {}

}
