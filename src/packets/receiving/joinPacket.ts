import { ReceivingPacket } from "../receivingPacket";
import { distanceBetween, InputType, type SurvivBitStream } from "../../utils";

export class JoinPacket extends ReceivingPacket {

    readData(stream: SurvivBitStream): void {
        stream.readUint32(); // Protocol
        stream.readString(); // matchPriv
        stream.readString(); // loadoutPriv
        stream.readString(); // loadoutStats
        stream.readBoolean(); // hasGoldenBP
        stream.readString(); // questPriv
        stream.readStringFixedLength(16); // Name
        stream.readBoolean(); // Is unlinked
        stream.readBoolean(); // Use touch
        stream.readBoolean(); // Is mobile
        stream.readBoolean(); // Is proxy
        stream.readBoolean(); // Other proxy
    }

}
