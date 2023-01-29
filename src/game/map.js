const {Utils, Vector, ObjectKind} = require('../utils.js');

class Map {

    constructor() {
        this.name = "main";
        this.seed = Math.floor(Math.random() * 2147483647);
        this.width = 720;
        this.height = 720;
        this.shoreInset = 48;
        this.grassInset = 18;

        this.rivers = [];
        //const riverCount = Utils.random(1, 3);
        //for(let i = 0; i < riverCount; i++) {}
        const points = [];
        points.push(new Vector(0, 0));
        points.push(new Vector(150, 150));
        points.push(new Vector(300, 350));
        points.push(new Vector(600, 600));
        points.push(new Vector(720, 720));
        this.rivers.push(new River(32, 0, points));

        // RIVER GENERATION IDEA: Diagonal line, with random fluctuations in x and y

        this.places = [];
        this.places.push(new Place("Ytyk-Kyuyol", new Vector(160, 160)));

        this.objects = [];

        const treeCount = 430;
        for(let i = 0; i < treeCount; i++) {
            let foundPos = false;
            let pos;
            while(!foundPos) {
                pos = Utils.randomVec(75, this.width - 75, 75, this.height - 75);
                foundPos = true;
            }
            this.objects.push(new Object(this.objects.length, pos, 0, 1.0, 'tree_01', ObjectKind.Obstacle));
        }
    
        this.groundPatches = [];
    }

}

class River {
    constructor(width, looped, points) {
        this.width = width;
        this.looped = looped;
        this.points = points;
    }
}

class Place {
    constructor(name, pos) {
        this.name = name;
        this.pos = pos;
    }
}

class Object {
    constructor(id, pos, ori, scale, type, kind, layer) {
        this.isPlayer = false;
        this.id = id;
        this.pos = pos;
        this.ori = ori;
        this.scale = scale; // Min: 0.125, max: 2.5

        this.healthT = 1;

        this.type = Utils.mapTypeToId(type);
        this.obstacleType = type;

        this.kind = kind;

        this.layer = layer ? layer : 0;
        this.dead = false;
        this.isDoor = false;
        this.teamId = 0;
        this.isButton = false;
        this.isPuzzlePiece = false;
        this.isSkin = false;
    }
}

class GroundPatch {
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

module.exports.Map = Map;
