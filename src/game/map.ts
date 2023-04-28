import {
    addAdjust,
    addOrientations,
    circleCollision,
    CollisionType,
    Debug,
    distanceBetween,
    Maps,
    ObjectKind,
    Objects,
    random,
    randomBoolean,
    randomFloat,
    randomPointInsideCircle,
    randomVec,
    rectCollision,
    rectRectCollision,
    rotateRect,
    TypeToId,
    weightedRandom,
    deepCopy,
    log,
    type Orientation,
    type MinMax
} from "../utils";
import { type Game } from "./game";
import { Obstacle } from "./objects/obstacle";
import { Structure } from "./objects/structure";
import { Building } from "./objects/building";
import { Decal } from "./objects/decal";
import { Vec2 } from "planck";
import { generateLooseLootFromArray, Loot } from "./objects/loot";
import { type GameObject } from "./gameObject";
import { Stair } from "./stair";
import { type JSONObjects } from "../jsonTypings";

type ObjectBounds = MinMax<Vec2> & { originalMin: Vec2, originalMax: Vec2, type: CollisionType };
type RectangleBound = ObjectBounds & { type: CollisionType.Rectangle };
// type CircleBound = ObjectBounds & { type: CollisionType.Circle };

// Potential naming collision with the native Map class
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

    constructor(game: Game, mapId: string) {
        const mapStartTime = Date.now();
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
        if(!Debug.disableMapGeneration) {

            let x = 0, y = 500;
            const points: Vec2[] = [];
            while(x < 700) {
                x += 20;
                y -= 5 + random(-8, 8);
                points.push(Vec2(x, y));

                // Crossing bunker
                if(x === 360) {
                    this.genStructure("bunker_structure_05", Objects.bunker_structure_05 as JSONObjects.Structure, Vec2(x, y), 1);
                }

                // River docks
                if(x === 400) {
                    this.genBuilding("dock_01", Objects.dock_01 as JSONObjects.Building, Vec2(x, y - 13), 0, 0);
                }

                // Fisherman's shacks
                if(x === 300 || x === 500) {
                    this.genBuilding("shack_03a", Objects.shack_03a as JSONObjects.Building, Vec2(x, y - 25), 0, 0);
                }

                // Large bridges
                if(x === 200 || x === 600) {
                    this.genBuilding("bridge_lg_01", Objects.bridge_lg_01 as JSONObjects.Building, Vec2(x, y), 1, 0);
                }

                // Smaller river
                if(x === 440) {
                    let x2 = 500, y2 = y - 32;
                    const points2: Vec2[] = [];
                    for(let steps = 0; y2 < 700; steps++) {
                        x2 += 5 + random(-8, 8);
                        y2 += 20;
                        points2.push(Vec2(x2, y2));

                        // Medium bridges
                        if(steps === 5 || steps === 12) this.genBuilding("bridge_md_01", Objects.bridge_md_01 as JSONObjects.Building, Vec2(x2, y2), 0, 0);
                        else if(y2 < 660) {
                            if(randomBoolean()) this.genRiverObstacle(Vec2(x2, y2), 5, "stone_03");
                            if(randomBoolean()) this.genRiverObstacle(Vec2(x2, y2), 5, "bush_04");
                        }
                    }
                    this.rivers.push(new River(8, 0, points2));
                }
            }
            this.rivers.push(new River(16, 0, points));

            // Generate river obstacles
            const riverIndex = random(0, this.rivers.length - 1);
            for(let i = 0; i < this.rivers.length; i++) {
                const river = this.rivers[i];
                let pointIndex;
                if(i === riverIndex) {
                    pointIndex = random(0, river.points.length - 1);
                }
                for(let i2 = 0; i2 < river.points.length; i2++) {
                    const { x, y } = river.points[i2];
                    if(i2 === pointIndex) {
                        this.genRiverObstacle(Vec2(x, y), 15, "chest_03"); // River chest
                    }
                    if(x > 20 && x < 700) {
                        // 1 in 3 chance of obstacle not generating at a river point
                        if(!(random(1, 3) === 1)) this.genRiverObstacle(Vec2(x, y), 15, "stone_03");
                        if(!(random(1, 3) === 1)) this.genRiverObstacle(Vec2(x, y), 15, "bush_04");
                    }
                }
            }
        }

        this.places = [];
        for(const place of mapInfo.places) {
            this.places.push(new Place(place.name, Vec2(place.x, place.y)));
        }
        this.groundPatches = [];

        if(!Debug.disableMapGeneration) {

            // Docks
            this.genOnShore(ObjectKind.Building, "warehouse_complex_01", 1, 72, 0, 1);

            // Conch bunker
            this.genOnShore(ObjectKind.Structure, "bunker_structure_04", 1, 36, 0, 1);

            // Huts
            this.genOnShore(ObjectKind.Building, "hut_01", 3, 27, 1);
            this.genOnShore(ObjectKind.Building, "hut_02", 1, 27, 1);
            this.genOnShore(ObjectKind.Building, "hut_03", 1, 27, 1);

            this.genOnShore(ObjectKind.Building, "hedgehog_01", 40, 57, 4);
            this.genOnShore(ObjectKind.Building, "shack_03b", 2, 57, 1);

            // Barrels & crates
            // TODO Allow barrels and crates to spawn on the beach naturally
            this.genOnShore(ObjectKind.Obstacle, "crate_01", 12, 57, 4);
            this.genOnShore(ObjectKind.Obstacle, "barrel_01", 12, 57, 4);

            // Treasure chest
            this.genOnShore(ObjectKind.Obstacle, "chest_01", 1, 57, 4);

            // Loose loot
            for(let i = 0; i < 16; i++) {
                generateLooseLootFromArray(
                    this.game,
                    [{ tier: "tier_world", min: 1, max: 1 }],
                                                                   //! ?????
                    this.getRandomPositionFor(ObjectKind.Loot, undefined as any, 0, 1),
                    0
                );
            }

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
                    case "structure":
                        this.genStructures(count, type, data);
                        break;
                }
            }
        } else {
            // Building/obstacle debug code goes here
            new Loot(this.game, "762mm", Vec2(450, 150), 0, 180);
            new Loot(this.game, "2xscope", Vec2(450, 150), 0, 1);
            new Loot(this.game, "m870", Vec2(450, 150), 0, 1);
            new Loot(this.game, "m1911", Vec2(450, 150), 0, 1);
            new Loot(this.game, "m870", Vec2(450, 150), 0, 1);
        }
        log(`Map generation took ${Date.now() - mapStartTime}ms`);

        // Calculate visible objects
        const visibleObjectsStartTime = Date.now();
        const supportedZoomLevels: number[] = [28, 36, 48, 32, 40, 48];
        if(this.game.has8x) supportedZoomLevels.push(64, 68);
        if(this.game.has15x) supportedZoomLevels.push(88, 104);
        for(const zoomLevel of supportedZoomLevels) {
            this.game.visibleObjects[zoomLevel] = {};
            const xCullDist = zoomLevel * 1.55, yCullDist = zoomLevel * 1.25;
            for(let x = 0; x <= this.width / 10; x++) {
                this.game.visibleObjects[zoomLevel][x * 10] = {};
                for(let y = 0; y <= this.height / 10; y++) {
                    const visibleObjects = new Set<GameObject>();

                    const minX = (x * 10) - xCullDist,
                          minY = (y * 10) - yCullDist,
                          maxX = (x * 10) + xCullDist,
                          maxY = (y * 10) + yCullDist;
                    const min = Vec2(minX, minY),
                          max = Vec2(maxX, maxY);

                    for(const object of this.game.staticObjects) {
                        let isVisible = false;
                        if((object as Building).mapObstacleBounds) {
                            for(const bounds of (object as Building).mapObstacleBounds) {
                                if(rectRectCollision(min, max, bounds.min, bounds.max)) {
                                    isVisible = true;
                                    break;
                                }
                            }
                        } else {
                            isVisible = object.position.x > minX &&
                                        object.position.x < maxX &&
                                        object.position.y > minY &&
                                        object.position.y < maxY;
                        }
                        if(isVisible) visibleObjects.add(object);
                    }
                    this.game.visibleObjects[zoomLevel][x * 10][y * 10] = visibleObjects;
                }
            }
        }
        log(`Calculating visible objects took ${Date.now() - visibleObjectsStartTime}ms`);
    }

    private obstacleTest(type: string, position: Vec2, orientation: Orientation = 0, scale = 1): void {
        this.genObstacle(type, position, 0, orientation, scale, Objects[type] as JSONObjects.Obstacle);
    }

    private genStructures(count: number, type: string, building: JSONObjects.Structure): void {
        for(let i = 0; i < count; i++) this.genStructure(type, building);
    }

    private genStructure(typeString: string, structureData: JSONObjects.Structure, setPosition?: Vec2, setOrientation?: Orientation): void {
        const orientation = setOrientation ?? random(0, 3) as Orientation;
        const position = setPosition ?? this.getRandomPositionFor(ObjectKind.Structure, structureData, orientation, 1);

        const layerObjIds: number[] = [];

        if(structureData.layers) {
            for(let layerId = 0, length = structureData.layers.length; layerId < length; layerId++) {
                const layerObj = structureData.layers[layerId];
                const layerType = layerObj.type;
                const layer = Objects[layerType];
                layerObjIds.push(TypeToId[layerType]);

                let layerOrientation: Orientation;
                if(layerObj.inheritOri === false) layerOrientation = layerObj.ori;
                else layerOrientation = addOrientations(layerObj.ori, orientation);
                const layerPosition = addAdjust(position, Vec2(layerObj.pos), orientation);

                if(layer.type === "structure") {
                    this.genStructure(layerType, layer, layerPosition, layerOrientation);
                } else if(layer.type === "building") {
                    this.genBuilding(layerType, layer, layerPosition, layerOrientation, layerId);
                } else {
                    // console.warn(`Unsupported object type: ${layer.type}`);
                }
            }
        }
        this.game.staticObjects.add(new Structure(this.game, typeString, position, orientation, layerObjIds));

        if ("stairs" in structureData && Array.isArray(structureData.stairs)) {
            for(const stairData of structureData.stairs) {
                if(!stairData.lootOnly) this.game.stairs.add(new Stair(position, orientation ?? 0, stairData));
            }
        }
    }

    private genBuildings(count: number, type: string, building: JSONObjects.Building): void {
        for(let i = 0; i < count; i++) this.genBuilding(type, building);
    }

    private buildingTest(type: string, orientation: Orientation): void {
        this.genBuilding(type, Objects[type] as JSONObjects.Building, Vec2(450, 150), orientation, undefined, true);
    }

    private genBuilding(typeString: string,
                        buildingData: JSONObjects.Building,
                        setPosition?: Vec2,
                        setOrientation?: Orientation,
                        setLayer?: number,
                        debug = false): void {
        let orientation: Orientation;
        if(setOrientation !== undefined && setOrientation !== null) orientation = setOrientation;
        else if(typeString.startsWith("cache_")) orientation = 0;
        else orientation = random(0, 3) as Orientation;

        const layer = setLayer ?? 0;
        const position = setPosition ?? this.getRandomPositionFor(ObjectKind.Building, buildingData, orientation, 1);

        const building = new Building(
            this.game,
            typeString,
            position,
            setLayer ?? 0,
            orientation,
            (buildingData.map as any)?.display ?? false,
            buildingData
        );

        for(const mapObject of buildingData.mapObjects ?? []) {
            const partType = mapObject.type;
            if(!partType || partType === "") {
                // console.warn(`${type}: Missing object at ${mapObject.position.x}, ${mapObject.position.y}`);
                continue;
            }
            const part = Objects[partType];

            let partOrientation: Orientation;
            if(mapObject.inheritOri === false) partOrientation = mapObject.ori;
            else partOrientation = addOrientations(mapObject.ori, orientation);
            const partPosition = addAdjust(position, Vec2(mapObject.pos), orientation);

            switch(part.type) {
                case "structure":
                    this.genStructure(partType, part, partPosition, partOrientation);
                    break;
                case "building":
                    this.genBuilding(partType, part, partPosition, partOrientation, layer);
                    break;
                case "obstacle":
                    this.genObstacle(
                        partType,
                        partPosition,
                        layer,
                        partOrientation,
                        mapObject.scale,
                        part,
                        building,
                        mapObject.bunkerWall ?? false,
                        mapObject.puzzlePiece
                    );
                    break;
                case "random": {
                    const items = Object.keys(part.weights);
                    const weights = Object.values(part.weights);
                    const randType = weightedRandom(items, weights);
                    if(randType !== "nothing") {
                        const data = Objects[randType];
                        switch(data.type) {
                            case "obstacle":
                                this.genObstacle(
                                    randType,
                                    partPosition,
                                    layer,
                                    partOrientation,
                                    mapObject.scale,
                                    data,
                                    building
                                );
                                break;
                            case "loot_spawner":
                                generateLooseLootFromArray(this.game, data.loot, partPosition, layer);
                                break;
                            case "building":
                                this.genBuilding(randType, data, partPosition, partOrientation, layer);
                                break;
                        }
                    }
                    break;
                }
                case "loot_spawner":
                    generateLooseLootFromArray(this.game, part.loot, partPosition, layer);
                    break;
                case "decal":
                    this.game.staticObjects.add(new Decal(partType, this.game, partPosition, layer, partOrientation, mapObject.scale));
                    break;
                // No such entry exists
                // case "ignored":
                    // Ignored
                    // break;
            }
        }
        if(buildingData.mapGroundPatches) {
            for(const groundPatch of buildingData.mapGroundPatches) {
                this.groundPatches.push(new GroundPatch(
                    //! all of these non-null assertions are unsafe
                    addAdjust(position, Vec2(groundPatch.bound.min!), orientation),
                    addAdjust(position, Vec2(groundPatch.bound.max!), orientation),
                    groundPatch.color!,
                    groundPatch.roughness!,
                    groundPatch.offsetDist!,
                    groundPatch.order!,
                    groundPatch.useAsMapShape ?? true
                ));
            }
        }

        if(debug) {
            for(const bounds of building.mapObstacleBounds) {
                this.placeDebugMarker(bounds.min);
                this.placeDebugMarker(bounds.max);
                this.placeDebugMarker(Vec2(bounds.min.x, bounds.max.y));
                this.placeDebugMarker(Vec2(bounds.max.x, bounds.min.y));
            }
        }
        this.game.staticObjects.add(building);
    }

    placeDebugMarker(position: Vec2): void {
        this.game.staticObjects.add(new Obstacle(
            this.game,
            "house_column_1",
            position,
            0,
            0,
            0.125,
            Objects.house_column_1
        ));
    }

    private genRiverObstacle(point: Vec2, riverWidth: number, typeString: string): void {
        //hack This type-cast is unsafe!
        const obstacleData = Objects[typeString] as unknown as JSONObjects.Obstacle;
        const scale = randomFloat(obstacleData.scale.createMin, obstacleData.scale.createMax);
        const position = this.getRandomPositionFor(ObjectKind.Obstacle, obstacleData, 0, scale, () => {
            return randomPointInsideCircle(Vec2(point.x, point.y), riverWidth);
        }, true);
        this.genObstacle(typeString, position, 0, 0, scale, obstacleData);
    }

    private genObstacle(typeString: string,
                        position: Vec2,
                        layer: number,
                        orientation: Orientation,
                        scale: number,
                        obstacleData: JSONObjects.Obstacle,
                        parentBuilding?: Building,
                        bunkerWall = false,
                        puzzlePice?: string): Obstacle {
        const obstacle = new Obstacle(
            this.game,
            typeString,
            position,
            layer,
            orientation,
            scale,
            obstacleData,
            parentBuilding,
            bunkerWall,
            puzzlePice
        );
        if(obstacle.door?.slideToOpen) this.game.dynamicObjects.add(obstacle);
        else this.game.staticObjects.add(obstacle);
        return obstacle;
    }

    private genObstacles(count: number, typeString: string, obstacleData: JSONObjects.Obstacle): void {
        for(let i = 0; i < count; i++) {
            const scale = randomFloat(obstacleData.scale.createMin, obstacleData.scale.createMax);
            this.genObstacle(
                typeString,
                this.getRandomPositionFor(ObjectKind.Obstacle, obstacleData, 0, scale),
                0,
                0,
                scale,
                obstacleData
            );
        }
    }

    private genOnShore(kind: ObjectKind,
                       typeString: string,
                       count: number,
                       shoreDist: number,
                       width: number,
                       orientationOffset: Orientation = 0,
                       shoreEdgeDist = shoreDist): void {
        for(let i = 0; i < count; i++) {
            const data = Objects[typeString] as JSONObjects.Obstacle | JSONObjects.Building | JSONObjects.Structure;
            const orientation = random(0, 3) as Orientation;
            const position = this.getPositionOnShore(kind, data, addOrientations(orientation, orientationOffset), 1, shoreDist, width, shoreEdgeDist);

            if(kind === ObjectKind.Building) {
                this.genBuilding(
                    typeString,
                    data as JSONObjects.Building,
                    position,
                    orientation
                );
            } else if(kind === ObjectKind.Obstacle) {
                this.genObstacle(
                    typeString,
                    position,
                    0,
                    (kind === ObjectKind.Obstacle) ? 0 : orientation,
                    random((data as JSONObjects.Obstacle).scale.createMin, (data as JSONObjects.Obstacle).scale.createMax),
                    data as JSONObjects.Obstacle
                );
            } else if(kind === ObjectKind.Structure) {
                this.genStructure(typeString, data as JSONObjects.Structure, position, orientation);
            }
        }
    }

    private getPositionOnShore(kind: ObjectKind, data: JSONObjects.Obstacle | JSONObjects.Building | JSONObjects.Structure, orientation: Orientation, scale: number, shoreDist: number, width: number, shoreEdgeDist = shoreDist): Vec2 {
        return this.getRandomPositionFor(kind, data, orientation, scale, () => {
            let min: Vec2, max: Vec2;
            switch(orientation) {
                case 0:
                    min = Vec2(shoreDist - width, 720 - shoreDist - width);
                    max = Vec2(720 - shoreDist + width, 720 - shoreDist + width);
                    break;
                case 1:
                    min = Vec2(shoreDist - width, 720 - shoreDist - width);
                    max = Vec2(shoreDist + width, shoreDist + width);
                    break;
                case 2:
                    min = Vec2(shoreDist - width, shoreDist - width);
                    max = Vec2(720 - shoreDist + width, shoreDist + width);
                    break;
                case 3:
                    min = Vec2(720 - shoreDist - width, 720 - shoreDist - width);
                    max = Vec2(720 - shoreDist + width, shoreDist + width);
                    break;
            }
            return randomVec(min.x, max.x, min.y, max.y);
        });
    }

    getRandomPositionFor(kind: ObjectKind,
                         object: JSONObjects.Obstacle | JSONObjects.Structure | JSONObjects.Building,
                         orientation: Orientation = 0,
                         scale = 1,
                         getPosition?: () => Vec2,
                         ignoreRivers?: boolean): Vec2 {
        const isBuilding =
            kind === ObjectKind.Building || kind === ObjectKind.Structure;
        type Bound = ({
            type: CollisionType.Rectangle
            originalMin: Vec2
            originalMax: Vec2
        } | {
            type: CollisionType.Circle
            rad: number
        }) & MinMax<Vec2>;
        const thisBounds: Bound[] = [];

        switch(kind) {
            case ObjectKind.Obstacle:
            {
                //!unsafe
                const bound = deepCopy((object as JSONObjects.Obstacle).collision) as unknown as Bound;

                //!unsafe
                if((object as JSONObjects.Obstacle).collision.type === CollisionType.Rectangle) {
                    //@ts-expect-error; hack
                    bound.originalMin = Vec2(bound.min!);
                    //@ts-expect-error; hack
                    bound.originalMax = Vec2(bound.max!);
                } else {
                    //@ts-expect-error; hack
                    bound.rad *= scale;
                }
                thisBounds.push(bound);
                break;
            }
            case ObjectKind.Player:
                //!unsafe
                //@ts-expect-error; hack
                thisBounds.push({ type: CollisionType.Circle, rad: 1 });
                break;
            case ObjectKind.Loot:
                //!unsafe
                //@ts-expect-error; hack
                thisBounds.push({ type: CollisionType.Circle, rad: 5 });
                break;
            case ObjectKind.Building:
                thisBounds.push(...this.getBoundsForBuilding(object as JSONObjects.Building));
                break;
            case ObjectKind.Structure:
                thisBounds.push(...this.getBoundsForStructure(object as JSONObjects.Structure));
                break;
        }

        if(!thisBounds.length) {
            throw new Error("Missing bounds data");
        }

        if(!getPosition) {
            const minEdgeDist = isBuilding ? 125 : 65;
            getPosition = () => {
                return randomVec(minEdgeDist, this.width - minEdgeDist, minEdgeDist, this.height - minEdgeDist);
            };
        }

        let foundPosition = false;
        let thisPos: Vec2;
        let attempts = 0;
        while(!foundPosition && attempts <= 200) {
            attempts++;
            if(attempts >= 200) {
                console.warn("[WARNING] Maximum spawn attempts exceeded for: ", object);
            }
            thisPos = getPosition();
            let shouldContinue = false;

            if(!ignoreRivers) {
                for(const river of this.rivers) {
                    const minRiverDist = isBuilding
                        ? river.width * 5
                        : river.width * 2.5;
                    for(const point of river.points) {
                        if(distanceBetween(thisPos, point) < minRiverDist) {
                            shouldContinue = true;
                            break;
                        }
                    }
                    if(shouldContinue) break;
                }
            }

            if(shouldContinue) continue;

            for(const thisBound of thisBounds) {
                if(thisBound.type === CollisionType.Rectangle) {
                    const newBound = rotateRect(thisPos, thisBound.originalMin, thisBound.originalMax, scale, orientation);
                    thisBound.min = newBound.min;
                    thisBound.max = newBound.max;
                }
                for(const that of this.game.staticObjects) {
                    if(that instanceof Building) {
                        // obstacles and players should still spawn on top of bunkers
                        if((kind === ObjectKind.Obstacle || kind === ObjectKind.Player) && that.layer === 1) continue;
                        for(const thatBound of that.mapObstacleBounds) {
                            if(thisBound.type === CollisionType.Circle) {
                                if(rectCollision(thatBound.min, thatBound.max, thisPos, thisBound.rad)) {
                                    shouldContinue = true;
                                }
                            } else if(thisBound.type === CollisionType.Rectangle) {
                                if(rectRectCollision(thatBound.min, thatBound.max, thisBound.min, thisBound.max)) {
                                    shouldContinue = true;
                                }
                            }
                        }
                    } else if(that instanceof Obstacle) {
                        if(thisBound.type === CollisionType.Circle) {
                            if(that.collision.type === CollisionType.Circle) {
                                if(circleCollision(that.position, that.collision.rad, thisPos, thisBound.rad)) {
                                    shouldContinue = true;
                                }
                            } else if(that.collision.type === CollisionType.Rectangle) {
                                if(rectCollision(that.collision.min, that.collision.max, thisPos, thisBound.rad)) {
                                    shouldContinue = true;
                                }
                            }
                        } else if(thisBound.type === CollisionType.Rectangle) {
                            if(that.collision.type === CollisionType.Circle) {
                                if(rectCollision(thisBound.min, thisBound.max, that.position, that.collision.rad)) {
                                    shouldContinue = true;
                                }
                            } else if(that.collision.type === CollisionType.Rectangle) {
                                if(rectRectCollision(that.collision.min, that.collision.max, thisBound.min, thisBound.max)) {
                                    shouldContinue = true;
                                }
                            }
                        }
                    }
                    if(shouldContinue) break;
                }
                if(shouldContinue) break;
            }
            if(shouldContinue) continue;
            foundPosition = true;
        }
        // This returns the spawn position of the last spawned object… why?
        return thisPos!;
    }

    getBoundsForBuilding(building: JSONObjects.Building, position = Vec2(0, 0), orientation: Orientation = 0): RectangleBound[] {
        const bounds: RectangleBound[] = [];
        if(building.mapObstacleBounds && building.mapObstacleBounds.length > 0) {
            for(const obstacleBound of building.mapObstacleBounds) {
                const bound: RectangleBound = rotateRect(position, Vec2(obstacleBound.min), Vec2(obstacleBound.max), 1, orientation) as RectangleBound;
                bound.originalMin = bound.min;
                bound.originalMax = bound.max;
                bound.type = CollisionType.Rectangle;
                bounds.push(bound);
            }
        } else if(building.ceiling.zoomRegions && building.ceiling.zoomRegions.length > 0) {
            for(const zoomRegion of building.ceiling.zoomRegions) {
                //!unsafe
                const rect = zoomRegion.zoomIn ? zoomRegion.zoomIn : zoomRegion.zoomOut!;
                //!unsafe
                const bound: RectangleBound = rotateRect(position, Vec2(rect.min!), Vec2(rect.max!), 1, orientation) as RectangleBound;
                bound.originalMin = bound.min;
                bound.originalMax = bound.max;
                bound.type = CollisionType.Rectangle;
                bounds.push(bound);
            }
        }
        for(const object of building.mapObjects) {
            const objectType = Objects[object.type]?.type;
            if(objectType === "building") {
                bounds.push(...this.getBoundsForBuilding(Objects[object.type] as JSONObjects.Building, Vec2(object.pos), object.ori));
            } else if(objectType === "structure") {
                bounds.push(...this.getBoundsForStructure(Objects[object.type] as JSONObjects.Structure, Vec2(object.pos), object.ori));
            }
        }
        return bounds;
    }

    getBoundsForStructure(structure: JSONObjects.Structure, position = Vec2(0, 0), orientation: Orientation = 0): RectangleBound[] {
        const bounds: RectangleBound[] = [];
        for(const building of structure.layers ?? []) {
            bounds.push(...this.getBoundsForBuilding(Objects[building.type] as JSONObjects.Building, position, orientation));
        }
        return bounds;
    }
}

class River {
    width: number;
    looped: number;
    points: Vec2[];

    constructor(width: number, looped: number, points: Vec2[]) {
        this.width = width;
        this.looped = looped;
        this.points = points;
    }

}

class Place {
    name: string;
    position: Vec2;

    constructor(name: string, pos: Vec2) {
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

    constructor(min: Vec2, max: Vec2, color: number, roughness: number, offsetDist: number, order: number, useAsMapShape: boolean) {
        this.min = min; // vector
        this.max = max; // vector
        this.color = color; // uint32
        this.roughness = roughness; // float32
        this.offsetDist = offsetDist; // float32
        this.order = order; // 7-bit integer
        this.useAsMapShape = useAsMapShape; // boolean (1 bit)
    }

}
