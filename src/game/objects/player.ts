import { type WebSocket } from "uWebSockets.js";

import {
    AllowedBoost,
    AllowedEmotes,
    AllowedHeal,
    AllowedMelee,
    AllowedSkins, AmmoTypes, CollisionRecord, CollisionType,
    Config,
    Constants,
    DamageType,
    deepCopy, degreesToRadians, distanceToCircle, distanceToRect,
    Emote,
    type Explosion, ItemSlot, MedTypes,
    ObjectKind, randomFloat,
    removeFrom, ScopeTypes,
    SurvivBitStream,
    TypeToId, unitVecToRadians, vec2Rotate,
    Weapons,
    WeaponType
} from "../../utils";
import { DeadBody } from "./deadBody";
import { type SendingPacket } from "../../packets/sendingPacket";
import { KillPacket } from "../../packets/sending/killPacket";
import { type Map } from "../map";
import { type Game } from "../game";
import { GameObject } from "../gameObject";
import { type Body, Circle, Vec2 } from "planck";
import { RoleAnnouncementPacket } from "../../packets/sending/roleAnnouncementPacket";
import { GameOverPacket } from "../../packets/sending/gameOverPacket";
import { Loot, splitUpLoot } from "./loot";
import { Bullet } from "../bullet";
import { Obstacle } from "./obstacle";

export class Player extends GameObject {

    isPlayer = true;
    isObstacle = false;
    isBullet = false;
    isLoot = false;
    collidesWith = {
        player: false,
        obstacle: true,
        bullet: true,
        loot: false
    };

    socket: WebSocket<any>;
    map: Map;

    name: string;
    teamId = 1; // For 50v50?
    groupId: number;

    direction: Vec2 = Vec2(1, 0);
    scale = 1;

    private _zoom: number;
    xCullDist: number;
    yCullDist: number;

    visibleObjects: GameObject[] = []; // Objects the player can see
    partialDirtyObjects: GameObject[] = []; // Objects that need to be partially updated
    fullDirtyObjects: GameObject[] = []; // Objects that need to be fully updated
    deletedObjects: GameObject[] = []; // Objects that need to be deleted

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
    animTime = -1;

    private _health = 100; // The player's health. Ranges from 0-100.
    private _boost = 0; // The player's adrenaline. Ranges from 0-100.

    kills = 0;

    downed = false; // Whether the player is downed (knocked out)
    disconnected = false; // Whether the player has left the game
    deadPos: Vec2;

    damageable = true;

    firstUpdate = true;
    playerStatusDirty = true;
    groupStatusDirty = false;
    bulletsDirty = false;
    planesDirty = false;
    airstrikeZonesDirty = false;
    mapIndicatorsDirty = false;
    activePlayerIdDirty = true;
    healthDirty = true;
    boostDirty = true;
    inventoryDirty = true;
    inventoryEmpty = true;
    zoomDirty = true;
    weaponsDirty = true;

    movesSinceLastUpdate = 0;

    isMobile: boolean;
    touchMoveDir: Vec2;

    emotes: Emote[] = [];
    explosions: Explosion[] = [];

    body: Body; // The player's Planck.js Body

    loadout: {
        outfit: number
        melee: number
        meleeType: string
        heal: number
        boost: number
        emotes: number[]
    };

    backpackLevel = 0;
    chestLevel = 0;
    helmetLevel = 0;
    inventory = {
        "9mm": 0,
        "762mm": 0,
        "556mm": 0,
        "12gauge": 0,
        "50AE": 0,
        "308sub": 0,
        flare: 0,
        "45acp": 0,
        frag: 0,
        smoke: 0,
        strobe: 0,
        mirv: 0,
        snowball: 0,
        potato: 0,
        bandage: 0,
        healthkit: 0,
        soda: 0,
        painkiller: 0,
        "1xscope": 1,
        "2xscope": 0,
        "4xscope": 0,
        "8xscope": 0,
        "15xscope": 0
    };

    scope = {
        typeString: "1xscope",
        typeId: 310
    };

    weapons = {
        activeSlot: 2,
        primaryGun: {
            typeString: "",
            typeId: 0,
            ammo: 0
        },
        secondaryGun: {
            typeString: "",
            typeId: 0,
            ammo: 0
        },
        melee: {
            typeString: "fists",
            typeId: TypeToId.fists
        },
        throwable: {
            typeString: "",
            typeId: 0,
            count: 0
        }
    };

    activeWeapon = {
        typeString: "fists",
        typeId: 389,
        weaponType: WeaponType.Melee,
        cooldown: 0,
        cooldownDuration: 250
    };

    actionItem: {
        typeString: string
        typeId: number
        duration: number
        useEnd: number
    };

    actionDirty = false;
    usingItem = false;
    actionType = 0;
    actionSeq = 0;

    speed = Config.movementSpeed;
    diagonalSpeed = Config.diagonalSpeed;

    role = 0;
    roleLost = false;

    joinTime: number;
    damageDealt = 0;
    damageTaken = 0;

    constructor(id: number, position: Vec2, socket: WebSocket<any>, game: Game, name: string, loadout) {
        super(game, "", position, 0);
        this.kind = ObjectKind.Player;

        // Misc
        this.game = game;
        this.map = this.game.map;
        this.socket = socket;
        this.groupId = this.game.nextGroupId;
        this.name = name;
        this.zoom = Constants.scopeZoomRadius.desktop["1xscope"];
        this.actionItem = { typeString: "", typeId: 0, duration: 0, useEnd: -1 };
        this.joinTime = Date.now();

        // Set loadout
        if(AllowedSkins.includes(loadout?.outfit) &&
            AllowedMelee.includes(loadout.melee) &&
            AllowedHeal.includes(loadout.heal) &&
            AllowedBoost.includes(loadout.boost) &&
            loadout.emotes &&
            loadout.emotes.length === 6) {
            this.loadout = {
                outfit: TypeToId[loadout.outfit],
                melee: TypeToId[loadout.melee],
                meleeType: loadout.melee,
                heal: TypeToId[loadout.heal],
                boost: TypeToId[loadout.boost],
                emotes: []
            };
            for(const emote of loadout.emotes) {
                if(AllowedEmotes.includes(emote)) this.loadout.emotes.push(TypeToId[emote]);
                else this.loadout.emotes.push(TypeToId.emote_happyface);
            }
        } else {
            this.loadout = {
                outfit: TypeToId.outfitBase,
                melee: TypeToId.fists,
                meleeType: "fists",
                heal: TypeToId.heal_basic,
                boost: TypeToId.boost_basic,
                emotes: [TypeToId.emote_happyface, TypeToId.emote_thumbsup, TypeToId.emote_surviv, TypeToId.emote_sadface, 0, 0]
            };
        }
        this.weapons.melee.typeString = this.loadout.meleeType;
        this.weapons.melee.typeId = this.loadout.melee;
        this.activeWeapon.typeString = this.loadout.meleeType;
        this.activeWeapon.typeId = this.loadout.melee;

        // Init body
        this.body = game.world.createBody({
            type: "dynamic",
            position,
            fixedRotation: true
        });
        this.body.createFixture({
            shape: Circle(1),
            friction: 0.0,
            density: 1000.0,
            restitution: 0.0,
            userData: this
        });
    }

    setVelocity(xVel: number, yVel: number): void {
        this.body.setLinearVelocity(Vec2(xVel, yVel));
        if(xVel !== 0 || yVel !== 0) {
            this.moving = true;
            this.movesSinceLastUpdate++;
        }
    }

    get position(): Vec2 {
        return this.deadPos ? this.deadPos : this.body.getPosition();
    }

    get zoom(): number {
        return this._zoom;
    }

    set zoom(zoom: number) {
        this._zoom = zoom;
        this.xCullDist = this._zoom * 1.5;
        this.yCullDist = this._zoom;
        this.zoomDirty = true;
    }

    setScope(scope: string): void {
        if(!this.inventory[scope]) return;

        this.scope.typeString = scope;
        this.scope.typeId = TypeToId[scope];

        if(this.isMobile) this.zoom = Constants.scopeZoomRadius.mobile[scope];
        else this.zoom = Constants.scopeZoomRadius.desktop[scope];
    }

    switchSlot(slot: number): void { // TODO Make this.weapons into an array
        switch(slot) {
            case 0:
                if(this.weapons.primaryGun.typeId === 0) break;
                this.activeWeapon.typeString = this.weapons.primaryGun.typeString;
                this.activeWeapon.typeId = this.weapons.primaryGun.typeId;
                this.activeWeapon.cooldownDuration = Weapons[this.activeWeapon.typeString].fireDelay * 900;
                this.activeWeapon.weaponType = WeaponType.Gun;
                this.weapons.activeSlot = slot;
                break;
            case 1:
                if(this.weapons.secondaryGun.typeId === 0) break;
                this.activeWeapon.typeString = this.weapons.secondaryGun.typeString;
                this.activeWeapon.typeId = this.weapons.secondaryGun.typeId;
                this.activeWeapon.cooldownDuration = Weapons[this.activeWeapon.typeString].fireDelay * 1000;
                this.activeWeapon.weaponType = WeaponType.Gun;
                this.weapons.activeSlot = slot;
                break;
            case 2:
                if(this.weapons.melee.typeId === 0) break;
                this.activeWeapon.typeString = this.weapons.melee.typeString;
                this.activeWeapon.typeId = this.weapons.melee.typeId;
                this.activeWeapon.cooldownDuration = Weapons[this.activeWeapon.typeString].attack.cooldownTime * 1000;
                this.activeWeapon.weaponType = WeaponType.Melee;
                this.weapons.activeSlot = slot;
                break;
        }
        this.weaponsDirty = true;
        this.inventoryDirty = true;
        this.game!.fullDirtyObjects.push(this);
        this.fullDirtyObjects.push(this);
    }

    static readonly slots = ["primaryGun", "secondaryGun", "melee"];

    dropItemInSlot(slot: number, item: string): void {
        const slotIndex = Player.slots[slot];
        // For guns
        if(this.weapons[slotIndex].typeString === item) {
            // Only drop the gun if it's the same as the one we have, AND it's in the primary slot
            if(slot === ItemSlot.Melee) {
                this.weapons[slotIndex] = {
                    typeString: "fists",
                    typeId: TypeToId.fists,
                    ammo: 0
                };
            } else {
                this.weapons[slotIndex] = {
                    typeString: "",
                    typeId: 0,
                    ammo: 0
                };
            }
            if(this.weapons.activeSlot === slot) this.switchSlot(2);
            this.weaponsDirty = true;
            const loot = new Loot(this.game, item, this.position, this.layer, 1);
            this.game.objects.push(loot);
            this.game.fullDirtyObjects.push(loot);
        }
        // For individual items
        if(slot === ItemSlot.Primary) {
            const inventoryCount = this.inventory[item];

            const isHelmet = item.startsWith("helmet");
            const isVest = item.startsWith("chest");

            if(isHelmet || isVest) {
                if(isHelmet) {
                    const level = this.helmetLevel;
                    if(level === 0) return;

                    const loot = new Loot(this.game, `helmet0${this.helmetLevel}`, this.position, this.layer, 1);
                    this.helmetLevel = 0;

                    this.fullDirtyObjects.push(this);
                    this.game.objects.push(loot);
                    this.game.fullDirtyObjects.push(loot, this);
                } else {
                    const level = this.chestLevel;
                    if(level === 0) return;

                    const loot = new Loot(this.game, `chest0${this.chestLevel}`, this.position, this.layer, 1);
                    this.chestLevel = 0;

                    this.fullDirtyObjects.push(this);
                    this.game.objects.push(loot);
                    this.game.fullDirtyObjects.push(loot, this);
                }
            }

            if(inventoryCount) {
                const isAmmo = AmmoTypes.includes(item);
                const isMed = MedTypes.includes(item);
                const isScope = ScopeTypes.includes(item);

                if(isScope) {
                    if(inventoryCount === "1xscope") return;
                    let scopeToSwitchTo: string = ScopeTypes[ScopeTypes.indexOf(item) - 1];

                    let timeout = 0;
                    while(!this.inventory[scopeToSwitchTo]) {
                        scopeToSwitchTo = ScopeTypes[ScopeTypes.indexOf(scopeToSwitchTo) - 1];
                        if(++timeout > 8) return;
                    }

                    this.inventoryDirty = true;
                    this.inventory[item] = 0;

                    const loot = new Loot(this.game, item, this.position, this.layer, 1);
                    this.game.objects.push(loot);
                    this.game.fullDirtyObjects.push(loot);
                    return this.setScope(scopeToSwitchTo);
                }

                let amountToDrop = Math.floor(inventoryCount / 2);
                if(isMed && inventoryCount <= 3) amountToDrop = Math.ceil(inventoryCount / 2);

                amountToDrop = Math.max(1, amountToDrop);
                if(amountToDrop < 5 && isAmmo) amountToDrop = Math.min(5, inventoryCount);

                this.inventory[item] = inventoryCount - amountToDrop;

                this.inventoryDirty = true;
                const loot = splitUpLoot(this, item, amountToDrop);
                for(const l of loot) {
                    this.game.objects.push(l);
                    this.game.fullDirtyObjects.push(l);
                }
            }
        }
    }

    swapWeaponSlots(): void {
        const primary = deepCopy(this.weapons.primaryGun);
        this.weapons.primaryGun = deepCopy(this.weapons.secondaryGun);
        this.weapons.secondaryGun = primary;
        if(this.weapons.activeSlot === 0) this.switchSlot(1);
        else if(this.weapons.activeSlot === 1) this.switchSlot(0);
    }

    weaponCooldownOver(): boolean {
        return Date.now() - this.activeWeapon.cooldown >= this.activeWeapon.cooldownDuration;
    }

    useMelee(): void {
        // Start punching animation
        if(!this.animActive) {
            this.animActive = true;
            this.animType = 1;
            this.animSeq = 1;
            this.animTime = 0;
            this.fullDirtyObjects.push(this);
            this.fullDirtyObjects.push(this);
        }

        // If the player is punching anything, damage the closest object
        let minDist = Number.MAX_VALUE;
        let closestObject;

        const weapon = Weapons[this.activeWeapon.typeString];
        const offset: Vec2 = Vec2.add(weapon.attack.offset, Vec2(1, 0).mul(this.scale - 1));
        const angle: number = unitVecToRadians(this.direction);

        const position: Vec2 = this.position.clone().add(vec2Rotate(offset, angle));
        const radius: number = weapon.attack.rad;

        for(const object of this.visibleObjects) {
            if(!object.dead && object !== this && object.layer === this.layer && object.damageable && object.body) {
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
            closestObject.damage(weapon.damage, this);
            if(closestObject.interactable) closestObject.interact(this);
        }
    }

    shootGun(): void {
        const weapon = Weapons[this.activeWeapon.typeString];
        const spread = degreesToRadians(weapon.shotSpread);
        let shotFx = true;
        for(let i = 0; i < weapon.bulletCount; i++) {
            const angle = unitVecToRadians(this.direction) + randomFloat(-spread, spread);
            const bullet: Bullet = new Bullet(
                this,
                Vec2(this.position.x + weapon.barrelLength * Math.cos(angle), this.position.y + weapon.barrelLength * Math.sin(angle)),
                Vec2(Math.cos(angle), Math.sin(angle)),
                weapon.bulletType,
                this.activeWeapon.typeId,
                shotFx,
                this.layer,
                this.game
            );
            this.game.bullets.push(bullet);
            this.game.dirtyBullets.push(bullet);
            shotFx = false;
        }
    }

    get health(): number {
        return this._health;
    }

    set health(health: number) {
        this._health = health;
        if(this._health > 100) this._health = 100;
        if(this._health < 0) this._health = 0;
        this.healthDirty = true;
    }

    get boost(): number {
        return this._boost;
    }

    set boost(boost: number) {
        this._boost = boost;
        if(this._boost > 100) this._boost = 100;
        if(this._boost < 0) this._boost = 0;
        this.boostDirty = true;
    }

    damage(amount: number, source?, objectUsed?, damageType = DamageType.Player): void {
        if(this._health === 0) return;

        let finalDamage: number = amount;
        finalDamage -= finalDamage * Constants.chestDamageReductionPercentages[this.chestLevel];
        finalDamage -= finalDamage * Constants.helmetDamageReductionPercentages[this.helmetLevel];
        if(this._health - finalDamage < 0) finalDamage += this._health - finalDamage;

        this.damageTaken += finalDamage;
        if(source instanceof Player) source.damageDealt += finalDamage;

        this._health -= finalDamage;
        this.healthDirty = true;

        if(this._health <= 0) {
            this.boost = 0;
            this.dead = true;

            // Update role
            if(this.role === TypeToId.kill_leader) {
                this.game.roleAnnouncements.push(new RoleAnnouncementPacket(this, false, true, source));

                // Find a new Kill Leader
                let highestKillCount = 0;
                let highestKillsPlayer: Player | null = null;
                for(const p of this.game.players) {
                    if(!p.dead && p.kills > highestKillCount) {
                        highestKillCount = p.kills;
                        highestKillsPlayer = p;
                    }
                }

                // If a new Kill Leader was found, assign the role.
                // Otherwise, leave it vacant.
                if(highestKillsPlayer && highestKillCount > 2) {
                    this.game.assignKillLeader(highestKillsPlayer);
                } else {
                    this.game.killLeader = { id: 0, kills: 0 };
                    this.game.killLeaderDirty = true;
                }
            }
            this.roleLost = true;

            // Decrement alive count
            if(!this.disconnected) {
                this.game.aliveCount--;
                this.game.aliveCountDirty = true;
            }

            // Increment kill count for killer
            if(source instanceof Player && source !== this) {
                source.kills++;
                if(source.kills > 2 && source.kills > this.game.killLeader.kills) {
                    this.game.assignKillLeader(source);
                }
            }

            // Set static dead position
            this.deadPos = this.body.getPosition().clone();
            this.game.world.destroyBody(this.body);
            this.fullDirtyObjects.push(this);
            removeFrom(this.game.objects, this);
            this.game.deletedObjects.push(this);

            // Send death emote
            if(this.loadout.emotes[5] !== 0) {
                this.game.emotes.push(new Emote(this.id, this.position, this.loadout.emotes[5], false));
            }

            // Create dead body
            const deadBody = new DeadBody(this.game, this.layer, this.position, this.id);
            this.game.objects.push(deadBody);
            this.game.fullDirtyObjects.push(deadBody);

            // Drop loot
            for(const item in this.inventory) {
                if(item === "1xscope") continue;
                if(this.inventory[item] > 0) this.dropLoot(item);
            }
            if(this.helmetLevel > 0) this.dropLoot(`helmet0${this.helmetLevel}`);
            if(this.chestLevel > 0) this.dropLoot(`chest0${this.chestLevel}`);
            if(this.backpackLevel > 0) this.dropLoot(`backpack0${this.backpackLevel}`);
            this.weapons.activeSlot = 2;
            this.weaponsDirty = true;
            this.inventoryDirty = true;

            // Remove from active players; send packets
            removeFrom(this.game.activePlayers, this);
            this.game.kills.push(new KillPacket(this, damageType, source, objectUsed));
            if(!this.disconnected) this.sendPacket(new GameOverPacket(this));

            // Winning logic
            if(this.game.aliveCount <= 1) {
                if(this.game.aliveCount === 1) {
                    const lastManStanding: Player = this.game.activePlayers[0];

                    // Send game over
                    lastManStanding.sendPacket(new GameOverPacket(lastManStanding, true));

                    // End the game in 750ms
                    setTimeout(() => {
                        if(lastManStanding.loadout.emotes[4] !== 0) { // Win emote
                            this.game.emotes.push(new Emote(lastManStanding.id, lastManStanding.position, lastManStanding.loadout.emotes[4], false));
                        }
                        this.game.end();
                    }, 750);
                } else {
                    setTimeout(() => this.game.end(), 750);
                }
            }
        }
    }

    private dropLoot(type: string): void {

        // Create the loot
        const loot: Loot = new Loot(
            this.game,
            type,
            this.deadPos,
            this.layer,
            this.inventory[type]
        );

        // Add the loot to the array of objects
        this.game.objects.push(loot);
        this.game.fullDirtyObjects.push(loot);
    }

    useItem(typeString: string, duration: number, actionType?: number, skipRecalculateSpeed?: boolean): void {
        if(this.actionItem.typeId !== 0) return;
        this.actionItem.typeString = typeString;
        this.actionItem.typeId = TypeToId[typeString];
        this.actionItem.duration = duration;
        this.actionItem.useEnd = Date.now() + duration * 1000;

        this.actionDirty = true;
        this.actionType = actionType ?? Constants.Action.UseItem;
        if(!actionType) this.usingItem = true;
        this.actionSeq = 1;

        if(!skipRecalculateSpeed) this.recalculateSpeed();
        this.game!.fullDirtyObjects.push(this);
        this.fullDirtyObjects.push(this);
    }

    recalculateSpeed(): void {
        this.speed = Config.movementSpeed;
        this.diagonalSpeed = Config.diagonalSpeed;
        if(this.usingItem) {
            this.speed *= 0.5;
            this.diagonalSpeed *= 0.5;
        }
        if(this.boost >= 50) {
            this.speed *= 1.15;
            this.diagonalSpeed *= 1.15;
        }
    }

    updateVisibleObjects(): void {
        this.movesSinceLastUpdate = 0;
        const newVisibleObjects: GameObject[] = [];
        for(const object of this.game.objects) {
            if(this === object) continue;
            const minX = this.position.x - this.xCullDist,
                  minY = this.position.y - this.yCullDist,
                  maxX = this.position.x + this.xCullDist,
                  maxY = this.position.y + this.yCullDist;
            if(object.position.x > minX &&
                object.position.x < maxX &&
                object.position.y > minY &&
                object.position.y < maxY) {
                newVisibleObjects.push(object);
                if(!this.visibleObjects.includes(object)) {
                    this.fullDirtyObjects.push(object);
                }
            } else { // if object is not visible
                if(this.visibleObjects.includes(object)) {
                    this.deletedObjects.push(object);
                }
            }
        }
        this.visibleObjects = newVisibleObjects;
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
        const stream = SurvivBitStream.alloc(packet.allocBytes);
        packet.serialize(stream);
        this.sendData(stream);
    }

    sendData(stream: SurvivBitStream): void {
        try {
            this.socket.send(stream.buffer.subarray(0, Math.ceil(stream.index / 8)), true, true);
        } catch(e) {
            console.warn("Error sending packet. Details:", e);
        }
    }

    serializePartial(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeUnitVec(this.direction, 8);
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeGameType(this.loadout.outfit);
        stream.writeGameType(298 + this.backpackLevel); // Backpack
        stream.writeGameType(this.helmetLevel === 0 ? 0 : 301 + this.helmetLevel); // Helmet
        stream.writeGameType(this.chestLevel === 0 ? 0 : 305 + this.chestLevel); // Vest
        stream.writeGameType(this.activeWeapon.typeId);

        stream.writeBits(this.layer, 2);
        stream.writeBoolean(this.dead);
        stream.writeBoolean(this.downed);

        stream.writeBits(this.animType, 3);
        stream.writeBits(this.animSeq, 3);
        stream.writeBits(this.actionType, 3);
        stream.writeBits(this.actionSeq, 3);

        stream.writeBoolean(false); // Wearing pan
        stream.writeBoolean(false); // Indoors
        stream.writeBoolean(false); // Gun loaded
        stream.writeBoolean(false); // Heal effect?

        stream.writeBits(0, 2); // Unknown bits

        stream.writeBoolean(this.actionItem.typeId !== 0);
        if(this.actionItem.typeId !== 0) {
            stream.writeGameType(this.actionItem.typeId);
        }

        stream.writeBoolean(false); // Scale dirty
        stream.writeBoolean(false); // Perks dirty
        stream.writeAlignToNextByte();
    }

}
