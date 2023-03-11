import { Bodies, Body, Vector } from "matter-js";
import { type WebSocket } from "ws";

import {
    CollisionCategory,
    type Emote,
    type Explosion,
    ObjectKind,
    removeFrom,
    type SurvivBitStream,
    SurvivBitStream as BitStream,
    TypeToId
} from "../../utils";
import { DeadBody } from "./deadBody";
import { type Packet } from "../../packets/packet";
import { KillPacket } from "../../packets/killPacket";
import { type Map } from "../map";
import { type Game } from "../game";
import { GameObject } from "../gameObject";

export class Player extends GameObject {
    socket: WebSocket;
    map: Map;

    username: string;
    // teamId: number = 0; // For 50v50?
    groupId: number;

    direction: Vector = Vector.create(1, 0);
    scale = 1;
    zoom = 28; // 1x scope

    visibleObjects: number[] = [];
    deletedObjects: number[] = [];
    fullObjects: number[] = [];
    partialObjects: number[] = [];

    moving = false;
    movingUp = false;
    movingDown = false;
    movingLeft = false;
    movingRight = false;

    shootStart = false;
    shootHold = false;

    animActive = false;
    animType = 0;
    animSeq = 0;
    animTime = 0;

    meleeCooldown = 0;

    private _health = 100;
    boost = 0;
    kills = 0;
    downed = false;

    deletedPlayerIdsDirty = false;
    playerStatusDirty = true;
    groupStatusDirty = false;
    bulletsDirty = false;
    explosionsDirty = false;
    emotesDirty = false;
    planesDirty = false;
    airstrikeZonesDirty = false;
    mapIndicatorsDirty = false;
    killLeaderDirty = true;
    activePlayerIdDirty = true;
    deletedObjectsDirty = false;
    gasDirty = true;
    gasCircleDirty = true;
    healthDirty = true;
    boostDirty = true;
    zoomDirty = true;
    weaponsDirty = true;
    skipObjectCalculations = false;
    getAllPlayerInfos = true;

    emotes: Emote[];
    explosions: Explosion[];

    body: Body;
    deadBody: DeadBody;

    loadout: {
        outfit: number
        melee: number
        meleeType: string
        heal: number
        boost: number
        emotes: number[]
        deathEffect: number
    };

    quit = false;

    constructor(id: number, position: Vector, socket: WebSocket, game: Game, username: string, loadout) {
        super(id, "", position, 0);
        this.kind = ObjectKind.Player;

        this.game = game;
        this.map = this.game.map;
        this.socket = socket;

        if(loadout?.outfit && loadout.melee && loadout.heal && loadout.boost && loadout.emotes && loadout.deathEffect) {
            this.loadout = {
                outfit: TypeToId[loadout.outfit],
                melee: TypeToId[loadout.melee],
                meleeType: loadout.melee,
                heal: TypeToId[loadout.heal],
                boost: TypeToId[loadout.boost],
                emotes: [],
                deathEffect: TypeToId[loadout.deathEffect]
            };
            for(const emote of loadout.emotes) this.loadout.emotes.push(TypeToId[emote]);
        } else {
            this.loadout = {
                outfit: 690,
                melee: 557,
                meleeType: "fists",
                heal: 109,
                boost: 138,
                deathEffect: 0,
                emotes: [195, 196, 197, 194, 0, 0]
            };
        }

        // Misc
        this.groupId = this.game.players.length - 1;
        this.username = username;

        // Init body
        this.body = Bodies.circle(position.x, position.y, 1, { restitution: 0, friction: 0, frictionAir: 0, inertia: Infinity });
        this.body.collisionFilter.category = CollisionCategory.Player;
        this.body.collisionFilter.mask = CollisionCategory.Obstacle;
        this.game.addBody(this.body);
    }

    setVelocity(xVel: number, yVel: number): void {
        Body.setVelocity(this.body, { x: xVel, y: yVel });
    }

    get position(): Vector {
        return this.body.position;
    }

    get health(): number {
        return this._health;
    }

    /* updateVisibleObjects() {
        for(const object of this.map.objects) {
            const id = object.id;
            if(id == this.id) continue;
            const cullingRadius = this.zoom + 15;
            const minX = this.position.x - cullingRadius,
                maxX = this.position.x + cullingRadius,
                minY = this.position.y - cullingRadius,
                maxY = this.position.y + cullingRadius;
            if(object.position.x >= minX &&
                object.position.x <= maxX &&
                object.position.y >= minY &&
                object.position.y <= maxY) {
                if(!this.visibleObjects.includes(id)) {
                    this.visibleObjects.push(id);
                    this.fullObjects.push(id);
                }
            } else {
                const index: number = this.visibleObjects.indexOf(id);
                if(index != -1) {
                    this.visibleObjects = this.visibleObjects.splice(index, 1);
                    this.deletedObjectsDirty = true;
                    this.deletedObjects.push(id);
                }
            }
        }
    } */

    damage(amount: number, source): void {
        this._health -= amount;
        this.healthDirty = true;
        if(this._health < 0) this._health = 0;
        if(this._health === 0) {
            this.dead = true;
            if(!this.quit) {
                this.game!.aliveCount--;
                this.game!.aliveCountDirty = true;
            }
            if(source instanceof Player) {
                source.kills++;
                this.game!.kills.push(new KillPacket(this, source));
            }
            this.fullObjects.push(this.id);
            this.deadBody = new DeadBody(this.map.objects.length, this.position, this.layer, this.id);
            this.map.objects.push(this.deadBody);
            this.game!.fullDirtyObjects.push(this.id);
            this.game!.fullDirtyObjects.push(this.deadBody.id);
            this.game!.deletedPlayerIds.push(this.id);
            removeFrom(this.game!.activePlayers, this);
        }
    }

    isOnOtherSide(door): boolean {
        switch(door.orientation) {
            case 0: return this.position.x < door.position.x;
            case 1: return this.position.y < door.position.y;
            case 2: return this.position.x > door.position.x;
            case 3: return this.position.y > door.position.y;
        }
        return false;
    }

    sendPacket(packet: Packet): void {
        const stream: BitStream = BitStream.alloc(packet.allocBytes);
        packet.writeData(stream);
        this.sendData(stream);
    }

    sendData(stream: BitStream): void {
        const oldArray = new Uint8Array(stream.buffer);
        const newArray = new Uint8Array(Math.ceil(stream.index / 8));
        for(let i = 0; i < newArray.length; i++) newArray[i] = oldArray[i];
        this.socket.send(newArray);
    }

    serializePart(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeUnitVec(this.direction, 8);
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeGameType(this.loadout.outfit);
        stream.writeGameType(450); // Backpack
        stream.writeGameType(0); // Helmet
        stream.writeGameType(0); // Vest
        stream.writeGameType(this.loadout.melee); // Active weapon (not necessarily melee)

        stream.writeBits(this.layer, 2);
        stream.writeBoolean(this.dead);
        stream.writeBoolean(this.downed);
        stream.writeBits(this.animType, 3);
        stream.writeBits(this.animSeq, 3);

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
    }

}
