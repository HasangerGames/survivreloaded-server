import { ReceivingPacket } from "../receivingPacket";
import { Emote, type SurvivBitStream } from "../../utils";

export class EmotePacket extends ReceivingPacket {

    deserialize(stream: SurvivBitStream): void {
        const position = stream.readVec(0, 0, 1024, 1024, 16);
        const type = stream.readGameType();
        const isPing = stream.readBoolean();
        stream.readBits(4); // Padding

        if(!this.p.dead) this.p.game!.emotes.push(new Emote(this.p.id, position, type, isPing));
    }

}
