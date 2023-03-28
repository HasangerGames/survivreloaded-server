import {
    Constants,
    Items,
    ObjectKind,
    removeFrom,
    type SurvivBitStream,
    Weapons
} from "../../utils";
import { type Game } from "../game";
import { GameObject } from "../gameObject";
import { Player } from "./player";
import { PickupMsgType, PickupPacket } from "../../packets/sending/pickupPacket";
import { Circle, Vec2 } from "planck";

export class Loot extends GameObject {

    isPlayer = false;
    isObstacle = false;
    isBullet = false;
    isLoot = true;
    collidesWith = {
        player: false,
        obstacle: true,
        bullet: false,
        loot: true
    };

    count: number;
    interactable = true;
    interactionRad = 1;

    oldPos: Vec2;

    constructor(game: Game,
                typeString: string,
                position: Vec2,
                layer: number,
                count: number) {
        super(game, typeString, position, layer);
        this.kind = ObjectKind.Loot;
        this.count = count;
        this.oldPos = position;

        // Create the body
        this.body = game.world.createBody({
            type: "dynamic",
            position
        });
        this.body.createFixture({
            shape: Circle(1),
            restitution: 0.5,
            density: 0.0,
            friction: 0.0,
            userData: this
        });

        // Push the loot in a random direction
        const angle: number = Math.random() * Math.PI * 2;
        this.body.setLinearVelocity(Vec2(Math.cos(angle), Math.sin(angle)).mul(0.005));

        game.loot.push(this);
    }

    get position(): Vec2 {
        return this.body!.getPosition();
    }

    interact(p: Player): void {
        let result: PickupMsgType = PickupMsgType.Success;
        let deleteItem = true;
        let playerDirty = false;
        let ignore = false;
        if(this.typeString.endsWith("scope")) {
            if(p.inventory[this.typeString] > 0) result = PickupMsgType.AlreadyEquipped;
            else {
                p.inventory[this.typeString]++;
                if(Items[this.typeString].level > Items[p.scope.typeString].level) {
                    p.setScope(this.typeString);
                }
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
        } else if(Constants.bagSizes[this.typeString]) {
            // if it is a bag
            const currentCount: number = p.inventory[this.typeString];
            const maxCapacity: number = Constants.bagSizes[this.typeString][p.backpackLevel];
            if(currentCount + this.count <= maxCapacity) {
                (p.inventory[this.typeString] as number) += this.count;
            } else if(currentCount + 1 > maxCapacity) {
                result = PickupMsgType.Full;
            } else if(currentCount + this.count > maxCapacity) {
                (p.inventory[this.typeString] as number) = maxCapacity;
                this.count = (currentCount + this.count) - maxCapacity;
                this.game.fullDirtyObjects.push(this);
                deleteItem = false;
            }
        } else {
            // if it is a gun
            if(p.weapons.primaryGun.typeId === 0) {
                p.weapons.primaryGun.typeString = this.typeString;
                p.weapons.primaryGun.typeId = this.typeId;
                p.switchSlot(0);
                p.useItem(this.typeString, Weapons[this.typeString].reloadTime, Constants.Action.Reload, true);
            } else if(p.weapons.primaryGun.typeId !== 0 && p.weapons.secondaryGun.typeId === 0) {
                p.weapons.secondaryGun.typeString = this.typeString;
                p.weapons.secondaryGun.typeId = this.typeId;
                p.switchSlot(1);
                p.useItem(this.typeString, Weapons[this.typeString].reloadTime, Constants.Action.Reload, true);
            } else if(p.weapons.activeSlot === 0 || p.weapons.activeSlot === 1) {
                const slotName = Player.slots[p.weapons.activeSlot];
                const slot = p.weapons[slotName];
                if(slot.typeString === this.typeString) result = PickupMsgType.AlreadyEquipped;
                else {
                    // create the swapped gun item
                    const loot = new Loot(this.game, slot.typeString, p.position, p.layer, 1);
                    this.game.objects.push(loot);
                    this.game.fullDirtyObjects.push(loot);

                    p.weapons[slotName].typeString = this.typeString;
                    p.weapons[slotName].typeId = this.typeId;
                    p.switchSlot(p.weapons.activeSlot);
                    p.useItem(this.typeString, Weapons[this.typeString].reloadTime, Constants.Action.Reload, true);
                }
            } else ignore = true;
            p.weaponsDirty = true;
            playerDirty = true;
        }

        if(!(p.isMobile && result !== PickupMsgType.Success)) {
            p.sendPacket(new PickupPacket(this.typeString!, this.count, result!));
        }
        if(result! === PickupMsgType.Success && !ignore) {
            if(deleteItem) {
                removeFrom(this.game.objects, this);
                removeFrom(this.game.loot, this);
                this.game.deletedObjects.push(this);
                this.game.world.destroyBody(this.body!);
                this.interactable = false;
            }
            if(playerDirty) {
                this.game?.fullDirtyObjects.push(p);
                p.fullDirtyObjects.push(p);
            }
            p.inventoryDirty = true;
            p.inventoryEmpty = false;
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
                const oldItem: Loot = new Loot(this.game, `${type}0${oldLevel}`, this.position, this.layer, 1);
                this.game.objects.push(oldItem);
                this.game.fullDirtyObjects.push(oldItem);
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

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    damage(amount: number, source): void {}

}

export function splitUpLoot(player: Player, item: string, amount: number): Loot[] {
    const loot: Loot[] = [];
    const dropCount = Math.floor(amount / 30);
    for(let i = 0; i < dropCount; i++) {
        loot.push(new Loot(player.game, item, player.position, player.layer, 30));
    }
    if(amount % 30 !== 0) loot.push(new Loot(player.game, item, player.position, player.layer, amount % 30));
    return loot;
}
