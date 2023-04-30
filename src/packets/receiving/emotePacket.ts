import { ReceivingPacket } from "../receivingPacket";
import type { SurvivBitStream } from "../../utils/survivBitStream";
import { Emote } from "../../utils/misc";

export class EmotePacket extends ReceivingPacket {
    deserialize (stream: SurvivBitStream): void {
        const position = stream.readVec(0, 0, 1024, 1024, 16);
        const type = stream.readGameType();
        const isPing = stream.readBoolean();
        stream.readBits(4); // Padding

        if (!this.p.dead) this.p.game.emotes.add(new Emote(this.p.id, position, type, isPing));
    }
}
