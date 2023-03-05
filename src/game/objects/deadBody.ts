import { ObjectKind, Point } from "../../utils";

export class DeadBody {
    readonly kind: ObjectKind = ObjectKind.DeadBody;

    id: number;
    pos: Point;
    layer: number;
    playerId: number;

    constructor(id, pos, layer, playerId) {
        this.id = id;
        this.pos = pos;
        this.layer = layer;
        this.playerId = playerId;
    }

}
