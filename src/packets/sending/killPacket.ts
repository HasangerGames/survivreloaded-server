import { SendingPacket } from "../sendingPacket";
import { DamageType, MsgType, type SurvivBitStream as BitStream } from "../../utils";
import { type Player } from "../../game/objects/player";

export class KillPacket extends SendingPacket {

    readonly killer;

    constructor(p: Player, killer) {
        super(p);
        this.killer = killer;
        this.msgType = MsgType.Kill;
        this.allocBytes = 32;
    }

    writeData(stream: BitStream): void {
        super.writeData(stream);
        stream.writeUint8(DamageType.Player); // Damage type
        stream.writeGameType(this.killer.loadout.melee); // Item source type
        stream.writeMapType(0); // Map source type
        stream.writeUint16(this.p.id); // Target ID
        stream.writeUint16(this.killer.id); // Killer ID
        stream.writeUint16(this.killer.id); // Kill credit ID. Presumably set to, e.g. a barrel if a barrel dealt the final blow
        stream.writeUint8(this.killer.kills); // Killer kills
        stream.writeBoolean(false); // Downed
        stream.writeBoolean(true); // Killed
        stream.writeAlignToNextByte();
    }

}
