import { MsgType, SurvivBitStream as BitStream } from "../utils";
import { Player } from "../game/objects/player";

export abstract class Packet {
    allocBytes: number = 0;
    msgType: MsgType;

    p: Player;

    protected constructor(p: Player) {
        this.p = p;
    }

    writeData(stream: BitStream): void {
        stream.writeUint8(this.msgType);
    }

}
