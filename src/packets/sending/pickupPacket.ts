import { SendingPacket } from "../sendingPacket";
import { MsgType, type SurvivBitStream, TypeToId } from "../../utils";

export class PickupPacket extends SendingPacket {

    readonly type: string;
    readonly count: number;
    readonly message: PickupMsgType;

    constructor(type: string, count: number, message: PickupMsgType) {
        super();
        this.msgType = MsgType.Pickup;
        this.allocBytes = 5;

        this.type = type;
        this.count = count;
        this.message = message;
    }

    serialize(stream: SurvivBitStream): void {
        super.serialize(stream);
        stream.writeUint8(this.message);
        stream.writeGameType(TypeToId[this.type]);
        stream.writeUint8(this.count);
        stream.writeBits(0, 5); // Padding
    }

}

export enum PickupMsgType {
    Full, AlreadyOwned, AlreadyEquipped, BetterItemEquipped, Success, GunCannotFire
}
