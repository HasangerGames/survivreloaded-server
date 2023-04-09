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
    weightedRandom
} from "../utils";
import { type Game } from "./game";
import { Obstacle } from "./objects/obstacle";
import { Structure } from "./objects/structure";
import { Building } from "./objects/building";
import { Decal } from "./objects/decal";
import { Vec2 } from "planck";
import { generateLooseLootFromArray } from "./objects/loot";
import { type GameObject } from "./gameObject";

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
        if(!Debug.disableMapGeneration) {

            let x = 0, y = 500;
            const points: Vec2[] = [];
            while(x < 700) {
                x += 20;
                y -= 5 + random(-8, 8);
                points.push(Vec2(x, y));

                // River docks
                if(x === 400) {
                    this.genBuilding("dock_01", Objects.dock_01, Vec2(x, y - 13), 0, 0);
                }

                // Fisherman's shacks
                if(x === 300 || x === 500) {
                    this.genBuilding("shack_03a", Objects.shack_03a, Vec2(x, y - 25), 0, 0);
                }

                // Large bridges
                if(x === 200 || x === 600) {
                    this.genBuilding("bridge_lg_01", Objects.bridge_lg_01, Vec2(x, y), 1, 0);
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
                        if(steps === 5 || steps === 12) this.genBuilding("bridge_md_01", Objects.bridge_md_01, Vec2(x2, y2), 0, 0);
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
            for(const river of this.rivers) {
                for(const { x, y } of river.points) {
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

            this.genOnShore(ObjectKind.Building, "hedgehog_01", 40, 57, 4);
            this.genOnShore(ObjectKind.Building, "shack_03b", 2, 57, 1);

            // TODO Allow barrels and crates to spawn on the beach naturally
            this.genOnShore(ObjectKind.Obstacle, "crate_01", 12, 57, 4);
            this.genOnShore(ObjectKind.Obstacle, "barrel_01", 12, 57, 4);

            // Huts
            this.genOnShore(ObjectKind.Building, "hut_01", 3, 27, 1);
            this.genOnShore(ObjectKind.Building, "hut_02", 1, 27, 1);
            this.genOnShore(ObjectKind.Building, "hut_03", 1, 27, 1);

            // Loose loot
            for(let i = 0; i < 16; i++) {
                generateLooseLootFromArray(
                    this.game,
                    [{ tier: "tier_world", min: 1, max: 1 }],
                    this.getRandomPositionFor(ObjectKind.Loot, undefined, 0, 0, 1),
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
                }
            }
        } else {
            //this.genStructure("club_structure_01", Objects.club_structure_01, Vec2(450, 150));

            this.buildingTest("teahouse_complex_01su", 0);
            //this.obstacleTest("house_door_02", Vec2(453, 153), 0);

            // Items test
            // this.obstacleTest("crate_01", Vec2(453, 153), 1);
            // this.obstacleTest("crate_01", Vec2(458, 153), 1);
            // this.obstacleTest("crate_01", Vec2(463, 153), 1);
            // this.obstacleTest("crate_01", Vec2(468, 153), 1);
            // (this.game.objects[0] as Obstacle).loot = [new Item("sv98", 1), new Item("762mm", 15), new Item("762mm", 15)];
            // (this.game.objects[1] as Obstacle).loot = [new Item("762mm", 20)];
            // (this.game.objects[2] as Obstacle).loot = [new Item("mac10", 2)];
            // (this.game.objects[3] as Obstacle).loot = [new Item("ak47", 1)];

            // Object culling test
            /*for(let x = 0; x <= 45; x++) {
                for(let y = 0; y <= 45; y++) {
                    this.obstacleTest("tree_01", Vec2(x * 16, y * 16), 1.6);
                }
            }*/

            // Dropping items test
            /*this.obstacleTest("crate_01", Vec2(453, 153), 1);
            this.obstacleTest("crate_01", Vec2(458, 153), 1);
            this.obstacleTest("crate_01", Vec2(463, 153), 1);
            this.obstacleTest("crate_01", Vec2(468, 153), 1);

            this.obstacleTest("crate_01", Vec2(453, 148), 1);
            this.obstacleTest("crate_01", Vec2(458, 148), 1);
            this.obstacleTest("crate_01", Vec2(463, 148), 1);
            this.obstacleTest("crate_01", Vec2(468, 148), 1);

            this.obstacleTest("crate_01", Vec2(453, 143), 1);
            this.obstacleTest("crate_01", Vec2(458, 143), 1);
            this.obstacleTest("crate_01", Vec2(463, 143), 1);
            this.obstacleTest("crate_01", Vec2(468, 143), 1);

            this.obstacleTest("crate_01", Vec2(453, 158), 1);

            (this.game.objects[0] as Obstacle).loot = [new Item("2xscope", 1)];
            (this.game.objects[1] as Obstacle).loot = [new Item("4xscope", 1)];
            (this.game.objects[2] as Obstacle).loot = [new Item("8xscope", 1)];
            (this.game.objects[3] as Obstacle).loot = [new Item("15xscope", 1)];

            (this.game.objects[4] as Obstacle).loot = [new Item("chest02", 1)];
            (this.game.objects[5] as Obstacle).loot = [new Item("chest03", 1)];
            (this.game.objects[6] as Obstacle).loot = [new Item("helmet02", 1)];
            (this.game.objects[7] as Obstacle).loot = [new Item("helmet03", 1)];

            (this.game.objects[8] as Obstacle).loot = [new Item("sv98", 1), new Item("762mm", 120)];
            (this.game.objects[9] as Obstacle).loot = [new Item("vector", 1), new Item("9mm", 120)];
            (this.game.objects[10] as Obstacle).loot = [new Item("m249", 1), new Item("556mm", 120)];
            (this.game.objects[11] as Obstacle).loot = [new Item("saiga", 1), new Item("12gauge", 15)];

            (this.game.objects[12] as Obstacle).loot = [new Item("backpack03", 1)];*/
        }

        // Calculate visible objects
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
                        if((object as any).mapObstacleBounds) {
                            for(const bounds of (object as any).mapObstacleBounds) {
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
    }

    private obstacleTest(type: string, position: Vec2, orientation = 0, scale = 1): void {
        this.genObstacle(type, position, 0, orientation, scale, Objects[type]);
    }

    private genStructure(typeString: string, structureData: any, setPosition: Vec2 | null = null, setOrientation: number | null = null): void {
        let orientation;
        if(setOrientation !== undefined) orientation = setOrientation;
        else orientation = random(0, 3);

        let position;
        if(setPosition) position = setPosition;
        else position = this.getRandomPositionFor(ObjectKind.Structure, structureData, 0, orientation, 1);

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
        this.game.staticObjects.add(new Structure(this.game, typeString, position, orientation, layerObjIds));
    }

    private genBuildings(count, type, building): void {
        for(let i = 0; i < count; i++) this.genBuilding(type, building);
    }

    private buildingTest(type: string, orientation: number): void {
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
        else if(typeString.startsWith("cache_")) orientation = 0;
        else orientation = random(0, 3);
        let layer;
        if(setLayer !== undefined) layer = setLayer;
        else layer = 0;
        let position;
        if(setPosition) position = setPosition;
        else position = this.getRandomPositionFor(ObjectKind.Building, buildingData, layer, orientation, 1);

        const building: Building = new Building(
            this.game,
            typeString,
            position,
            setLayer !== undefined ? setLayer : 0,
            orientation,
            buildingData.map ? buildingData.map.display : false,
            buildingData
        );

        for(const mapObject of buildingData.mapObjects ?? []) {
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
                        building
                    );
                    break;
                case "random": {
                    const items = Object.keys(part.weights);
                    const weights = Object.values(part.weights);
                    const randType = weightedRandom(items, weights as number[]);
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
                case "ignored":
                    // Ignored
                    break;
            }
        }
        if(buildingData.mapGroundPatches) {
            for(const groundPatch of buildingData.mapGroundPatches) {
                this.groundPatches.push(new GroundPatch(
                    addAdjust(position, groundPatch.bound.min, orientation),
                    addAdjust(position, groundPatch.bound.max, orientation),
                    groundPatch.color,
                    groundPatch.roughness,
                    groundPatch.offsetDist,
                    groundPatch.order,
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

    private placeDebugMarker(position: Vec2): void {
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
        const obstacleData = Objects[typeString];
        const scale = randomFloat(obstacleData.scale.createMin, obstacleData.scale.createMax);
        const position = this.getRandomPositionFor(ObjectKind.Obstacle, obstacleData.collision, 0, 0, scale, () => {
            return randomPointInsideCircle(Vec2(point.x, point.y), riverWidth);
        }, true);
        this.genObstacle(typeString, position, 0, 0, scale, obstacleData);
    }

    private genObstacle(typeString: string,
                        position: Vec2,
                        layer: number,
                        orientation: number,
                        scale: number,
                        obstacleData,
                        parentBuilding?: Building): Obstacle {
        const obstacle = new Obstacle(
            this.game,
            typeString,
            position,
            layer !== undefined ? layer : 0,
            orientation,
            scale,
            obstacleData,
            parentBuilding
        );
        this.game.staticObjects.add(obstacle);
        return obstacle;
    }

    private genObstacles(count, typeString, obstacleData): void {
        for(let i = 0; i < count; i++) {
            const scale = randomFloat(obstacleData.scale.createMin, obstacleData.scale.createMax);
            this.genObstacle(
                typeString,
                this.getRandomPositionFor(ObjectKind.Obstacle, obstacleData.collision, 0, 0, scale),
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
                       orientationOffset = 0,
                       shoreEdgeDist = shoreDist): void {
        for(let i = 0; i < count; i++) {
            const data = Objects[typeString];
            const orientation = random(0, 3);
            const position = this.getPositionOnShore(kind, data, addOrientations(orientation, orientationOffset), 1, shoreDist, width, shoreEdgeDist);
            if(kind === ObjectKind.Building) this.genBuilding(typeString, data, position, orientation);
            else if(kind === ObjectKind.Obstacle) this.genObstacle(typeString, position, 0, orientation, random(data.scale.createMin, data.scale.createMax), data);
        }
    }

    private getPositionOnShore(kind: ObjectKind, data, orientation: number, scale: number, shoreDist: number, width: number, shoreEdgeDist = shoreDist): Vec2 {
        return this.getRandomPositionFor(kind, kind === ObjectKind.Building ? data : data.collision, 0, orientation, scale, () => {
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
                default:
                    throw new Error("Invalid orientation");
            }
            return randomVec(min.x, max.x, min.y, max.y);
        });
    }

    getRandomPositionFor(kind: ObjectKind, collisionData, layer: number, orientation: number, scale: number, getPosition?: () => Vec2, ignoreRivers?: boolean): Vec2 {
        const isBuilding = (kind === ObjectKind.Building || kind === ObjectKind.Structure);

        if(kind === ObjectKind.Player) {
            collisionData = { type: CollisionType.Circle, rad: 1 };
        } else if(kind === ObjectKind.Loot) {
            collisionData = { type: CollisionType.Circle, rad: 5 };
        }

        if(!getPosition) {
            const minEdgeDist = isBuilding ? 125 : 65;
            getPosition = () => {
                return randomVec(minEdgeDist, this.width - minEdgeDist, minEdgeDist, this.height - minEdgeDist);
            };
        }

        let foundPosition = false;
        let thisPos;
        while(!foundPosition) {
            thisPos = getPosition();
            let shouldContinue = false;

            if(!ignoreRivers) {
                for(const river of this.rivers) {
                    const minRiverDist = isBuilding ? river.width * 5 : river.width * 2.5;
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
            if(!collisionData) {
                throw new Error("Missing collision data");
            }

            let thisMin, thisMax, thisRad;
            if(collisionData.type === CollisionType.Rectangle) {
                const rect = rotateRect(thisPos, collisionData.min, collisionData.max, scale, orientation);
                thisMin = rect.min;
                thisMax = rect.max;
            } else if(collisionData.type === CollisionType.Circle) {
                thisRad = collisionData.rad * scale;
            }
            for(const that of this.game.staticObjects) {
                if(that.layer !== layer) continue;
                if(that instanceof Building) {
                    for(const thatBounds of that.mapObstacleBounds) {
                         if(collisionData.type === CollisionType.Circle) {
                             if(rectCollision(thatBounds.min, thatBounds.max, thisPos, thisRad)) {
                                 shouldContinue = true;
                             }
                        } else if(collisionData.type === CollisionType.Rectangle) {
                             if(rectRectCollision(thatBounds.min, thatBounds.max, thisMin, thisMax)) {
                                 shouldContinue = true;
                             }
                        } else if(collisionData.mapObstacleBounds) {
                             for(const bounds2 of collisionData.mapObstacleBounds) {
                                 const thisBounds = rotateRect(thisPos, bounds2.min, bounds2.max, 1, orientation);
                                 if(rectRectCollision(thisBounds.min, thisBounds.max, thatBounds.min, thatBounds.max)) {
                                     shouldContinue = true;
                                     break;
                                 }
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
                    }/* else if(collisionData.mapObstacleBounds) {
                        for(const bounds of collisionData.mapObstacleBounds) {
                            const thisBounds = rotateRect(thisPos, bounds.min, bounds.max, 1, orientation);
                            if(that.collision.type === CollisionType.Circle) {
                                if(rectCollision(thisBounds.min, thisBounds.max, that.position, that.collision.rad)) {
                                    shouldContinue = true;
                                }
                            } else if(that.collision.type === CollisionType.Rectangle) {
                                if(rectRectCollision(thisBounds.min, thisBounds.max, that.collision.min, that.collision.max)) {
                                    shouldContinue = true;
                                }
                            }
                        }
                    }*/
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
