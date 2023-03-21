import { ReceivingPacket } from "../receivingPacket";
import { type SurvivBitStream } from "../../utils";

export class JoinPacket extends ReceivingPacket {

    deserialize(stream: SurvivBitStream): void {
        stream.readUint32(); // Protocol

        stream.readString(); // matchPriv
        stream.readString(); // loadoutPriv
        stream.readString(); // questPriv

        stream.readString(); // Name

        stream.readBoolean(); // Use touch
        stream.readBoolean(); // Is mobile

        stream.readBoolean(); // Is proxy
        stream.readBoolean(); // Other proxy
        stream.readBoolean(); // Is bot
        stream.readAlignToNextByte(); // Padding
    }

}
