import { ObjectKind, Point, TypeToId, Utils } from "../../utils";
import Matter from "matter-js";

export class Building {
    readonly kind: ObjectKind = ObjectKind.Building;

    showOnMap: boolean;

    id: any;
    layer: number;
    mapType: number;

    _pos: Point;
    type: string;
    ori: number;
    scale: number = 1;

    ceilingDead: boolean = false;
    occupied: boolean = false;
    ceilingDamaged: boolean = false;
    hasPuzzle: boolean = false;
    dead: boolean = false;

    body: Matter.Body;


    constructor(id: any, data, pos: Point, type: string, ori, layer: number, showOnMap: boolean) {
        this.showOnMap = showOnMap;

        this.id = id;
        this.mapType = TypeToId[type];
        this._pos = pos;
        this.type = type;
        this.ori = ori;
        this.layer = layer;
        if(data.mapObstacleBounds) this.body = Utils.bodyFromCollisionData(data.mapObstacleBounds[0], this.pos);
    }

    get pos() {
        return this._pos;
    }

}
