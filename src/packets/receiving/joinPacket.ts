import { ReceivingPacket } from "../receivingPacket";
import { type SurvivBitStream } from "../../utils";
import { Vec2 } from "planck";
import { type Player } from "../../game/objects/player";

export class JoinPacket extends ReceivingPacket {

    deserialize(stream: SurvivBitStream): void {
        const p: Player = this.p;

        stream.readUint32(); // Protocol

        stream.readString(); // matchPriv
        stream.readString(); // loadoutPriv
        stream.readString(); // loadoutStats

        stream.readBoolean(); // hasGoldenBP
        stream.readString(); // questPriv

        stream.readString(); // Name
        stream.readBoolean(); // Is unlinked

        p.useTouch = stream.readBoolean(); // Use touch
        if(p.useTouch) {
            p.touchMoveDir = Vec2(0, 0);
        }
        p.isMobile = stream.readBoolean(); // Is mobile
        if(p.isMobile) {
            p.zoom = 64; //Constants.scopeZoomRadius.mobile["1xscope"];
        }
        stream.readBoolean(); // Is proxy
        stream.readBoolean(); // Other proxy
        stream.readBoolean(); // Is bot
        stream.readBoolean(); // Auto melee
        stream.readBoolean(); // Aim assist

        stream.readString(); // KPG (kills per game)
        stream.readBoolean(); // Progress notification active
        stream.readBoolean(); // Is admin

        stream.readAlignToNextByte(); // Padding
    }

}
