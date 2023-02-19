const {Objects, ObjectKind, GameOptions, Maps, Utils, Vector} = require("../utils.js");
const {River, Place, Obstacle, Building, Structure, GroundPatch} = require("./miscObjects.js");

class Map {

    constructor(mapId) {
        this.name = mapId;
        this.seed = Utils.random(0, 2147483647);

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

        if(!global.DEBUG_MODE) {
            for(const type in mapInfo.objects) {
                const data = Objects[type];
                const count = mapInfo.objects[type];
                switch(data.type) {
                    case "obstacle":
                        this.#genObstacles(count, type, data);
                        break;
                    case "building":
                        this.#genBuildings(count, type, data);
                        break;
                }
            }
            // 2 fisherman's shacks: 2 at oceanside, 2 at riverside
        } else {
            this.#genStructure("club_structure_01", Objects["club_structure_01"]);
        }
    
        this.groundPatches = [];
        //this.groundPatches = JSON.parse(require('fs').readFileSync("groundPatchesTest.json"));
    }

    #genStructure(type, structure, setPos, setOri, setLayer) {
        let pos;
        if(setPos) pos = setPos;
        else if(global.DEBUG_MODE) pos = Vector.create(450, 150);
        else pos = this.#getSafeObstaclePos();

        let ori;
        if(setOri != undefined) ori = setOri;
        else if(global.DEBUG_MODE) ori = 0;
        else ori = Utils.random(0, 3);

        let layer;
        if(setLayer != undefined) layer = setLayer;
        else layer = 0;

        const layerObjIds = [];

        for(let layerId = 0; layerId < structure.layers.length; layerId++) {
            const layerObj = structure.layers[layerId];
            const layerType = layerObj.type;
            const layer = Objects[layerType];

            layerObjIds.push(Utils.typeToId(layerType));

            let xOffset, yOffset;
            let layerOri;
            if(layerObj.inheritOri == false) layerOri = layerObj.ori;
            else layerOri = layerObj.ori + ori;
            let layerPos = Utils.addAdjust(pos, layerObj.pos, ori);

            if(layer.type == "structure") {
                this.#genStructure(layerType, layer, layerPos, layerOri);
            } else if(layer.type == "building") {
                this.#genBuilding(layerType, layer, layerPos, layerOri, layerId);
            } else {
                console.warn(`Unsupported object type: ${layer.type}`);
            }
        }
        this.objects.push(new Structure(this.objects.length, pos, type, ori, layerObjIds));
    }

    #genBuildings(count, type, building) {
        for(let i = 0; i < count; i++) {
            this.#genBuilding(type, building);
        }
    }

    #genBuildingTest(type) {
        this.#genBuilding(type, Objects[type]);
    }

    #genBuilding(type, building, setPos, setOri, setLayer) {
        let pos;
        if(setPos) pos = setPos;
        else if(global.DEBUG_MODE) pos = Vector.create(450, 150);
        else pos = this.#getSafeObstaclePos();

        let ori;
        if(setOri != undefined) ori = setOri;
        else if(global.DEBUG_MODE) ori = 0;
        else ori = Utils.random(0, 3);

        let layer;
        if(setLayer != undefined) layer = setLayer;
        else layer = 0;

        for(const mapObject of building.mapObjects) {
            const partType = mapObject.type;
            if(!partType || partType == "") {
                console.warn(`${type}: Missing object at ${mapObject.pos.x}, ${mapObject.pos.y}`);
                continue;
            }
            const part = Objects[partType];

            let xOffset, yOffset;
            let partOri;
            if(mapObject.inheritOri == false) partOri = mapObject.ori;
            else partOri = mapObject.ori + ori;
            let partPos = Utils.addAdjust(pos, mapObject.pos, ori);

            if(part.type == "structure") {
                this.#genStructure(partType, part, partPos, partOri, layer);
            } else if(part.type == "building") {
                this.#genBuilding(partType, part, partPos, partOri, layer);
            } else if(part.type == "obstacle") {
                this.#genObstacle(
                    partType,
                    part,
                    partPos,
                    partOri,
                    mapObject.scale,
                    layer
                );
            } else if(part.type == "random") {
                const items = Object.keys(part.weights), weights = Object.values(part.weights);
                const randType = Utils.weightedRandom(items, weights);
                this.#genObstacle(
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
                console.warn(`Unknown object type: ${part.type}`);
            }
        }
        this.objects.push(new Building(
            this.objects.length,
            pos,
            type,
            ori,
            setLayer != undefined ? setLayer : 0,
            building.map ? building.map.display : false
        ));
    }

    #genObstacleTest(type) {
        this.#genObstacle(type, Objects[type], Vector.create(452, 152), 0, 1);
    }

    #genObstacle(type, obstacle, pos, ori, scale, layer) {
        this.objects.push(new Obstacle(
            this.objects.length,
            obstacle,
            type,
            pos,
            ori,
            scale,
            layer != undefined ? layer : 0
        ));
    }

    #genObstacles(count, type, obstacle) {
        const createMin = obstacle.scale.createMin,
              createMax = obstacle.scale.createMax;
        for(let i = 0; i < count; i++) {
            this.objects.push(new Obstacle(
                this.objects.length,
                obstacle,
                type,
                this.#getSafeObstaclePos(),
                0,
                Utils.randomFloat(createMin, createMax),
                0
            ));
        }
    }

    #getSafeObstaclePos() {
        let foundPos = false;
        let pos;
        while(!foundPos) {
            pos = Utils.randomVec(75, this.width - 75, 75, this.height - 75);
            let shouldContinue = false;

            for(const river of this.rivers) {
                for(const point of river.points) {
                    if(Utils.distanceBetween(pos, point) < river.width + (river.width / 1.5)) {
                        shouldContinue = true;
                        break;
                    }
                }
            }
            if(shouldContinue) continue;

            for(const object of this.objects) {
                if(Utils.distanceBetween(object.pos, pos) < 5) {
                    shouldContinue = true;
                    break;
                }
            }
            if(shouldContinue) continue;

            foundPos = true;
        }
        return pos;
    }

}

module.exports = { Map };
