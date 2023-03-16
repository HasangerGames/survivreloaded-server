import crypto from "crypto";
import {
    circleCollision, CollisionRecord, CollisionType,
    Config,
    DebugFeatures, distanceToCircle, distanceToRect,
    type Emote,
    type Explosion,
    log,
    randomVec, rectCollision,
    removeFrom,
    SurvivBitStream as BitStream, unitVecToRadians, vec2Rotate, Weapons
} from "../utils";
import { Map } from "./map";
import { Player } from "./objects/player";
import { AliveCountsPacket } from "../packets/sending/aliveCountsPacket";
import { UpdatePacket } from "../packets/sending/updatePacket";
import { JoinedPacket } from "../packets/sending/joinedPacket";
import { MapPacket } from "../packets/sending/mapPacket";
import { type KillPacket } from "../packets/sending/killPacket";
import { type GameObject } from "./gameObject";
import { Settings, Vec2, World } from "planck";
import { Obstacle } from "./objects/obstacle";

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

    world: World;

    // Red zone
    gasMode: number;
    initialGasDuration: number;
    oldGasPosition: Vec2;
    newGasPosition: Vec2;
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
        this.oldGasPosition = Vec2(360, 360);
        this.newGasPosition = Vec2(360, 360);
        this.oldGasRadius = 2048;
        this.newGasRadius = 2048;

        this.world = new World({
            gravity: Vec2(0, 0)
        });
        Settings.maxLinearCorrection = 0; // This prevents collision jitter

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
            this.world.step(Config.tickDelta);

            // First loop: Calculate movement & animations.
            for(const p of this.activePlayers) {

                if(p.oldPosition.x !== p.position.x || p.oldPosition.y !== p.position.y) {
                    p.movesSinceLastUpdate++;
                }
                p.oldPosition = p.position.clone();

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
                            this.fullDirtyObjects.push(p);
                            p.fullDirtyObjects.push(p);
                        }

                        // If the player is punching anything, damage the closest object
                        let minDist = Number.MAX_VALUE;
                        let closestObject;
                        const weapon = Weapons[p.loadout.meleeType];
                        const radius: number = weapon.attack.rad;
                        const angle: number = unitVecToRadians(p.direction);
                        const offset: Vec2 = Vec2.add(weapon.attack.offset, Vec2(1, 0).mul(p.scale - 1));
                        const position: Vec2 = p.position.clone().add(vec2Rotate(offset, angle));
                        //p.meleeBody.setAwake(true);
                        //p.meleeBody.setPosition(position);
                        for(const object of p.visibleObjects) {
                            if(object.body && !object.dead && object !== p && object.damageable) {
                                let record: CollisionRecord;
                                if(object instanceof Obstacle) {
                                    if(object.collision.type === CollisionType.Circle) {
                                        record = distanceToCircle(object.position, object.collision.rad, position, radius);
                                    } else if(object.collision.type === CollisionType.Rectangle) {
                                        record = distanceToRect(object.collision.min, object.collision.max, position, radius);
                                    }
                                } else if(object instanceof Player) {
                                    record = distanceToCircle(object.position, object.scale, position, radius);
                                }
                                if(record!.collided && record!.distance < minDist) {
                                    minDist = record!.distance;
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

                // Calculate visible objects
                if(p.movesSinceLastUpdate > 8 || this.fullDirtyObjects.length || this.partialDirtyObjects.length || this.deletedObjects.length) {
                    p.movesSinceLastUpdate = 0;
                    const newVisibleObjects: GameObject[] = [];
                    for(const object of this.objects) {
                        if(p === object) continue;
                        const minX = p.position.x - p.xCullDist,
                              maxX = p.position.x + p.xCullDist,
                              minY = p.position.y - p.yCullDist,
                              maxY = p.position.y + p.yCullDist;
                        if(object.position.x > minX &&
                           object.position.x < maxX &&
                           object.position.y > minY &&
                           object.position.y < maxY) {
                            newVisibleObjects.push(object);
                            if(!p.visibleObjects.includes(object)) {
                                p.fullDirtyObjects.push(object);
                            }
                        } else {
                            if(p.visibleObjects.includes(object)) {
                                p.deletedObjects.push(object);
                            }
                        }
                    }
                    p.visibleObjects = newVisibleObjects;
                }

                if(p.animActive) {
                    p.animTime++;
                    if(p.animTime > 16) {
                        p.animActive = false;
                        this.fullDirtyObjects.push(p);
                        p.fullDirtyObjects.push(p);
                        p.animType = p.animSeq = p.animTime = 0;
                    } else if(p.moving) {
                        this.partialDirtyObjects.push(p);
                        p.partialDirtyObjects.push(p);
                    }
                } else if(p.moving) {
                    this.partialDirtyObjects.push(p);
                    p.partialDirtyObjects.push(p);
                }
            }

            // Second loop: calculate visible objects & send packets
            for(const p of this.connectedPlayers) {

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
                        //if(p.visibleObjects.includes(object)) p.deletedObjects.push(object);
                        p.deletedObjects.push(object);
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
            this.deletedObjects = [];
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
        if(DebugFeatures.fixedSpawnLocation.length) spawnPosition = Vec2(DebugFeatures.fixedSpawnLocation[0], DebugFeatures.fixedSpawnLocation[1]);
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
        p.direction = Vec2(1, 0);
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

    end(): void {
        this.active = false;
    }

    get nextObjectId(): number {
        this._nextObjectId++;
        return this._nextObjectId;
    }

}
