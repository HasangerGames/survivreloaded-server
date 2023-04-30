import { SendingPacket } from "../sendingPacket";
import { MsgType } from "../../utils/constants";
import type { SurvivBitStream } from "../../utils/survivBitStream";
import { type Game } from "../../game/game";

export class AliveCountsPacket extends SendingPacket {
    readonly game;

    constructor (game: Game) {
        super();

        this.msgType = MsgType.AliveCounts;
        this.allocBytes = 3;

        this.game = game;
    }

    serialize (stream: SurvivBitStream): void {
        super.serialize(stream);
        stream.writeUint8(1); // Team count (2 for 50v50, 1 for everything else)
        stream.writeUint8(this.game.aliveCount);
    }
}
