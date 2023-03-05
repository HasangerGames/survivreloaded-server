import { Packet } from "./packet";
import { DamageType, MsgType, SurvivBitStream } from "../utils";
import { Player } from "../game/objects/player";

export class KillPacket extends Packet {

    killer;

    constructor(p: Player, killer) {
        super(p);
        this.killer = killer;
        this.msgType = MsgType.Kill;
        this.allocBytes = 32;
    }

    writeData(stream: SurvivBitStream): void {
        super.writeData(stream);
        stream.writeUint8(MsgType.Kill);
        stream.writeUint8(DamageType.Player); // Damage type
        stream.writeGameType(557); // Item source type (fists in this case)
        stream.writeMapType(this.killer.id); // Map source type
        stream.writeUint16(this.p.id); // Target ID
        stream.writeUint16(this.killer.id); // Killer ID
        stream.writeUint16(this.killer.id); // Kill credit ID. Presumably set to, e.g. a barrel if a barrel dealt the final blow
        stream.writeUint8(this.killer.kills); // Killer kills
        stream.writeBoolean(false); // Downed
        stream.writeBoolean(true); // Killed
        stream.writeAlignToNextByte();
    }

}
