import { ObjectKind, Point, TypeToId } from "../../utils";
import Matter from "matter-js";

export class Structure {
    readonly kind: ObjectKind = ObjectKind.Structure;
    showOnMap: boolean = false;

    id: any;
    mapType: number;
    _pos: Point;
    type: string;
    ori: number;
    scale: number = 1;
    layerObjIds: any[];
    dead: boolean = false;

    body: Matter.Body = null;

    constructor(id: any, pos: Point, type, ori, layerObjIds) {
        this.id = id;
        this.mapType = TypeToId[type];
        this._pos = pos;
        this.type = type;
        this.ori = ori;
        this.layerObjIds = layerObjIds;
    }

    get pos() {
        return this._pos;
    }

}
