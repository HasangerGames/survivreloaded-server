import { SendingPacket } from "../sendingPacket";
import { Constants, MsgType, type SurvivBitStream } from "../../utils";
import { type Player } from "../../game/objects/player";

export class UpdatePacket extends SendingPacket {

    constructor(p: Player) {
        super(p);
        this.msgType = MsgType.Update;
        this.allocBytes = 8192;
    }

    serialize(stream: SurvivBitStream): void {
        super.serialize(stream);
        const p = this.p!;

        let valuesChanged = 0;
        if(p.deletedObjects.length) valuesChanged += 1;
        if(p.fullDirtyObjects.length) valuesChanged += 2;
        if(p.activePlayerIdDirty) valuesChanged += 4;
        if(p.game!.gasDirty || p.firstUpdate) valuesChanged += 8;
        if(p.game!.gasCircleDirty || p.firstUpdate) valuesChanged += 16;
        if(p.game!.playerInfosDirty) valuesChanged += 32;
        if(p.game!.deletedPlayers.length) valuesChanged += 64;
        if(/*p.game!.dirtyStatusPlayers.length || */p.firstUpdate) valuesChanged += 128;
        if(p.groupStatusDirty) valuesChanged += 256;
        if(p.bulletsDirty) valuesChanged += 512;
        if(p.explosions.length) valuesChanged += 1024;
        if(p.emotes.length) valuesChanged += 2048;
        if(p.planesDirty) valuesChanged += 4096;
        if(p.airstrikeZonesDirty) valuesChanged += 8192;
        if(p.mapIndicatorsDirty) valuesChanged += 16384;
        if(p.game!.killLeaderDirty || p.firstUpdate) valuesChanged += 32768;
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

        //
        // Active player data
        //

        // Health
        stream.writeBoolean(p.healthDirty);
        if(p.healthDirty) {
            stream.writeFloat(p.health, 0, 100, 8);
            p.healthDirty = false;
        }

        // Adrenaline
        stream.writeBoolean(p.boostDirty);
        if(p.boostDirty) {
            stream.writeFloat(p.boost, 0, 100, 8);
            p.boostDirty = false;
        }

        // Misc
        stream.writeBits(0, 3); // Misc dirty

        // Zoom
        stream.writeBoolean(p.zoomDirty);
        if(p.zoomDirty) {
            stream.writeUint8(p.zoom);
            p.zoomDirty = false;
        }

        stream.writeBoolean(false); // Action dirty

        // Inventory
        stream.writeBoolean(p.inventoryDirty);
        if(p.inventoryDirty) {
            stream.writeGameType(p.activeItems.scope.typeId);
            for(const value of Object.values(p.inventory)) {
                const hasItem: boolean = (value as number) > 0;
                stream.writeBoolean(hasItem);
                if(hasItem) stream.writeBits(value as number, 9);
            }
        }

        // Weapons
        stream.writeBoolean(p.weaponsDirty);
        if(p.weaponsDirty) {
            // Current weapon slot
            stream.writeBits(2, 2);

            // Primary
            stream.writeGameType(p.activeItems.primaryGun.typeId); // Primary
            stream.writeUint8(p.activeItems.primaryGun.ammo); // Ammo

            // Secondary
            stream.writeGameType(p.activeItems.secondaryGun.typeId); // Secondary
            stream.writeUint8(p.activeItems.secondaryGun.ammo); // Ammo

            // Melee
            stream.writeGameType(p.activeItems.melee.typeId);
            stream.writeUint8(0);

            // Throwable
            stream.writeGameType(p.activeItems.throwable.typeId);
            stream.writeUint8(p.activeItems.throwable.count);

            p.weaponsDirty = false;
        }

        stream.writeBoolean(false); // Spectator count dirty
        stream.writeAlignToNextByte(); // Padding

        //
        // End active player data
        //

        // Red zone data
        if(p.game!.gasDirty || p.firstUpdate) {
            stream.writeUint8(p.game!.gasMode); // Mode
            stream.writeBits(p.game!.initialGasDuration, 8); // Duration
            stream.writeVec(p.game!.oldGasPosition, 0, 0, 1024, 1024, 16); // Old position
            stream.writeVec(p.game!.newGasPosition, 0, 0, 1024, 1024, 16); // New position
            stream.writeFloat(p.game!.oldGasRadius, 0, 2048, 16); // Old radius
            stream.writeFloat(p.game!.newGasRadius, 0, 2048, 16); // New radius
        }

        // Red zone time data
        if(p.game!.gasCircleDirty || p.firstUpdate) {
            stream.writeFloat(0, 0, 1, 16); // Indicates red zone time (gasT)
        }

        // Player info
        let playerInfosSource;
        if(p.firstUpdate) {
            playerInfosSource = p.game!.players;
        } else if(p.game!.playerInfosDirty) {
            playerInfosSource = p.game!.newPlayers;
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

                for(let i = 0; i < Constants.EmoteSlot.Count; i++) {
                    stream.writeGameType(player.loadout.emotes[i]);
                }

                // Misc
                stream.writeUint32(player.id); // User account ID
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
        //const dirtyStatusPlayers: Player[] = p.game!.dirtyStatusPlayers;
        //if(p.firstUpdate) dirtyStatusPlayers.push(p);
        //if(dirtyStatusPlayers.length) {
        if(p.firstUpdate) {
            stream.writeUint8(1); // Player count

            //for(const player of dirtyStatusPlayers) {
            stream.writeBoolean(true); // Has data

            stream.writeVec(p.position, 0, 0, 1024, 1024, 11); // Position. Yes, 11 bits is correct!
            stream.writeBoolean(true); // Visible
            stream.writeBoolean(p.dead); // Dead
            stream.writeBoolean(p.downed); // Downed

            stream.writeBoolean(p.role !== 0); // Has role
            if(p.role !== 0) stream.writeGameType(p.role);

            stream.writeAlignToNextByte();
            //}
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
        if(p.game!.killLeaderDirty || p.firstUpdate) {
            stream.writeUint16(p.game!.killLeader.id);
            stream.writeUint8(p.game!.killLeader.kills);
        }

        if(p.firstUpdate) p.firstUpdate = false;

        stream.writeUint8(0); // "Ack" msg
    }

}
