const {Utils, Vector, MsgType, ObjectKind} = require('../utils.js');
const {BitStream} = require('bit-buffer');

class Player {

    constructor(socket, username, map, pos) {
        this.isPlayer = true;
        this.socket = socket;
        this.username = username;
        this.map = map;

        this.kind = ObjectKind.Player;

        this.pos = pos;
        this.dir = new Vector(1, 0);
        this.zoom = 28; // 1x scope
        this.layer = 0;
        this.visibleObjectIds = [];

        this.deletedObjectsDirty = false;
        this.deletedObjects = [];
        this.fullObjectsDirty = false;
        this.fullObjects = [];
        this.activePlayerIdDirty = false;
        this.gasDirty = false;
        this.gasCircleDirty = false;
        this.playerInfosDirty = false;
        this.deletePlayerIdsDirty = false;
        this.playerStatusDirty = false;
        this.groupStatusDirty = false;
        this.bulletsDirty = false;
        this.explosionsDirty = false;
        this.emotesDirty = false;
        this.planesDirty = false;
        this.airstrikeZonesDirty = false;
        this.mapIndicatorsDirty = false;
        this.killLeaderDirty = false;

        this.movingUp = false;
        this.movingDown = false;
        this.movingLeft = false;
        this.movingRight = false;
        this.shootStart = false;
        this.shootHold = false;

        this.animActive = false;
        this.animType = 0;
        this.animSeq = 0;

        this.health = 100;
        this.boost = 0;
    }

    onJoin() {
        const joinStream = Utils.createStream(512);
        joinStream.writeUint8(MsgType.Joined);
        joinStream.writeUint8(1); // Team mode
        joinStream.writeUint16(this.id); // Player ID
        joinStream.writeBoolean(false); // Game started
        joinStream.writeUint8(6); // Emote count
        joinStream.writeGameType(195);          // First emote slot
        joinStream.writeGameType(328);          // Second emote slot
        joinStream.writeGameType(336);          // Third emote slot
        joinStream.writeGameType(194);          // Fourth emote slot
        joinStream.writeGameType(297);          // Fifth emote slot (win)
        joinStream.writeGameType(333);          // Sixth emote slot (death)
        Utils.send(this.socket, joinStream);

        const stream = Utils.createStream(32768);

        stream.writeUint8(MsgType.Map); // Indicates map msg
        stream.writeString(this.map.name, 24); // 24 bytes max
        stream.writeUint32(this.map.seed);
        stream.writeUint16(this.map.width);
        stream.writeUint16(this.map.height);
        stream.writeUint16(this.map.shoreInset);
        stream.writeUint16(this.map.grassInset);

        stream.writeUint8(this.map.rivers.length);
        for(const river of this.map.rivers) {
            stream.writeBits(river.width, 8);
            stream.writeUint8(river.looped);

            stream.writeUint8(river.points.length);
            for(const point of river.points) {
                stream.writeVec(point, 0, 0, 1024, 1024, 16);
            }
        }

        stream.writeUint8(this.map.places.length);
        for(const place of this.map.places) {
            stream.writeString(place.name);
            stream.writeVec(place.pos, 0, 0, 1024, 1024, 16);
        }

        const objects = this.map.objects.filter(obj => !obj.isPlayer);
        stream.writeUint16(objects.length);
        for(const object of objects) {
            stream.writeVec(object.pos, 0, 0, 1024, 1024, 16);
            stream.writeFloat(object.scale, 0.125, 2.5, 8);
            stream.writeMapType(object.type); // mapType
            stream.writeBits(object.ori, 2); // ori = orientation
            stream.writeString(object.obstacleType);
            stream.writeBits(0, 2); // zeroes
        }

        stream.writeUint8(this.map.groundPatches.length);
        for(const groundPatch of this.map.groundPatches) {
            //stream.writeVec(groundPatch.min, 0, 0, 1024, 1024, 16);
            //stream.writeVec(groundPatch.max, 0, 0, 1024, 1024, 16);
            //stream.writeUint32(groundPatch.color);
            // TODO
        }

        this.activePlayerIdDirty = true;

        this.healthDirty = true;
        this.boostDirty = true;
        this.zoomDirty = true;
        this.weapsDirty = true;

        this.gasDirty = true;
        this.gasMode = 0;
        this.initialGasDuration = 0;
        this.oldGasPos = new Vector(360, 360);
        this.newGasPos = new Vector(360, 360);
        this.oldGasRad = 2048;
        this.newGasRad = 2048;

        this.gasCircleDirty = true;
        this.playerInfosDirty = true;
        this.playerStatusDirty = true;
        this.killLeaderDirty = true;

        stream.writeBitStream(Utils.truncateToBitStream(this.getUpdate()));

        stream.writeUint8(MsgType.AliveCounts); // Indicates alive count msg
        stream.writeUint8(1); // Indicates team count
        stream.writeUint8(1); // Indicates alive count in team

        stream.writeUint8(MsgType.Stats); // Indicates stats msg
        stream.writeString('bGV0IGEgPSAhIVtdLnNsaWNlLmNhbGwoZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2gyJykpLm1hcCh4ID0+IHguaW5uZXJIVE1MKS5maW5kKHggPT4gL0ljZUhhY2tzL2cudGVzdCh4KSk7bGV0IGIgPSBhID8gMTIgOiA4MjtyZXR1cm4gYnRvYShKU09OLnN0cmluZ2lmeSh7IHQ6IDAsIGQ6IGIgfSkpOw==');
        Utils.send(this.socket, stream);
    }

    getUpdate() {

        for(const object of this.map.objects) {
            const id = object.id;
            const cullingRadius = 8;
            /*const minX = this.pos.x - cullingRadius,
                  maxX = this.pos.x + cullingRadius,
                  minY = this.pos.y - cullingRadius,
                  maxY = this.pos.y + cullingRadius;*/
            if(Utils.distanceBetween(object.pos, this.pos) <= cullingRadius) { /*object.pos.x >= minX && object.pos.x <= maxX && object.pos.y >= minY && object.pos.y <= maxY && object.layer == this.layer*/
                if(!this.visibleObjectIds.includes(id)) {
                    console.log('Adding');
                    this.visibleObjectIds.push(id);
                    this.fullObjectsDirty = true;
                    this.fullObjects.push(id);
                }
            } else {
                if(this.visibleObjectIds.includes(id)) {
                    console.log('Removing');
                    this.visibleObjectIds = this.visibleObjectIds.remove(id);
                    this.deletedObjectsDirty = true;
                    this.deletedObjects.push(id);
                }
            }
        }
        this.fullObjectsDirty = true;
        this.fullObjects.push(this.id);

        let valuesChanged = 0;
        if(this.deletedObjectsDirty) valuesChanged += 1;
        if(this.fullObjectsDirty) valuesChanged += 2;
        if(this.activePlayerIdDirty) valuesChanged += 4;
        if(this.gasDirty) valuesChanged += 8;
        if(this.gasCircleDirty) valuesChanged += 16;
        if(this.playerInfosDirty) valuesChanged += 32;
        if(this.deletePlayerIdsDirty) valuesChanged += 64;
        if(this.playerStatusDirty) valuesChanged += 128;
        if(this.groupStatusDirty) valuesChanged += 256;
        if(this.bulletsDirty) valuesChanged += 512;
        if(this.explosionsDirty) valuesChanged += 1024;
        if(this.emotesDirty) valuesChanged += 2048;
        if(this.planesDirty) valuesChanged += 4096;
        if(this.airstrikeZonesDirty) valuesChanged += 8192;
        if(this.mapIndicatorsDirty) valuesChanged += 16384;
        if(this.killLeaderDirty) valuesChanged += 32768;


        const stream = Utils.createStream(16384);
        stream.writeUint8(6);  // Indicates update msg
        stream.writeUint16(valuesChanged);

        // Deleted objects
        if(this.deletedObjectsDirty) {
            stream.writeUint16(this.deletedObjects.length); // Deleted object count
            for(const deletedObject of this.deletedObjects) stream.writeUint16(deletedObject.id);
            this.deletedObjectsDirty = false;
            this.deletedObjects = [];
        }


        // Full objects
        if(this.fullObjectsDirty) {
            stream.writeUint16(this.fullObjects.length); // Full object count

            for(const id of this.fullObjects) {
                const fullObject = this.map.objects[id];
                stream.writeUint8(fullObject.kind);
                stream.writeUint16(fullObject.id);

                switch(fullObject.kind) {
                    case ObjectKind.Player:
                        stream.writeVec(this.pos, 0, 0, 1024, 1024, 16); // Position
                        stream.writeUnitVec(this.dir, 8); // Direction

                        stream.writeBits(740, 11); // Outfit (skin)
                        stream.writeBits(450, 11); // Backpack
                        stream.writeBits(0, 11); // Helmet
                        stream.writeBits(0, 11); // Chest (vest?)
                        stream.writeBits(666, 11); // Weapon

                        stream.writeBits(0, 2); // Layer
                        stream.writeBoolean(false); // Dead
                        stream.writeBoolean(false); // Downed
                        stream.writeBits(this.animType, 3); // 1 indicates melee animation
                        stream.writeBits(this.animSeq, 3); // Sequence

                        stream.writeBits(0, 3); // Action type
                        stream.writeBits(0, 3); // Action sequence

                        stream.writeBoolean(false); // Wearing pan
                        stream.writeBoolean(false); // Indoors
                        stream.writeBoolean(false); // Gun loaded
                        stream.writeBoolean(false); // Passive heal
                        stream.writeBoolean(false); // Heal by item effect (healing particles?)

                        stream.writeBoolean(false); // Haste seq dirty

                        stream.writeBoolean(false); // Action item dirty

                        stream.writeBoolean(false); // Scale dirty

                        stream.writeBoolean(false); // Role dirty

                        stream.writeBoolean(false); // Perks dirty

                        stream.writeBits(0, 4); // Event-specific effects

                        stream.writeAlignToNextByte();
                        break;

                    // Obstacle
                    case ObjectKind.Obstacle:
                        stream.writeVec(fullObject.pos, 0, 0, 1024, 1024, 16); // Position
                        stream.writeBits(fullObject.ori, 2);                   // Orientation
                        stream.writeFloat(fullObject.scale, 0.125, 2.5, 8);    // Size
                        stream.writeBits(0, 6);                                // Zeroes

                        stream.writeFloat(fullObject.healthT, 0, 1, 8); // Health
                        stream.writeMapType(fullObject.type);       // Type
                        stream.writeString(fullObject.obstacleType);    // Obstacle type (string ver. of ID)
                        stream.writeBits(fullObject.layer, 2);          // Layer
                        stream.writeBoolean(fullObject.dead);           // Dead
                        stream.writeBoolean(fullObject.isDoor);         // Is door
                        stream.writeUint8(fullObject.teamId);           // Team ID
                        stream.writeBoolean(fullObject.isButton);       // Is button
                        stream.writeBoolean(fullObject.isPuzzlePiece);  // Is puzzle piece
                        stream.writeBoolean(fullObject.isSkin);         // Is skin
                        stream.writeBits(0, 5);                         // Zeroes
                        break;
                }
            }

            // Invalid: 0
            // Player: 1
            // Obstacle: 2
            // Loot: 3
            // LootSpawner: 4
            // DeadBody: 5
            // Building: 6
            // Structure: 7
            // Decal: 8
            // Projectile: 9
            // Smoke: 10
            // Airdrop: 11
            // Npc: 12
            // Skitternade: 13


            // Obstacle
            /*stream.writeUint8(2);     // Object type: Obstacle
            stream.writeUint16(3400); // ID

            stream.writeVec(new Vector(160, 160), 0, 0, 1024, 1024, 16); // Position
            stream.writeBits(0, 2);                                      // Orientation
            stream.writeFloat(1, 0.125, 2.5, 8);                         // Size
            stream.writeBits(0, 6);                                      // Zeroes

            stream.writeFloat(1, 0, 1, 8); // Health
            stream.writeBits(329, 12);     // Type
            stream.writeString('tree_01'); // Obstacle type (barrel, furniture, crate, airdrop, locker, pot, toilet, sink, vending, window)
            stream.writeBits(0, 2);        // Layer
            stream.writeBoolean(false);    // Dead
            stream.writeBoolean(false);    // Is door
            stream.writeUint8(0);          // Team ID
            stream.writeBoolean(false);    // Is button
            stream.writeBoolean(false);    // Is puzzle piece
            stream.writeBoolean(false);    // Is skin
            stream.writeBits(0, 5);        // Zeroes*/

            // Obstacle
            /*stream.writeUint8(2);     // Object type: Obstacle
            stream.writeUint16(3402); // ID

            stream.writeVec(new Vector(122, 120), 0, 0, 1024, 1024, 16); // Position
            stream.writeBits(2, 2);                                      // Orientation
            stream.writeFloat(1, 0.125, 2.5, 8);                         // Size
            stream.writeBits(0, 6);                                      // Zeroes

            stream.writeFloat(1, 0, 1, 8); // Health
            stream.writeBits(320, 12);     // Type
            stream.writeString('toilet_01'); // Obstacle type (barrel, furniture, crate, airdrop, locker, pot, toilet, sink, vending, window)
            stream.writeBits(0, 2);        // Layer
            stream.writeBoolean(false);    // Dead
            stream.writeBoolean(false);    // Is door
            stream.writeUint8(0);          // Team ID
            stream.writeBoolean(false);    // Is button
            stream.writeBoolean(false);    // Is puzzle piece
            stream.writeBoolean(false);    // Is skin
            stream.writeBits(0, 5);        // Zeroes*/

            // Building
            /*stream.writeUint8(6);     // Object type: Building
            stream.writeUint16(3477); // ID

            stream.writeBoolean(false); // Ceiling dead
            stream.writeBoolean(false); // Occupied
            stream.writeBoolean(false); // Ceiling damaged
            stream.writeBoolean(false); // Has puzzle
            stream.writeBits(0, 4);     // Zeroes

            stream.writeVec(new Vector(130, 130), 0, 0, 1024, 1024, 16); // Position
            stream.writeBits(723, 12);                                   // Type
            stream.writeBits(0, 2);                                      // Orientation
            stream.writeBits(0, 2);                                      // Layer

            // Building
            stream.writeUint8(6);     // Object type: Building
            stream.writeUint16(3478); // ID

            stream.writeBoolean(false); // Ceiling dead
            stream.writeBoolean(false); // Occupied
            stream.writeBoolean(false); // Ceiling damaged
            stream.writeBoolean(false); // Has puzzle
            stream.writeBits(0, 4);     // Zeroes

            stream.writeVec(new Vector(130, 130), 0, 0, 1024, 1024, 16); // Position
            stream.writeBits(723, 12);                                   // Type
            stream.writeBits(0, 2);                                      // Orientation
            stream.writeBits(0, 2);                                      // Layer

            // Structure
            stream.writeUint8(7);     // Object type: Structure
            stream.writeUint16(3479); // ID

            stream.writeVec(new Vector(130, 130), 0, 0, 1024, 1024, 16); // Position
            stream.writeMapType(859);                                    // Type
            stream.writeBits(0, 2);                                      // Orientation
            stream.writeBoolean(true); // Interior sound enabled
            stream.writeBoolean(false); // Interior sound alt
            stream.writeUint16(3477); // Layer 1 ID
            stream.writeUint16(3478); // Layer 2 ID*/

            this.fullObjectsDirty = false;
            this.fullObjects = [];
        }


        // Part objects
        stream.writeUint16(this.partObjectsDirty ? this.partObjects.length : 0); // Indicates part object count
        if(this.partObjectsDirty) {
            for(const partObject of this.partObjects) {
                stream.writeUint16(0); // Object type: Player
                stream.writeVec(this.pos, 0, 0, 1024, 1024, 16); // Position
                stream.writeUnitVec(this.dir, 8); // Direction
            }
        }


        // Active player ID
        if(this.activePlayerIdDirty) {
            stream.writeUint16(this.id);
            this.activePlayerIdDirty = false;
        }


        // Active player data
        stream.writeBoolean(this.healthDirty);
        if(this.healthDirty) {
            stream.writeFloat(this.health, 0, 100, 8);
            this.healthDirty = false;
        }

        stream.writeBoolean(this.boostDirty); // Boost (adrenaline) dirty
        if(this.boostDirty) {
            stream.writeFloat(this.boost, 0, 100, 8);
            this.boostDirty = false;
        }

        stream.writeBits(0, 3);     // Misc dirty
        stream.writeBoolean(this.zoomDirty); // Zoom dirty
        if(this.zoomDirty) {
            stream.writeUint8(this.zoom);
            this.zoomDirty = false;
        }
        stream.writeBoolean(false); // Action dirty
        stream.writeBoolean(false); // Inventory dirty
        stream.writeBoolean(this.weapsDirty); // Weapons dirty
        if(this.weapsDirty) {
            stream.writeBits(2, 2); // Current weapon slot

            stream.writeGameType(0); // Primary
            stream.writeUint8(0); // Ammo

            stream.writeGameType(0); // Secondary
            stream.writeUint8(0); // Ammo

            stream.writeGameType(666); // Melee
            stream.writeUint8(0); // Ammo

            stream.writeGameType(0); // Throwable
            stream.writeUint8(0); // Ammo
            this.weapsDirty = false;
        }
        stream.writeBoolean(false); // Spectator count dirty
        stream.writeAlignToNextByte();


        // Red zone data
        if(this.gasDirty) {
            stream.writeUint8(this.gasMode); // Mode
            stream.writeBits(this.initialGasDuration, 8); // Duration
            stream.writeVec(this.oldGasPos, 0, 0, 1024, 1024, 16); // Old position
            stream.writeVec(this.newGasPos, 0, 0, 1024, 1024, 16); // New position
            stream.writeFloat(this.oldGasRad, 0, 2048, 16); // Old radius
            stream.writeFloat(this.newGasRad, 0, 2048, 16); // New radius
            this.gasDirty = false;
        }


        // Red zone time data
        if(this.gasCircleDirty) {
            stream.writeFloat(0, 0, 1, 16); // Indicates red zone time (gasT)
            this.gasCircleDirty = false;
        }


        // Player info
        if(this.playerInfosDirty) {
            stream.writeUint8(1); // Player info count

            // Basic info
            stream.writeUint16(this.id);           // Player ID
            stream.writeUint8(0);               // Team ID
            stream.writeUint8(0);               // Group ID
            stream.writeString('Kris Kringle'); // Name

            // Loadout
            stream.writeGameType(740);          // Outfit (skin)
            stream.writeGameType(114);          // Healing particles
            stream.writeGameType(145);          // Adrenaline particles
            stream.writeGameType(666);          // Melee
            stream.writeGameType(1060);         // Death effect

            stream.writeGameType(195);          // First emote slot
            stream.writeGameType(328);          // Second emote slot
            stream.writeGameType(336);          // Third emote slot
            stream.writeGameType(194);          // Fourth emote slot
            stream.writeGameType(297);          // Fifth emote slot (win)
            stream.writeGameType(333);          // Sixth emote slot (death)

            // Misc
            stream.writeUint32(0);              // User ID
            stream.writeBoolean(false);         // Is unlinked (doesn't have account)
            stream.writeAlignToNextByte();
            this.playerInfosDirty = false;
        }


        // Player IDs to delete
        if(this.deletePlayerIdsDirty) {
            this.deletePlayerIdsDirty = false;
            // TODO
        }


        // Player status
        if(this.playerStatusDirty) {
            stream.writeUint8(1); // Player count

            stream.writeBoolean(true); // Has data

            stream.writeVec(this.pos, 0, 0, 1024, 1024, 11); // Position
            stream.writeBoolean(true); // Visible
            stream.writeBoolean(false); // Dead
            stream.writeBoolean(false); // Downed

            stream.writeBoolean(false); // Has role

            stream.writeAlignToNextByte();

            this.playerStatusDirty = false;
        }


        // Group status


        // Bullets


        // Explosions


        // Emotes
        if(this.emotesDirty) {
            stream.writeUint8(this.emotes.length); // Emote count
            for(const emote of this.emotes) {
                stream.writeUint16(emote.playerId);
                stream.writeGameType(emote.type);
                stream.writeGameType(0); // Item type
                stream.writeBoolean(emote.isPing);
                if(emote.isPing) stream.writeVec(emote.pos, 0, 0, 1024, 1024, 16);
                stream.writeBits(0, 1); // Zero
            }
            this.emotesDirty = false;
        }


        // Planes


        // Airstrike zones


        // Map indicators


        // Kill leader
        if(this.killLeaderDirty) {
            stream.writeUint16(this.id); // ID
            stream.writeUint8(84);    // Kill count
            this.killLeaderDirty = false;
        }


        stream.writeUint8(0); // "Ack" msg

        return stream;
    }

    sendUpdate() {
        Utils.send(this.socket, this.getUpdate());
    }

}

module.exports.Player = Player;
