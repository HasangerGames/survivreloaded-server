// noinspection TypeScriptValidateJSTypes

import { Bodies, Body, Collision, Vector } from "matter-js";
import { Socket } from "ws";

import {
    CollisionCategory,
    Emote,
    Explosion,
    ObjectKind,
    SurvivBitStream as BitStream, TypeToId,
    Utils,
    Weapons
} from "../../utils";
import { DeadBody } from "./deadBody";
import { Packet } from "../../packets/packet";
import { KillPacket } from "../../packets/killPacket";
import { Map } from "../map";
import { Game } from "../game";

export class Player {
    kind: ObjectKind = ObjectKind.Player;
    socket: Socket;
    game: Game;
    map: Map;

    username: string = "Player";
    id: number;
    //teamId: number = 0; // For 50v50?
    groupId: number;

    direction: Vector;
    scale: number = 1;
    zoom: number = 28; // 1x scope
    layer: number = 0;

    visibleObjects: number[] = [];
    deletedObjects: number[] = [];
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
    playerStatusDirty: boolean = true;
    groupStatusDirty: boolean = false;
    bulletsDirty: boolean = false;
    explosionsDirty: boolean = false;
    emotesDirty: boolean = false;
    planesDirty: boolean = false;
    airstrikeZonesDirty: boolean = false;
    mapIndicatorsDirty: boolean = false;
    killLeaderDirty: boolean = true;
    activePlayerIdDirty: boolean = true;
    deletedObjectsDirty: boolean = false;
    gasDirty: boolean = true;
    gasCircleDirty: boolean = true;
    healthDirty: boolean = true;
    boostDirty: boolean = true;
    zoomDirty: boolean = true;
    weaponsDirty: boolean = true;
    skipObjectCalculations: boolean = false;
    getAllPlayerInfos: boolean = true;

    emotes: Emote[];
    explosions: Explosion[];

    body: Body;
    deadBody: DeadBody;

    loadout: {
        outfit: number,
        melee: number,
        heal: number,
        boost: number,
        emotes: number[],
        deathEffect: number
    };

    quit: boolean = false;

    constructor(socket, game, username: string, position: Vector, loadout) {
        this.game = game;
        this.map = this.game.map;
        this.socket = socket;

        if(loadout) {
            this.loadout = {
                outfit: TypeToId[loadout.outfit],
                melee: TypeToId[loadout.melee],
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
                heal: 109,
                boost: 138,
                deathEffect: 0,
                emotes: [195, 196, 197, 194, 0, 0]
            };
        }

        this.groupId = this.game.players.length - 1;

        this.direction = Vector.create(1, 0);

        this.username = username;

        this.meleeCooldown = Date.now();

        this.body = Bodies.circle(position.x, position.y, 1, { restitution: 0, friction: 0, frictionAir: 0, inertia: Infinity });
        this.body.collisionFilter.category = CollisionCategory.Player;
        this.body.collisionFilter.mask = CollisionCategory.Obstacle;
        this.game.addBody(this.body);
    }


    setVelocity(xVel: number, yVel: number) {
        Body.setVelocity(this.body, { x: xVel, y: yVel });
    }

    get position(): Vector {
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
            if(source instanceof Player) {
                source.kills++;
                source.sendPacket(new KillPacket(this, source));
            }
            this.sendPacket(new KillPacket(this, source));
            this.fullObjects.push(this.id);
            this.deadBody = new DeadBody(this.map.objects.length, this.position, this.layer, this.id);
            this.map.objects.push(this.deadBody);
            this.game.fullDirtyObjects.push(this.id);
            this.game.fullDirtyObjects.push(this.deadBody.id);
            this.game.deletedPlayerIds.push(this.id);
        }
    }

    meleeCollisionWith(gameObject): Collision {
        if(!gameObject.body) return false;
        const weap = Weapons["fists"], // TODO Get player's melee, substitute here
              angle = Utils.unitVecToRadians(this.direction),
              offset = Vector.add(weap.attack.offset, Vector.mult(Vector.create(1, 0), this.scale - 1)),
              position = Vector.add(this.position, Vector.rotate(offset, angle));
        const body: Body = Bodies.circle(position.x, position.y, 0.9);
        body.collisionFilter.category = CollisionCategory.Other;
        body.collisionFilter.mask = CollisionCategory.Obstacle;
        return Collision.collides(body, gameObject.body);
    }

    isOnOtherSide(door) {
        switch(door.orientation) {
            case 0: return this.position.x < door.position.x;
            case 1: return this.position.y < door.position.y;
            case 2: return this.position.x > door.position.x;
            case 3: return this.position.y > door.position.y;
        }
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

}
