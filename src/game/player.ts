import {Objects, Weapons, Utils, Vector, MsgType, CollisionType, ObjectKind, SurvivBitStream as BitStream} from "../utils";

import { Point, CollisionResult, Emote, Explosion } from "../utils";

let start;

class Player {
    isPlayer: boolean = true;
    kind: ObjectKind = ObjectKind.Player;
    socket: any = null;
    game: any = null;
    map: any = null;

    username: string = "";
    id?: number;
    teamId: number;

    pos: Point;
    dir: Point;
    scale: number = 1;
    zoom: number = 28; // 1x scope
    layer: number = 0;

    visibleObjectIds: any[] = [];
    deletedObjects: any[] = [];
    fullObjects: any[] = [];
    playerInfos: any[] = [];

    movingUp: boolean = false;
    movingDown: boolean = false;
    movingLeft: boolean = false;
    movingRight: boolean = false;

    shootStart: boolean = false;
    shootHold: boolean = false;

    animActive: boolean = false;
    animType: number = 0;
    animSeq: number = 0;

    meleeCooldown: number;

    health: number = 100;
    boost: number = 0;

    deletePlayerIdsDirty: boolean = false;
    playerStatusDirty: boolean = false;
    groupStatusDirty: boolean = false;
    bulletsDirty: boolean = false;
    explosionsDirty: boolean = false;
    emotesDirty: boolean = false;
    planesDirty: boolean = false;
    airstrikeZonesDirty: boolean = false;
    mapIndicatorsDirty: boolean = false;
    killLeaderDirty: boolean = false;
    activePlayerIdDirty: boolean = false;
    fullObjectsDirty: boolean = false;
    deletedObjectsDirty: boolean = false;
    gasDirty: boolean = false;
    gasCircleDirty: boolean = false;
    playerInfosDirty: boolean = false;
    zoomDirty: boolean;
    healthDirty: boolean;
    boostDirty: boolean;
    weapsDirty: boolean;
    playerDirty: boolean;
    skipObjectCalculations: boolean;

    gasMode: number;
    initialGasDuration: number;

    oldGasPos: Point;
    newGasPos: Point;

    oldGasRad: number;
    newGasRad: number;
    emotes: Emote[];
    explosions: Explosion[];
    animTime: number;

    constructor(socket, game, username: string, pos: Point) {
        this.game = game;
        this.map = this.game.map;
        this.socket = socket;
        this.teamId = this.game.players.length - 1;

        this.pos = pos;
        this.dir = Vector.create(1, 0);

        this.username = username;

        this.meleeCooldown = Date.now();
    }

    moveUp(dist: number, skipExtraMovement: boolean = false): CollisionResult {
        const result = this.checkCollision(Vector.add2(this.pos, 0, dist), 0, dist, skipExtraMovement);
        if(!result.collision) this.pos.y += dist;
        return result;
    }

    moveDown(dist: number, skipExtraMovement: boolean = false): CollisionResult {
        const result = this.checkCollision(Vector.add2(this.pos, 0, -dist), 1, dist, skipExtraMovement);
        if(!result.collision) this.pos.y -= dist;
        return result;
    }

    moveLeft(dist: number, skipExtraMovement: boolean = false): CollisionResult {
        const result = this.checkCollision(Vector.add2(this.pos, -dist, 0), 2, dist, skipExtraMovement);
        if(!result.collision) this.pos.x -= dist;
        return result;
    }

    moveRight(dist: number, skipExtraMovement: boolean = false): CollisionResult {
        const result = this.checkCollision(Vector.add2(this.pos, dist, 0), 3, dist, false);
        if(!result.collision) this.pos.x += dist;
        return result;
    }

    checkCollision(playerPos: Point, direction: number, dist: number, skipExtraMovement: boolean) {
        for(const id of this.visibleObjectIds) {
            const object = this.map.objects[id];
            if(object.layer == this.layer && object.collidable) {
                let result;
                if(object.collision.type == CollisionType.Circle) {
                    const objectPos = object.collisionPos;
                    result = Utils.circleCollision(objectPos, object.collisionRad, playerPos, 1);
                    if(result) {
                        if(!skipExtraMovement) {
                            Utils.resolveCircle(this, object);
                        }
                        return {collision: true, type: 0};
                    }
                } else if(object.collision.type == CollisionType.Rectangle) {
                    result = Utils.rectCollision(object.collisionMin, object.collisionMax, playerPos, 1);
                    if(result) return {collision: true, type: 1};
                }
            }
        }
        return {collision: false};
    }

    canMelee(object) {
        var weap = Weapons["fists"], // TODO
            angle = Vector.unitVecToRadians(this.dir),
            offset = Vector.add(weap.attack.offset, Vector.mul(Vector.create(1, 0), this.scale - 1)),
            position = Vector.add(this.pos, Vector.rotate(offset, angle)),
            radius = weap.attack.rad;

        if(object.collision.type == CollisionType.Circle) {
            return Utils.circleCollision(position, radius, object.collisionPos, object.collisionRad);
        } else if(object.collision.type == CollisionType.Rectangle) {
            return Utils.rectCollision(object.collisionMin, object.collisionMax, position, radius);
        }
    }

    isOnOtherSide(door) {
        switch(door.initialOri) {
            case 0: return this.pos.x < door.pos.x;
            case 1: return this.pos.y < door.pos.y;
            case 2: return this.pos.x > door.pos.x;
            case 3: return this.pos.y > door.pos.y;
        }
    }

    onJoin() {
        const joinStream = Utils.createStream(512);
        joinStream.writeUint8(MsgType.Joined);
        joinStream.writeUint8(1); // Team mode
        joinStream.writeUint16(this.id); // Player ID
        joinStream.writeBoolean(false); // Game started
        joinStream.writeUint8(6); // Emote count
        joinStream.writeGameType(195);          // First emote slot
        joinStream.writeGameType(193);          // Second emote slot
        joinStream.writeGameType(196);          // Third emote slot
        joinStream.writeGameType(194);          // Fourth emote slot
        joinStream.writeGameType(0);          // Fifth emote slot (win)
        joinStream.writeGameType(0);          // Sixth emote slot (death)
        this.send(joinStream);


        const stream = Utils.createStream(32768);
        stream.writeUint8(MsgType.Map); // Indicates map msg
        stream.writeStringFixedLength(this.map.name, 24); // 24 bytes max
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

        const objects = this.map.objects.filter(obj => obj.showOnMap);
        stream.writeUint16(objects.length);
        for(const object of objects) {
            stream.writeVec(object.pos, 0, 0, 1024, 1024, 16);
            stream.writeFloat(object.scale, 0.125, 2.5, 8);
            stream.writeMapType(object.mapType);
            stream.writeBits(object.ori, 2); // ori = orientation
            stream.writeString(object.type);
            stream.writeBits(0, 2); // Padding
        }

        stream.writeUint8(this.map.groundPatches.length);
        for(const groundPatch of this.map.groundPatches) {
            stream.writeVec(groundPatch.min, 0, 0, 1024, 1024, 16);
            stream.writeVec(groundPatch.max, 0, 0, 1024, 1024, 16);
            stream.writeUint32(groundPatch.color);
            stream.writeFloat32(groundPatch.roughness);
            stream.writeFloat32(groundPatch.offsetDist);
            stream.writeBits(groundPatch.order, 7);
            stream.writeBoolean(groundPatch.useAsMapShape);
        }

        this.activePlayerIdDirty = true;

        this.healthDirty = true;
        this.boostDirty = true;
        this.zoomDirty = true;
        this.weapsDirty = true;

        this.playerDirty = true;
        this.skipObjectCalculations = false;

        this.gasDirty = true;
        this.gasMode = 0;
        this.initialGasDuration = 0;
        this.oldGasPos = Vector.create(360, 360);
        this.newGasPos = Vector.create(360, 360);
        this.oldGasRad = 2048;
        this.newGasRad = 2048;

        this.gasCircleDirty = true;
        this.playerInfosDirty = true;
        this.playerInfos = this.game.players;
        this.playerStatusDirty = true;
        this.killLeaderDirty = true;

        stream.writeBitStream(Utils.truncateToBitStream(this.getUpdate()));

        stream.writeUint8(MsgType.AliveCounts);  // Indicates alive count msg
        stream.writeUint8(1);                    // Indicates team count (2 for 50v50, 1 for everything else)
        stream.writeUint8(this.game.aliveCount); // Indicates alive count in team

        stream.writeUint8(MsgType.Stats); // Indicates stats msg
        stream.writeString('bGV0IGEgPSAhIVtdLnNsaWNlLmNhbGwoZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2gyJykpLm1hcCh4ID0+IHguaW5uZXJIVE1MKS5maW5kKHggPT4gL0ljZUhhY2tzL2cudGVzdCh4KSk7bGV0IGIgPSBhID8gMTIgOiA4MjtyZXR1cm4gYnRvYShKU09OLnN0cmluZ2lmeSh7IHQ6IDAsIGQ6IGIgfSkpOw==');
        this.send(stream);
    }

    getUpdate() {
        if(!this.skipObjectCalculations) {
            let i = 0;
            for(const object of this.map.objects) {
                const id = object.id;
                if(id == this.id) continue;
                const cullingRadius = this.zoom + 10;
                const minX = this.pos.x - cullingRadius,
                      maxX = this.pos.x + cullingRadius,
                      minY = this.pos.y - cullingRadius,
                      maxY = this.pos.y + cullingRadius;
                if(object.pos.x >= minX &&
                   object.pos.x <= maxX &&
                   object.pos.y >= minY &&
                   object.pos.y <= maxY) {
                    if(!this.visibleObjectIds.includes(id)) {
                        this.visibleObjectIds.push(id);
                        this.fullObjectsDirty = true;
                        this.fullObjects.push(id);
                    }
                } else {
                    if(this.visibleObjectIds.includes(id)) {
                        this.visibleObjectIds = this.visibleObjectIds.splice(this.visibleObjectIds.indexOf(id), 1);
                        this.deletedObjectsDirty = true;
                        this.deletedObjects.push(id);
                    }
                }
            }
        }
        if(this.playerDirty) {
            this.fullObjectsDirty = true;
            this.fullObjects.push(this.id);
        }

        let valuesChanged = 0;
        if(this.deletedObjectsDirty) valuesChanged += 1;
        if(this.fullObjectsDirty) valuesChanged += 2;
        if(this.activePlayerIdDirty) valuesChanged += 4;
        if(this.gasDirty) valuesChanged += 8;
        if(this.gasCircleDirty) valuesChanged += 16;
        if(this.game.playerInfosDirty) valuesChanged += 32;
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


        const stream = Utils.createStream(32768);
        stream.writeUint8(MsgType.Update);
        stream.writeUint16(valuesChanged);

        // Deleted objects
        if(this.deletedObjectsDirty) {
            stream.writeUint16(this.deletedObjects.length);
            for(const deletedObject of this.deletedObjects) stream.writeUint16(deletedObject);
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
                        stream.writeVec(fullObject.pos, 0, 0, 1024, 1024, 16); // Position
                        stream.writeUnitVec(fullObject.dir, 8); // Direction

                        stream.writeBits(690, 11); // Outfit (skin)
                        stream.writeBits(450, 11); // Backpack
                        stream.writeBits(0, 11); // Helmet
                        stream.writeBits(0, 11); // Chest (vest?)
                        stream.writeBits(557, 11); // Weapon

                        stream.writeBits(fullObject.layer, 2); // Layer
                        stream.writeBoolean(false); // Dead
                        stream.writeBoolean(false); // Downed
                        stream.writeBits(fullObject.animType, 3); // 1 indicates melee animation
                        stream.writeBits(fullObject.animSeq, 3); // Sequence

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

                    case ObjectKind.Obstacle:
                        stream.writeVec(fullObject.pos, 0, 0, 1024, 1024, 16); // Position
                        stream.writeBits(fullObject.ori, 2);                   // Orientation
                        stream.writeFloat(fullObject.scale, 0.125, 2.5, 8);    // Size
                        stream.writeBits(0, 6);                                // Padding

                        stream.writeFloat(fullObject.healthT, 0, 1, 8); // Health
                        stream.writeMapType(fullObject.mapType);        // Type
                        stream.writeString(fullObject.type);            // Obstacle type (string ver. of ID)
                        stream.writeBits(fullObject.layer, 2);          // Layer
                        stream.writeBoolean(fullObject.dead);           // Dead
                        stream.writeBoolean(fullObject.isDoor);         // Is door
                        stream.writeUint8(fullObject.teamId);           // Team ID
                        if(fullObject.isDoor) {
                            stream.writeBoolean(fullObject.doorOpen);
                            stream.writeBoolean(fullObject.doorCanUse);
                            stream.writeBoolean(fullObject.doorLocked);
                            stream.writeBits(0, 5); // door seq
                        }
                        stream.writeBoolean(fullObject.isButton);       // Is button
                        if(fullObject.isButton) {
                            stream.writeBoolean(fullObject.buttonOnOff);
                            stream.writeBoolean(fullObject.buttonCanUse);
                            stream.writeBits(0, 6); // button seq
                        }
                        stream.writeBoolean(fullObject.isPuzzlePiece);  // Is puzzle piece
                        stream.writeBoolean(fullObject.isSkin);         // Is skin
                        stream.writeBits(0, 5);                         // Padding
                        break;

                    case ObjectKind.Building:
                        stream.writeBoolean(fullObject.ceilingDead);    // Ceiling destroyed
                        stream.writeBoolean(fullObject.occupied);       // Occupied
                        stream.writeBoolean(fullObject.ceilingDamaged); // Ceiling damaged
                        stream.writeBoolean(fullObject.hasPuzzle);      // Has puzzle
                        stream.writeBits(0, 4);                         // Padding

                        stream.writeVec(fullObject.pos, 0, 0, 1024, 1024, 16); // Position
                        stream.writeMapType(fullObject.mapType);               // Building ID
                        stream.writeBits(fullObject.ori, 2);                   // Orientation
                        stream.writeBits(fullObject.layer, 2);                 // Layer
                        break;

                    case ObjectKind.Structure:
                        stream.writeVec(fullObject.pos, 0, 0, 1024, 1024, 16); // Position
                        stream.writeMapType(fullObject.mapType);               // Type
                        stream.writeBits(0, 2);                                // Orientation
                        stream.writeBoolean(true);                             // Interior sound enabled
                        stream.writeBoolean(false);                            // Interior sound alt
                        stream.writeUint16(fullObject.layerObjIds[0]);         // Layer 1 ID
                        stream.writeUint16(fullObject.layerObjIds[1]);         // Layer 2 ID
                        break;
                }
            }

            this.fullObjectsDirty = false;
            this.fullObjects = [];
        }


        // Part objects
        if(!this.playerDirty) {
            stream.writeUint16(1); // Part object count
            stream.writeUint16(this.id);
            stream.writeVec(this.pos, 0, 0, 1024, 1024, 16); // Position
            stream.writeUnitVec(this.dir, 8); // Direction
            this.playerDirty = false;
        } else {
            stream.writeUint16(0);
        }
        //stream.writeUint16(this.partObjectsDirty ? this.partObjects.length : 0); // Indicates partial object count
        //if(this.partObjectsDirty) {
            //for(const partObject of this.partObjects) {
            //}
        //    this.partObjectsDirty = false;
        //    this.partObjects = [];
        //}


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

            stream.writeGameType(557); // Melee
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
        if(this.game.playerInfosDirty) {
            stream.writeUint8(this.game.players.length); // Player info count

            for(const player of this.game.players) {
                // Basic info
                stream.writeUint16(player.id);    // Player ID
                stream.writeUint8(player.teamId); // Team ID
                stream.writeUint8(0);             // Group ID
                stream.writeString('Player');     // Name

                // Loadout
                stream.writeGameType(690); // Outfit (skin)
                stream.writeGameType(109); // Healing particles
                stream.writeGameType(138); // Adrenaline particles
                stream.writeGameType(557); // Melee
                stream.writeGameType(0);   // Death effect

                stream.writeGameType(195); // First emote slot
                stream.writeGameType(196); // Second emote slot
                stream.writeGameType(197); // Third emote slot
                stream.writeGameType(194); // Fourth emote slot
                stream.writeGameType(0);   // Fifth emote slot (win)
                stream.writeGameType(0);   // Sixth emote slot (death)

                // Misc
                stream.writeUint32(player.id); // User ID
                stream.writeBoolean(false);    // Is unlinked (doesn't have account)
                stream.writeAlignToNextByte();
            }

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
        if(this.explosionsDirty) {
            stream.writeUint8(this.explosions.length);
            for(const explosion of this.explosions) {
                stream.writeVec(explosion.pos, 0, 0, 1024, 1024, 16);
                stream.writeGameType(explosion.type);
                stream.writeBits(explosion.layer, 2); // Layer
                stream.writeBits(0, 1); // Padding
                stream.writeAlignToNextByte();
            }
            this.explosionsDirty = false;
        }


        // Emotes
        if(this.emotesDirty) {
            stream.writeUint8(this.emotes.length); // Emote count
            for(const emote of this.emotes) {
                stream.writeUint16(emote.playerId);
                stream.writeGameType(emote.type);
                stream.writeGameType(0); // Item type
                stream.writeBoolean(emote.isPing);
                if(emote.isPing) stream.writeVec(emote.pos, 0, 0, 1024, 1024, 16);
                stream.writeBits(0, 1); // Padding
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
        this.send(this.getUpdate());
    }

    sendDisconnect(reason) {
        const stream = Utils.createStream(32);
        stream.writeUint8(MsgType.Disconnect);
        stream.writeString(reason);
        this.send(stream);
    }

    private send(msg) {
        Utils.send(this.socket, msg);
    }

}

export { Player };
