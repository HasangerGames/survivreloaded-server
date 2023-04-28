import { type MsgType, type SurvivBitStream } from "../utils";
import { type Player } from "../game/objects/player";

export abstract class SendingPacket {
    allocBytes = 0;
    msgType: MsgType;

    p?: Player;

    protected constructor (p?: Player) {
        this.p = p;
    }

    serialize (stream: SurvivBitStream): void {
        stream.writeUint8(this.msgType);
    }
}
