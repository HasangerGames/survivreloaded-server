import { Vector } from "matter-js";
import { ObjectKind } from "../../utils";

export class DeadBody {
    readonly kind: ObjectKind = ObjectKind.DeadBody;

    id: number;
    position: Vector;
    layer: number;
    playerId: number;

    constructor(id, position, layer, playerId) {
        this.id = id;
        this.position = position;
        this.layer = layer;
        this.playerId = playerId;
    }

}
