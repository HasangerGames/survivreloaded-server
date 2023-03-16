import { SendingPacket } from "../sendingPacket";
import { MsgType, type SurvivBitStream } from "../../utils";
import { type Player } from "../../game/objects/player";

export class JoinedPacket extends SendingPacket {

    constructor(p: Player) {
        super(p);
        this.allocBytes = 512;
    }

    writeData(stream: SurvivBitStream): void {
        stream.writeUint8(MsgType.Joined);
        stream.writeUint8(1); // Team mode
        stream.writeUint16(this.p.id); // Player ID
        stream.writeBoolean(false); // Game started
        stream.writeUint8(6); // Emote count
        for(let i = 0; i < 6; i++) { stream.writeGameType(this.p.loadout.emotes[i]); }
    }

}
