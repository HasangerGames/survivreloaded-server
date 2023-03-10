"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = void 0;
const crypto_1 = __importDefault(require("crypto"));
const utils_1 = require("../utils");
const matter_js_1 = require("matter-js");
const map_1 = require("./map");
const player_1 = require("./objects/player");
const obstacle_1 = require("./objects/obstacle");
const aliveCountsPacket_1 = require("../packets/aliveCountsPacket");
const updatePacket_1 = require("../packets/updatePacket");
const joinedPacket_1 = require("../packets/joinedPacket");
const mapPacket_1 = require("../packets/mapPacket");
class Game {
    /***
     * The game ID. 16 hex characters, same as MD5
     */
    id;
    map;
    /***
     * All players, including dead and disconnected players.
     */
    players = [];
    /***
     * All connected players. May be dead.
     */
    connectedPlayers = [];
    /***
     * All connected and living players.
     */
    activePlayers = [];
    dirtyPlayers = [];
    aliveCount = 0;
    aliveCountDirty = false;
    playerInfosDirty = false;
    deletedPlayerIds = [];
    emotes = [];
    explosions = [];
    kills = [];
    fullDirtyObjects = [];
    partialDirtyObjects = [];
    timer;
    engine;
    gasMode;
    initialGasDuration;
    oldGasPosition;
    newGasPosition;
    oldGasRadius;
    newGasRadius;
    constructor() {
        this.id = crypto_1.default.createHash('md5').update(crypto_1.default.randomBytes(512)).digest('hex');
        this.gasMode = 0;
        this.initialGasDuration = 0;
        this.oldGasPosition = matter_js_1.Vector.create(360, 360);
        this.newGasPosition = matter_js_1.Vector.create(360, 360);
        this.oldGasRadius = 2048;
        this.newGasRadius = 2048;
        this.engine = matter_js_1.Engine.create();
        this.engine.gravity.scale = 0; // Disable gravity
        this.map = new map_1.Map(this, "main");
        this.timer = setInterval(() => {
            // Update physics engine
            matter_js_1.Engine.update(this.engine, utils_1.GameOptions.tickDelta);
            // First loop: Calculate movement & animations.
            for (const p of this.activePlayers) {
                // TODO: Only check objects when player moves 1 unit. No reason to check every 0.2 units.
                // Movement
                p.moving = true;
                const s = utils_1.GameOptions.movementSpeed, ds = utils_1.GameOptions.diagonalSpeed;
                if (p.movingUp && p.movingLeft)
                    p.setVelocity(-ds, ds);
                else if (p.movingUp && p.movingRight)
                    p.setVelocity(ds, ds);
                else if (p.movingDown && p.movingLeft)
                    p.setVelocity(-ds, -ds);
                else if (p.movingDown && p.movingRight)
                    p.setVelocity(ds, -ds);
                else if (p.movingUp)
                    p.setVelocity(0, s);
                else if (p.movingDown)
                    p.setVelocity(0, -s);
                else if (p.movingLeft)
                    p.setVelocity(-s, 0);
                else if (p.movingRight)
                    p.setVelocity(s, 0);
                else {
                    p.setVelocity(0, 0);
                    if (p.moving)
                        p.setVelocity(0, 0);
                    p.moving = false;
                }
                // p.updateVisibleObjects();
                if (p.shootStart) {
                    p.shootStart = false;
                    if (Date.now() - p.meleeCooldown >= 250) {
                        p.meleeCooldown = Date.now();
                        // Start punching animation
                        if (!p.animActive) {
                            p.animActive = true;
                            p.animType = 1;
                            p.animTime = 0;
                        }
                        // If the player is punching anything, damage the closest object
                        let maxDepth = -1, closestObject;
                        const weapon = utils_1.Weapons[p.loadout.meleeType], angle = utils_1.Utils.unitVecToRadians(p.direction), offset = matter_js_1.Vector.add(weapon.attack.offset, matter_js_1.Vector.mult(matter_js_1.Vector.create(1, 0), p.scale - 1)), position = matter_js_1.Vector.add(p.position, matter_js_1.Vector.rotate(offset, angle));
                        const body = matter_js_1.Bodies.circle(position.x, position.y, 0.9);
                        for (const object of this.map.objects) { // TODO This is very inefficient. Only check visible objects
                            if (!object.body || object.dead || object.id == p.id)
                                continue;
                            if (((object instanceof obstacle_1.Obstacle && object.destructible) || object instanceof player_1.Player)) {
                                const collision = matter_js_1.Collision.collides(body, object.body);
                                if (collision && collision.depth > maxDepth) {
                                    maxDepth = collision.depth;
                                    closestObject = object;
                                }
                            }
                        }
                        if (closestObject) {
                            closestObject.damage(24, p);
                            if (closestObject instanceof obstacle_1.Obstacle && closestObject.isDoor)
                                closestObject.interact(p);
                        }
                        /* This code is more efficient, but doesn't work:
                        for(const id of p.visibleObjects) {
                            const object = this.map.objects[id];
                            if(!object.body || object.dead || object.id == p.id) continue;
                            if(((object instanceof Obstacle && object.destructible) || object instanceof Player)) {
                                const collision: Collision = Collision.collides(body, object.body);
                                if(collision && collision.depth > maxDepth) {
                                    maxDepth = collision.depth;
                                    closestObject = object;
                                }
                            }
                        }
                        */
                    }
                }
                if (p.animActive) {
                    this.fullDirtyObjects.push(p.id);
                    p.fullObjects.push(p.id);
                    p.animTime++;
                    p.animSeq = 1;
                    if (p.animTime > 8) {
                        p.animActive = false;
                        p.animType = p.animSeq = p.animTime = 0;
                    }
                }
                else {
                    this.partialDirtyObjects.push(p.id);
                    p.partialObjects.push(p.id); // TODO Check for movement first
                }
            }
            // Second loop: calculate visible objects & send packets
            for (const p of this.connectedPlayers) {
                p.skipObjectCalculations = !this.fullDirtyObjects.length && !this.partialDirtyObjects.length && !p.moving;
                if (this.emotes.length > 0) {
                    p.emotesDirty = true;
                    p.emotes = this.emotes;
                }
                if (this.explosions.length > 0) {
                    p.explosionsDirty = true;
                    p.explosions = this.explosions;
                }
                if (this.fullDirtyObjects.length > 0) {
                    for (const id of this.fullDirtyObjects) {
                        if (p.visibleObjects.includes(id))
                            p.fullObjects.push(id);
                    }
                }
                if (this.partialDirtyObjects.length > 0) {
                    for (const id of this.partialDirtyObjects) {
                        if (p.visibleObjects.includes(id))
                            p.partialObjects.push(id);
                    }
                }
                p.sendPacket(new updatePacket_1.UpdatePacket(p));
                if (this.aliveCountDirty)
                    p.sendPacket(new aliveCountsPacket_1.AliveCountsPacket(p));
                if (this.kills.length) {
                    for (const kill of this.kills)
                        p.sendPacket(kill);
                }
            }
            // Reset everything
            this.emotes = [];
            this.explosions = [];
            this.kills = [];
            this.fullDirtyObjects = [];
            this.partialDirtyObjects = [];
            this.dirtyPlayers = [];
            this.deletedPlayerIds = [];
            this.aliveCountDirty = false;
        }, utils_1.GameOptions.tickDelta);
    }
    onMessage(stream, p) {
        try {
            const msgType = stream.readUint8();
            switch (msgType) {
                case utils_1.MsgType.Input:
                    stream.readUint8(); // Discard second byte (this.seq)
                    // Movement and shooting
                    p.movingLeft = stream.readBoolean(); // Left
                    p.movingRight = stream.readBoolean(); // Right
                    p.movingUp = stream.readBoolean(); // Up
                    p.movingDown = stream.readBoolean(); // Down
                    const shootStart = stream.readBoolean();
                    p.shootStart = p.shootStart ? true : shootStart; // Shoot start
                    p.shootHold = stream.readBoolean(); // Shoot hold
                    stream.readBoolean(); // Portrait
                    stream.readBoolean(); // Touch move active
                    // Direction
                    const direction = stream.readUnitVec(10);
                    if (p.direction != direction) {
                        p.direction = direction;
                        p.skipObjectCalculations = false;
                    }
                    stream.readFloat(0, 64, 8); // Distance to mouse
                    // Other inputs
                    const inputCount = stream.readBits(4);
                    for (let i = 0; i < inputCount; i++) {
                        const input = stream.readUint8();
                        switch (input) {
                            case utils_1.InputType.Interact:
                                for (const id of p.visibleObjects) {
                                    const object = this.map.objects[id];
                                    if (object instanceof obstacle_1.Obstacle && object.isDoor && !object.dead) {
                                        // @ts-ignore
                                        const interactionBody = matter_js_1.Bodies.circle(p.position.x, p.position.y, 1 + object.interactionRad);
                                        const collisionResult = matter_js_1.Collision.collides(interactionBody, object.body);
                                        if (collisionResult && collisionResult.collided) {
                                            object.interact(p);
                                            this.partialDirtyObjects.push(id);
                                        }
                                    }
                                }
                                break;
                        }
                    }
                    // Misc
                    stream.readGameType(); // Item in use
                    stream.readBits(5); // Zeroes
                    break;
                case utils_1.MsgType.Emote:
                    const position = stream.readVec(0, 0, 1024, 1024, 16);
                    const type = stream.readGameType();
                    const isPing = stream.readBoolean();
                    stream.readBits(4); // Padding
                    if (!p.dead)
                        this.emotes.push(new utils_1.Emote(p.id, position, type, isPing));
                    break;
            }
        }
        catch (e) {
            //console.warn("Error parsing message:", e);
        }
    }
    addPlayer(socket, username, loadout) {
        let spawnPosition;
        if (utils_1.GameOptions.debugMode)
            spawnPosition = matter_js_1.Vector.create(450, 150);
        else
            spawnPosition = utils_1.Utils.randomVec(75, this.map.width - 75, 75, this.map.height - 75);
        const p = new player_1.Player(this.map.objects.length, socket, this, username, spawnPosition, loadout);
        this.map.objects.push(p);
        this.players.push(p);
        this.connectedPlayers.push(p);
        this.activePlayers.push(p);
        this.dirtyPlayers.push(p);
        this.fullDirtyObjects.push(p.id);
        this.aliveCount++;
        this.aliveCountDirty = true;
        this.playerInfosDirty = true;
        p.sendPacket(new joinedPacket_1.JoinedPacket(p));
        const stream = utils_1.SurvivBitStream.alloc(32768);
        new mapPacket_1.MapPacket(p).writeData(stream);
        p.fullObjects.push(p.id);
        new updatePacket_1.UpdatePacket(p).writeData(stream);
        new aliveCountsPacket_1.AliveCountsPacket(p).writeData(stream);
        p.sendData(stream);
        return p;
    }
    removePlayer(p) {
        p.direction = matter_js_1.Vector.create(1, 0);
        p.quit = true;
        this.deletedPlayerIds.push(p.id);
        this.partialDirtyObjects.push(p.id);
        (0, utils_1.removeFrom)(this.activePlayers, p);
        (0, utils_1.removeFrom)(this.connectedPlayers, p);
        if (!p.dead) {
            this.aliveCount--;
            this.aliveCountDirty = true;
        }
    }
    addBody(body) {
        matter_js_1.Composite.add(this.engine.world, body);
    }
    removeBody(body) {
        matter_js_1.Composite.remove(this.engine.world, body);
    }
    end() {
        for (const p of this.players)
            p.socket.close();
        clearInterval(this.timer);
    }
}
exports.Game = Game;
//# sourceMappingURL=game.js.map