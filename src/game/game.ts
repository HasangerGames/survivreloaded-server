import crypto from "crypto";
import {
    Bullets,
    Config,
    Constants,
    DamageRecord,
    DamageType,
    Debug,
    distanceBetween,
    type Emote,
    lerp,
    log,
    ObjectKind,
    random,
    randomPointInsideCircle,
    RedZoneStages,
    removeFrom,
    SurvivBitStream,
    TypeToId,
    vecLerp,
    WeaponType,
    sameLayer
} from "../utils";
import { Map } from "./map";
import { Player } from "./objects/player";
import { AliveCountsPacket } from "../packets/sending/aliveCountsPacket";
import { UpdatePacket } from "../packets/sending/updatePacket";
import { JoinedPacket } from "../packets/sending/joinedPacket";
import { MapPacket } from "../packets/sending/mapPacket";
import { type KillPacket } from "../packets/sending/killPacket";
import { type GameObject } from "./gameObject";
import { Box, Fixture, Settings, Vec2, World } from "planck";
import { RoleAnnouncementPacket } from "../packets/sending/roleAnnouncementPacket";
import { Loot } from "./objects/loot";
import { Bullet } from "./bullet";
import { Explosion } from "./explosion";
import { type Stair } from "./stair";

export class Game {

    id: string; // The game ID. 16 hex characters, same as MD5

    map: Map;

    // Used when calculating visible objects
    has8x = false;
    has15x = false;

    world: World; // The Planck.js World

    staticObjects = new Set<GameObject>(); // A Set of all the static objects in the world
    dynamicObjects = new Set<GameObject>(); // A Set of all the dynamic (moving) objects in the world
    _nextObjectId = -1;
    _nextGroupId = -1;

    visibleObjects = {};
    updateObjects = false;

    partialDirtyObjects = new Set<GameObject>();
    fullDirtyObjects = new Set<GameObject>();
    deletedObjects = new Set<GameObject>();
    loot = new Set<Loot>();
    stairs = new Set<Stair>();

    players = new Set<Player>(); // All players, including dead and disconnected players.
    connectedPlayers = new Set<Player>(); // All connected players. May be dead.
    livingPlayers = new Set<Player>(); // All connected and living players.
    spectatablePlayers: Player[] = []; // Same as activePlayers, but an array. Used to navigate through players when spectating.

    newPlayers = new Set<Player>();
    deletedPlayers = new Set<Player>();

    playerInfosDirty = false;

    killLeader: { id: number, kills: number } = { id: 0, kills: 0 };
    killLeaderDirty = false;

    aliveCountDirty = false; // Whether the alive count needs to be updated

    emotes = new Set<Emote>(); // All emotes sent this tick
    explosions = new Set<Explosion>(); // All explosions created this tick
    bullets = new Set<Bullet>(); // All bullets that currently exist
    newBullets = new Set<Bullet>(); // All bullets created this tick
    aliveCounts: AliveCountsPacket;
    kills = new Set<KillPacket>(); // All kills this tick
    roleAnnouncements = new Set<RoleAnnouncementPacket>(); // All role announcements this tick
    damageRecords = new Set<DamageRecord>(); // All records of damage by bullets this tick

    // Red zone
    readonly gas = {
        stage: 0,
        mode: 0, // 0 = inactive, 1 = waiting, 2 = moving
        initialDuration: 0,
        countdownStart: 0,
        duration: 0,
        posOld: Vec2(360, 360),
        posNew: Vec2(360, 360),
        radOld: 534.6,
        radNew: 534.6,
        currentPos: Vec2(360, 360),
        currentRad: 534.6,
        damage: 0
    };

    gasDirty = false;
    gasCircleDirty = false;
    ticksSinceLastGasDamage = 0;

    over = false; // Whether this game is over. This is set to true to stop the tick loop.
    started = false; // Whether there are more than 2 players, meaning the game has started.
    allowJoin = true; // Whether new players should be able to join

    constructor() {
        this.id = crypto.createHash("md5").update(crypto.randomBytes(512)).digest("hex");

        // Create the Planck.js World
        this.world = new World({
            gravity: Vec2(0, 0)
        });
        Settings.maxTranslation = 5.0; // Allows bullets to travel fast

        // Create world boundaries
        this.createWorldBoundary(360, -0.25, 360, 0);
        this.createWorldBoundary(-0.25, 360, 0, 360);
        this.createWorldBoundary(360, 720.25, 360, 0);
        this.createWorldBoundary(720.25, 360, 0, 360);

        // Handle bullet collisions
        this.world.on("begin-contact", contact => {
            const objectA: any = contact.getFixtureA().getUserData();
            const objectB: any = contact.getFixtureB().getUserData();
            //console.log(objectA.typeString, objectB.typeString);
            if(objectA instanceof Bullet && objectA.distance <= objectA.maxDistance && !objectA.dead) {
                objectA.dead = true;
                this.damageRecords.add(new DamageRecord(objectB, objectA.shooter, objectA));
            } else if(objectB instanceof Bullet && objectB.distance <= objectB.maxDistance && !objectB.dead) {
                objectB.dead = true;
                this.damageRecords.add(new DamageRecord(objectA, objectB.shooter, objectB));
            }
        });

        // If maxLinearCorrection is set to 0, player collisions work perfectly, but loot doesn't spread out.
        // If maxLinearCorrection is greater than 0, loot spreads out, but player collisions are jittery.
        // This code solves the dilemma by setting maxLinearCorrection to the appropriate value for the object.
        this.world.on("pre-solve", contact => {
            // @ts-expect-error getUserData() should always be a GameObject
            if(contact.getFixtureA().getUserData().isLoot || contact.getFixtureB().getUserData().isLoot) Settings.maxLinearCorrection = 0.055;
            else Settings.maxLinearCorrection = 0;
        });

        // Collision filtering code:
        // - Players should collide with obstacles, but not with each other or with loot.
        // - Bullets should collide with players and obstacles, but not with each other or with loot.
        // - Loot should only collide with obstacles and other loot.
        Fixture.prototype.shouldCollide = function(that): boolean {

            // Get the objects
            const thisObject: any = this.getUserData();
            const thatObject: any = that.getUserData();

            // Make sure the objects are on the same layer
            if(!sameLayer(thisObject.layer, thatObject.layer)) return false;

            // Prevents collision with invisible walls in bunker entrances
            if(thisObject.isPlayer && thatObject.isObstacle && thisObject.layer & 0x2 && thatObject.bunkerWall) {
                return false;
            } else if(thisObject.isObstacle && thatObject.isPlayer && thatObject.layer & 0x2 && thisObject.bunkerWall) {
                return false;
            }

            if(thisObject.isPlayer) return thatObject.collidesWith.player;
            else if(thisObject.isObstacle) return thatObject.collidesWith.obstacle;
            else if(thisObject.isBullet) return thatObject.collidesWith.bullet;
            else if(thisObject.isLoot) return thatObject.collidesWith.loot;
            else return false;
        };

        this.map = new Map(this, "main");

        // Prevent new players from joining after 4 minutes
        setInterval(() => {
            if(this.aliveCount > 1) this.allowJoin = false;
        }, 240000);

        this.tick(30);
    }

    private createWorldBoundary(x: number, y: number, width: number, height: number): void {
        const boundary = this.world.createBody({
            type: "static",
            position: Vec2(x, y)
        });
        boundary.createFixture({
            shape: Box(width, height),
            userData: {
                kind: ObjectKind.Obstacle,
                layer: 0,
                isPlayer: false,
                isObstacle: true,
                isBullet: false,
                isLoot: false,
                collidesWith: {
                    player: true,
                    obstacle: false,
                    bullet: true,
                    loot: false
                }
            }
        });
    }

    tickTimes: number[] = [];

    tick(delay: number): void {
        setTimeout(() => {
            const tickStart = Date.now();

            // Update physics
            this.world.step(30);

            // Create an alive count packet
            if(this.aliveCountDirty) this.aliveCounts = new AliveCountsPacket(this);

            // Update loot positions
            for(const loot of this.loot) {
                if(loot.oldPos.x !== loot.position.x || loot.oldPos.y !== loot.position.y) {
                    this.partialDirtyObjects.add(loot);
                }
                loot.oldPos = loot.position.clone();
            }

            // Update bullets
            for(const bullet of this.bullets) {
                if(bullet.distance >= bullet.maxDistance) {
                    const bulletData = Bullets[bullet.typeString];

                    if (bulletData.onHit) {
                        const explosionPosition = bullet.position.clone().add(bullet.direction.clone().mul(bullet.maxDistance));
                        this.explosions.add(new Explosion(explosionPosition, bulletData.onHit, bullet.layer, bullet.shooter, bullet.shotSource));
                    }
                    this.world.destroyBody(bullet.body);
                    this.bullets.delete(bullet);
                }
            }

            // Do damage to objects hit by bullets
            for(const damageRecord of this.damageRecords) {
                const bullet = damageRecord.bullet;
                const bulletData = Bullets[bullet.typeString];

                if(bulletData.onHit) {
                    this.explosions.add(new Explosion(bullet.body.getPosition(), bulletData.onHit, bullet.layer, bullet.shooter, bullet.shotSource));
                }

                if(damageRecord.damaged.damageable) {
                    if(damageRecord.damaged instanceof Player) {
                        damageRecord.damaged.damage(bulletData.damage, damageRecord.damager, bullet.shotSource);
                    } else {
                        damageRecord.damaged.damage(bulletData.damage * bulletData.obstacleDamage, damageRecord.damager);
                    }
                 }
                this.world.destroyBody(bullet.body);
                this.bullets.delete(bullet);
            }

            // Update red zone
            if(this.gas.mode !== 0) {
                this.gas.duration = (Date.now() - this.gas.countdownStart) / 1000 / this.gas.initialDuration;
                this.gasCircleDirty = true;
            }

            // Red zone damage
            this.ticksSinceLastGasDamage++;
            let gasDamage = false;
            if(this.ticksSinceLastGasDamage >= 67) {
                this.ticksSinceLastGasDamage = 0;
                gasDamage = true;
                if(this.gas.mode === 2) {
                    this.gas.currentPos = vecLerp(this.gas.duration, this.gas.posOld, this.gas.posNew);
                    this.gas.currentRad = lerp(this.gas.duration, this.gas.radOld, this.gas.radNew);
                }
            }

            // First loop over players: Calculate movement & animations
            for(const p of this.livingPlayers) {

                // Movement
                if(p.isMobile) {
                    p.setVelocity(p.touchMoveDir.x * p.speed, p.touchMoveDir.y * p.speed);
                } else {
                    // This system allows opposite movement keys to cancel each other out.
                    let xMovement = 0, yMovement = 0;
                    if(p.movingUp) yMovement++;
                    if(p.movingDown) yMovement--;
                    if(p.movingLeft) xMovement--;
                    if(p.movingRight) xMovement++;
                    const speed: number = (xMovement !== 0 && yMovement !== 0) ? p.diagonalSpeed : p.speed;
                    p.setVelocity(xMovement * speed, yMovement * speed);
                }

                // Pick up nearby items if on mobile
                if(p.isMobile) {
                    for(const object of p.visibleObjects) {
                        if(object instanceof Loot &&
                            (!object.isGun || (p.weapons[0].typeId === 0 || p.weapons[1].typeId === 0)) &&
                            !object.isMelee &&
                            distanceBetween(p.position, object.position) <= p.scale + Constants.player.touchLootRadMult) {
                            object.interact(p);
                        }
                    }
                }

                // Drain adrenaline
                if(p.boost > 0) p.boost -= 0.01136;

                // Health regeneration from adrenaline
                if(p.boost > 0 && p.boost <= 25) p.health += 0.0050303;
                else if(p.boost > 25 && p.boost <= 50) p.health += 0.012624;
                else if(p.boost > 50 && p.boost <= 87.5) p.health += 0.01515;
                else if(p.boost > 87.5 && p.boost <= 100) p.health += 0.01766;

                // Red zone damage
                if(gasDamage && this.isInRedZone(p.position)) {
                    p.damage(this.gas.damage, undefined, undefined, DamageType.Gas);
                }

                // Perform action again
                if(p.performActionAgain) {
                    p.performActionAgain = false;
                    p.doAction(p.lastActionItem.typeString, p.lastActionItem.duration, p.lastActionType);
                }

                // Action item logic
                if(p.actionDirty && Date.now() - p.actionItem.useEnd > 0) {
                    if(p.actionType === Constants.Action.UseItem) {
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
                    } else if(p.actionType === Constants.Action.Reload) {
                        const weaponInfo = p.activeWeaponInfo;
                        let difference: number = Math.min(p.inventory[weaponInfo.ammo], weaponInfo.maxClip - p.activeWeapon.ammo);
                        if(difference > weaponInfo.maxReload) {
                            difference = weaponInfo.maxReload;
                            p.performActionAgain = true;
                        }

                        (p.activeWeapon.ammo as number) += difference;
                        p.inventory[weaponInfo.ammo] -= difference;
                        p.weaponsDirty = true;
                        p.inventoryDirty = true;
                    }
                    if(p.performActionAgain) {
                        p.lastActionItem = { ...p.actionItem };
                        p.lastActionType = p.actionType;
                        p.cancelAction();
                    } else p.cancelAction();
                }

                // Weapon logic
                if(p.shootStart) {
                    p.shootStart = false;
                    if(p.weaponCooldownOver()) {
                        p.activeWeapon.cooldown = Date.now();
                        if(p.activeWeapon.weaponType === WeaponType.Melee) { // Melee logic
                            p.useMelee();
                        } else if(p.activeWeapon.weaponType === WeaponType.Gun) {
                            p.shootGun();
                        }
                    }
                } else if(p.shootHold && p.activeWeapon.weaponType === WeaponType.Gun && (p.activeWeaponInfo.fireMode === "auto" || p.activeWeaponInfo.fireMode === "burst")) {
                    if(p.weaponCooldownOver()) {
                        p.activeWeapon.cooldown = Date.now();
                        p.shootGun();
                    }
                } else {
                    p.shooting = false;
                }

                // Animation logic
                if(p.anim.active) p.anim.time++;
                if(p.anim.time > p.anim.duration) {
                    p.anim.active = false;
                    this.fullDirtyObjects.add(p);
                    p.fullDirtyObjects.add(p);
                    p.anim.type = p.anim.seq = 0;
                    p.anim.time = -1;
                } else if(p.moving) {
                    p.game.partialDirtyObjects.add(p);
                    p.partialDirtyObjects.add(p);
                }
                p.moving = false;

                let onStair = false;
                const originalLayer = p.layer;
                for(const stair of this.stairs) {
                    if(stair.check(p)) onStair = true;
                }
                if(!onStair) {
                    if(p.layer === 2) p.layer = 0;
                    if(p.layer === 3) p.layer = 1;
                }
                if(p.layer !== originalLayer) {
                    p.fullDirtyObjects.add(p);
                    p.game.fullDirtyObjects.add(p);
                }
            }

            for(const explosion of this.explosions) {
                explosion.explode(this);
            }

            // Second loop over players: calculate visible objects & send packets
            for(const p of this.connectedPlayers) {

                // Calculate visible objects
                if(p.movesSinceLastUpdate > 8 || this.updateObjects) {
                    p.updateVisibleObjects();
                }

                // Update role
                if(p.roleLost) {
                    p.roleLost = false;
                    p.role = 0;
                }

                // Spectate logic
                if(p.spectateBegin) {
                    p.spectateBegin = false;
                    let toSpectate;
                    if(p.killedBy && !p.killedBy.dead) toSpectate = p.killedBy;
                    else toSpectate = this.randomPlayer();
                    p.spectate(toSpectate);
                } else if(p.spectateNext && p.spectating) { // TODO Remember which players were spectated so navigation works properly
                    p.spectateNext = false;
                    let index: number = this.spectatablePlayers.indexOf(p.spectating) + 1;
                    if(index >= this.spectatablePlayers.length) index = 0;
                    p.spectate(this.spectatablePlayers[index]);
                } else if(p.spectatePrevious && p.spectating) {
                    p.spectatePrevious = false;
                    let index: number = this.spectatablePlayers.indexOf(p.spectating) - 1;
                    if(index < 0) index = this.spectatablePlayers.length - 1;
                    p.spectate(this.spectatablePlayers[index]);
                }

                // Emotes
                // TODO Determine which emotes should be sent to the client
                if(this.emotes.size) {
                    for(const emote of this.emotes) {
                        if(!emote.isPing || emote.playerId === p.id) p.emotes.add(emote);
                    }
                }

                // Explosions
                // TODO Determine which explosions should be sent to the client
                if(this.explosions.size) {
                    for(const explosion of this.explosions) {
                        p.explosions.add(explosion);
                    }
                }

                // Full objects
                if(this.fullDirtyObjects.size) {
                    for(const object of this.fullDirtyObjects) {
                        if(p.visibleObjects.has(object) && !p.fullDirtyObjects.has(object)) {
                            p.fullDirtyObjects.add(object);
                        }
                    }
                }

                // Partial objects
                if(this.partialDirtyObjects.size && !p.fullUpdate) {
                    for(const object of this.partialDirtyObjects) {
                        if(p.visibleObjects.has(object) && !p.fullDirtyObjects.has(object)) {
                            p.partialDirtyObjects.add(object);
                        }
                    }
                }

                // Deleted objects
                if(this.deletedObjects.size) {
                    for(const object of this.deletedObjects) {
                        /*if(p.visibleObjects.includes(object) && object !== p) {
                            p.deletedObjects.add(object);
                        }*/
                        if(object !== p) p.deletedObjects.add(object);
                    }
                }

                // Send packets
                if(!p.isSpectator) {
                    const updatePacket = new UpdatePacket(p);
                    const updateStream = SurvivBitStream.alloc(updatePacket.allocBytes);
                    updatePacket.serialize(updateStream);
                    p.sendData(updateStream);
                    for(const spectator of p.spectators) {
                        spectator.sendData(updateStream);
                    }
                }
                if(this.aliveCountDirty) p.sendPacket(this.aliveCounts);
                for(const kill of this.kills) p.sendPacket(kill);
                for(const roleAnnouncement of this.roleAnnouncements) p.sendPacket(roleAnnouncement);
            }

            // Reset everything
            if(this.fullDirtyObjects.size) this.fullDirtyObjects = new Set<GameObject>();
            if(this.partialDirtyObjects.size) this.partialDirtyObjects = new Set<GameObject>();
            if(this.deletedObjects.size) this.deletedObjects = new Set<GameObject>();

            if(this.newPlayers.size) this.newPlayers = new Set<Player>();
            if(this.deletedPlayers.size) this.deletedPlayers = new Set<Player>();

            if(this.emotes.size) this.emotes = new Set<Emote>();
            if(this.explosions.size) this.explosions = new Set<Explosion>();
            if(this.newBullets.size) this.newBullets = new Set<Bullet>();
            if(this.kills.size) this.kills = new Set<KillPacket>();
            if(this.roleAnnouncements.size) this.roleAnnouncements = new Set<RoleAnnouncementPacket>();
            if(this.damageRecords.size) this.damageRecords = new Set<DamageRecord>();

            this.gasDirty = false;
            this.gasCircleDirty = false;
            this.aliveCountDirty = false;

            // Stop the tick loop if the game is over
            if(this.over) {
                for(const player of this.connectedPlayers) {
                    try {
                        player.socket.close();
                    } catch(e) {}
                }
                return;
            }

            // Record performance and start the next tick
            const tickTime: number = Date.now() - tickStart;
            this.tickTimes.push(tickTime);
            if(this.tickTimes.length >= 200) {
                let tickSum = 0;
                for(const time of this.tickTimes) tickSum += time;
                log(`Average ms/tick: ${tickSum / this.tickTimes.length}`);
                this.tickTimes = [];
            }
            const newDelay: number = Math.max(0, 30 - tickTime);
            this.tick(newDelay);
        }, delay);
    }

    isInRedZone(position: Vec2): boolean {
        return distanceBetween(position, this.gas.currentPos) >= this.gas.currentRad;
    }

    get aliveCount(): number {
        return this.livingPlayers.size;
    }

    addPlayer(socket, name, loadout): Player {
        let spawnPosition;
        if(!this.allowJoin) spawnPosition = Vec2(360, 360);
        if(Debug.fixedSpawnLocation.length) spawnPosition = Vec2(Debug.fixedSpawnLocation[0], Debug.fixedSpawnLocation[1]);
        else if(this.gas.currentRad <= 16) spawnPosition = this.gas.currentPos.clone();
        else {
            let foundPosition = false;
            while(!foundPosition) {
                spawnPosition = this.map.getRandomPositionFor(ObjectKind.Player, undefined, 0, 1);
                if(!this.isInRedZone(spawnPosition)) foundPosition = true;
            }
        }

        const p = new Player(this.nextObjectId, spawnPosition, socket, this, name, loadout);
        this.players.add(p);
        this.connectedPlayers.add(p);
        this.newPlayers.add(p);
        this.aliveCountDirty = true;
        this.playerInfosDirty = true;
        this.updateObjects = true;
        if(!this.allowJoin) {
            p.dead = true;
            p.spectate(this.randomPlayer());
        } else {
            p.updateVisibleObjects();
            this.livingPlayers.add(p);
            this.spectatablePlayers.push(p);
            p.fullDirtyObjects.add(p);
        }
        this.dynamicObjects.add(p);
        this.fullDirtyObjects.add(p);

        p.sendPacket(new JoinedPacket(p));
        const stream = SurvivBitStream.alloc(32768);
        new MapPacket(p).serialize(stream);
        new UpdatePacket(this.allowJoin ? p : p.spectating!).serialize(stream);
        new AliveCountsPacket(this).serialize(stream);
        p.sendData(stream);

        if(this.aliveCount > 1 && !this.started) {
            this.started = true;
            Game.advanceRedZone(this);
        }

        return p;
    }

    static advanceRedZone(game: Game): void {
        if(Debug.disableRedZone) return;
        const currentStage = RedZoneStages[game.gas.stage + 1];
        if(!currentStage) return;
        game.gas.stage++;
        game.gas.mode = currentStage.mode;
        game.gas.initialDuration = currentStage.duration;
        game.gas.duration = 1;
        game.gas.countdownStart = Date.now();
        if(currentStage.mode === 1) {
            game.gas.posOld = game.gas.posNew.clone();
            if(currentStage.radNew !== 0) {
                game.gas.posNew = randomPointInsideCircle(game.gas.posOld, currentStage.radOld - currentStage.radNew);
            } else {
                game.gas.posNew = game.gas.posOld.clone();
            }
            game.gas.currentPos = game.gas.posOld.clone();
            game.gas.currentRad = currentStage.radOld;
        }
        game.gas.radOld = currentStage.radOld;
        game.gas.radNew = currentStage.radNew;
        game.gas.damage = currentStage.damage;
        game.gasDirty = true;
        game.gasCircleDirty = true;

        // Start the next stage
        if(currentStage.duration !== 0) {
            setTimeout(() => Game.advanceRedZone(game), currentStage.duration * 1000);
        }
    }

    removePlayer(p: Player): void {
        if(this.aliveCount > 0) {
            const randomPlayer = this.randomPlayer();
            for(const spectator of p.spectators) {
                spectator.spectate(randomPlayer);
            }
            p.spectators = new Set<Player>();
        } else {
            this.end();
        }

        if(p.spectating) {
            p.spectating.spectators.delete(p);
            p.spectating.spectatorCountDirty = true;
        }

        p.movingUp = false;
        p.movingDown = false;
        p.movingLeft = false;
        p.movingRight = false;
        p.shootStart = false;
        p.shootHold = false;
        p.isSpectator = false;
        p.spectating = undefined;

        this.livingPlayers.delete(p);
        this.connectedPlayers.delete(p);
        removeFrom(this.spectatablePlayers, p);

        if(!p.dead) {
            // If player is dead, alive count has already been decremented
            this.aliveCountDirty = true;

            if(p.inventoryEmpty) {
                this.dynamicObjects.delete(p);
                this.partialDirtyObjects.delete(p);
                this.fullDirtyObjects.delete(p);
                this.deletedPlayers.add(p);
                this.deletedObjects.add(p);
            } else {
                p.direction = Vec2(1, 0);
                p.disconnected = true;
                p.deadPos = p.body.getPosition().clone();
                this.fullDirtyObjects.add(p);
            }
        }
    }

    randomPlayer(): Player | undefined {
        if(this.aliveCount === 0) return;
        return [...this.livingPlayers][random(0, this.livingPlayers.size - 1)];
    }

    assignKillLeader(p: Player): void {
        this.killLeaderDirty = true;
        if(this.killLeader !== p || !p.dead) { // If the player isn't already the Kill Leader... //And isn't dead
            p.role = TypeToId.kill_leader;
            this.killLeader = p;
            this.roleAnnouncements.add(new RoleAnnouncementPacket(p, true, false));
        }
    }

    end(): void {
        log("Game ending");
        if(Config.stopServerOnGameEnd) process.exit(1);
        this.over = true;
        for(const p of this.connectedPlayers) {
            if(!p.disconnected) {
                try {
                    p.socket.close();
                } catch(e) {}
            }
        }
    }

    get nextObjectId(): number {
        this._nextObjectId++;
        return this._nextObjectId;
    }

    get nextGroupId(): number {
        this._nextGroupId++;
        return this._nextGroupId;
    }

}
