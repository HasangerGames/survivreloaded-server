import { type SurvivBitStream } from "../utils";
import { type Player } from "../game/objects/player";

export abstract class ReceivingPacket {

    p: Player;

    constructor(p: Player) {
        this.p = p;
    }

    abstract readData(stream: SurvivBitStream);

}
