import {
    Constants, deepCopy,
    Items,
    log,
    LootTables,
    ObjectKind, random,
    type SurvivBitStream,
    TypeToId, unitVecToRadians,
    Weapons,
    weightedRandom
} from "../../utils";
import { type Game } from "../game";
import { GameObject } from "../gameObject";
import { type Player } from "./player";
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

    isGun = false;
    isMelee = false;
    isAmmo = false;

    oldPos: Vec2;

    constructor(game: Game,
                typeString: string,
                position: Vec2,
                layer: number,
                count: number) {
        if(!TypeToId[typeString]) {
            log(`[WARNING] Unknown loot item: ${typeString}`);
            typeString = "9mm";
            count = 60;
        }
        super(game, typeString, position, layer);
        this.kind = ObjectKind.Loot;
        this.count = count;
        this.isGun = Weapons[typeString]?.type === "gun";
        this.isMelee = Weapons[typeString]?.type === "melee";
        this.isAmmo = Items[typeString]?.type === "ammo";
        let radius;
        if(this.isGun) radius = Constants.lootRadius.gun;
        else if(this.isMelee) radius = Constants.lootRadius.melee;
        else if(this.isAmmo) radius = Constants.lootRadius.ammo;
        else radius = 1;
        this.interactionRad = radius;
        this.oldPos = position;

        // Create the body
        this.body = game.world.createBody({
            type: "dynamic",
            position
        });
        this.body.createFixture({
            shape: Circle(radius),
            restitution: 0.5,
            density: 0.0,
            friction: 0.0,
            userData: this
        });

        // Push the loot in a random direction
        const angle: number = Math.random() * Math.PI * 2;
        this.body.setLinearVelocity(Vec2(Math.cos(angle), Math.sin(angle)).mul(0.005));

        game.loot.add(this);
        game.dynamicObjects.add(this);
        game.fullDirtyObjects.add(this);
        game.updateObjects = true;
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
            // if it is ammo or a healing item
            const currentCount: number = p.inventory[this.typeString];
            const maxCapacity: number = Constants.bagSizes[this.typeString][p.backpackLevel];
            if(currentCount + this.count <= maxCapacity) {
                (p.inventory[this.typeString] as number) += this.count;
            } else if(currentCount + 1 > maxCapacity) {
                result = PickupMsgType.Full;
            } else if(currentCount + this.count > maxCapacity) {
                (p.inventory[this.typeString] as number) = maxCapacity;
                this.count = (currentCount + this.count) - maxCapacity;
                this.game.fullDirtyObjects.add(this);
                deleteItem = false;
            }

            // Reload active gun if the player picks up the correct ammo
            if(p.activeWeapon.ammo === 0 && this.typeString === p.activeWeaponInfo.ammo) p.reload();
        } else if(Weapons[this.typeString]?.type === "melee") {
            let slotSwitchingTo: number | undefined;
            if(p.weapons[2].typeString === this.typeString) {
                result = PickupMsgType.AlreadyEquipped;
            } else if(p.weapons[2].typeString !== "fists") { // TODO Do item type check in drop item packet, not in drop item method
                p.dropItemInSlot(2, p.weapons[2].typeString, true);
                slotSwitchingTo = 2;
            }
            p.weapons[2].typeString = this.typeString;
            p.weapons[2].typeId = this.typeId;
            if(slotSwitchingTo === undefined) {
                slotSwitchingTo = p.selectedWeaponSlot === 2 ? 2 : undefined;
            }
            if(slotSwitchingTo !== undefined) {
                p.switchSlot(slotSwitchingTo);
            }
            p.weaponsDirty = true;
        } else {
            let slotSwitchingTo: number;
            // if it is a gun
            const canDualWield = !!Weapons[this.typeString]?.dualWieldType;
            if(canDualWield && p.weapons[0].typeId === this.typeId) {
                const gunTypeString = Weapons[this.typeString]?.dualWieldType;
                p.weapons[0].typeString = gunTypeString;
                p.weapons[0].typeId = TypeToId[gunTypeString];
                slotSwitchingTo = 0;
            } else if(canDualWield && p.weapons[1].typeId === this.typeId) {
                const gunTypeString = Weapons[this.typeString]?.dualWieldType;
                p.weapons[1].typeString = gunTypeString;
                p.weapons[1].typeId = TypeToId[gunTypeString];
                slotSwitchingTo = 1;
            } else if(p.weapons[0].typeId === 0) {
                p.weapons[0].typeString = this.typeString;
                p.weapons[0].typeId = this.typeId;
                slotSwitchingTo = 0;
            } else if(p.weapons[0].typeId !== 0 && p.weapons[1].typeId === 0) {
                p.weapons[1].typeString = this.typeString;
                p.weapons[1].typeId = this.typeId;
                slotSwitchingTo = 1;
            } else if(p.selectedWeaponSlot === 0 || p.selectedWeaponSlot === 1) {
                if(p.activeWeapon.typeString === this.typeString) ignore = true;
                else {
                    p.dropItemInSlot(p.selectedWeaponSlot, p.activeWeapon.typeString, true);
                    p.activeWeapon.typeString = this.typeString;
                    p.activeWeapon.typeId = this.typeId;
                    slotSwitchingTo = p.selectedWeaponSlot;
                }
            } else ignore = true;
            if(!ignore) {
                p.weaponsDirty = true;
                playerDirty = true;
                p.cancelAction();
                p.switchSlot(slotSwitchingTo!);
            }
        }

        if(!(p.isMobile && result !== PickupMsgType.Success) && !ignore) {
            p.sendPacket(new PickupPacket(this.typeString!, this.count, result!));
        }
        if(result! === PickupMsgType.Success && !ignore) {
            if(playerDirty) {
                this.game?.fullDirtyObjects.add(p);
                p.fullDirtyObjects.add(p);
            }
            p.inventoryDirty = true;
            p.inventoryEmpty = false;
        } else if(!ignore) {
            deleteItem = false;
        }

        // Delete the original loot item if it's not ignored
        if(!ignore) {
            this.game.dynamicObjects.delete(this);
            this.game.loot.delete(this);
            this.game.deletedObjects.add(this);
            this.game.world.destroyBody(this.body!);
            this.interactable = false;
        }

        // Create a new loot item, even if nothing was picked up
        if(!deleteItem) {
            const angle = unitVecToRadians(p.direction);
            const invertedAngle = (angle + Math.PI) % (2 * Math.PI);
            new Loot(this.game, this.typeString, this.position.add(Vec2(0.4 * Math.cos(invertedAngle), 0.4 * Math.sin(invertedAngle))), this.layer, this.count);
        }
    }

    canPickUpItem(p: Player): boolean {
        if(this.typeString.endsWith("scope")) {
            return p.inventory[this.typeString] === 0;
        } else if(this.typeString.startsWith("backpack")) {
            return this.canPickUpTieredItem("backpack", p);
        } else if(this.typeString.startsWith("chest")) {
            return this.canPickUpTieredItem("chest", p);
        } else if(this.typeString.startsWith("helmet")) {
            return this.canPickUpTieredItem("helmet", p);
        } else if(Constants.bagSizes[this.typeString]) { // if it is ammo or a healing item
            const currentCount: number = p.inventory[this.typeString];
            const maxCapacity: number = Constants.bagSizes[this.typeString][p.backpackLevel];
            return currentCount + 1 <= maxCapacity;
        } else if(Weapons[this.typeString]?.type === "melee") {
            return p.weapons[2].typeString !== this.typeString;
        } else { // if it is a gun
            const canDualWield = Boolean(Weapons[this.typeString]?.dualWieldType);
            if((canDualWield && (p.weapons[0].typeId === this.typeId || p.weapons[1].typeId === this.typeId)) || p.weapons[0].typeId === 0 || p.weapons[1].typeId === 0) {
                return true;
            } else if(p.selectedWeaponSlot === 0 || p.selectedWeaponSlot === 1) {
                return p.activeWeapon.typeString !== this.typeString;
            } else return false;
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
                new Loot(this.game, `${type}0${oldLevel}`, this.position, this.layer, 1);
            }
        }
        return PickupMsgType.Success;
    }

    private canPickUpTieredItem(type: string, p: Player): boolean {
        const oldLevel: number = p[`${type}Level`];
        const newLevel: number = parseInt(this.typeString.charAt(this.typeString.length - 1)); // Last digit of the ID is the item level
        return newLevel > oldLevel;
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

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    damage(amount: number, source): void {}

}

export interface LooseLoot { tier: string, min: number, max: number }

export function generateLooseLootFromArray(game: Game, loot: LooseLoot[], position: Vec2, layer: number): void {
    for(let i = 0; i < loot.length; i++) {
        for(let j = 0; j < random(loot[i].min, loot[i].max); j++) {
            const lootTable = LootTables[loot[i].tier];
            if(!lootTable) return;

            const items: string[] = [], weights: number[] = [];
            for(const item in lootTable) {
                items.push(item);
                weights.push(lootTable[item].weight);
            }

            const selectedItem: string = weightedRandom(items, weights);
            if(selectedItem === "nothing") continue;
            if(selectedItem.startsWith("tier_")) {
                const lootItem = deepCopy(loot[i]);
                lootItem.tier = selectedItem;
                generateLooseLootFromArray(game, [lootItem], position, layer);
            } else {
                new Loot(game, selectedItem, position, layer, lootTable[selectedItem].count);

                const weapon = Weapons[selectedItem];
                if(weapon?.ammo) {
                    if(weapon.ammoSpawnCount === 1) {
                        new Loot(game, weapon.ammo, position, layer, 1);
                    } else {
                        const count: number = weapon.ammoSpawnCount / 2;
                        new Loot(game, weapon.ammo, Vec2.add(position, Vec2(-1.5, -1.5)), layer, count);
                        new Loot(game, weapon.ammo, Vec2.add(position, Vec2(1.5, -1.5)), layer, count);
                    }
                }
            }
        }
    }
}
export function splitUpLoot(player: Player, item: string, amount: number): void {
    const dropCount = Math.floor(amount / 60);
    for(let i = 0; i < dropCount; i++) {
        new Loot(player.game, item, player.position, player.layer, 60);
    }
    if(amount % 60 !== 0) new Loot(player.game, item, player.position, player.layer, amount % 60);
}
