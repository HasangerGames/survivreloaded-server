import { SendingPacket } from "../sendingPacket";
import { MsgType, type SurvivBitStream } from "../../utils";
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

    serialize(stream: SurvivBitStream): void {
        super.serialize(stream);
        stream.writeUint8(this.damageType); // Damage type
        if(this.killedWith && !this.killedWith.isObstacle) {
            stream.writeGameType(this.killedWith.typeId); // Item source type
        } else {
            stream.writeGameType(0);
        }
        stream.writeMapType(this.killedWith ? this.killedWith.typeId : 0); // Map source type
        stream.writeUint16(this.p!.id); // Target ID
        stream.writeUint16(this.killer?.id ?? 0); // Killer ID
        stream.writeUint16(this.killer ? this.killer.id : 0); // Kill credit ID
        stream.writeUint8(this.killer?.kills ?? 0); // Killer kills
        stream.writeBoolean(false); // Downed
        stream.writeBoolean(true); // Killed
        stream.writeAlignToNextByte();
    }

}
