import { ObjectKind, Point, TypeToId } from "../../utils";
import Matter from "matter-js";

export class Structure {
    readonly kind: ObjectKind = ObjectKind.Structure;
    showOnMap: boolean = false;

    id: any;
    mapType: number;
    _position: Point;
    type: string;
    orientation: number;
    scale: number = 1;
    layerObjIds: any[];
    dead: boolean = false;

    body: Matter.Body = null;

    constructor(id: any, position: Point, type, orientation, layerObjIds) {
        this.id = id;
        this.mapType = TypeToId[type];
        this._position = position;
        this.type = type;
        this.orientation = orientation;
        this.layerObjIds = layerObjIds;
    }

    get position() {
        return this._position;
    }

}
