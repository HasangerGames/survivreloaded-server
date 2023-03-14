import crypto from "crypto";
import {
    DebugFeatures,
    type Emote,
    type Explosion,
    Config, log,
    randomVec,
    removeFrom,
    SurvivBitStream as BitStream,
    unitVecToRadians,
    Weapons
} from "../utils";
import { Bodies, type Body, Collision, Composite, Engine, Vector } from "matter-js";
import { Map } from "./map";
import { Player } from "./objects/player";
import { AliveCountsPacket } from "../packets/sending/aliveCountsPacket";
import { UpdatePacket } from "../packets/sending/updatePacket";
import { JoinedPacket } from "../packets/sending/joinedPacket";
import { MapPacket } from "../packets/sending/mapPacket";
import { type KillPacket } from "../packets/sending/killPacket";
import { type GameObject } from "./gameObject";

export class Game {

    /***
     * The game ID. 16 hex characters, same as MD5
     */
    id: string;

    map: Map;

    objects: GameObject[] = [];
    _nextObjectId = 0;
    partialDirtyObjects: GameObject[] = [];
    fullDirtyObjects: GameObject[] = [];
    deletedObjects: GameObject[] = [];

    /**
     * All players, including dead and disconnected players.
     */
    players: Player[] = [];

    /**
     * All connected players. May be dead.
     */
    connectedPlayers: Player[] = [];

    /**
     * All connected and living players.
     */
    activePlayers: Player[] = [];

    dirtyPlayers: Player[] = [];

    deletedPlayers: Player[] = [];

    playerInfosDirty = false;

    /**
     * The number of players alive. Does not include players who have quit the game
     */
    aliveCount = 0;
    aliveCountDirty = false;

    emotes: Emote[] = [];
    explosions: Explosion[] = [];
    kills: KillPacket[] = [];

    engine: Engine;

    // Red zone
    gasMode: number;
    initialGasDuration: number;
    oldGasPosition: Vector;
    newGasPosition: Vector;
    oldGasRadius: number;
    newGasRadius: number;

    /**
     * Whether this game is active. This is set to false to stop the tick loop.
     */
    active = true;

    constructor() {
        this.id = crypto.createHash("md5").update(crypto.randomBytes(512)).digest("hex");

        this.gasMode = 0;
        this.initialGasDuration = 0;
        this.oldGasPosition = Vector.create(360, 360);
        this.newGasPosition = Vector.create(360, 360);
        this.oldGasRadius = 2048;
        this.newGasRadius = 2048;

        this.engine = Engine.create();
        this.engine.gravity.scale = 0; // Disable gravity

        this.map = new Map(this, "main");

        this.tick(Config.tickDelta);
    }

    tickTimes: number[] = [];

    tick(delay: number): void {
        setTimeout(() => {
            const tickStart = performance.now();

            // Stop the tick loop if the game is no longer active
            if(!this.active) return;

            // Update physics
            Engine.update(this.engine, Config.tickDelta);

            // First loop: Calculate movement & animations.
            for(const p of this.activePlayers) {

                // TODO: Only check objects when player moves 1 unit. No reason to check every 0.2 units.

                // Movement
                p.moving = false;
                const s = Config.movementSpeed;
                const ds = Config.diagonalSpeed;
                if(p.movingUp && p.movingLeft) p.setVelocity(-ds, ds);
                else if(p.movingUp && p.movingRight) p.setVelocity(ds, ds);
                else if(p.movingDown && p.movingLeft) p.setVelocity(-ds, -ds);
                else if(p.movingDown && p.movingRight) p.setVelocity(ds, -ds);
                else if(p.movingUp) p.setVelocity(0, s);
                else if(p.movingDown) p.setVelocity(0, -s);
                else if(p.movingLeft) p.setVelocity(-s, 0);
                else if(p.movingRight) p.setVelocity(s, 0);
                if(!p.moving) p.setVelocity(0, 0);

                if(p.shootStart) {
                    p.shootStart = false;
                    if(Date.now() - p.meleeCooldown >= 250) {
                        p.meleeCooldown = Date.now();

                        // Start punching animation
                        if(!p.animActive) {
                            p.animActive = true;
                            p.animType = 1;
                            p.animSeq = 1;
                            p.animTime = 0;
                        }

                        // If the player is punching anything, damage the closest object
                        let maxDepth = -1;
                        let closestObject;
                        const weapon = Weapons[p.loadout.meleeType];
                        const angle: number = unitVecToRadians(p.direction);
                        const offset: Vector = Vector.add(weapon.attack.offset, Vector.mult(Vector.create(1, 0), p.scale - 1));
                        const position: Vector = Vector.add(p.position, Vector.rotate(offset, angle));
                        const body: Body = Bodies.circle(position.x, position.y, 0.9);
                        for(const object of p.visibleObjects) {
                            if(!object.body || object.dead || object === p) continue;
                            if(object.damageable) {
                                // @ts-expect-error The 3rd argument for Collision.collides is optional
                                const collision = Collision.collides(body, object.body);
                                if(collision && collision.depth > maxDepth) {
                                    maxDepth = collision.depth;
                                    closestObject = object;
                                }
                            }
                        }
                        if(closestObject) {
                            closestObject.damage(24, p);
                            if(closestObject.interactable) closestObject.interact(p);
                        }
                    }
                }

                if(p.animActive) {
                    this.fullDirtyObjects.push(p);
                    p.fullDirtyObjects.push(p);
                    p.animTime++;
                    if(p.animTime > 8) {
                        p.animActive = false;
                        p.animType = p.animSeq = p.animTime = 0;
                    }
                } else if(p.moving) {
                    this.partialDirtyObjects.push(p);
                    p.partialDirtyObjects.push(p);
                }
            }

            // Second loop: calculate visible objects & send packets
            for(const p of this.connectedPlayers) {

                // Calculate visible objects
                if(p.moving || this.fullDirtyObjects.length || this.partialDirtyObjects.length || this.deletedObjects.length) {
                    const minX = p.position.x - p.xCullingDistance,
                          maxX = p.position.x + p.xCullingDistance,
                          minY = p.position.y - p.yCullingDistance,
                          maxY = p.position.y + p.yCullingDistance;
                    for(const object of this.objects) {
                        if(p === object) continue;
                        if(object.position.x > minX &&
                            object.position.x < maxX &&
                            object.position.y > minY &&
                            object.position.y < maxY) {
                            if(!p.visibleObjects.includes(object)) {
                                p.visibleObjects.push(object);
                                p.fullDirtyObjects.push(object);
                            }
                        } else {
                            const index: number = p.visibleObjects.indexOf(object);
                            if(index !== -1) {
                                p.visibleObjects = p.visibleObjects.slice(0, index).concat(p.visibleObjects.slice(index + 1));
                                p.deletedObjectsDirty = true;
                                p.deletedObjects.push(object);
                            }
                        }
                    }
                }

                if(this.emotes.length) {
                    p.emotesDirty = true;
                    p.emotes = this.emotes;
                }

                if(this.explosions.length) {
                    p.explosionsDirty = true;
                    p.explosions = this.explosions;
                }

                if(this.fullDirtyObjects.length) {
                    for(const object of this.fullDirtyObjects) {
                        if(p.visibleObjects.includes(object)) p.fullDirtyObjects.push(object);
                    }
                }

                if(this.partialDirtyObjects.length) {
                    for(const object of this.partialDirtyObjects) {
                        if(p.visibleObjects.includes(object)) p.partialDirtyObjects.push(object);
                    }
                }

                if(this.deletedObjects.length) {
                    for(const object of this.deletedObjects) {
                        if(p.visibleObjects.includes(object)) p.deletedObjects.push(object);
                    }
                }

                p.sendPacket(new UpdatePacket(p));
                if(this.aliveCountDirty) p.sendPacket(new AliveCountsPacket(p));
                if(this.kills.length) {
                    for(const kill of this.kills) p.sendPacket(kill);
                }
            }

            // Reset everything
            this.emotes = [];
            this.explosions = [];
            this.kills = [];
            this.fullDirtyObjects = [];
            this.partialDirtyObjects = [];
            this.dirtyPlayers = [];
            this.deletedPlayers = [];
            this.aliveCountDirty = false;

            const tickTime: number = performance.now() - tickStart;
            if(DebugFeatures.performanceLog) {
                this.tickTimes.push(tickTime);
                if(this.tickTimes.length === DebugFeatures.performanceLogInterval) {
                    let tickSum = 0;
                    for(const time of this.tickTimes) tickSum += time;
                    log(`Average ms/tick: ${tickSum / this.tickTimes.length}`);
                    this.tickTimes = [];
                }
            }
            const newDelay: number = Math.max(0, Config.tickDelta - tickTime);
            this.tick(newDelay);
        }, delay);
    }

    addPlayer(socket, username, loadout): Player {
        let spawnPosition;
        if(DebugFeatures.fixedSpawnLocation.length) spawnPosition = Vector.create(DebugFeatures.fixedSpawnLocation[0], DebugFeatures.fixedSpawnLocation[1]);
        else spawnPosition = randomVec(75, this.map.width - 75, 75, this.map.height - 75);

        const p = new Player(this.nextObjectId, spawnPosition, socket, this, username, loadout);
        this.objects.push(p);
        this.players.push(p);
        this.connectedPlayers.push(p);
        this.activePlayers.push(p);
        this.dirtyPlayers.push(p);
        this.fullDirtyObjects.push(p);
        this.aliveCount++;
        this.aliveCountDirty = true;
        this.playerInfosDirty = true;

        p.sendPacket(new JoinedPacket(p));
        const stream = BitStream.alloc(32768);
        new MapPacket(p).writeData(stream);
        p.fullDirtyObjects.push(p);
        new UpdatePacket(p).writeData(stream);
        new AliveCountsPacket(p).writeData(stream);
        p.sendData(stream);

        return p;
    }

    removePlayer(p): void {
        p.direction = Vector.create(1, 0);
        p.quit = true;
        this.deletedPlayers.push(p);
        this.partialDirtyObjects.push(p);
        removeFrom(this.activePlayers, p);
        removeFrom(this.connectedPlayers, p);
        if(!p.dead) {
            this.aliveCount--;
            this.aliveCountDirty = true;
        }
    }

    addBody(body): void {
        Composite.add(this.engine.world, body);
    }

    removeBody(body): void {
        Composite.remove(this.engine.world, body);
    }

    end(): void {
        this.active = false;
    }

    get nextObjectId(): number {
        this._nextObjectId++;
        return this._nextObjectId;
    }

}
