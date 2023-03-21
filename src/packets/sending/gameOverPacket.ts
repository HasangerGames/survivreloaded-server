import { SendingPacket } from "../sendingPacket";
import { DamageType, MsgType, type SurvivBitStream } from "../../utils";
import { type Player } from "../../game/objects/player";

export class GameOverPacket extends SendingPacket {

    constructor(p: Player) {
        super(p);
        this.msgType = MsgType.GameOver;
        this.allocBytes = 32;
    }

    serialize(stream: SurvivBitStream): void {
        super.serialize(stream);
        const p = this.p!;

        stream.writeUint8(1); // Team ID (not duo/squad ID, for 50v50?)
        stream.writeUint8(p.game!.aliveCount + 1); // Team rank
        stream.writeUint8(0); // Game over
        stream.writeUint8(0); // Winning team ID

        stream.writeUint8(1); // Player stats count

        stream.writeUint16(p.id); // Player ID
        stream.writeUint16((Date.now() - p.joinTime) / 1000); // Time alive
        stream.writeUint8(p.kills); // Kills
        stream.writeUint8(1); // Dead
        stream.writeUint16(p.damageDealt); // Damage dealt
        stream.writeUint16(p.damageTaken); // Damage taken
    }

}
