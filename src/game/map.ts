import {
    addAdjust,
    addOrientations,
    circleCollision,
    CollisionType,
    Debug,
    distanceBetween, Item,
    Maps,
    ObjectKind,
    Objects,
    random,
    randomFloat,
    randomVec,
    rectCollision,
    rectRectCollision,
    rotateRect,
    TypeToId,
    weightedRandom
} from "../utils";
import { type Game } from "./game";
import { Obstacle } from "./objects/obstacle";
import { Structure } from "./objects/structure";
import { Building } from "./objects/building";
import { Vec2 } from "planck";

export class Map {
    name: string;
    seed: number;

    game: Game;

    width: number;
    height: number;
    shoreInset: number;
    grassInset: number;

    rivers: River[];
    places: Place[];
    groundPatches: GroundPatch[];

    constructor(game, mapId) {
        this.name = mapId;
        this.seed = random(0, 2147483647);
        this.game = game;

        const mapInfo = Maps[mapId];

        this.width = mapInfo.width;
        this.height = mapInfo.height;
        this.shoreInset = 48;
        this.grassInset = 18;

        // TODO Better river generation
        this.rivers = [];
        let x = 0; let y = 0;
        const points: Vec2[] = [];
        while(x < 720 && y < 720) {
            x += 10 + random(-6, 6);
            y += 10 + random(-6, 6);
            points.push(Vec2(x, y));
        }
        this.rivers.push(new River(8, 0, points));

        this.places = [];
        for(const place of mapInfo.places) {
            this.places.push(new Place(place.name, Vec2(place.x, place.y)));
        }

        if(!Debug.disableMapGeneration) {
            for(const type in mapInfo.objects) {
                const data = Objects[type];
                const count = mapInfo.objects[type];
                switch(data.type) {
                    case "obstacle":
                        this.genObstacles(count, type, data);
                        break;
                    case "building":
                        this.genBuildings(count, type, data);
                        break;
                }
            }
            // 2 fisherman's shacks: 2 at oceanside, 2 at riverside
        } else {
            //this.genStructure("club_structure_01", Objects["club_structure_01"]);

            //this.genBuildingTest("barn_01", 0, false);

            // Items test
            this.obstacleTest("crate_01", Vec2(453, 153), 1);
            this.obstacleTest("crate_01", Vec2(458, 153), 1);
            this.obstacleTest("crate_01", Vec2(463, 153), 1);
            this.obstacleTest("crate_01", Vec2(468, 153), 1);
            (this.game.objects[0] as Obstacle).loot = [new Item("m9", 1)];
            (this.game.objects[1] as Obstacle).loot = [new Item("m249", 1)];
            (this.game.objects[2] as Obstacle).loot = [new Item("mac10", 2)];
            (this.game.objects[3] as Obstacle).loot = [new Item("ak47", 1)];

            // Object culling test
            /*for(let x = 0; x <= 45; x++) {
                for(let y = 0; y <= 45; y++) {
                    this.obstacleTest("tree_01", Vec2(x * 16, y * 16), 1.6);
                }
            }*/
        }

        this.groundPatches = [];
    }

    private obstacleTest(type: string, position: Vec2, scale: number): void {
        this.genObstacle(type, position, 0, 1, scale, Objects[type]);
    }

    private genStructure(typeString: string, structureData: any, setPosition: Vec2 | null = null, setOrientation: number | null = null): void {
        let orientation;
        if(setOrientation !== undefined) orientation = setOrientation;
        else orientation = random(0, 3);

        let position;
        if(setPosition) position = setPosition;
        else position = this.getRandomPositionFor(ObjectKind.Structure, structureData, orientation, 1);

        const layerObjIds: number[] = [];

        for(let layerId = 0; layerId < structureData.layers.length; layerId++) {
            const layerObj = structureData.layers[layerId];
            const layerType = layerObj.type;
            const layer = Objects[layerType];
            layerObjIds.push(TypeToId[layerType]);

            let layerOrientation;
            if(layerObj.inheritOri === false) layerOrientation = layerObj.orientation;
            else layerOrientation = addOrientations(layerObj.ori, orientation);
            const layerPosition = addAdjust(position, layerObj.pos, orientation);

            if(layer.type === "structure") {
                this.genStructure(layerType, layer, layerPosition, layerOrientation);
            } else if(layer.type === "building") {
                this.genBuilding(layerType, layer, layerPosition, layerOrientation, layerId);
            } else {
                // console.warn(`Unsupported object type: ${layer.type}`);
            }
        }
        this.game.objects.push(new Structure(this.game.nextObjectId, typeString, position, orientation, layerObjIds));
    }

    private genBuildings(count, type, building): void {
        for(let i = 0; i < count; i++) this.genBuilding(type, building);
    }

    private genBuildingTest(type: string, orientation: number, markers: boolean): void {
        this.genBuilding(type, Objects[type], Vec2(450, 150), orientation, undefined, true);
    }

    private genBuilding(typeString: string,
                        buildingData,
                        setPosition?: Vec2,
                        setOrientation?: number,
                        setLayer?: number,
                        debug = false): void {
        let orientation;
        if(setOrientation !== undefined) orientation = setOrientation;
        else orientation = random(0, 3);
        let position;
        if(setPosition) position = setPosition;
        else position = this.getRandomPositionFor(ObjectKind.Building, buildingData, orientation, 1);

        let layer;
        if(setLayer !== undefined) layer = setLayer;
        else layer = 0;

        for(const mapObject of buildingData.mapObjects) {
            const partType = mapObject.type;
            if(!partType || partType === "") {
                // console.warn(`${type}: Missing object at ${mapObject.position.x}, ${mapObject.position.y}`);
                continue;
            }
            const part = Objects[partType];

            let partOrientation;
            if(mapObject.inheritOri === false) partOrientation = mapObject.ori;
            else partOrientation = addOrientations(mapObject.ori, orientation);
            const partPosition = addAdjust(position, mapObject.pos, orientation);

            if(part.type === "structure") {
                this.genStructure(partType, part, partPosition, partOrientation);
            } else if(part.type === "building") {
                this.genBuilding(partType, part, partPosition, partOrientation, layer);
            } else if(part.type === "obstacle") {
                this.genObstacle(
                    partType,
                    partPosition,
                    layer,
                    partOrientation,
                    mapObject.scale,
                    part
                );
            } else if(part.type === "random") {
                const items = Object.keys(part.weights); const weights = Object.values(part.weights);
                const randType = weightedRandom(items, weights as number[]);
                this.genObstacle(
                    randType,
                    partPosition,
                    layer,
                    partOrientation,
                    mapObject.scale,
                    Objects[randType]
                );
            } else if(part.type === "ignored") {
                // Ignored
            } else {
                // console.warn(`Unknown object type: ${part.type}`);
            }
        }
        const building: Building = new Building(
            this.game.nextObjectId,
            typeString,
            position,
            setLayer !== undefined ? setLayer : 0,
            orientation,
            this.game,
            buildingData.map ? buildingData.map.display : false,
            buildingData
        );
        if(debug) {
            for(const bounds of building.mapObstacleBounds) {
                this.placeDebugMarker(bounds.min);
                this.placeDebugMarker(bounds.max);
                this.placeDebugMarker(Vec2(bounds.min.x, bounds.max.y));
                this.placeDebugMarker(Vec2(bounds.max.x, bounds.min.y));
            }
        }
        this.game.objects.push(building);
    }

    private placeDebugMarker(position: Vec2): void {
        this.game.objects.push(new Obstacle(
            this.game.nextObjectId,
            "house_column_1",
            position,
            0,
            0,
            this.game,
            0.125,
            Objects.house_column_1
        ));
    }

    private genObstacle(typeString: string,
                        position: Vec2,
                        layer: number,
                        orientation: number,
                        scale: number,
                        obstacleData): void {
        this.game.objects.push(new Obstacle(
            this.game.nextObjectId,
            typeString,
            position,
            layer !== undefined ? layer : 0,
            orientation,
            this.game,
            scale,
            obstacleData
        ));
    }

    private genObstacles(count, typeString, obstacleData): void {
        for(let i = 0; i < count; i++) {
            const scale = randomFloat(obstacleData.scale.createMin, obstacleData.scale.createMax);
            this.genObstacle(
                typeString,
                this.getRandomPositionFor(ObjectKind.Obstacle, obstacleData.collision, 0, scale),
                0,
                0,
                scale,
                obstacleData
            );
        }
    }

    private getRandomPositionFor(kind: ObjectKind, collisionData, orientation: number, scale: number): Vec2 {
        let foundPosition = false;
        let thisPos;
        while(!foundPosition) {
            thisPos = randomVec(75, this.width - 75, 75, this.height - 75);
            let shouldContinue = false;

            for(const river of this.rivers) {
                const minRiverDist = (kind === ObjectKind.Building || kind === ObjectKind.Structure) ? river.width * 5 : river.width * 2.5;
                for(const point of river.points) {
                    if(distanceBetween(thisPos, point) < minRiverDist) {
                        shouldContinue = true;
                        break;
                    }
                }
                if(shouldContinue) break;
            }
            if(shouldContinue) continue;
            if(!collisionData) break;

            let thisMin, thisMax, thisRad;
            if(collisionData.type === CollisionType.Rectangle) {
                thisMin = Vec2.add(thisPos, collisionData.min);
                thisMax = Vec2.add(thisPos, collisionData.max);
            } else if(collisionData.type === CollisionType.Circle) {
                thisRad = collisionData.rad;
            }

            for(const that of this.game.objects) {
                if(that instanceof Building) {
                    for(const thatBounds of that.mapObstacleBounds) {
                        if(collisionData.mapObstacleBounds) {
                            for(const bounds2 of collisionData.mapObstacleBounds) {
                                const thisBounds = rotateRect(thisPos, bounds2.min, bounds2.max, 1, orientation);
                                if(rectRectCollision(thatBounds.min, thatBounds.max, thisBounds.min, thisBounds.max)) {
                                    shouldContinue = true;
                                    break;
                                }
                            }
                        } else if(collisionData.type === CollisionType.Circle) {
                            if(rectCollision(thatBounds.min, thatBounds.max, thisPos, thisRad)) {
                                shouldContinue = true;
                            }
                        } else if(collisionData.type === CollisionType.Rectangle) {
                            if(rectRectCollision(thatBounds.min, thatBounds.max, thisMin, thisMax)) {
                                shouldContinue = true;
                            }
                        }
                    }
                } else if(that instanceof Obstacle) {
                    if(collisionData.type === CollisionType.Circle) {
                        if(that.collision.type === CollisionType.Circle) {
                            if(circleCollision(that.position, that.collision.rad, thisPos, thisRad)) {
                                shouldContinue = true;
                            }
                        } else if(that.collision.type === CollisionType.Rectangle) {
                            if(rectCollision(that.collision.min, that.collision.max, thisPos, thisRad)) {
                                shouldContinue = true;
                            }
                        }
                    } else if(collisionData.type === CollisionType.Rectangle) {
                        if(that.collision.type === CollisionType.Circle) {
                            if(rectCollision(thisMin, thisMax, that.position, that.collision.rad)) {
                                shouldContinue = true;
                            }
                        } else if(that.collision.type === CollisionType.Rectangle) {
                            if(rectRectCollision(that.collision.min, that.collision.max, thisMin, thisMax)) {
                                shouldContinue = true;
                            }
                        }
                    }
                }
                if(shouldContinue) break;
            }
            if(shouldContinue) continue;

            foundPosition = true;
        }
        return thisPos;
    }

}

class River {
    width: number;
    looped: number;
    points: Vec2[];

    constructor(width, looped, points) {
        this.width = width;
        this.looped = looped;
        this.points = points;
    }

}

class Place {
    name: string;
    position: Vec2;

    constructor(name, pos) {
        this.name = name;
        this.position = pos;
    }

}

class GroundPatch {
    min: Vec2;
    max: Vec2;
    color: number;
    roughness: number;
    offsetDist: number;
    order: number;
    useAsMapShape: boolean;

    constructor(min, max, color, roughness, offsetDist, order, useAsMapShape) {
        this.min = min; // vector
        this.max = max; // vector
        this.color = color; // uint32
        this.roughness = roughness; // float32
        this.offsetDist = offsetDist; // float32
        this.order = order; // 7-bit integer
        this.useAsMapShape = useAsMapShape; // boolean (1 bit)
    }

}
