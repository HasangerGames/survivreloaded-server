"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Map = void 0;
const matter_js_1 = require("matter-js");
const utils_1 = require("../utils");
const obstacle_1 = require("./objects/obstacle");
const structure_1 = require("./objects/structure");
const building_1 = require("./objects/building");
class Map {
    name;
    seed;
    game;
    width;
    height;
    shoreInset;
    grassInset;
    rivers;
    places;
    objects;
    groundPatches;
    constructor(game, mapId) {
        this.name = mapId;
        this.seed = utils_1.Utils.random(0, 2147483647);
        this.game = game;
        const mapInfo = utils_1.Maps[mapId];
        this.width = mapInfo.width;
        this.height = mapInfo.height;
        this.shoreInset = 48;
        this.grassInset = 18;
        // TODO Better river generation
        this.rivers = [];
        let x = 0, y = 0;
        const points = [];
        while (x < 720 && y < 720) {
            x += 10 + utils_1.Utils.random(-6, 6);
            y += 10 + utils_1.Utils.random(-6, 6);
            points.push(matter_js_1.Vector.create(x, y));
        }
        this.rivers.push(new River(8, 0, points));
        this.places = [];
        for (const place of mapInfo.places) {
            this.places.push(new Place(place.name, matter_js_1.Vector.create(place.x, place.y)));
        }
        this.objects = [];
        if (!utils_1.GameOptions.debugMode) {
            for (const type in mapInfo.objects) {
                const data = utils_1.Objects[type];
                const count = mapInfo.objects[type];
                switch (data.type) {
                    case "obstacle":
                        this.genObstacles(count, type, data);
                        break;
                    case "building":
                        this.genBuildings(count, type, data);
                        break;
                }
            }
            // 2 fisherman's shacks: 2 at oceanside, 2 at riverside
        }
        else {
            //this.genStructure("club_structure_01", Objects["club_structure_01"]);
            //this.genBuildingTest("house_red_01", 1, false);
            this.genObstacleTest("crate_01", matter_js_1.Vector.create(455, 155));
            this.genObstacleTest("crate_01", matter_js_1.Vector.create(505, 155));
            this.genObstacleTest("crate_01", matter_js_1.Vector.create(455, 205));
            this.genObstacleTest("crate_01", matter_js_1.Vector.create(505, 205));
        }
        this.groundPatches = [];
    }
    genStructure(typeString, structureData, setPosition = null, setOrientation = null) {
        let position;
        if (setPosition)
            position = setPosition;
        else if (utils_1.GameOptions.debugMode)
            position = matter_js_1.Vector.create(450, 150);
        else
            position = this.getRandomPositionFor(utils_1.ObjectKind.Structure, structureData, 1);
        let orientation;
        if (setOrientation != undefined)
            orientation = setOrientation;
        else if (utils_1.GameOptions.debugMode)
            orientation = 0;
        else
            orientation = utils_1.Utils.random(0, 3);
        const layerObjIds = [];
        for (let layerId = 0; layerId < structureData.layers.length; layerId++) {
            const layerObj = structureData.layers[layerId];
            const layerType = layerObj.type;
            const layer = utils_1.Objects[layerType];
            layerObjIds.push(utils_1.TypeToId[layerType]);
            let layerOrientation;
            if (layerObj.inheritOri == false)
                layerOrientation = layerObj.orientation;
            else
                layerOrientation = utils_1.Utils.addOrientations(layerObj.ori, orientation);
            let layerPosition = utils_1.Utils.addAdjust(position, layerObj.pos, orientation);
            if (layer.type == "structure") {
                this.genStructure(layerType, layer, layerPosition, layerOrientation);
            }
            else if (layer.type == "building") {
                this.genBuilding(layerType, layer, layerPosition, layerOrientation, layerId);
            }
            else {
                //console.warn(`Unsupported object type: ${layer.type}`);
            }
        }
        this.objects.push(new structure_1.Structure(this.objects.length, position, typeString, orientation, layerObjIds));
    }
    genBuildings(count, type, building) {
        for (let i = 0; i < count; i++) {
            this.genBuilding(type, building);
        }
    }
    genBuildingTest(type, orientation, markers) {
        this.genBuilding(type, utils_1.Objects[type], undefined, orientation, undefined, true);
    }
    genBuilding(typeString, buildingData, setPosition, setOrientation, setLayer, debug = false) {
        let position;
        if (setPosition)
            position = setPosition;
        else if (utils_1.GameOptions.debugMode)
            position = matter_js_1.Vector.create(450, 150);
        else
            position = this.getRandomPositionFor(utils_1.ObjectKind.Building, buildingData.mapObstacleBounds ? buildingData.mapObstacleBounds[0] : null); // TODO Add support for multiple bounds
        let orientation;
        if (setOrientation != undefined)
            orientation = setOrientation;
        else if (utils_1.GameOptions.debugMode)
            orientation = 0;
        else
            orientation = utils_1.Utils.random(0, 3);
        let layer;
        if (setLayer != undefined)
            layer = setLayer;
        else
            layer = 0;
        for (const mapObject of buildingData.mapObjects) {
            const partType = mapObject.type;
            if (!partType || partType == "") {
                //console.warn(`${type}: Missing object at ${mapObject.position.x}, ${mapObject.position.y}`);
                continue;
            }
            const part = utils_1.Objects[partType];
            let partOrientation;
            if (mapObject.inheritOri == false)
                partOrientation = mapObject.ori;
            else
                partOrientation = utils_1.Utils.addOrientations(mapObject.ori, orientation);
            let partPosition = utils_1.Utils.addAdjust(position, mapObject.pos, orientation);
            if (part.type == "structure") {
                this.genStructure(partType, part, partPosition, partOrientation);
            }
            else if (part.type == "building") {
                this.genBuilding(partType, part, partPosition, partOrientation, layer);
            }
            else if (part.type == "obstacle") {
                this.genObstacle(partType, partPosition, layer, partOrientation, mapObject.scale, part);
            }
            else if (part.type == "random") {
                const items = Object.keys(part.weights), weights = Object.values(part.weights);
                const randType = utils_1.Utils.weightedRandom(items, weights);
                this.genObstacle(randType, partPosition, layer, partOrientation, mapObject.scale, utils_1.Objects[randType]);
            }
            else if (part.type == "ignored") {
                // Ignored
            }
            else {
                //console.warn(`Unknown object type: ${part.type}`);
            }
        }
        this.objects.push(new building_1.Building(this.objects.length, typeString, position, setLayer != undefined ? setLayer : 0, orientation, buildingData.map ? buildingData.map.display : false, buildingData));
    }
    genObstacleTest(typeString, position) {
        this.genObstacle(typeString, position ? position : matter_js_1.Vector.create(455, 155), 0, 0, 0.8, utils_1.Objects[typeString]);
    }
    genObstacle(typeString, position, layer, orientation, scale, obstacleData) {
        this.objects.push(new obstacle_1.Obstacle(this.objects.length, typeString, position, layer != undefined ? layer : 0, orientation, this.game, scale, obstacleData));
    }
    genObstacles(count, typeString, obstacleData) {
        for (let i = 0; i < count; i++) {
            const scale = utils_1.Utils.randomBase(obstacleData.scale.createMin, obstacleData.scale.createMax);
            this.genObstacle(typeString, this.getRandomPositionFor(utils_1.ObjectKind.Obstacle, obstacleData.collision, scale), 0, 0, scale, obstacleData);
        }
    }
    getRandomPositionFor(kind, collisionData, scale) {
        if (!scale)
            scale = 1;
        let foundPosition = false;
        let position;
        while (!foundPosition) {
            position = utils_1.Utils.randomVec(75, this.width - 75, 75, this.height - 75);
            let shouldContinue = false;
            for (const river of this.rivers) {
                const minRiverDist = (kind == utils_1.ObjectKind.Building || kind == utils_1.ObjectKind.Structure) ? river.width * 5 : river.width * 2.5;
                for (const point of river.points) {
                    if (utils_1.Utils.distanceBetween(position, point) < minRiverDist) {
                        shouldContinue = true;
                        break;
                    }
                }
            }
            if (shouldContinue)
                continue;
            if (!collisionData)
                break;
            const collider = utils_1.Utils.bodyFromCollisionData(collisionData, position, scale);
            if (collider == null)
                break;
            for (const object of this.objects) {
                if (!object.body)
                    continue;
                const collisionResult = matter_js_1.Collision.collides(collider, object.body);
                if (collisionResult && collisionResult.collided) {
                    shouldContinue = true;
                    break;
                }
            }
            if (shouldContinue)
                continue;
            foundPosition = true;
        }
        return position;
    }
}
exports.Map = Map;
class River {
    width;
    looped;
    points;
    constructor(width, looped, points) {
        this.width = width;
        this.looped = looped;
        this.points = points;
    }
}
class Place {
    name;
    position;
    constructor(name, pos) {
        this.name = name;
        this.position = pos;
    }
}
class GroundPatch {
    min;
    max;
    color;
    roughness;
    offsetDist;
    order;
    useAsMapShape;
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
//# sourceMappingURL=map.js.map