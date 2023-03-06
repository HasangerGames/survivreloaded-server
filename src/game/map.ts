import { GameOptions, Maps, ObjectKind, Objects, TypeToId, Utils } from "../utils";
import { Game } from "./game";
import { Collision, Vector } from "matter-js";
import { Obstacle } from "./objects/obstacle";
import { Structure } from "./objects/structure";
import { Building } from "./objects/building";

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
    objects: any[];
    groundPatches: GroundPatch[];

    constructor(game, mapId) {
        this.name = mapId;
        this.seed = Utils.random(0, 2147483647);
        this.game = game;

        const mapInfo = Maps[mapId];

        this.width = mapInfo.width;
        this.height = mapInfo.height;
        this.shoreInset = 48;
        this.grassInset = 18;

        // TODO Better river generation
        this.rivers = [];
        let x = 0, y = 0;
        const points = [];
        while(x < 720 && y < 720) {
            x += 10 + Utils.random(-6, 6);
            y += 10 + Utils.random(-6, 6);
            points.push(Vector.create(x, y));
        }
        this.rivers.push(new River(8, 0, points));

        this.places = [];
        for(const place of mapInfo.places) {
            this.places.push(new Place(place.name, Vector.create(place.x, place.y)));
        }
        

        this.objects = [];

        if(!GameOptions.debugMode) {
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
            //this.genBuildingTest("house_red_01", 1, false);
            this.genObstacleTest("crate_01");
        }
    
        this.groundPatches = [];
    }

    private genStructure(type: any, structure: any, setPosition: Vector | null = null, setOrientation: number | null = null) {
        let position;
        if(setPosition) position = setPosition;
        else if(GameOptions.debugMode) position = Vector.create(450, 150);
        else position = this.getRandomPositionFor(null, ObjectKind.Structure); // TODO

        let orientation;
        if(setOrientation != undefined) orientation = setOrientation;
        else if(GameOptions.debugMode) orientation = 0;
        else orientation = Utils.random(0, 3);

        const layerObjIds = [];

        for(let layerId = 0; layerId < structure.layers.length; layerId++) {
            const layerObj = structure.layers[layerId];
            const layerType = layerObj.type;
            const layer = Objects[layerType];
            layerObjIds.push(TypeToId[layerType]);

            let layerOrientation;
            if(layerObj.inheritOri == false) layerOrientation = layerObj.orientation;
            else layerOrientation = Utils.addOrientations(layerObj.ori, orientation);
            let layerPosition = Utils.addAdjust(position, layerObj.pos, orientation);

            if(layer.type == "structure") {
                this.genStructure(layerType, layer, layerPosition, layerOrientation);
            } else if(layer.type == "building") {
                this.genBuilding(layerType, layer, layerPosition, layerOrientation, layerId);
            } else {
                //console.warn(`Unsupported object type: ${layer.type}`);
            }
        }
        this.objects.push(new Structure(this.objects.length, position, type, orientation, layerObjIds));
    }

    private genBuildings(count, type, building) {
        for(let i = 0; i < count; i++) {
            this.genBuilding(type, building);
        }
    }

    private genBuildingTest(type: string, orientation: number, markers: boolean) {
        this.genBuilding(type, Objects[type], undefined, orientation, undefined, markers);
    }

    private genBuilding(type, building, setPosition?: Vector, setOrientation?: number, setLayer?: number, debug: boolean = false) {
        let position;
        if(setPosition) position = setPosition;
        else if(GameOptions.debugMode) position = Vector.create(450, 150);
        else position = this.getRandomPositionFor(ObjectKind.Building, building.mapObstacleBounds ? building.mapObstacleBounds[0] : null); // TODO Add support for multiple bounds
        let orientation;
        if(setOrientation != undefined) orientation = setOrientation;
        else if(GameOptions.debugMode) orientation = 0;
        else orientation = Utils.random(0, 3);

        let layer;
        if(setLayer != undefined) layer = setLayer;
        else layer = 0;

        for(const mapObject of building.mapObjects) {
            const partType = mapObject.type;
            if(!partType || partType == "") {
                //console.warn(`${type}: Missing object at ${mapObject.position.x}, ${mapObject.position.y}`);
                continue;
            }
            const part = Objects[partType];

            let partOrientation;
            if(mapObject.inheritOri == false) partOrientation = mapObject.ori;
            else partOrientation = Utils.addOrientations(mapObject.ori, orientation);
            let partPosition = Utils.addAdjust(position, mapObject.pos, orientation);

            if(part.type == "structure") {
                this.genStructure(partType, part, partPosition, partOrientation);
            } else if(part.type == "building") {
                this.genBuilding(partType, part, partPosition, partOrientation, layer);
            } else if(part.type == "obstacle") {
                this.genObstacle(
                    partType,
                    part,
                    partPosition,
                    partOrientation,
                    mapObject.scale,
                    layer
                );
            } else if(part.type == "random") {
                const items = Object.keys(part.weights), weights = Object.values(part.weights);
                const randType = Utils.weightedRandom(items, weights as number[]);
                this.genObstacle(
                    randType,
                    Objects[randType],
                    partPosition,
                    partOrientation,
                    mapObject.scale,
                    layer
                );
            } else if(part.type == "ignored") {
                // Ignored
            } else {
                //console.warn(`Unknown object type: ${part.type}`);
            }
        }
        this.objects.push(new Building(
            this.objects.length,
            building,
            position,
            type,
            orientation,
            setLayer != undefined ? setLayer : 0,
            building.map ? building.map.display : false
        ));
    }

    private genObstacleTest(type) {
        this.genObstacle(type, Objects[type], Vector.create(455, 155), 0, 0.8);
    }

    private genObstacle(type, obstacle, pos, orientation, scale, layer = 0) {
        this.objects.push(new Obstacle(
            this.objects.length,
            this.game,
            obstacle,
            type,
            pos,
            orientation,
            scale,
            layer != undefined ? layer : 0
        ));
    }

    private genObstacles(count, type, obstacle) {
        const scale = Utils.randomFloat(obstacle.scale.createMin, obstacle.scale.createMax);
        for(let i = 0; i < count; i++) {
            this.objects.push(new Obstacle(
                this.objects.length,
                this.game,
                obstacle,
                type,
                this.getRandomPositionFor(ObjectKind.Obstacle, obstacle.collision, scale),
                0,
                scale,
                0
            ));
        }
    }

    private getRandomPositionFor(kind: ObjectKind, collisionData, scale?) {
        if(!scale) scale = 1;
        let foundPosition = false;
        let position;
        while(!foundPosition) {
            position = Utils.randomVec(75, this.width - 75, 75, this.height - 75);
            let shouldContinue = false;

            for(const river of this.rivers) {
                const minRiverDist = (kind == ObjectKind.Building || kind == ObjectKind.Structure) ? river.width * 5 : river.width * 2.5;
                for(const point of river.points) {
                    if(Utils.distanceBetween(position, point) < minRiverDist) {
                        shouldContinue = true;
                        break;
                    }
                }
            }
            if(shouldContinue) continue;
            if(!collisionData) break; // TODO Come back to this
            const collider = Utils.bodyFromCollisionData(collisionData, position, scale);
            if(collider == null) break;

            for(const object of this.objects) {
                if(object.body != null) {
                    const collisionResult = Collision.collides(collider, object.body);
                    if(collisionResult != null && collisionResult.collided) {
                        shouldContinue = true;
                        break;
                    }
                }
            }
            if(shouldContinue) continue;

            foundPosition = true;
        }
        return position;
    }

}

class River {
    width: number;
    looped: number;
    points: Vector[];

    constructor(width, looped, points) {
        this.width = width;
        this.looped = looped;
        this.points = points;
    }

}

class Place {
    name: string;
    position: Vector;

    constructor(name, pos) {
        this.name = name;
        this.position = pos;
    }

}

class GroundPatch {
    min: Vector;
    max: Vector;
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
