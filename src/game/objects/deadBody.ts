import { ObjectKind, Point } from "../../utils";

export class DeadBody {
    readonly kind: ObjectKind = ObjectKind.DeadBody;

    id: number;
    position: Point;
    layer: number;
    playerId: number;

    constructor(id, position, layer, playerId) {
        this.id = id;
        this.position = position;
        this.layer = layer;
        this.playerId = playerId;
    }

}
