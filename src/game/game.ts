import crypto from "crypto";
import {
    type CollisionRecord,
    CollisionType,
    Config,
    Debug,
    distanceToCircle,
    distanceToRect,
    type Emote,
    type Explosion,
    log,
    randomVec,
    removeFrom, SurvivBitStream, TypeToId,
    unitVecToRadians,
    vec2Rotate, Weapons
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
import { type RoleAnnouncementPacket } from "../packets/sending/roleAnnouncementPacket";

export class Game {

    id: string; // The game ID. 16 hex characters, same as MD5

    map: Map;

    world: World; // The Planck.js World

    objects: GameObject[] = []; // An array of all the objects in the world
    _nextObjectId = -1;

    partialDirtyObjects: GameObject[] = [];
    fullDirtyObjects: GameObject[] = [];
    deletedObjects: GameObject[] = [];

    players: Player[] = []; // All players, including dead and disconnected players.
    connectedPlayers: Player[] = []; // All connected players. May be dead.
    activePlayers: Player[] = []; // All connected and living players.

    newPlayers: Player[] = [];

    deletedPlayers: Player[] = [];
    //dirtyStatusPlayers: Player[] = [];

    playerInfosDirty = false;

    killLeader: { id: number, kills: number } = { id: 0, kills: 0 };
    killLeaderDirty = false;

    aliveCount = 0; // The number of players alive. Does not include players who have quit the game
    aliveCountDirty = false; // Whether the alive count needs to be updated

    emotes: Emote[] = []; // All emotes sent this tick
    explosions: Explosion[] = []; // All explosions created this tick
    kills: KillPacket[] = []; // All kills this tick
    roleAnnouncements: RoleAnnouncementPacket[] = []; // All role announcements this tick

    // Red zone
    gasMode: number;
    initialGasDuration: number;
    oldGasPosition: Vec2;
    newGasPosition: Vec2;
    oldGasRadius: number;
    newGasRadius: number;
    gasDirty = false;
    gasCircleDirty = false;

    /**
     * Whether this game is active. This is set to false to stop the tick loop.
     */
    active = true;

    /**
     * Creates a new Game. Doesn't take any arguments.
     */
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
                    p.moving = true;
                    p.movesSinceLastUpdate++;
                }
                p.oldPosition = p.position.clone();

                // Movement
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
                else p.setVelocity(0, 0);

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
                        const weapon = Weapons[p.activeItems.melee.typeString];
                        const radius: number = weapon.attack.rad;
                        const angle: number = unitVecToRadians(p.direction);
                        const offset: Vec2 = Vec2.add(weapon.attack.offset, Vec2(1, 0).mul(p.scale - 1));
                        const position: Vec2 = p.position.clone().add(vec2Rotate(offset, angle));
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

                if(p.animActive) {
                    p.animTime++;
                    if(p.animTime > 8) {
                        p.animActive = false;
                        this.fullDirtyObjects.push(p);
                        p.fullDirtyObjects.push(p);
                        p.animType = p.animSeq = 0;
                        p.animTime = -1;
                    } else if(p.moving) {
                        this.partialDirtyObjects.push(p);
                        p.partialDirtyObjects.push(p);
                    }
                } else if(p.moving && p.animTime !== 0) { // animTime === 0 meaning animation just started
                    this.partialDirtyObjects.push(p);
                    p.partialDirtyObjects.push(p);
                }

                p.moving = false;
            }

            // Second loop: calculate visible objects & send packets
            for(const p of this.connectedPlayers) {

                if(p.roleLost) {
                    p.roleLost = false;
                    p.role = 0;
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
                        } else { // if object is not visible
                            if(p.visibleObjects.includes(object)) {
                                p.deletedObjects.push(object);
                            }
                        }
                    }
                    p.visibleObjects = newVisibleObjects;
                }

                // TODO Determine which emotes should be displayed to the player
                if(this.emotes.length) p.emotes = this.emotes;

                // TODO Determine which explosions should be displayed to the player
                if(this.explosions.length) p.explosions = this.explosions;

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
                for(const kill of this.kills) p.sendPacket(kill);
                for(const roleAnnouncement of this.roleAnnouncements) p.sendPacket(roleAnnouncement);
            }

            // Reset everything
            this.fullDirtyObjects = [];
            this.partialDirtyObjects = [];
            this.deletedObjects = [];

            this.newPlayers = [];
            this.deletedPlayers = [];
            //this.dirtyStatusPlayers = [];

            this.emotes = [];
            this.explosions = [];
            this.kills = [];
            this.roleAnnouncements = [];

            this.gasDirty = false;
            this.gasCircleDirty = false;
            this.aliveCountDirty = false;

            const tickTime: number = performance.now() - tickStart;
            if(Debug.performanceLog) {
                this.tickTimes.push(tickTime);
                if(this.tickTimes.length === Debug.performanceLogInterval) {
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
        if(Debug.fixedSpawnLocation.length) spawnPosition = Vec2(Debug.fixedSpawnLocation[0], Debug.fixedSpawnLocation[1]);
        else spawnPosition = randomVec(75, this.map.width - 75, 75, this.map.height - 75);

        const p = new Player(this.nextObjectId, spawnPosition, socket, this, username, loadout);
        this.objects.push(p);
        this.players.push(p);
        this.connectedPlayers.push(p);
        this.activePlayers.push(p);
        this.newPlayers.push(p);
        this.fullDirtyObjects.push(p);
        this.aliveCount++;
        this.aliveCountDirty = true;
        this.playerInfosDirty = true;

        p.sendPacket(new JoinedPacket(p));
        const stream = SurvivBitStream.alloc(32768);
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
        p.role = 0;
        if(p.role === TypeToId.kill_leader) {
            this.killLeader = { id: 0, kills: 0 };
            this.killLeaderDirty = true;
        }
        //this.deletedPlayers.push(p);
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
