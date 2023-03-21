import { CollisionCategory, Constants, ObjectKind, removeFrom, type SurvivBitStream, TypeToId } from "../../utils";
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
        this.body = game.world.createBody({
            type: "dynamic",
            position,
            fixedRotation: true
        });
        this.body.createFixture({
            shape: Circle(position, 1),
            restitution: 0.0,
            density: 10.0,
            friction: 0.0,
            filterCategoryBits: CollisionCategory.Loot,
            filterMaskBits: CollisionCategory.Obstacle
        });
    }

    get position(): Vec2 {
        return this.body!.getPosition();
    }

    interact(p: Player): void {
        let result: PickupMsgType = PickupMsgType.Success;
        let deleteItem = true;
        let playerDirty = false;
        if(this.typeString.endsWith("scope")) {
            if(p.inventory[this.typeString] > 0) result = PickupMsgType.AlreadyEquipped;
            else {
                p.inventory[this.typeString]++;
                p.activeItems.scope.typeString = this.typeString;
                p.activeItems.scope.typeId = TypeToId[this.typeString];
                if(p.isMobile) p.zoom = Constants.scopeZoomRadius.mobile[this.typeString];
                else p.zoom = Constants.scopeZoomRadius.desktop[this.typeString];
            }
        } else if(this.typeString.startsWith("backpack")) {
            result = this.pickUpTieredItem("backpack", p);
            playerDirty = true;
        } else if(this.typeString.startsWith("chest")) {
            result = this.pickUpTieredItem("chest", p);
            playerDirty = true;
        } else if(this.typeString.startsWith("helmet")) {
            result = this.pickUpTieredItem("helmet", p);
            playerDirty = true;
        } else {
            const currentCount: number = p.inventory[this.typeString];
            const maxCapacity: number = Constants.bagSizes[this.typeString][p.backpackLevel];
            if(currentCount + this.count <= maxCapacity) {
                (p.inventory[this.typeString] as number) += this.count;
            } else if(currentCount + 1 > maxCapacity) {
                result = PickupMsgType.Full;
            } else if(currentCount + this.count > maxCapacity) {
                (p.inventory[this.typeString] as number) = maxCapacity;
                this.count = (currentCount + this.count) - maxCapacity;
                this.game!.fullDirtyObjects.push(this);
                deleteItem = false;
            }
        }

        if(!(p.isMobile && result !== PickupMsgType.Success)) {
            p.sendPacket(new PickupPacket(this.typeString!, this.count, result!));
        }
        if(result! === PickupMsgType.Success) {
            if(deleteItem) {
                removeFrom(this.game!.objects, this);
                //removeFrom(this.game!.loot, this);
                this.game!.deletedObjects.push(this);
                this.game!.world.destroyBody(this.body!);
                this.interactable = false;
            }
            if(playerDirty) {
                this.game?.fullDirtyObjects.push(p);
                p.fullDirtyObjects.push(p);
            }
            p.inventoryDirty = true;
        }
    }

    private pickUpTieredItem(type: string, p: Player): PickupMsgType {
        const oldLevel: number = p[`${type}Level`];
        const newLevel: number = parseInt(this.typeString.charAt(this.typeString.length - 1)); // Last digit of the ID is the item level
        if(newLevel < oldLevel) return PickupMsgType.BetterItemEquipped;
        else if(newLevel === oldLevel) return PickupMsgType.AlreadyEquipped;
        else {
            p[`${type}Level`] = newLevel;
            if(oldLevel !== 0) { // If oldLevel === 0, the player didn't have an item of this type equipped, so don't drop loot
                // Example: if type = helmet and p.helmetLevel = 1, typeString = helmet01
                const oldItem: Loot = new Loot(this.game!.nextObjectId, `${type}0${oldLevel}`, this.position, this.layer, this.game!, 1);
                this.game!.objects.push(oldItem);
                //this.game!.loot.push(oldItem);
                this.game!.fullDirtyObjects.push(oldItem);
            }
        }
        return PickupMsgType.Success;
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
        stream.writeBits(0, 1); // Padding
    }

}
