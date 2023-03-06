import { Vector } from "matter-js";

import { ObjectKind, TypeToId, Utils } from "../../utils";
import { GameObject } from "./gameObject";

export class Building extends GameObject {
    readonly kind: ObjectKind = ObjectKind.Building;

    showOnMap: boolean;

    id: any;
    layer: number;
    mapType: number;

    _position: Vector;
    type: string;
    orientation: number;
    scale: number = 1;

    ceilingDead: boolean = false;
    occupied: boolean = false;
    ceilingDamaged: boolean = false;
    hasPuzzle: boolean = false;
    dead: boolean = false;

    body: Body;


    constructor(id: any, data, position: Vector, type: string, orientation, layer: number, showOnMap: boolean) {
        super();
        this.showOnMap = showOnMap;

        this.id = id;
        this.mapType = TypeToId[type];
        this._position = position;
        this.type = type;
        this.orientation = orientation;
        this.layer = layer;
        if(data.mapObstacleBounds) this.body = Utils.bodyFromCollisionData(data.mapObstacleBounds[0], this.position);
    }

    get position() {
        return this._position;
    }

}
