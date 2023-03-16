import { SendingPacket } from "../sendingPacket";
import { MsgType, type SurvivBitStream } from "../../utils";
import { type Player } from "../../game/objects/player";

export class UpdatePacket extends SendingPacket {

    constructor(p: Player) {
        super(p);
        this.allocBytes = 8192;
    }

    writeData(stream: SurvivBitStream): void {
        const p = this.p;

        let valuesChanged = 0;
        if(p.deletedObjects.length) valuesChanged += 1;
        if(p.fullDirtyObjects.length) valuesChanged += 2;
        if(p.activePlayerIdDirty) valuesChanged += 4;
        if(p.gasDirty) valuesChanged += 8;
        if(p.gasCircleDirty) valuesChanged += 16;
        if(p.game!.playerInfosDirty) valuesChanged += 32;
        if(p.game!.deletedPlayers.length) valuesChanged += 64;
        if(p.playerStatusDirty) valuesChanged += 128;
        if(p.groupStatusDirty) valuesChanged += 256;
        if(p.bulletsDirty) valuesChanged += 512;
        if(p.explosions.length) valuesChanged += 1024;
        if(p.emotes.length) valuesChanged += 2048;
        if(p.planesDirty) valuesChanged += 4096;
        if(p.airstrikeZonesDirty) valuesChanged += 8192;
        if(p.mapIndicatorsDirty) valuesChanged += 16384;
        if(p.killLeaderDirty) valuesChanged += 32768;

        stream.writeUint8(MsgType.Update);
        stream.writeUint16(valuesChanged);

        // Deleted objects
        if(p.deletedObjects.length) {
            stream.writeUint16(p.deletedObjects.length);
            for(const deletedObject of p.deletedObjects) {
                stream.writeUint16(deletedObject.id);
            }
            p.deletedObjects = [];
        }

        // Full objects
        if(p.fullDirtyObjects.length) {
            stream.writeUint16(p.fullDirtyObjects.length);
            for(const fullObject of p.fullDirtyObjects) {
                stream.writeUint8(fullObject.kind);
                stream.writeUint16(fullObject.id);
                fullObject.serializePartial(stream);
                fullObject.serializeFull(stream);
            }
            p.fullDirtyObjects = [];
        }

        // Partial objects
        stream.writeUint16(p.partialDirtyObjects.length);
        for(const partialObject of p.partialDirtyObjects) {
            stream.writeUint16(partialObject.id);
            partialObject.serializePartial(stream);
        }
        p.partialDirtyObjects = [];

        // Active player ID
        if(p.activePlayerIdDirty) {
            stream.writeUint16(p.id);
            p.activePlayerIdDirty = false;
        }

        // Active player data
        stream.writeBoolean(p.healthDirty);
        if(p.healthDirty) {
            stream.writeFloat(p.health, 0, 100, 8);
            p.healthDirty = false;
        }

        stream.writeBoolean(p.boostDirty); // Boost (adrenaline) dirty
        if(p.boostDirty) {
            stream.writeFloat(p.boost, 0, 100, 8);
            p.boostDirty = false;
        }

        stream.writeBits(0, 3); // Misc dirty

        stream.writeBoolean(p.zoomDirty); // Zoom dirty
        if(p.zoomDirty) {
            stream.writeUint8(p.zoom);
            p.zoomDirty = false;
        }

        stream.writeBoolean(false); // Action dirty
        stream.writeBoolean(false);//p.inventoryDirty); // Inventory dirty
        if(p.inventoryDirty) {

        }

        stream.writeBoolean(p.weaponsDirty); // Weapons dirty
        if(p.weaponsDirty) {
            stream.writeBits(2, 2); // Current weapon slot

            stream.writeGameType(0); // Primary
            stream.writeUint8(0); // Ammo

            stream.writeGameType(0); // Secondary
            stream.writeUint8(0); // Ammo

            stream.writeGameType(p.loadout.melee); // Melee
            stream.writeUint8(0); // Ammo

            stream.writeGameType(0); // Throwable
            stream.writeUint8(0); // Ammo
            p.weaponsDirty = false;
        }
        stream.writeBoolean(false); // Spectator count dirty
        stream.writeAlignToNextByte();

        // Red zone data
        if(p.gasDirty) {
            stream.writeUint8(p.game!.gasMode); // Mode
            stream.writeBits(p.game!.initialGasDuration, 8); // Duration
            stream.writeVec(p.game!.oldGasPosition, 0, 0, 1024, 1024, 16); // Old position
            stream.writeVec(p.game!.newGasPosition, 0, 0, 1024, 1024, 16); // New position
            stream.writeFloat(p.game!.oldGasRadius, 0, 2048, 16); // Old radius
            stream.writeFloat(p.game!.newGasRadius, 0, 2048, 16); // New radius
            p.gasDirty = false;
        }

        // Red zone time data
        if(p.gasCircleDirty) {
            stream.writeFloat(0, 0, 1, 16); // Indicates red zone time (gasT)
            p.gasCircleDirty = false;
        }

        // Player info
        let playerInfosSource;
        if(p.getAllPlayerInfos) {
            p.getAllPlayerInfos = false;
            playerInfosSource = p.game!.players;
        } else if(p.game!.playerInfosDirty) {
            playerInfosSource = p.game!.dirtyPlayers;
        }

        if(playerInfosSource) {
            stream.writeUint8(playerInfosSource.length); // Player info count

            for(const player of playerInfosSource) {
                // Basic info
                stream.writeUint16(player.id); // Player ID
                stream.writeUint8(player.teamId); // Team ID
                stream.writeUint8(player.groupId); // Group ID
                stream.writeString(player.name); // Name

                // Loadout
                stream.writeGameType(player.loadout.outfit); // Outfit (skin)
                stream.writeGameType(player.loadout.heal); // Healing particles
                stream.writeGameType(player.loadout.boost); // Adrenaline particles
                stream.writeGameType(player.loadout.melee); // Melee
                stream.writeGameType(player.loadout.deathEffect); // Death effect

                for(let i = 0; i < 6; i++) {
                    stream.writeGameType(player.loadout.emotes[i]);
                }

                // Misc
                stream.writeUint32(player.id); // User ID
                stream.writeBoolean(false); // Is unlinked (doesn't have account)
                stream.writeAlignToNextByte(); // Padding
            }
        }

        // Player IDs to delete
        if(p.game!.deletedPlayers.length > 0) {
            stream.writeUint8(p.game!.deletedPlayers.length);
            for(const player of p.game!.deletedPlayers) stream.writeUint16(player.id);
        }

        // Player status
        if(p.playerStatusDirty) {
            stream.writeUint8(1); // Player count

            stream.writeBoolean(true); // Has data

            stream.writeVec(p.position, 0, 0, 1024, 1024, 11); // Position. Yes, 11 bits is correct!
            stream.writeBoolean(true); // Visible
            stream.writeBoolean(false); // Dead
            stream.writeBoolean(false); // Downed

            stream.writeBoolean(false); // Has role

            stream.writeAlignToNextByte();

            p.playerStatusDirty = false;
        }

        // Group status

        // Bullets

        // Explosions
        if(p.explosions.length) {
            stream.writeUint8(p.explosions.length);
            for(const explosion of p.explosions) {
                stream.writeVec(explosion.position, 0, 0, 1024, 1024, 16);
                stream.writeGameType(explosion.type);
                stream.writeBits(explosion.layer, 2); // Layer
                stream.writeBits(0, 1); // Padding
                stream.writeAlignToNextByte();
            }
            p.explosions = [];
        }

        // Emotes
        if(p.emotes.length) {
            stream.writeUint8(p.emotes.length);
            for(const emote of p.emotes) {
                stream.writeUint16(emote.playerId);
                stream.writeGameType(emote.type);
                stream.writeGameType(0); // Item type
                stream.writeBoolean(emote.isPing);
                if(emote.isPing) stream.writeVec(emote.position, 0, 0, 1024, 1024, 16);
                stream.writeBits(0, 1); // Padding
            }
            p.emotes = [];
        }

        // Planes

        // Airstrike zones

        // Map indicators

        // Kill leader
        if(p.killLeaderDirty) {
            stream.writeUint16(p.id); // ID
            stream.writeUint8(84); // Kill count
            p.killLeaderDirty = false;
        }

        stream.writeUint8(0); // "Ack" msg
    }

}
