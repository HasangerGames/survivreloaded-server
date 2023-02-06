const {Objects, ObjectKind, GameOptions, Utils, Vector} = require("../utils.js");
const {River, Place, Obstacle, Building, GroundPatch} = require("./miscObjects.js");

class Map {

    constructor(mapId) {
        this.name = mapId;
        this.seed = Utils.random(0, 2147483647);

        const mapInfo = GameOptions.maps[mapId];

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
            points.push(new Vector(x, y));
        }
        this.rivers.push(new River(8, 0, points));

        this.places = [];
        for(const place of mapInfo.places) {
            this.places.push(new Place(place.name, new Vector(place.x, place.y)));
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
            this.#genBuildingTest("house_red_01");
        }
    
        this.groundPatches = [];
        //this.groundPatches = JSON.parse(require('fs').readFileSync("groundPatchesTest.json"));
    }

    #genBuildings(count, type, building) {
        for(let i = 0; i < count; i++) {
            this.#genBuilding(type, building);
        }
    }

    #genBuildingTest(type) {
        this.#genBuilding(type, Objects[type]);
    }

    #genBuilding(type, building, setPos, setOri) {
        let pos;
        if(setPos) pos = setPos;
        else if(global.DEBUG_MODE) pos = new Vector(450, 150);
        else pos = this.#getSafeObstaclePos();

        let ori;
        if(setOri) ori = setOri;
        else if(global.DEBUG_MODE) ori = 0;
        else ori = Utils.random(0, 3);

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

            if(part.type == "building") {
                this.#genBuilding(partType, part, partPos);
            } else if(part.type == "obstacle") {
                this.#genObstacle(
                    partType,
                    part,
                    partPos,
                    partOri,
                    mapObject.scale
                );
            } else if(part.type == "random") {
                const items = Object.keys(part.weights), weights = Object.values(part.weights);
                const randType = Utils.weightedRandom(items, weights);
                this.#genObstacle(
                    randType,
                    Objects[randType],
                    partPos,
                    partOri,
                    mapObject.scale
                );
            } else {
                console.warn(`Unknown object type: ${part.type}`);
            }
        }
        this.objects.push(new Building(this.objects.length, pos, type, ori, 0, building.map ? building.map.display : false));
    }

    #genObstacleTest(type) {
        this.#genObstacle(type, Objects[type], new Vector(452, 152), 0, 1);
    }

    #genObstacle(type, obstacle, pos, ori, scale) {
        this.objects.push(new Obstacle(
            this.objects.length,
            obstacle,
            type,
            pos,
            ori,
            scale,
            0 // layer
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

module.exports.Map = Map;
