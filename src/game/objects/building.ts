import {
    ObjectKind,
    Constants,
    type Orientation
} from "../../utils/constants";
import {
    rotateRect,
    sameLayer,
    rectCollision,
    type MinMax
} from "../../utils/math";
import type { SurvivBitStream } from "../../utils/survivBitStream";
import { GameObject } from "../gameObject";
import { Vec2 } from "planck";
import { type Game } from "../game";
import { type Obstacle } from "./obstacle";
import { type Player } from "./player";
import { type JSONObjects } from "../../jsonTypings";

export class Building extends GameObject {
    showOnMap: boolean;

    occupied = false;
    hasPuzzle = false;
    hasPrintedCoordsToConsole = false;
    hasAddedDebugMarkers = false;
    minPos: Vec2;
    maxPos: Vec2;
    zoomRadius = 28;
    data: JSONObjects.Building;

    puzzle: {
        name: string
        completeUseType: string // door to open when puzzle is completed
        completeOffDelay: number
        completeUseDelay: number
        errorResetDelay: number
        pieceResetDelay: number
        order: string[]
        inputOrder: string[]
        solved: boolean
        errorSeq: number
        resetTimeoutId: number
    };

    ceiling = {
        destructible: false,
        destroyed: false,
        wallsToDestroy: 0,
        damageable: false,
        damaged: false,
        obstaclesToDestroy: 0
    };

    mapObstacleBounds: Array<MinMax<Vec2>> = [];
    zoomRegions: Array<MinMax<Vec2> & { zoom?: number }> = [];

    doors: Obstacle[] = [];

    puzzlePieces: Obstacle[] = [];

    declare kind: ObjectKind.Building;

    constructor (game: Game,
        typeString: string,
        position: Vec2,
        layer: number,
        orientation: Orientation,
        showOnMap: boolean,
        data: JSONObjects.Building) {
        super(game, typeString, position, layer, orientation);
        this.kind = ObjectKind.Building;
        this.data = data;

        this.showOnMap = showOnMap;

        for (const zoomRegion of data.ceiling.zoomRegions) {
            if (zoomRegion.zoomIn) {
                //! unsafe
                const rect = rotateRect(
                    this.position,
                    Vec2(zoomRegion.zoomIn.min!),
                    Vec2(zoomRegion.zoomIn.max!),
                    1,
                    this.orientation
                ) as MinMax<Vec2> & { zoom?: number };
                rect.zoom = zoomRegion.zoom;
                this.zoomRegions.push(rect);
            }
        }

        if (data.ceiling.destroy != null) {
            this.ceiling.destructible = true;
            //! unsafe
            this.ceiling.wallsToDestroy = data.ceiling.destroy.wallCount!;
        }
        if (data.ceiling.damage != null) {
            this.ceiling.damageable = true;
            this.ceiling.obstaclesToDestroy = data.ceiling.damage.obstacleCount;
        }

        if (data.puzzle) {
            this.hasPuzzle = true;
            this.puzzle = {
                name: data.puzzle.name,
                completeUseType: data.puzzle.completeUseType,
                completeOffDelay: data.puzzle.completeOffDelay,
                completeUseDelay: data.puzzle.completeUseDelay,
                errorResetDelay: data.puzzle.errorResetDelay,
                pieceResetDelay: data.puzzle.pieceResetDelay,
                order: data.puzzle.order,
                inputOrder: [],
                solved: false,
                errorSeq: 0,
                resetTimeoutId: 0
            };
        }

        if (data.mapObstacleBounds?.length) {
            for (const bounds of data.mapObstacleBounds) {
                this.mapObstacleBounds.push(rotateRect(position, Vec2(bounds.min), Vec2(bounds.max), 1, this.orientation));
            }
        } else if (data.ceiling && data.ceiling.zoomRegions.length > 0) {
            // use the zoom regions as a fallback
            for (const zoomRegion of data.ceiling.zoomRegions) {
                //! unsafe
                const rect = zoomRegion.zoomIn ? zoomRegion.zoomIn : zoomRegion.zoomOut!;
                this.mapObstacleBounds.push(
                    rotateRect(
                        position,
                        //! unsafe
                        Vec2(rect.min!),
                        //! unsafe
                        Vec2(rect.max!),
                        1,
                        this.orientation
                    )
                );
            }
        } else {
            console.warn(`No obstacle bounds specified for building: ${typeString}`);
        }
    }

    serializePartial (stream: SurvivBitStream): void {
        stream.writeBoolean(this.ceiling.destroyed);
        stream.writeBoolean(this.occupied);
        stream.writeBoolean(this.ceiling.damaged);
        stream.writeBoolean(this.hasPuzzle);
        if (this.hasPuzzle) {
            stream.writeBoolean(this.puzzle.solved);
            stream.writeBits(this.puzzle.errorSeq, 7);
        }
        stream.writeBits(0, 4); // Padding
    }

    serializeFull (stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeMapType(this.typeId);
        stream.writeBits(this.orientation, 2);
        stream.writeBits(this.layer, 2);
    }

    onObstacleDestroyed (obstacle: Obstacle): void {
        const ceiling = this.ceiling;
        if (ceiling.destructible && obstacle.isWall && !ceiling.destroyed) {
            ceiling.wallsToDestroy--;
            if (ceiling.wallsToDestroy <= 0) {
                ceiling.destroyed = true;
                this.game.partialDirtyObjects.add(this);
                this.game.updateObjects = true;
            }
        }
        if (ceiling.damageable && obstacle.damageCeiling && !ceiling.damaged) {
            ceiling.obstaclesToDestroy--;
            if (ceiling.obstaclesToDestroy-- <= 0) {
                ceiling.damaged = true;
                this.game.partialDirtyObjects.add(this);
                this.game.updateObjects = true;
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    damage (amount: number, source): void {}

    playerIsOnZoomArea (player: Player): number {
        if (this.ceiling.destroyed || !sameLayer(this.layer, player.layer)) return 0;

        for (const zoomRegion of this.zoomRegions) {
            if (zoomRegion.min) {
                if (rectCollision(zoomRegion.min, zoomRegion.max, player.position, 1)) {
                    return zoomRegion.zoom !== undefined
                        ? zoomRegion.zoom
                        : Constants.scopeZoomRadius[player.isMobile ? "mobile" : "desktop"]["1xscope"];
                }
            }
        }
        return 0;
    }

    puzzlePieceToggled (piece: Obstacle): void {
        this.puzzle.inputOrder.push(piece.puzzlePiece);
        if (this.puzzle.resetTimeoutId) clearTimeout(this.puzzle.resetTimeoutId);

        // hack to compare two arrays :boffy:
        if (JSON.stringify(this.puzzle.inputOrder) === JSON.stringify(this.puzzle.order)) {
            for (const door of this.doors) {
                if (door.typeString === this.puzzle.completeUseType) {
                    setTimeout(() => {
                        door.toggleDoor();
                    }, this.puzzle.completeUseDelay * 1000);
                }
            }
            this.puzzle.solved = true;
            setTimeout(this.resetPuzzle.bind(this), this.puzzle.completeOffDelay * 1000);
            this.game.partialDirtyObjects.add(this);
        } else if (this.puzzle.inputOrder.length >= this.puzzle.order.length) {
            this.puzzle.errorSeq++;
            this.puzzle.errorSeq %= 2;
            this.game.partialDirtyObjects.add(this);
            this.puzzle.resetTimeoutId = setTimeout(this.resetPuzzle.bind(this), this.puzzle.errorResetDelay * 1000) as unknown as number;
        } else {
            this.puzzle.resetTimeoutId = setTimeout(() => {
                this.puzzle.errorSeq++;
                this.puzzle.errorSeq %= 2;
                this.game.partialDirtyObjects.add(this);
                setTimeout(this.resetPuzzle.bind(this), this.puzzle.errorResetDelay * 1000, this);
            }, this.puzzle.pieceResetDelay * 1000) as unknown as number;
        }
    }

    resetPuzzle (): void {
        this.puzzle.inputOrder = [];
        for (const piece of this.puzzlePieces) {
            if (piece.isButton) {
                piece.button.canUse = !this.puzzle.solved;
                piece.interactable = piece.button.canUse;
                piece.button.onOff = false;
                this.game.fullDirtyObjects.add(piece);
            }
        }
        this.game.partialDirtyObjects.add(this);
    }
}
