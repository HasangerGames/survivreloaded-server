import { ReceivingPacket } from "../receivingPacket";
import { type SurvivBitStream, ItemSlot, log, IdToGameType } from "../../utils";
import { Loot } from "../../game/objects/loot";

const blankGun = {
    typeString: "",
    typeId: 0,
    ammo: 0
};

const slots = ["primaryGun", "secondaryGun", "melee"];

export class DropItemPacket extends ReceivingPacket {

    private checkSlot(slot: number, item: string): boolean {
        const slotIndex = slots[slot];
        if(this.p.weapons[slotIndex].typeString === item) {
            // Only drop the gun if it's the same as the one we have, AND it's in the primary slot
            this.p.weapons[slotIndex] = blankGun;
            log(JSON.stringify(this.p.weapons));
            log(this.p.weapons.activeSlot as unknown as string);
            if(this.p.weapons.activeSlot === slot) this.p.switchSlot(2, true);
            const loot = new Loot(this.p.game, item, this.p.position, this.p.layer, 1);
            this.p.game.objects.push(loot);
            this.p.game.fullDirtyObjects.push(loot);
            return true;
        }
        return false;
    }

    deserialize(stream: SurvivBitStream): void {
        //stream.readAlignToNextByte();
        const itemId = stream.readGameType();
        const itemSlot = stream.readUint8();
        const item: string = IdToGameType[String(itemId)];
        switch(itemSlot) {
            case ItemSlot.Primary:
                if(this.checkSlot(itemSlot, item)) break;
                break;
            case ItemSlot.Secondary:
                if(this.checkSlot(itemSlot, item)) break;
                break;
            case ItemSlot.Melee:
                if(item === "fists") break;
                break;
            default:
                break;
        }
        stream.readBits(6); // Padding
    }
}
