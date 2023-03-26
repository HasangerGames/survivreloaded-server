import { ReceivingPacket } from "../receivingPacket";
import { type SurvivBitStream, ItemSlot, log, IdToGameType } from "../../utils";

export class DropItemPacket extends ReceivingPacket {
    deserialize(stream: SurvivBitStream): void {
        //stream.readAlignToNextByte();
        const itemId = stream.readUint8();
        const itemSlot = stream.readUint8();
        const item: string = IdToGameType[String(itemId)];
        switch(itemSlot) {
            case ItemSlot.Primary:
                log("Item dropped from Primary/Non-specific slot: " + item);
                break;
            case ItemSlot.Secondary:
                log("Item dropped from Secondary slot: " + item);
                break;
            case ItemSlot.Melee:
                log("Item dropped from Melee slot: " + item);
                break;
            default:
                log(`Item dropped from unknown slot (${itemSlot}): ` + item);
                break;
        }
    }
}
