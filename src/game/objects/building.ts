import { ObjectKind, rotateRect, type SurvivBitStream } from "../../utils";
import { GameObject } from "../gameObject";
import { Vec2 } from "planck";
import { type Game } from "../game";
import { type Obstacle } from "./obstacle";

export class Building extends GameObject {

    showOnMap: boolean;

    occupied = false;
    hasPuzzle = false;
    hasPrintedCoordsToConsole = false;
    hasAddedDebugMarkers = false;
    minPos: Vec2;
    maxPos: Vec2;

    ceiling = {
        destructible: false,
        destroyed: false,
        wallsToDestroy: 0,
        damageable: false,
        damaged: false,
        obstaclesToDestroy: 0
    };

    mapObstacleBounds: any[] = [];
    zoomRegions: any;

    data: any;

    constructor(game: Game,
                typeString: string,
                position: Vec2,
                layer: number,
                orientation: number,
                showOnMap: boolean,
                data) {
        super(game, typeString, position, layer, orientation);
        this.kind = ObjectKind.Building;
        this.zoomRegions = data.ceiling.zoomRegions;
        this.data = data;

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
                this.mapObstacleBounds.push(rotateRect(position, bounds.min, bounds.max, 1, this.orientation!));
            }
        } else if(data.ceiling && data.ceiling.zoomRegions.length > 0) {
            // use the zoom regions as a fallback
            for(const zoomRegion of data.ceiling.zoomRegions) {
                const rect = zoomRegion.zoomIn ? zoomRegion.zoomIn : zoomRegion.zoomOut;
                this.mapObstacleBounds.push(rotateRect(position, rect.min, rect.max, 1, this.orientation!));
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

    coordsAreInZoomArea(coords: Vec2, layer: number, onStairs: boolean): boolean {
        let xMin = 0;
        let yMin = 0;
        let xMax = 0;
        let yMax = 0;
        if(this.data.ceiling && this.data.ceiling.zoomRegions.length > 0) {
            for(let i = 0; i < this.data.ceiling.zoomRegions.length; i++){
                if(this.data.ceiling.zoomRegions[i].zoomIn){
                    xMin = this.position.x + this.data.ceiling.zoomRegions[i].zoomIn.min.x;
                    yMin = this.position.y + this.data.ceiling.zoomRegions[i].zoomIn.min.y;
                    xMax = this.position.x + this.data.ceiling.zoomRegions[i].zoomIn.max.x;
                    yMax = this.position.y + this.data.ceiling.zoomRegions[i].zoomIn.max.y;
                    this.minPos = new Vec2(xMin,yMin);
                    this.maxPos = new Vec2(xMax,yMax);
                    this.minPos = rotateRect(this.position, this.data.ceiling.zoomRegions[i].zoomIn.min, this.data.ceiling.zoomRegions[i].zoomIn.max, 1, this.orientation!).min;
                    this.maxPos = rotateRect(this.position, this.data.ceiling.zoomRegions[i].zoomIn.min, this.data.ceiling.zoomRegions[i].zoomIn.max, 1, this.orientation!).max;
                    xMin = this.minPos.x;
                    yMin = this.minPos.y;
                    xMax = this.maxPos.x;
                    yMax = this.maxPos.y;
                    if(!this.hasAddedDebugMarkers){
                        this.hasAddedDebugMarkers = true;
                    }
                    if(!this.hasPrintedCoordsToConsole){
                        console.warn(this.typeString);
                        console.warn(xMin);
                        console.warn(yMin);
                        console.warn(xMax);
                        console.warn(yMax);
                        this.hasPrintedCoordsToConsole = true;
                    }

                    if (coords.x > xMin && coords.y > yMin && coords.x < xMax && coords.y < yMax && layer === this.layer || onStairs) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
