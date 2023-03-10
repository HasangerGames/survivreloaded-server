"use strict";
// noinspection TypeScriptValidateJSTypes
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = void 0;
const matter_js_1 = require("matter-js");
const utils_1 = require("../../utils");
const deadBody_1 = require("./deadBody");
const killPacket_1 = require("../../packets/killPacket");
const gameObject_1 = require("./gameObject");
class Player extends gameObject_1.GameObject {
    socket;
    map;
    username = "Player";
    //teamId: number = 0; // For 50v50?
    groupId;
    direction = matter_js_1.Vector.create(1, 0);
    scale = 1;
    zoom = 28; // 1x scope
    visibleObjects = [];
    deletedObjects = [];
    fullObjects = [];
    partialObjects = [];
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
    _health = 100;
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
    emotes;
    explosions;
    body;
    deadBody;
    loadout;
    quit = false;
    constructor(id, socket, game, username, position, loadout) {
        super(id, "", -1, 0);
        this.kind = utils_1.ObjectKind.Player;
        this.game = game;
        this.map = this.game.map;
        this.socket = socket;
        if (loadout && loadout.outfit && loadout.melee && loadout.heal && loadout.boost && loadout.emotes && loadout.deathEffect) {
            this.loadout = {
                outfit: utils_1.TypeToId[loadout.outfit],
                melee: utils_1.TypeToId[loadout.melee],
                meleeType: loadout.melee,
                heal: utils_1.TypeToId[loadout.heal],
                boost: utils_1.TypeToId[loadout.boost],
                emotes: [],
                deathEffect: utils_1.TypeToId[loadout.deathEffect]
            };
            for (const emote of loadout.emotes)
                this.loadout.emotes.push(utils_1.TypeToId[emote]);
        }
        else {
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
        this.body = matter_js_1.Bodies.circle(position.x, position.y, 1, { restitution: 0, friction: 0, frictionAir: 0, inertia: Infinity });
        this.body.collisionFilter.category = utils_1.CollisionCategory.Player;
        this.body.collisionFilter.mask = utils_1.CollisionCategory.Obstacle;
        this.game.addBody(this.body);
    }
    setVelocity(xVel, yVel) {
        matter_js_1.Body.setVelocity(this.body, { x: xVel, y: yVel });
    }
    get position() {
        return this.body.position;
    }
    get health() {
        return this._health;
    }
    /*updateVisibleObjects() {
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
    }*/
    damage(amount, source) {
        this._health -= amount;
        this.healthDirty = true;
        if (this._health < 0)
            this._health = 0;
        if (this._health == 0) {
            this.dead = true;
            if (!this.quit) {
                this.game.aliveCount--;
                this.game.aliveCountDirty = true;
            }
            if (source instanceof Player) {
                source.kills++;
                this.game.kills.push(new killPacket_1.KillPacket(this, source));
            }
            this.fullObjects.push(this.id);
            this.deadBody = new deadBody_1.DeadBody(this.map.objects.length, this.position, this.layer, this.id);
            this.map.objects.push(this.deadBody);
            this.game.fullDirtyObjects.push(this.id);
            this.game.fullDirtyObjects.push(this.deadBody.id);
            this.game.deletedPlayerIds.push(this.id);
            (0, utils_1.removeFrom)(this.game.activePlayers, this);
        }
    }
    isOnOtherSide(door) {
        switch (door.orientation) {
            case 0: return this.position.x < door.position.x;
            case 1: return this.position.y < door.position.y;
            case 2: return this.position.x > door.position.x;
            case 3: return this.position.y > door.position.y;
        }
    }
    sendPacket(packet) {
        const stream = utils_1.SurvivBitStream.alloc(packet.allocBytes);
        packet.writeData(stream);
        this.sendData(stream);
    }
    sendData(stream) {
        const oldArray = new Uint8Array(stream.buffer);
        const newArray = new Uint8Array(Math.ceil(stream.index / 8));
        for (let i = 0; i < newArray.length; i++)
            newArray[i] = oldArray[i];
        this.socket.send(newArray);
    }
    serializePart(stream) {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeUnitVec(this.direction, 8);
    }
    serializeFull(stream) {
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
exports.Player = Player;
//# sourceMappingURL=player.js.map