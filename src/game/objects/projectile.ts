import { ObjectKind, type SurvivBitStream, Constants } from "../../utils";
import { GameObject } from "../gameObject";
import { Vec2 } from "planck";
import { type Game } from "../game";

export class Projectile extends GameObject {

    zPos: 1;
    direction = new Vec2(0, 0);

    constructor(
        typeString: string,
        game: Game,
        position: Vec2,
        layer: number,
    ) {
        super(game, typeString, position, layer);
        this.kind = ObjectKind.Projectile;
    }

    serializePartial(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeFloat(this.zPos, 0, Constants.projectile.maxHeight, 10);
        stream.writeUnitVec(this.direction, 7);
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeGameType(this.typeId);
        stream.writeBits(this.layer, 2);
        stream.writeBits(0, 4); // padding
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    damage(amount: number, source): void {}
}
