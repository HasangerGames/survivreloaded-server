import { Packet } from "./packet";
import { MsgType, SurvivBitStream as BitStream } from "../utils";
import { Player } from "../game/objects/player";

export class UpdatePacket extends Packet {

    constructor(p: Player) {
        super(p);
        this.allocBytes = 16384;
    }

    writeData(stream: BitStream): void {
        if(!this.p.skipObjectCalculations) {
            for(const object of this.p.map.objects) {
                const id = object.id;
                if(id == this.p.id) continue;
                const cullingRadius = this.p.zoom + 15;
                const minX = this.p.position.x - cullingRadius,
                    maxX = this.p.position.x + cullingRadius,
                    minY = this.p.position.y - cullingRadius,
                    maxY = this.p.position.y + cullingRadius;
                if(object.position.x >= minX &&
                    object.position.x <= maxX &&
                    object.position.y >= minY &&
                    object.position.y <= maxY) {
                    if(!this.p.visibleObjects.includes(id)) {
                        this.p.visibleObjects.push(id);
                        this.p.fullObjects.push(id);
                    }
                } else {
                    const index: number = this.p.visibleObjects.indexOf(id);
                    if(index != -1) {
                        this.p.visibleObjects = this.p.visibleObjects.splice(index, 1);
                        this.p.deletedObjectsDirty = true;
                        this.p.deletedObjects.push(id);
                    }
                }
            }
        }

        let valuesChanged = 0;
        if(this.p.deletedObjectsDirty) valuesChanged += 1;
        if(this.p.fullObjects.length) valuesChanged += 2;
        if(this.p.activePlayerIdDirty) valuesChanged += 4;
        if(this.p.gasDirty) valuesChanged += 8;
        if(this.p.gasCircleDirty) valuesChanged += 16;
        if(this.p.game!.playerInfosDirty) valuesChanged += 32;
        if(this.p.deletedPlayerIdsDirty) valuesChanged += 64;
        if(this.p.playerStatusDirty) valuesChanged += 128;
        if(this.p.groupStatusDirty) valuesChanged += 256;
        if(this.p.bulletsDirty) valuesChanged += 512;
        if(this.p.explosionsDirty) valuesChanged += 1024;
        if(this.p.emotesDirty) valuesChanged += 2048;
        if(this.p.planesDirty) valuesChanged += 4096;
        if(this.p.airstrikeZonesDirty) valuesChanged += 8192;
        if(this.p.mapIndicatorsDirty) valuesChanged += 16384;
        if(this.p.killLeaderDirty) valuesChanged += 32768;

        stream.writeUint8(MsgType.Update);
        stream.writeUint16(valuesChanged);

        // Deleted objects
        if(this.p.deletedObjectsDirty) {
            stream.writeUint16(this.p.deletedObjects.length);
            for(const deletedObject of this.p.deletedObjects) stream.writeUint16(deletedObject);
            this.p.deletedObjectsDirty = false;
            this.p.deletedObjects = [];
        }


        // Full objects
        if(this.p.fullObjects.length) {
            stream.writeUint16(this.p.fullObjects.length); // Full object count

            for(const id of this.p.fullObjects) {
                const fullObject = this.p.map.objects[id];
                stream.writeUint8(fullObject.kind);
                stream.writeUint16(fullObject.id);
                fullObject.serializePart(stream);
                fullObject.serializeFull(stream);
            }
            this.p.fullObjects = [];
        }


        // Partial objects
        stream.writeUint16(this.p.partialObjects.length); // Indicates partial object count
        for(const id of this.p.partialObjects) {
            const partialObject = this.p.map.objects[id];
            stream.writeUint16(partialObject.id);
            partialObject.serializePart(stream);
        }
        this.p.partialObjects = [];


        // Active player ID
        if(this.p.activePlayerIdDirty) {
            stream.writeUint16(this.p.id);
            this.p.activePlayerIdDirty = false;
        }


        // Active player data
        stream.writeBoolean(this.p.healthDirty);
        if(this.p.healthDirty) {
            stream.writeFloat(this.p.health, 0, 100, 8);
            this.p.healthDirty = false;
        }

        stream.writeBoolean(this.p.boostDirty); // Boost (adrenaline) dirty
        if(this.p.boostDirty) {
            stream.writeFloat(this.p.boost, 0, 100, 8);
            this.p.boostDirty = false;
        }

        stream.writeBits(0, 3);     // Misc dirty
        stream.writeBoolean(this.p.zoomDirty); // Zoom dirty
        if(this.p.zoomDirty) {
            stream.writeUint8(this.p.zoom);
            this.p.zoomDirty = false;
        }
        stream.writeBoolean(false); // Action dirty
        stream.writeBoolean(false); // Inventory dirty
        stream.writeBoolean(this.p.weaponsDirty); // Weapons dirty
        if(this.p.weaponsDirty) {
            stream.writeBits(2, 2); // Current weapon slot

            stream.writeGameType(0); // Primary
            stream.writeUint8(0); // Ammo

            stream.writeGameType(0); // Secondary
            stream.writeUint8(0); // Ammo

            stream.writeGameType(this.p.loadout.melee); // Melee
            stream.writeUint8(0); // Ammo

            stream.writeGameType(0); // Throwable
            stream.writeUint8(0); // Ammo
            this.p.weaponsDirty = false;
        }
        stream.writeBoolean(false); // Spectator count dirty
        stream.writeAlignToNextByte();


        // Red zone data
        if(this.p.gasDirty) {
            stream.writeUint8(this.p.game!.gasMode); // Mode
            stream.writeBits(this.p.game!.initialGasDuration, 8); // Duration
            stream.writeVec(this.p.game!.oldGasPosition, 0, 0, 1024, 1024, 16); // Old position
            stream.writeVec(this.p.game!.newGasPosition, 0, 0, 1024, 1024, 16); // New position
            stream.writeFloat(this.p.game!.oldGasRadius, 0, 2048, 16); // Old radius
            stream.writeFloat(this.p.game!.newGasRadius, 0, 2048, 16); // New radius
            this.p.gasDirty = false;
        }


        // Red zone time data
        if(this.p.gasCircleDirty) {
            stream.writeFloat(0, 0, 1, 16); // Indicates red zone time (gasT)
            this.p.gasCircleDirty = false;
        }


        // Player info
        let playerInfosSource: Player[];
        if(this.p.getAllPlayerInfos) {
            this.p.getAllPlayerInfos = false;
            playerInfosSource = this.p.game!.players;
        } else if(this.p.game!.playerInfosDirty) {
            playerInfosSource = this.p.game!.dirtyPlayers;
        }
        // @ts-ignore
        if(playerInfosSource) {
            stream.writeUint8(playerInfosSource.length); // Player info count

            for(const player of playerInfosSource) {
                // Basic info
                stream.writeUint16(player.id);    // Player ID
                stream.writeUint8(0);       // Team ID
                stream.writeUint8(player.groupId); // Group ID
                stream.writeString(player.username); // Name

                // Loadout
                stream.writeGameType(player.loadout.outfit); // Outfit (skin)
                stream.writeGameType(player.loadout.heal); // Healing particles
                stream.writeGameType(player.loadout.boost); // Adrenaline particles
                stream.writeGameType(player.loadout.melee); // Melee
                stream.writeGameType(player.loadout.deathEffect);   // Death effect

                for(let i = 0; i < 6; i++)
                    stream.writeGameType(player.loadout.emotes[i]);

                // Misc
                stream.writeUint32(player.id);    // User ID
                stream.writeBoolean(false); // Is unlinked (doesn't have account)
                stream.writeAlignToNextByte();    // Padding
            }
        }


        // Player IDs to delete
        if(this.p.game!.deletedPlayerIds.length > 0) {
            stream.writeUint8(this.p.game!.deletedPlayerIds.length);
            for(const id of this.p.game!.deletedPlayerIds) stream.writeUint16(id);
        }


        // Player status
        if(this.p.playerStatusDirty) {
            stream.writeUint8(1); // Player count

            stream.writeBoolean(true); // Has data

            stream.writeVec(this.p.position, 0, 0, 1024, 1024, 11); // Position. Yes, 11 bits is correct!
            stream.writeBoolean(true); // Visible
            stream.writeBoolean(false); // Dead
            stream.writeBoolean(false); // Downed

            stream.writeBoolean(false); // Has role

            stream.writeAlignToNextByte();

            this.p.playerStatusDirty = false;
        }


        // Group status


        // Bullets


        // Explosions
        if(this.p.explosionsDirty) {
            stream.writeUint8(this.p.explosions.length);
            for(const explosion of this.p.explosions) {
                stream.writeVec(explosion.position, 0, 0, 1024, 1024, 16);
                stream.writeGameType(explosion.type);
                stream.writeBits(explosion.layer, 2); // Layer
                stream.writeBits(0, 1); // Padding
                stream.writeAlignToNextByte();
            }
            this.p.explosionsDirty = false;
        }


        // Emotes
        if(this.p.emotesDirty) {
            stream.writeUint8(this.p.emotes.length); // Emote count
            for(const emote of this.p.emotes) {
                stream.writeUint16(emote.playerId);
                stream.writeGameType(emote.type);
                stream.writeGameType(0); // Item type
                stream.writeBoolean(emote.isPing);
                if(emote.isPing) stream.writeVec(emote.position, 0, 0, 1024, 1024, 16);
                stream.writeBits(0, 1); // Padding
            }
            this.p.emotesDirty = false;
        }


        // Planes


        // Airstrike zones


        // Map indicators


        // Kill leader
        if(this.p.killLeaderDirty) {
            stream.writeUint16(this.p.id); // ID
            stream.writeUint8(84); // Kill count
            this.p.killLeaderDirty = false;
        }


        stream.writeUint8(0); // "Ack" msg
    }

}
