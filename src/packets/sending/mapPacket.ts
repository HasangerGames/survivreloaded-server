import { SendingPacket } from "../sendingPacket";
import { MsgType, type SurvivBitStream } from "../../utils";
import { type Player } from "../../game/objects/player";

export class MapPacket extends SendingPacket {

    constructor(p: Player) {
        super(p);
        this.msgType = MsgType.Map;
        this.allocBytes = 16384;
    }

    serialize(stream: SurvivBitStream): void {
        super.serialize(stream);

        const p: Player = this.p!;

        stream.writeStringFixedLength(p.map.name, 24); // 24 bytes max
        stream.writeUint32(p.map.seed);
        stream.writeUint16(p.map.width);
        stream.writeUint16(p.map.height);
        stream.writeUint16(p.map.shoreInset);
        stream.writeUint16(p.map.grassInset);

        stream.writeUint8(p.map.rivers.length);
        for(const river of p.map.rivers) {
            stream.writeFloat32(river.width);
            stream.writeUint8(river.looped);

            stream.writeUint8(river.points.length);
            for(const point of river.points) {
                stream.writeVec(point, 0, 0, 1024, 1024, 16);
            }
        }

        stream.writeUint8(p.map.places.length);
        for(const place of p.map.places) {
            stream.writeString(place.name);
            stream.writeVec(place.position, 0, 0, 1024, 1024, 16);
        }

        const objects = p.game!.objects.filter(obj => obj.showOnMap);
        stream.writeUint16(objects.length);
        for(const obj of objects) {
            stream.writeVec(obj.position, 0, 0, 1024, 1024, 16);
            stream.writeFloat(obj.scale, 0.125, 2.5, 8);
            stream.writeMapType(obj.typeId);
            stream.writeBits(obj.orientation!, 2);
            stream.writeBits(0, 2); // Padding
        }

        // Outfit, pack, helmet, chest, melee, 0, false, false, animType, animSeq, actionSeq, actionType, actionItem, false, false, false, false, false, false, 0, "", [], false, (50, 50), (0, -1)

        stream.writeUint8(p.map.groundPatches.length);
        for(const groundPatch of p.map.groundPatches) {
            stream.writeVec(groundPatch.min, 0, 0, 1024, 1024, 16);
            stream.writeVec(groundPatch.max, 0, 0, 1024, 1024, 16);
            stream.writeUint32(groundPatch.color);
            stream.writeFloat32(groundPatch.roughness);
            stream.writeFloat32(groundPatch.offsetDist);
            stream.writeBits(groundPatch.order, 7);
            stream.writeBoolean(groundPatch.useAsMapShape);
        }
    }

}
