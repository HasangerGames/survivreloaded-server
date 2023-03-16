import { Constants, ObjectKind, removeFrom, type SurvivBitStream } from "../../utils";
import { type Game } from "../game";
import { GameObject } from "../gameObject";
import { type Player } from "./player";
import { PickupMsgType, PickupPacket } from "../../packets/sending/pickupPacket";
import { Circle, type Vec2 } from "planck";

export class Loot extends GameObject {

    count: number;
    interactable = true;
    interactionRad = 1;

    constructor(id: number,
                typeString: string,
                position: Vec2,
                layer: number,
                game: Game,
                count: number) {
        super(id, typeString, position, layer, undefined, game);
        this.kind = ObjectKind.Loot;
        this.count = count;
        this.body = game.world.createBody({ position });
        this.body.createFixture(Circle(position, 1));
    }

    get position(): Vec2 {
        return this.body!.getPosition();
    }

    interact(p: Player): void {
        removeFrom(this.game!.objects, this);
        this.game!.deletedObjects.push(this);
        this.game!.world.destroyBody(this.body!);
        this.interactable = false;
        p.sendPacket(new PickupPacket(p, this.typeString!, this.count, PickupMsgType.Success));

        if(this.typeString?.endsWith("scope")) { // TODO Check if mobile or desktop
            p.zoom = Constants.scopeZoomRadius.desktop[this.typeString];
        } else if(this.typeString?.startsWith("backpack")) {
            p.packLevel = parseInt(this.typeString.charAt(10)); // Last digit of the ID is always the item level
        } else if(this.typeString?.startsWith("chest")) {
            p.chestLevel = parseInt(this.typeString.charAt(7));
        } else if(this.typeString?.startsWith("helmet")) {
            p.helmetLevel = parseInt(this.typeString.charAt(8));
        }
    }

    serializePartial(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeGameType(this.typeId);
        stream.writeUint8(this.count);
        stream.writeBits(this.layer, 2);
        stream.writeBoolean(false); // Is old
        stream.writeBoolean(false); // Is preloaded gun
        stream.writeBoolean(false); // Has owner
    }

}
