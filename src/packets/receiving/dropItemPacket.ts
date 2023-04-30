import { ReceivingPacket } from "../receivingPacket";
import type { SurvivBitStream } from "../../utils/survivBitStream";
import { IdToGameType } from "../../utils/data";
import { ItemSlot } from "../../utils/constants";

export class DropItemPacket extends ReceivingPacket {
    deserialize (stream: SurvivBitStream): void {
        const itemId = stream.readGameType();
        const itemSlot = stream.readUint8();
        const item: string = IdToGameType[String(itemId)];
        switch (itemSlot) {
            case ItemSlot.Primary:
                this.p.dropItemInSlot(0, item);
                break;
            case ItemSlot.Secondary:
                this.p.dropItemInSlot(1, item);
                break;
            case ItemSlot.Melee:
                if (item === "fists") break;
                this.p.dropItemInSlot(2, item);
                break;
            case ItemSlot.Throwable:
                this.p.dropItemInSlot(3, item);
                break;
            default:
                break;
        }
        stream.readBits(6); // Padding
    }
}
