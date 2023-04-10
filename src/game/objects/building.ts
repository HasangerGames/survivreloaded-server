import { ObjectKind, rotateRect, type SurvivBitStream } from "../../utils";
import { GameObject } from "../gameObject";
import { type Vec2 } from "planck";
import { type Game } from "../game";
import { type Obstacle } from "./obstacle";

export class Building extends GameObject {

    showOnMap: boolean;

    occupied = false;
    hasPuzzle = false;

    ceiling = {
        destructible: false,
        destroyed: false,
        wallsToDestroy: 0,
        damageable: false,
        damaged: false,
        obstaclesToDestroy: 0
    };

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

        if(data.ceiling?.destroy) {
            this.ceiling.destructible = true;
            this.ceiling.wallsToDestroy = data.ceiling.destroy.wallCount;
        }
        if(data.ceiling?.damage) {
            this.ceiling.damageable = true;
            this.ceiling.obstaclesToDestroy = data.ceiling.damage.obstacleCount;
        }

        if(data.mapObstacleBounds?.length) {
            for(const bounds of data.mapObstacleBounds) {
                const bound: any = rotateRect(position, bounds.min, bounds.max, 1, this.orientation!);
                bound.layer = this.layer;
                this.mapObstacleBounds.push(bound);
            }
        } else if(data.ceiling && data.ceiling.zoomRegions.length > 0) {
            // use the zoom regions as a fallback
            for(const zoomRegion of data.ceiling.zoomRegions) {
                const bound: any = rotateRect(position, zoomRegion.zoomIn.min, zoomRegion.zoomIn.max, 1, this.orientation!);
                bound.layer = this.layer;
                this.mapObstacleBounds.push(bound);
            }
        } else {
            console.warn(`No obstacle bounds specified for building: ${typeString}`);
        }
    }

    serializePartial(stream: SurvivBitStream): void {
        stream.writeBoolean(this.ceiling.destroyed);
        stream.writeBoolean(this.occupied);
        stream.writeBoolean(this.ceiling.damaged);
        stream.writeBoolean(this.hasPuzzle);
        stream.writeBits(0, 4); // Padding
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeMapType(this.typeId);
        stream.writeBits(this.orientation!, 2);
        stream.writeBits(this.layer, 2);
    }

    onObstacleDestroyed(obstacle: Obstacle): void {
        const ceiling = this.ceiling;
        if(ceiling.destructible && obstacle.isWall && !ceiling.destroyed) {
            ceiling.wallsToDestroy--;
            if(ceiling.wallsToDestroy <= 0) {
                ceiling.destroyed = true;
                this.game.partialDirtyObjects.add(this);
                this.game.updateObjects = true;
            }
        }
        if(ceiling.damageable && obstacle.damageCeiling && !ceiling.damaged) {
            ceiling.obstaclesToDestroy--;
            if(ceiling.obstaclesToDestroy-- <= 0) {
                ceiling.damaged = true;
                this.game.partialDirtyObjects.add(this);
                this.game.updateObjects = true;
            }
        }

    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    damage(amount: number, source): void {}

}
