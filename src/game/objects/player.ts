import { type WebSocket } from "uWebSockets.js";

import {
    type Emote,
    type Explosion,
    ObjectKind,
    removeFrom,
    type SurvivBitStream,
    SurvivBitStream as BitStream,
    TypeToId
} from "../../utils";
import { DeadBody } from "./deadBody";
import { type SendingPacket } from "../../packets/sendingPacket";
import { KillPacket } from "../../packets/sending/killPacket";
import { type Map } from "../map";
import { type Game } from "../game";
import { GameObject } from "../gameObject";
import { type Body, Circle, Vec2 } from "planck";

export class Player extends GameObject {
    socket: WebSocket<any>;
    map: Map;

    name: string;
    teamId = 1; // For 50v50?
    groupId: number;

    direction: Vec2 = Vec2(1, 0);
    scale = 1;
    private _zoom = 28; // 1x scope
    xCullingDistance = this._zoom + 20;
    yCullingDistance = this._zoom + 15;

    visibleObjects: GameObject[] = [];
    partialDirtyObjects: GameObject[] = [];
    fullDirtyObjects: GameObject[] = [];
    deletedObjects: GameObject[] = [];

    moving = false;
    turning = false;
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

    damageable = true;

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

    constructor(id: number, position: Vec2, socket: WebSocket<any>, game: Game, username: string, loadout) {
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
                emotes: [195, 193, 196, 194, 0, 0]
            };
        }

        // Misc
        this.groupId = this.game.players.length - 1;
        this.name = username;

        // Init body
        this.body = game.world.createBody({ type: "dynamic", position });
        this.body.createFixture({
            shape: Circle(position, 1),
            friction: 0,
            density: 1000.0
        });
    }

    setVelocity(xVel: number, yVel: number): void {
        this.moving = true;
        this.body.setLinearVelocity(Vec2(xVel, yVel));
    }

    get position(): Vec2 {
        return this.body.getPosition();
    }

    get zoom(): number {
        return this._zoom;
    }

    set zoom(zoom: number) {
        this._zoom = zoom;
        this.xCullingDistance = this._zoom + 20;
        this.yCullingDistance = this._zoom + 15;
    }

    get health(): number {
        return this._health;
    }

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
            this.fullDirtyObjects.push(this);
            this.deadBody = new DeadBody(this.game!.nextObjectId, this.layer, this.position, this.id);
            this.game!.objects.push(this.deadBody);
            this.game!.fullDirtyObjects.push(this);
            this.game!.fullDirtyObjects.push(this.deadBody);
            this.game!.deletedPlayers.push(this);
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

    sendPacket(packet: SendingPacket): void {
        const stream: BitStream = BitStream.alloc(packet.allocBytes);
        packet.writeData(stream);
        this.sendData(stream);
    }

    sendData(stream: BitStream): void {
        this.socket.send(stream.buffer.subarray(0, Math.ceil(stream.index / 8)), true, true);
    }

    serializePartial(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeUnitVec(this.direction, 8);
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeGameType(this.loadout.outfit);
        stream.writeGameType(451); // Backpack
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
