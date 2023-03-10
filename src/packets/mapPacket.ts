import { Packet } from "./packet";
import { MsgType, SurvivBitStream } from "../utils";
import { Player } from "../game/objects/player";

export class MapPacket extends Packet {

    constructor(p: Player) {
        super(p);
        this.allocBytes = 16384;
    }

    writeData(stream: SurvivBitStream): void {
        stream.writeUint8(MsgType.Map); // Indicates map msg
        stream.writeStringFixedLength(this.p.map.name, 24); // 24 bytes max
        stream.writeUint32(this.p.map.seed);
        stream.writeUint16(this.p.map.width);
        stream.writeUint16(this.p.map.height);
        stream.writeUint16(this.p.map.shoreInset);
        stream.writeUint16(this.p.map.grassInset);

        stream.writeUint8(this.p.map.rivers.length);
        for(const river of this.p.map.rivers) {
            stream.writeBits(river.width, 8);
            stream.writeUint8(river.looped);

            stream.writeUint8(river.points.length);
            for(const point of river.points) {
                stream.writeVec(point, 0, 0, 1024, 1024, 16);
            }
        }

        stream.writeUint8(this.p.map.places.length);
        for(const place of this.p.map.places) {
            stream.writeString(place.name);
            stream.writeVec(place.position, 0, 0, 1024, 1024, 16);
        }

        const objects = this.p.map.objects.filter(obj => obj.showOnMap);
        stream.writeUint16(objects.length);
        for(const obj of objects) {
            stream.writeVec(obj.position, 0, 0, 1024, 1024, 16);
            stream.writeFloat(obj.scale, 0.125, 2.5, 8);
            stream.writeMapType(obj.typeId);
            stream.writeBits(obj.orientation, 2);
            stream.writeString(obj.typeString);
            stream.writeBits(0, 2); // Padding
        }

        stream.writeUint8(this.p.map.groundPatches.length);
        for(const groundPatch of this.p.map.groundPatches) {
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
