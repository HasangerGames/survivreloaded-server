import { SendingPacket } from "../sendingPacket";
import { MsgType } from "../../utils/constants";
import type { SurvivBitStream } from "../../utils/survivBitStream";
import { type Emote } from "../../utils/misc";
import { type Player } from "../../game/objects/player";
import { type GameObject } from "../../game/gameObject";
import { type Explosion } from "../../game/explosion";

export class UpdatePacket extends SendingPacket {
    constructor (p: Player) {
        super(p);
        this.msgType = MsgType.Update;
        this.allocBytes = 16384;
    }

    serialize (stream: SurvivBitStream): void {
        super.serialize(stream);
        const p = this.p!;
        const game = p.game;

        let valuesChanged = 0;
        if (p.deletedObjects.size) valuesChanged += 1;
        if (p.fullDirtyObjects.size) valuesChanged += 2;
        if (p.activePlayerIdDirty) valuesChanged += 4;
        if (game.gasDirty || p.fullUpdate) valuesChanged += 8;
        if (game.gasCircleDirty || p.fullUpdate) valuesChanged += 16;
        if (game.playerInfosDirty) valuesChanged += 32;
        if (game.deletedPlayers.size) valuesChanged += 64;
        if (/* game.dirtyStatusPlayers.length || */p.fullUpdate) valuesChanged += 128;
        if (p.groupStatusDirty) valuesChanged += 256;
        if (game.newBullets.size) valuesChanged += 512;
        if (p.explosions.size) valuesChanged += 1024;
        if (p.emotes.size) valuesChanged += 2048;
        if (p.planesDirty) valuesChanged += 4096;
        if (p.airstrikeZonesDirty) valuesChanged += 8192;
        if (p.mapIndicatorsDirty) valuesChanged += 16384;
        if (game.killLeaderDirty || p.fullUpdate) valuesChanged += 32768;
        stream.writeUint16(valuesChanged);

        // Deleted objects
        if (p.deletedObjects.size) {
            stream.writeUint16(p.deletedObjects.size);
            for (const deletedObject of p.deletedObjects) {
                stream.writeUint16(deletedObject.id);
            }
            p.deletedObjects = new Set<GameObject>();
        }

        // Full objects
        if (p.fullDirtyObjects.size) {
            stream.writeUint16(p.fullDirtyObjects.size);
            for (const fullObject of p.fullDirtyObjects) {
                stream.writeUint8(fullObject.kind);
                stream.writeUint16(fullObject.id);
                fullObject.serializePartial(stream);
                fullObject.serializeFull(stream);
            }
            p.fullDirtyObjects = new Set<GameObject>();
        }

        // Partial objects
        stream.writeUint16(p.partialDirtyObjects.size);
        for (const partialObject of p.partialDirtyObjects) {
            stream.writeUint16(partialObject.id);
            partialObject.serializePartial(stream);
        }
        p.partialDirtyObjects = new Set<GameObject>();

        // Active player ID
        if (p.activePlayerIdDirty) {
            stream.writeUint16(p.id);
            p.activePlayerIdDirty = false;
        }

        //
        // Active player data
        //

        // Health
        stream.writeBoolean(p.healthDirty);
        if (p.healthDirty) {
            stream.writeFloat(p.health, 0, 100, 8);
            p.healthDirty = false;
        }

        // Adrenaline
        stream.writeBoolean(p.boostDirty);
        if (p.boostDirty) {
            stream.writeFloat(p.boost, 0, 100, 8);
            p.boostDirty = false;
        }

        // Zoom
        stream.writeBoolean(p.zoomDirty);
        if (p.zoomDirty) {
            stream.writeUint8(p.zoom);
            p.zoomDirty = false;
        }

        // Action
        stream.writeBoolean(p.actionDirty);
        if (p.actionDirty) {
            stream.writeFloat(p.actionItem.duration - ((p.actionItem.useEnd - Date.now()) / 1000), 0, 8.5, 8);
            stream.writeFloat(p.actionItem.duration, 0, 8.5, 8);
            stream.writeUint16(p.id); // Target ID (set to ID of the player being revived if reviving)
        }

        // Inventory
        stream.writeBoolean(p.inventoryDirty);
        if (p.inventoryDirty) {
            stream.writeGameType(p.scope.typeId);
            for (const value of Object.values(p.inventory)) {
                const hasItem: boolean = (value) > 0;
                stream.writeBoolean(hasItem);
                if (hasItem) stream.writeBits(value, 9);
            }
            p.inventoryDirty = false;
        }

        // Weapons
        stream.writeBoolean(p.weaponsDirty);
        if (p.weaponsDirty) {
            // Current weapon slot
            stream.writeBits(p.selectedWeaponSlot, 2);

            // Primary
            stream.writeGameType(p.weapons[0].typeId);
            stream.writeUint8(p.weapons[0].ammo);

            // Secondary
            stream.writeGameType(p.weapons[1].typeId);
            stream.writeUint8(p.weapons[1].ammo);

            // Melee
            stream.writeGameType(p.weapons[2].typeId);
            stream.writeUint8(0);

            // Throwable
            stream.writeGameType(p.weapons[3].typeId);
            stream.writeUint8(p.weapons[3].count);

            p.weaponsDirty = false;
        }

        // Spectator count
        stream.writeBoolean(p.spectatorCountDirty);
        if (p.spectatorCountDirty) {
            stream.writeUint8(p.spectators.size);
            p.spectatorCountDirty = false;
        }

        stream.writeAlignToNextByte(); // Padding

        //
        // End active player data
        //

        // Red zone data
        if (game.gasDirty || p.fullUpdate) {
            stream.writeUint8(game.gas.mode);
            stream.writeFloat32(game.gas.initialDuration);
            stream.writeVec(game.gas.posOld, 0, 0, 1024, 1024, 16);
            stream.writeVec(game.gas.posNew, 0, 0, 1024, 1024, 16);
            stream.writeFloat(game.gas.radOld, 0, 2048, 16);
            stream.writeFloat(game.gas.radNew, 0, 2048, 16);
        }

        // Red zone time data
        if (game.gasCircleDirty || p.fullUpdate) {
            stream.writeFloat(game.gas.duration, 0, 1, 16);
        }

        // Player info
        let playerInfosSource;
        if (p.fullUpdate) {
            playerInfosSource = game.players;
        } else if (game.playerInfosDirty) {
            playerInfosSource = game.newPlayers;
        }
        if (playerInfosSource) {
            stream.writeUint8(playerInfosSource.size); // Player info count

            for (const player of playerInfosSource) {
                // Basic info
                stream.writeUint16(player.id); // Player ID
                stream.writeUint8(player.teamId); // Team ID
                stream.writeUint8(player.groupId); // Group ID
                stream.writeString(player.name); // Name

                // Loadout
                stream.writeGameType(player.loadout.heal); // Healing particles
                stream.writeGameType(player.loadout.boost); // Adrenaline particles
                stream.writeAlignToNextByte(); // Padding
            }
        }

        // Player IDs to delete
        if (game.deletedPlayers.size > 0) {
            stream.writeUint8(game.deletedPlayers.size);
            for (const player of game.deletedPlayers) stream.writeUint16(player.id);
        }

        // Player status
        // const dirtyStatusPlayers: Player[] = p.firstUpdate ? game.players : game.dirtyStatusPlayers;
        // if(dirtyStatusPlayers.length) {
        if (p.fullUpdate) {
            // stream.writeUint8(dirtyStatusPlayers.length); // Player count
            stream.writeUint8(1);
            // for(const player of dirtyStatusPlayers) {
            stream.writeBoolean(true); // Has data

            stream.writeVec(p.position, 0, 0, 1024, 1024, 11); // Position. Yes, 11 bits is correct!
            stream.writeBoolean(true); // Visible
            stream.writeBoolean(p.dead); // Dead
            stream.writeBoolean(p.downed); // Downed

            stream.writeBoolean(p.role !== 0); // Has role
            if (p.role !== 0) stream.writeGameType(p.role);
            // }
            stream.writeAlignToNextByte();
        }

        // Group status

        // Bullets
        if (game.newBullets.size) {
            stream.writeUint8(game.newBullets.size);
            for (const bullet of game.newBullets) {
                stream.writeUint16(bullet.shooter.id);
                stream.writeVec(bullet.position, 0, 0, 1024, 1024, 16);
                stream.writeUnitVec(bullet.direction, 8);
                stream.writeGameType(bullet.typeId);
                stream.writeBits(bullet.layer, 2);
                stream.writeFloat(bullet.varianceT, 0, 1, 4);
                stream.writeBits(bullet.distAdjIdx, 4);
                stream.writeBoolean(bullet.clipDistance);
                if (bullet.clipDistance) {
                    stream.writeFloat(bullet.maxDistance, 0, 1024, 16);
                }
                stream.writeBoolean(bullet.shotFx);
                if (bullet.shotFx) {
                    stream.writeGameType(bullet.shotSource.typeId);
                    stream.writeBoolean(bullet.shotOffhand);
                    stream.writeBoolean(bullet.lastShot);
                }
                stream.writeBoolean(bullet.reflect);
                if (bullet.reflect) {
                    stream.writeBits(bullet.reflectCount, 2);
                    stream.writeUint16(bullet.reflectObjId);
                }
                stream.writeBoolean(bullet.splinter);
                if (bullet.splinter) {
                    stream.writeBoolean(bullet.splinterSmall);
                }
                stream.writeBoolean(bullet.trailFx);
                if (bullet.trailFx) {
                    stream.writeBoolean(bullet.trailSaturated);
                    stream.writeBoolean(bullet.trailThick);
                }
            }
            stream.writeAlignToNextByte();
        }

        // Explosions
        if (p.explosions.size) {
            stream.writeUint8(p.explosions.size);
            for (const explosion of p.explosions) {
                stream.writeVec(explosion.position, 0, 0, 1024, 1024, 16);
                stream.writeGameType(explosion.typeId);
                stream.writeBits(explosion.layer, 2); // Layer
                stream.writeBits(0, 1); // Padding
                stream.writeAlignToNextByte();
            }
            if (p.explosions.size) p.explosions = new Set<Explosion>();
        }

        // Emotes
        if (p.emotes.size) {
            stream.writeUint8(p.emotes.size);
            for (const emote of p.emotes) {
                stream.writeUint16(emote.playerId);
                stream.writeGameType(emote.type as any); // hack unsafe
                stream.writeGameType(0); // Item type
                stream.writeBoolean(emote.isPing);
                if (emote.isPing) stream.writeVec(emote.position, 0, 0, 1024, 1024, 16);
                stream.writeBits(0, 3); // Padding
            }
            if (p.emotes.size) p.emotes = new Set<Emote>();
        }

        // Planes

        // Airstrike zones

        // Map indicators

        // Kill leader
        if (game.killLeaderDirty || p.fullUpdate) {
            stream.writeUint16(game.killLeader.id);
            stream.writeUint8(game.killLeader.kills);
        }

        if (p.fullUpdate) p.fullUpdate = false;

        stream.writeUint8(0); // "Ack" msg
    }
}
