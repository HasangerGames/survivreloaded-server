// noinspection TypeScriptValidateJSTypes

import Matter from "matter-js";

import {
    CollisionCategory,
    DamageType,
    Emote,
    Explosion,
    MsgType,
    ObjectKind,
    Point,
    Utils,
    Vector,
    Weapons
} from "../../utils";
import { BitStream } from "bit-buffer";
import { DeadBody } from "./deadBody";

class Player {
    kind: ObjectKind = ObjectKind.Player;
    socket: any = null;
    game: any = null;
    map: any = null;

    username: string = "Player";
    id: number;
    //teamId: number = 0; // For 50v50?
    groupId: number;

    dir: Point;
    scale: number = 1;
    zoom: number = 28; // 1x scope
    layer: number = 0;

    visibleObjects: any[] = [];
    deletedObjects: any[] = [];
    fullObjects: number[] = [];
    partialObjects: number[] = [];

    movingUp: boolean = false;
    movingDown: boolean = false;
    movingLeft: boolean = false;
    movingRight: boolean = false;
    notMoving: boolean = true;

    shootStart: boolean = false;
    shootHold: boolean = false;

    animActive: boolean = false;
    animType: number = 0;
    animSeq: number = 0;
    animTime: number = 0;

    meleeCooldown: number;

    private _health: number = 100;
    boost: number = 0;
    kills: number = 0;
    dead: boolean = false;

    deletedPlayerIdsDirty: boolean = false;
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
    deletedObjectsDirty: boolean = false;
    gasDirty: boolean = false;
    gasCircleDirty: boolean = false;
    zoomDirty: boolean;
    healthDirty: boolean;
    boostDirty: boolean;
    weapsDirty: boolean;
    playerDirty: boolean;
    skipObjectCalculations: boolean;
    getAllPlayerInfos: boolean = true;

    gasMode: number;
    initialGasDuration: number;

    oldGasPos: Point;
    newGasPos: Point;

    oldGasRad: number;
    newGasRad: number;
    emotes: Emote[];
    explosions: Explosion[];

    body: Matter.Body;
    deadBody: DeadBody;

    quit: boolean = false;

    constructor(socket, game, username: string, pos: Point) {
        this.game = game;
        this.map = this.game.map;
        this.socket = socket;
        this.groupId = this.game.players.length - 1;

        this.dir = Vector.create(1, 0);

        this.username = username;

        this.meleeCooldown = Date.now();

        this.body = Matter.Bodies.circle(pos.x, pos.y, 1, { restitution: 0, friction: 0, frictionAir: 0, inertia: Infinity });
        this.body.collisionFilter.category = CollisionCategory.Player;
        this.body.collisionFilter.mask = CollisionCategory.Obstacle;
        this.game.addBody(this.body);
    }


    setVelocity(xVel: number, yVel: number) {
        Matter.Body.setVelocity(this.body, { x: xVel, y: yVel });
    }

    get pos(): Point {
        return this.body.position;
    }

    get health(): number {
        return this._health;
    }

    damage(source, amount: number): void {
        this._health -= amount;
        this.healthDirty = true;
        if(this._health < 0) this._health = 0;
        if(this._health == 0) {
            this.dead = true;
            this.game.aliveCount--;
            if(source instanceof Player) source.kills++;
            this.sendKill(source, this);
            source.sendKill(source, this);
            this.fullObjects.push(this.id);
            this.deadBody = new DeadBody(this.map.objects.length, this.pos, this.layer, this.id);
            this.map.objects.push(this.deadBody);
            this.game.fullDirtyObjects.push(this.id);
            this.game.fullDirtyObjects.push(this.deadBody.id);
            this.game.deletedPlayerIds.push(this.id);
            this.game.deletedPlayerIdsDirty = true;
        }
    }

    meleeCollisionWith(gameObject): Matter.Collision {
        if(!gameObject.body) return false;
        const weap = Weapons["fists"], // TODO Get player's melee, substitute here
              angle = Vector.unitVecToRadians(this.dir),
              offset = Vector.add(weap.attack.offset, Vector.mul(Vector.create(1, 0), this.scale - 1)),
              position = Vector.add(this.pos, Vector.rotate(offset, angle));
        const body: Matter.Body = Matter.Bodies.circle(position.x, position.y, 0.9, {
            collisionFilter: {
                category: CollisionCategory.Other,
                mask: CollisionCategory.Obstacle
            }
        });
        return Matter.Collision.collides(body, gameObject.body);
    }

    isOnOtherSide(door) {
        switch(door.ori) {
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
        for(const obj of objects) {
            stream.writeVec(obj.pos, 0, 0, 1024, 1024, 16);
            stream.writeFloat(obj.scale, 0.125, 2.5, 8);
            stream.writeMapType(obj.mapType);
            stream.writeBits(obj.ori, 2); // ori = orientation
            stream.writeString(obj.type);
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
        this.getAllPlayerInfos = true;
        this.playerStatusDirty = true;
        this.killLeaderDirty = true;
        this.fullObjects.push(this.id);

        stream.writeBitStream(Utils.truncateToBitStream(this.getUpdate()));

        stream.writeUint8(MsgType.AliveCounts);  // Indicates alive count msg
        stream.writeUint8(1);              // Indicates team count (2 for 50v50, 1 for everything else)
        stream.writeUint8(this.game.aliveCount); // Indicates alive count in team

        //stream.writeUint8(MsgType.Stats); // Indicates stats msg
        //stream.writeString('bGV0IGEgPSAhIVtdLnNsaWNlLmNhbGwoZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2gyJykpLm1hcCh4ID0+IHguaW5uZXJIVE1MKS5maW5kKHggPT4gL0ljZUhhY2tzL2cudGVzdCh4KSk7bGV0IGIgPSBhID8gMTIgOiA4MjtyZXR1cm4gYnRvYShKU09OLnN0cmluZ2lmeSh7IHQ6IDAsIGQ6IGIgfSkpOw==');
        this.send(stream);
    }

    private getUpdate(): BitStream {
        if(!this.skipObjectCalculations) {
            for(const object of this.map.objects) {
                const id = object.id;
                if(id == this.id) continue;
                const cullingRadius = this.zoom + 15;
                const minX = this.pos.x - cullingRadius,
                      maxX = this.pos.x + cullingRadius,
                      minY = this.pos.y - cullingRadius,
                      maxY = this.pos.y + cullingRadius;
                if(object.pos.x >= minX &&
                   object.pos.x <= maxX &&
                   object.pos.y >= minY &&
                   object.pos.y <= maxY) {
                    if(!this.visibleObjects.includes(id)) {
                        this.visibleObjects.push(id);
                        this.fullObjects.push(id);
                    }
                } else {
                    if(this.visibleObjects.includes(id)) {
                        this.visibleObjects = this.visibleObjects.splice(this.visibleObjects.indexOf(id), 1);
                        this.deletedObjectsDirty = true;
                        this.deletedObjects.push(id);
                    }
                }
            }
        }

        let valuesChanged = 0;
        if(this.deletedObjectsDirty) valuesChanged += 1;
        if(this.fullObjects.length) valuesChanged += 2;
        if(this.activePlayerIdDirty) valuesChanged += 4;
        if(this.gasDirty) valuesChanged += 8;
        if(this.gasCircleDirty) valuesChanged += 16;
        if(this.game.playerInfosDirty) valuesChanged += 32;
        if(this.deletedPlayerIdsDirty) valuesChanged += 64;
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
        if(this.fullObjects.length) {
            stream.writeUint16(this.fullObjects.length); // Full object count

            for(const id of this.fullObjects) {
                const fullObject = this.map.objects[id];
                stream.writeUint8(fullObject.kind);
                stream.writeUint16(fullObject.id);

                switch(fullObject.kind) {
                    case ObjectKind.Player:
                        stream.writeVec(fullObject.pos, 0, 0, 1024, 1024, 16); // Position
                        stream.writeUnitVec(fullObject.dir, 8); // Direction

                        stream.writeGameType(690); // Outfit (skin)
                        stream.writeGameType(450); // Backpack
                        stream.writeGameType(0); // Helmet
                        stream.writeGameType(0); // Chest (vest?)
                        stream.writeGameType(557); // Weapon

                        stream.writeBits(fullObject.layer, 2); // Layer
                        stream.writeBoolean(fullObject.dead); // Dead
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

                    case ObjectKind.DeadBody:
                        stream.writeVec(fullObject.pos, 0, 0, 1024, 1024, 16);
                        stream.writeUint8(fullObject.layer);
                        stream.writeUint16(fullObject.playerId);
                        break;
                }
            }
            this.fullObjects = [];
        }


        // Partial objects
        stream.writeUint16(this.partialObjects.length); // Indicates partial object count
        for(const id of this.partialObjects) {
            const partialObject = this.map.objects[id];
            stream.writeUint16(partialObject.id);
            switch(partialObject.kind) {
                case ObjectKind.Player:
                    stream.writeVec(partialObject.pos, 0, 0, 1024, 1024, 16);
                    stream.writeUnitVec(partialObject.dir, 8);
                    break;
                case ObjectKind.Obstacle:
                    stream.writeVec(partialObject.pos, 0, 0, 1024, 1024, 16);
                    stream.writeBits(partialObject.ori, 2);
                    stream.writeFloat(partialObject.scale, 0.125, 2.5, 8);
                    stream.writeBits(0, 6); // Padding
                    break;
                case ObjectKind.DeadBody:
                    stream.writeVec(partialObject.pos, 0, 0, 1024, 1024, 16);
                    break;
            }
        }
        this.partialObjects = [];


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
        let playerInfosSource: Player[];
        if(this.getAllPlayerInfos) {
            this.getAllPlayerInfos = false;
            playerInfosSource = this.game.players;
        } else if(this.game.playerInfosDirty) {
            playerInfosSource = this.game.dirtyPlayers;
        }
        if(playerInfosSource) {
            stream.writeUint8(playerInfosSource.length); // Player info count

            for(const player of playerInfosSource) {
                // Basic info
                stream.writeUint16(player.id);    // Player ID
                stream.writeUint8(0);       // Team ID
                stream.writeUint8(player.groupId); // Group ID
                stream.writeString('Player'); // Name

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
                stream.writeUint32(player.id);    // User ID
                stream.writeBoolean(false); // Is unlinked (doesn't have account)
                stream.writeAlignToNextByte();    // Padding
            }
        }


        // Player IDs to delete
        if(this.game.deletedPlayerIds.length > 0) {
            stream.writeUint8(this.game.deletedPlayerIds.length);
            for(const id of this.game.deletedPlayerIds) stream.writeUint16(id);
        }


        // Player status
        if(this.playerStatusDirty) {
            stream.writeUint8(1); // Player count

            stream.writeBoolean(true); // Has data

            stream.writeVec(this.pos, 0, 0, 1024, 1024, 11); // Position. Yes, 11 bits is correct!
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
            stream.writeUint8(84); // Kill count
            this.killLeaderDirty = false;
        }


        stream.writeUint8(0); // "Ack" msg

        return stream;
    }

    sendUpdate(): void {
        this.send(this.getUpdate());
    }

    sendAliveCounts(): void {
        const stream = Utils.createStream(3);
        stream.writeUint8(MsgType.AliveCounts);
        stream.writeUint8(1); // Team count (2 for 50v50, 1 for everything else)
        stream.writeUint8(this.game.aliveCount);
        this.send(stream);
    }

    sendKill(killer: Player, killed: Player): void {
        const stream = Utils.createStream(64);
        stream.writeUint8(MsgType.Kill);
        stream.writeUint8(DamageType.Player); // Damage type
        stream.writeGameType(557); // Item source type (fists in this case)
        stream.writeMapType(killer.id); // Map source type
        stream.writeUint16(killed.id); // Target ID
        stream.writeUint16(killer.id); // Killer ID
        stream.writeUint16(killer.id); // Kill credit ID. Presumably set to, e.g. a barrel if a barrel dealt the final blow
        stream.writeUint8(killer.kills); // Killer kills
        stream.writeBoolean(false); // Downed
        stream.writeBoolean(true); // Killed
        stream.writeAlignToNextByte();
        this.send(stream);
    }

    private send(msg) {
        Utils.send(this.socket, msg);
    }

}

export { Player };
