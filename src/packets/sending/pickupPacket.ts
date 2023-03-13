import { SendingPacket } from "../sendingPacket";
import { MsgType, type SurvivBitStream, TypeToId } from "../../utils";
import { type Player } from "../../game/objects/player";

export class PickupPacket extends SendingPacket {

    readonly type: string;
    readonly count: number;
    readonly message: PickupMsgType;

    constructor(p: Player, type: string, count: number, message: PickupMsgType) {
        super(p);
        this.msgType = MsgType.Pickup;
        this.allocBytes = 4;

        this.type = type;
        this.count = count;
        this.message = message;
    }

    writeData(stream: SurvivBitStream): void {
        super.writeData(stream);
        stream.writeUint8(this.message);
        stream.writeGameType(TypeToId[this.type]);
        stream.writeUint8(this.count);
        stream.writeBits(0, 5); // Padding
    }

}

export enum PickupMsgType {
    Full, AlreadyOwned, AlreadyEquipped, BetterItemEquipped, Success, GunCannotFire
}
