import { GameOptions, Maps, ObjectKind, Objects, Point, TypeToId, Utils, Vector } from "../utils";
import { Player } from "./objects/player";
import { Game } from "./game";
import Matter from "matter-js";
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
    objects: (Obstacle | Building | Structure | Player)[];
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

    private genStructure(type: any, structure: any, setPos: Point | null = null, setOri: number | null = null) {
        let pos;
        if(setPos) pos = setPos;
        else if(GameOptions.debugMode) pos = Vector.create(450, 150);
        else pos = this.getRandomPosFor(null, ObjectKind.Structure); // TODO

        let ori;
        if(setOri != undefined) ori = setOri;
        else if(GameOptions.debugMode) ori = 0;
        else ori = Utils.random(0, 3);

        const layerObjIds = [];

        for(let layerId = 0; layerId < structure.layers.length; layerId++) {
            const layerObj = structure.layers[layerId];
            const layerType = layerObj.type;
            const layer = Objects[layerType];
            layerObjIds.push(TypeToId[layerType]);

            let layerOri;
            if(layerObj.inheritOri == false) layerOri = layerObj.ori;
            else layerOri = Utils.addOris(layerObj.ori, ori);
            let layerPos = Utils.addAdjust(pos, layerObj.pos, ori);

            if(layer.type == "structure") {
                this.genStructure(layerType, layer, layerPos, layerOri);
            } else if(layer.type == "building") {
                this.genBuilding(layerType, layer, layerPos, layerOri, layerId);
            } else {
                //console.warn(`Unsupported object type: ${layer.type}`);
            }
        }
        this.objects.push(new Structure(this.objects.length, pos, type, ori, layerObjIds));
    }

    private genBuildings(count, type, building) {
        for(let i = 0; i < count; i++) {
            this.genBuilding(type, building);
        }
    }

    private genBuildingTest(type: string, ori: number, markers: boolean) {
        this.genBuilding(type, Objects[type], undefined, ori, undefined, markers);
    }

    private genBuilding(type, building, setPos?: Point, setOri?: number, setLayer?: number, debug: boolean = false) {
        let pos;
        if(setPos) pos = setPos;
        else if(GameOptions.debugMode) pos = Vector.create(450, 150);
        else pos = this.getRandomPosFor(ObjectKind.Building, building.mapObstacleBounds ? building.mapObstacleBounds[0] : null); // TODO Add support for multiple bounds
        let ori;
        if(setOri != undefined) ori = setOri;
        else if(GameOptions.debugMode) ori = 0;
        else ori = Utils.random(0, 3);

        let layer;
        if(setLayer != undefined) layer = setLayer;
        else layer = 0;

        for(const mapObject of building.mapObjects) {
            const partType = mapObject.type;
            if(!partType || partType == "") {
                //console.warn(`${type}: Missing object at ${mapObject.pos.x}, ${mapObject.pos.y}`);
                continue;
            }
            const part = Objects[partType];

            let partOri;
            if(mapObject.inheritOri == false) partOri = mapObject.ori;
            else partOri = Utils.addOris(mapObject.ori, ori);
            let partPos = Utils.addAdjust(pos, mapObject.pos, ori);

            if(part.type == "structure") {
                this.genStructure(partType, part, partPos, partOri);
            } else if(part.type == "building") {
                this.genBuilding(partType, part, partPos, partOri, layer);
            } else if(part.type == "obstacle") {
                this.genObstacle(
                    partType,
                    part,
                    partPos,
                    partOri,
                    mapObject.scale,
                    layer
                );
            } else if(part.type == "random") {
                const items = Object.keys(part.weights), weights = Object.values(part.weights);
                const randType = Utils.weightedRandom(items, weights as number[]);
                this.genObstacle(
                    randType,
                    Objects[randType],
                    partPos,
                    partOri,
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
            pos,
            type,
            ori,
            setLayer != undefined ? setLayer : 0,
            building.map ? building.map.display : false
        ));
    }

    private genObstacleTest(type) {
        this.genObstacle(type, Objects[type], Vector.create(455, 155), 0, 1);
    }

    private genObstacle(type, obstacle, pos, ori, scale, layer = 0) {
        this.objects.push(new Obstacle(
            this.objects.length,
            this.game,
            obstacle,
            type,
            pos,
            ori,
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
                this.getRandomPosFor(ObjectKind.Obstacle, obstacle.collision, scale),
                0,
                scale,
                0
            ));
        }
    }

    private getRandomPosFor(kind: ObjectKind, collisionData, scale?) {
        if(!scale) scale = 1;
        let foundPos = false;
        let pos;
        while(!foundPos) {
            pos = Utils.randomVec(75, this.width - 75, 75, this.height - 75);
            let shouldContinue = false;

            for(const river of this.rivers) {
                const minRiverDist = (kind == ObjectKind.Building || kind == ObjectKind.Structure) ? river.width * 5 : river.width * 2.5;
                for(const point of river.points) {
                    if(Utils.distanceBetween(pos, point) < minRiverDist) {
                        shouldContinue = true;
                        break;
                    }
                }
            }
            if(shouldContinue) continue;
            if(!collisionData) break; // TODO Come back to this
            const collider = Utils.bodyFromCollisionData(collisionData, pos, scale);
            if(collider == null) break;

            for(const object of this.objects) {
                if(object.body != null) {
                    const collisionResult = Matter.Collision.collides(collider, object.body);
                    if(collisionResult != null && collisionResult.collided) {
                        shouldContinue = true;
                        break;
                    }
                }
            }
            if(shouldContinue) continue;

            foundPos = true;
        }
        return pos;
    }

}

class River {
    width: number;
    looped: boolean;
    points: Point[];

    constructor(width, looped, points) {
        this.width = width;
        this.looped = looped;
        this.points = points;
    }
}

class Place {
    name: string;
    pos: Point;

    constructor(name, pos) {
        this.name = name;
        this.pos = pos;
    }
}

class GroundPatch {
    min: Point;
    max: Point;
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
