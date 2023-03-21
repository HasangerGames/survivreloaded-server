import crypto from "crypto";
import {
    type CollisionRecord,
    CollisionType,
    Constants,
    Debug,
    distanceBetween,
    distanceToCircle,
    distanceToRect,
    type Emote,
    type Explosion,
    log,
    randomVec,
    removeFrom,
    SurvivBitStream,
    TypeToId,
    unitVecToRadians,
    vec2Rotate,
    Weapons
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
import { RoleAnnouncementPacket } from "../packets/sending/roleAnnouncementPacket";
import { Loot } from "./objects/loot";

export class Game {

    id: string; // The game ID. 16 hex characters, same as MD5

    map: Map;

    world: World; // The Planck.js World

    objects: GameObject[] = []; // An array of all the objects in the world
    _nextObjectId = -1;

    partialDirtyObjects: GameObject[] = [];
    fullDirtyObjects: GameObject[] = [];
    deletedObjects: GameObject[] = [];
    newObjects: GameObject[] = [];
    //loot: Loot[] = [];

    players: Player[] = []; // All players, including dead and disconnected players.
    connectedPlayers: Player[] = []; // All connected players. May be dead.
    activePlayers: Player[] = []; // All connected and living players.

    newPlayers: Player[] = [];

    deletedPlayers: Player[] = [];
    dirtyStatusPlayers: Player[] = [];

    playerInfosDirty = false;

    killLeader: { id: number, kills: number } = { id: 0, kills: 0 };
    killLeaderDirty = false;

    aliveCount = 0; // The number of players alive. Does not include players who have quit the game
    aliveCountDirty = false; // Whether the alive count needs to be updated

    emotes: Emote[] = []; // All emotes sent this tick
    explosions: Explosion[] = []; // All explosions created this tick
    aliveCounts: AliveCountsPacket;
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

        this.tick(33);
    }

    tickTimes: number[] = [];

    tick(delay: number): void {
        setTimeout(() => {
            const tickStart = Date.now();

            // Stop the tick loop if the game is no longer active
            if(!this.active) return;

            // Update physics
            this.world.step(30);

            // Create an alive count packet
            if(this.aliveCountDirty) this.aliveCounts = new AliveCountsPacket(this);

            // Update loot positions
            /*for(const loot of this.loot) {
                const velocity = loot.body!.getLinearVelocity();
                if(velocity.x > 0 || velocity.y > 0) this.partialDirtyObjects.push(loot);
            }*/

            // First loop: Calculate movement & animations
            for(const p of this.activePlayers) {

                // Movement
                if(p.isMobile) {
                    p.setVelocity(p.touchMoveDir.x * p.speed, p.touchMoveDir.y * p.speed);
                } else {
                    if(p.movingUp && p.movingLeft) p.setVelocity(-p.diagonalSpeed, p.diagonalSpeed);
                    else if(p.movingUp && p.movingRight) p.setVelocity(p.diagonalSpeed, p.diagonalSpeed);
                    else if(p.movingDown && p.movingLeft) p.setVelocity(-p.diagonalSpeed, -p.diagonalSpeed);
                    else if(p.movingDown && p.movingRight) p.setVelocity(p.diagonalSpeed, -p.diagonalSpeed);
                    else if(p.movingUp) p.setVelocity(0, p.speed);
                    else if(p.movingDown) p.setVelocity(0, -p.speed);
                    else if(p.movingLeft) p.setVelocity(-p.speed, 0);
                    else if(p.movingRight) p.setVelocity(p.speed, 0);
                    else p.setVelocity(0, 0);
                }

                // Pick up nearby items if on mobile
                if(p.isMobile) {
                    for(const object of p.visibleObjects) {
                        if(object instanceof Loot && distanceBetween(p.position, object.position) <= p.scale + Constants.player.touchLootRadMult) {
                            object.interact(p);
                        }
                    }
                }

                // Drain adrenaline
                if(p.boost) p.boost -= 0.01136;

                // Health regeneration from adrenaline
                if(p.boost > 0 && p.boost <= 25) p.health += 0.0050303;
                else if(p.boost > 25 && p.boost <= 50) p.health += 0.012624;
                else if(p.boost > 50 && p.boost <= 87.5) p.health += 0.01515;
                else if(p.boost > 87.5 && p.boost <= 100) p.health += 0.01766;

                // Action item logic
                if(p.actionDirty && Date.now() - p.actionItemUseEnd > 0) {
                    switch(p.actionItem.typeString) {
                        case "bandage":
                            p.health += 15;
                            break;
                        case "healthkit":
                            p.health = 100;
                            break;
                        case "soda":
                            p.boost += 25;
                            break;
                        case "painkiller":
                            p.boost += 50;
                            break;
                    }
                    p.inventory[p.actionItem.typeString]--;
                    p.inventoryDirty = true;
                    p.actionItem.typeString = "";
                    p.actionItem.typeId = 0;
                    p.actionDirty = false;
                    p.actionType = 0;
                    p.actionSeq = 0;
                    p.recalculateSpeed();
                    this.fullDirtyObjects.push(p);
                    p.fullDirtyObjects.push(p);
                }

                // Melee logic
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

                // Animation logic
                if(p.animActive) p.animTime++;
                if(p.animTime > 8) {
                    p.animActive = false;
                    this.fullDirtyObjects.push(p);
                    p.fullDirtyObjects.push(p);
                    p.animType = p.animSeq = 0;
                    p.animTime = -1;
                } else if(p.moving) {
                    p.game?.partialDirtyObjects.push(p);
                    p.partialDirtyObjects.push(p);
                }
                p.moving = false;
            }

            // Second loop: calculate visible objects & send packets
            for(const p of this.connectedPlayers) {

                // Calculate visible objects
                if(p.movesSinceLastUpdate > 8 || this.fullDirtyObjects.length || this.partialDirtyObjects.length || this.deletedObjects.length) {
                    p.updateVisibleObjects();
                }

                // Update role
                if(p.roleLost) {
                    p.roleLost = false;
                    p.role = 0;
                }

                // Emotes
                // TODO Determine which emotes should be displayed to the player
                if(this.emotes.length) p.emotes = this.emotes;

                // Explosions
                // TODO Determine which explosions should be displayed to the player
                if(this.explosions.length) p.explosions = this.explosions;

                // Full objects
                if(this.fullDirtyObjects.length) {
                    for(const object of this.fullDirtyObjects) {
                        if(p.visibleObjects.includes(object)) p.fullDirtyObjects.push(object);
                    }
                }

                // Partial objects
                if(this.partialDirtyObjects.length) {
                    for(const object of this.partialDirtyObjects) {
                        if(p.visibleObjects.includes(object)) p.partialDirtyObjects.push(object);
                    }
                }

                // Deleted objects
                if(this.deletedObjects.length) {
                    for(const object of this.deletedObjects) {
                        //if(p.visibleObjects.includes(object)) p.deletedObjects.push(object);
                        p.deletedObjects.push(object);
                    }
                }

                // Send packets
                p.sendPacket(new UpdatePacket(p));
                if(this.aliveCountDirty) p.sendPacket(this.aliveCounts);
                for(const kill of this.kills) p.sendPacket(kill);
                for(const roleAnnouncement of this.roleAnnouncements) p.sendPacket(roleAnnouncement);
            }

            // Reset everything
            this.fullDirtyObjects = [];
            this.partialDirtyObjects = [];
            this.deletedObjects = [];

            this.newPlayers = [];
            this.deletedPlayers = [];
            this.dirtyStatusPlayers = [];

            this.emotes = [];
            this.explosions = [];
            this.kills = [];
            this.roleAnnouncements = [];

            this.gasDirty = false;
            this.gasCircleDirty = false;
            this.aliveCountDirty = false;

            const tickTime: number = Date.now() - tickStart;
            if(Debug.performanceLog) {
                this.tickTimes.push(tickTime);
                if(this.tickTimes.length === Debug.performanceLogInterval) {
                    let tickSum = 0;
                    for(const time of this.tickTimes) tickSum += time;
                    log(`Average ms/tick: ${tickSum / this.tickTimes.length}`);
                    this.tickTimes = [];
                }
            }
            const newDelay: number = Math.max(0, 30 - tickTime);
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
        p.updateVisibleObjects();
        for(const player of this.players) {
            if(player === p) continue;
            player.fullDirtyObjects.push(p);
            p.fullDirtyObjects.push(player);
        }
        p.fullDirtyObjects.push(p);

        p.sendPacket(new JoinedPacket(p));
        const stream = SurvivBitStream.alloc(32768);
        new MapPacket(p).serialize(stream);
        new UpdatePacket(p).serialize(stream);
        new AliveCountsPacket(this).serialize(stream);
        p.sendData(stream);

        return p;
    }

    removePlayer(p): void {
        p.direction = Vec2(1, 0);
        p.disconnected = true;
        p.deadPos = p.body.getPosition().clone();
        this.world.destroyBody(p.body);

        //this.deletedPlayers.push(p);
        this.fullDirtyObjects.push(p);
        removeFrom(this.activePlayers, p);
        removeFrom(this.connectedPlayers, p);

        if(!p.dead) {
            this.aliveCount--;
            this.aliveCountDirty = true;
        }
    }

    assignKillLeader(p: Player): void {
        this.killLeaderDirty = true;
        if(this.killLeader !== p) { // If the player isn't already the Kill Leader...
            p.role = TypeToId.kill_leader;
            this.dirtyStatusPlayers.push(p);
            if(this.killLeader instanceof Player) {
                this.dirtyStatusPlayers.push(this.killLeader);
            }
            this.killLeader = p;
            this.roleAnnouncements.push(new RoleAnnouncementPacket(p, true, false));
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
