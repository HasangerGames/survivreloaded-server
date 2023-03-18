import {
    CollisionCategory,
    Constants,
    IdToGameType,
    ObjectKind,
    removeFrom,
    type SurvivBitStream,
    TypeToId
} from "../../utils";
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
        this.body.createFixture({
            shape: Circle(position, 1),
            filterCategoryBits: CollisionCategory.Loot,
            filterMaskBits: CollisionCategory.Obstacle | CollisionCategory.Player,
            filterGroupIndex: 3
        });
    }

    get position(): Vec2 {
        return this.body!.getPosition();
    }

    interact(p: Player): void { // TODO Clean up, remove redundant code
        let result: PickupMsgType = PickupMsgType.Success;
        if(this.typeString.endsWith("scope")) {
            if(p.inventory[this.typeString] > 0) result = PickupMsgType.AlreadyEquipped;
            else {
                p.activeItems.scope.typeString = this.typeString;
                p.activeItems.scope.typeId = TypeToId[this.typeString];
                if(p.isMobile) p.zoom = Constants.scopeZoomRadius.mobile[this.typeString];
                else p.zoom = Constants.scopeZoomRadius.desktop[this.typeString];
                p.zoomDirty = true;
            }
        } else if(this.typeString.startsWith("backpack")) {
            const packLevel = parseInt(this.typeString.charAt(9)); // Last digit of the ID is always the item level
            if(packLevel < p.packLevel) result = PickupMsgType.BetterItemEquipped;
            else if(packLevel === p.packLevel) result = PickupMsgType.AlreadyEquipped;
            else {
                const noPack: boolean = (p.packLevel === 0);
                p.packLevel = packLevel;
                if(!noPack) {
                    const oldItem: Loot = new Loot(this.game!.nextObjectId, IdToGameType[450 + p.packLevel], this.position, this.layer, this.game!, 1);
                    this.game!.objects.push(oldItem);
                    this.game!.fullDirtyObjects.push(oldItem);
                }
            }
        } else if(this.typeString.startsWith("chest")) {
            const chestLevel = parseInt(this.typeString.charAt(6));
            if(chestLevel < p.chestLevel) result = PickupMsgType.BetterItemEquipped;
            else if(chestLevel === p.chestLevel) result = PickupMsgType.AlreadyEquipped;
            else {
                const noChest: boolean = (p.chestLevel === 0);
                p.chestLevel = chestLevel;
                if(!noChest) {
                    const oldItem: Loot = new Loot(this.game!.nextObjectId, IdToGameType[457 + p.chestLevel], this.position, this.layer, this.game!, 1);
                    this.game!.objects.push(oldItem);
                    this.game!.fullDirtyObjects.push(oldItem);
                }
            }
        } else if(this.typeString.startsWith("helmet")) {
            const helmetLevel = parseInt(this.typeString.charAt(7));
            if(helmetLevel < p.helmetLevel) result = PickupMsgType.BetterItemEquipped;
            else if(helmetLevel === p.helmetLevel) result = PickupMsgType.AlreadyEquipped;
            else {
                const noHelmet: boolean = (p.helmetLevel === 0);
                p.helmetLevel = helmetLevel;
                if(!noHelmet) {
                    const oldItem: Loot = new Loot(this.game!.nextObjectId, IdToGameType[453 + p.helmetLevel], this.position, this.layer, this.game!, 1);
                    this.game!.objects.push(oldItem);
                    this.game!.fullDirtyObjects.push(oldItem);
                }
            }
        } else {
            const currentCount: number = p.inventory[this.typeString];
            const maxCapacity: number = Constants.bagSizes[this.typeString][p.packLevel];
            if(currentCount + 1 > maxCapacity) result = PickupMsgType.Full;
            else if(currentCount + this.count > maxCapacity) {
                const increase = (currentCount + this.count) - maxCapacity;
                (p.inventory[this.typeString] as number) += increase;
                this.count -= increase;
                result = PickupMsgType.Success;
            }
        }

        if(!(p.isMobile && result !== PickupMsgType.Success)) {
            p.sendPacket(new PickupPacket(this.typeString!, this.count, result!));
        }
        if(result! === PickupMsgType.Success) {
            removeFrom(this.game!.objects, this);
            this.game!.deletedObjects.push(this);
            this.game!.world.destroyBody(this.body!);
            this.interactable = false;

            this.game?.fullDirtyObjects.push(p);
            p.fullDirtyObjects.push(p);
            p.inventoryDirty = true;
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
