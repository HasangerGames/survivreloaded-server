import { SendingPacket } from "../sendingPacket";
import { MsgType, type SurvivBitStream } from "../../utils";
import { type Player } from "../../game/objects/player";
import { type GameObject } from "../../game/gameObject";

export class RoleAnnouncementPacket extends SendingPacket {

    readonly assigned: boolean;
    readonly killed: boolean;
    readonly killer?: GameObject;

    constructor(p: Player, assigned: boolean, killed: boolean, killer?: GameObject) {
        super(p);
        this.assigned = assigned;
        this.killed = killed;
        this.killer = killer;
        this.msgType = MsgType.RoleAnnouncement;
        this.allocBytes = 8;
    }

    serialize(stream: SurvivBitStream): void {
        const p = this.p!;

        super.serialize(stream);
        stream.writeUint16(p.id);
        stream.writeUint16(this.killer ? this.killer.id : 0);
        stream.writeGameType(p.role);
        stream.writeBoolean(this.assigned);
        stream.writeBoolean(this.killed);

        // Padding
        stream.writeBits(0, 1);
        stream.writeAlignToNextByte();
    }

}
