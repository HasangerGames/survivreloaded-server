import { SendingPacket } from "../sendingPacket";
import { DamageType, MsgType, type SurvivBitStream } from "../../utils";
import { type Player } from "../../game/objects/player";

export class KillPacket extends SendingPacket {

    readonly killer;

    readonly killedWith?;
    readonly killedWithObstacle?;

    constructor(p: Player, killer, killedWith?, killedWithObstacle?) {
        super(p);
        this.killer = killer;
        this.killedWith = killedWith;
        this.killedWithObstacle = killedWithObstacle;
        this.msgType = MsgType.Kill;
        this.allocBytes = 32;
    }

    serialize(stream: SurvivBitStream): void {
        super.serialize(stream);
        stream.writeUint8(DamageType.Player); // Damage type
        stream.writeGameType(this.killedWith && !this.killedWithObstacle ? 0 : this.killer.activeWeapon.typeId); // Item source type
        stream.writeMapType(this.killedWith && this.killedWithObstacle ? this.killedWith.typeId : 0); // Map source type
        stream.writeUint16(this.p!.id); // Target ID
        stream.writeUint16(this.killer.id); // Killer ID
        stream.writeUint16(this.killedWith ? this.killedWith.id : this.killer.id); // Kill credit ID. Presumably set to, e.g. a barrel if a barrel dealt the final blow
        stream.writeUint8(this.killer.kills); // Killer kills
        stream.writeBoolean(false); // Downed
        stream.writeBoolean(true); // Killed
        stream.writeAlignToNextByte();
    }

}
