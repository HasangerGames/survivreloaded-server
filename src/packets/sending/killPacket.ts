import { SendingPacket } from "../sendingPacket";
import { DamageType, MsgType, type SurvivBitStream } from "../../utils";
import { type Player } from "../../game/objects/player";

export class KillPacket extends SendingPacket {

    readonly damageType;
    readonly killer?;
    readonly killedWith?;

    constructor(p: Player, damageType, killer?, killedWith?) {
        super(p);
        this.damageType = damageType;
        this.killer = killer;
        this.killedWith = killedWith;
        this.msgType = MsgType.Kill;
        this.allocBytes = 32;
    }

    serialize(stream: SurvivBitStream): void { // TODO Replace nested ternary operators with something easier to read
        super.serialize(stream);
        stream.writeUint8(this.damageType); // Damage type
        stream.writeGameType(this.killedWith ? 0 : (this.killer ? this.killer.activeWeapon.typeId : 0)); // Item source type
        stream.writeMapType(this.killedWith ? this.killedWith.typeId : 0); // Map source type
        stream.writeUint16(this.p!.id); // Target ID
        stream.writeUint16(this.killer?.id ?? 0); // Killer ID
        stream.writeUint16(this.killedWith ? this.killedWith.id : (this.killer ? this.killer.id : 0)); // Kill credit ID. Set to, e.g. a barrel if a barrel dealt the final blow
        stream.writeUint8(this.killer?.kills ?? 0); // Killer kills
        stream.writeBoolean(false); // Downed
        stream.writeBoolean(true); // Killed
        stream.writeAlignToNextByte();
    }

}
