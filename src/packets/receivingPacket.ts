import type { SurvivBitStream } from "../utils/survivBitStream";
import { type Player } from "../game/objects/player";

export abstract class ReceivingPacket {
    p: Player;

    constructor (p: Player) {
        this.p = p;
    }

    abstract deserialize (stream: SurvivBitStream);
}
