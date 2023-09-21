import type { MsgType } from "../utils/constants";
import type { SurvivBitStream } from "../utils/survivBitStream";
import { type Player } from "../game/objects/player";

export abstract class SendingPacket {
    allocBytes = 0;
    msgType: MsgType;

    p?: Player;

    protected constructor(p?: Player) {
        this.p = p;
    }

    serialize(stream: SurvivBitStream): void {
        stream.writeUint8(this.msgType);
    }
}
