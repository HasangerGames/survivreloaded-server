import { type WebSocket } from "uWebSockets.js";

import {
    AllowedBoost,
    AllowedEmotes,
    AllowedHeal,
    AllowedMelee,
    AllowedSkins,
    AmmoTypes,
    clamp,
    Config,
    Constants,
    DamageType,
    deepCopy,
    degreesToRadians,
    Emote,
    ItemSlot,
    MedTypes,
    objectCollision,
    ObjectKind,
    randomBoolean,
    randomFloat,
    removeFrom,
    sameLayer,
    ScopeTypes,
    SurvivBitStream,
    TypeToId,
    unitVecToRadians,
    vec2Rotate,
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
import type { Explosion } from "../explosion";

// import { Building } from "./building";

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
    teamId: number;
    groupId: number;

    direction: Vec2 = Vec2(1, 0);
    distanceToMouse: number;
    scale = 1;

    private _zoom: number;
    xCullDist: number;
    yCullDist: number;

    visibleObjects = new Set<GameObject>(); // Objects the player can see
    partialDirtyObjects = new Set<GameObject>(); // Objects that need to be partially updated
    fullDirtyObjects = new Set<GameObject>(); // Objects that need to be fully updated
    deletedObjects = new Set<GameObject>(); // Objects that need to be deleted

    moving = false;
    movingUp = false;
    movingDown = false;
    movingLeft = false;
    movingRight = false;

    shooting = false;
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

    fullUpdate = true;
    playerStatusDirty = true;
    groupStatusDirty = false;
    planesDirty = false;
    airstrikeZonesDirty = false;
    mapIndicatorsDirty = false;
    activePlayerIdDirty = true;
    healthDirty = true;
    boostDirty = true;
    zoomDirty = true;
    weaponsDirty = true;
    inventoryDirty = true;
    inventoryEmpty = true;
    spectatorCountDirty = false;

    movesSinceLastUpdate = 0;

    isMobile: boolean;
    touchMoveDir: Vec2;

    emotes = new Set<Emote>();
    explosions = new Set<Explosion>();

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
        typeId: TypeToId["1xscope"]
    };

    weapons = [
        {
            typeString: "",
            typeId: 0,
            ammo: 0,
            cooldown: 0,
            cooldownDuration: 0,
            weaponType: WeaponType.Gun
        },
        {
            typeString: "",
            typeId: 0,
            ammo: 0,
            cooldown: 0,
            cooldownDuration: 0,
            weaponType: WeaponType.Gun
        },
        {
            typeString: "fists",
            typeId: TypeToId.fists,
            cooldown: 0,
            cooldownDuration: 250,
            weaponType: WeaponType.Melee
        },
        {
            typeString: "",
            typeId: 0,
            count: 0,
            cooldown: 0,
            cooldownDuration: 0,
            weaponType: WeaponType.Throwable
        }
    ];

    selectedWeaponSlot = 2;
    lastWeaponSlot = this.selectedWeaponSlot;

    actionItem: {
        typeString: string
        typeId: number
        duration: number
        useEnd: number
    };

    performActionAgain = false;
    lastActionType = 0;
    lastActionItem: { duration: number, typeString: string, typeId: number, useEnd: number };

    actionDirty = false;
    usingItem = false;
    actionType = 0;
    actionSeq = 0;

    lastShotHand: "right" | "left" = "right";

    speed = Config.movementSpeed;
    diagonalSpeed = Config.diagonalSpeed;

    role = 0;
    roleLost = false;

    joinTime: number;
    damageDealt = 0;
    damageTaken = 0;

    killedBy?: Player;

    spectators = new Set<Player>();
    spectating?: Player;

    isSpectator = false;
    spectateBegin = false;
    spectateNext = false;
    spectatePrevious = false;
    spectateForce = false;

    constructor(id: number, position: Vec2, socket: WebSocket<any>, game: Game, name: string, loadout) {
        super(game, "", position, 0);
        this.kind = ObjectKind.Player;

        // Misc
        this.game = game;
        this.map = this.game.map;
        this.socket = socket;
        this.teamId = this.groupId = this.game.nextGroupId;
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
        this.weapons[2].typeString = this.loadout.meleeType;
        this.weapons[2].typeId = this.loadout.melee;
        this.weapons[0].typeString = "m93r_dual";
        this.weapons[0].typeId = TypeToId.m93r_dual;
        this.inventory["9mm"] = 50;

        if(this.game.gas.stage >= 9) {
            this.inventory.bandage = 3;
            this.inventory["9mm"] = 30;
            this.inventory["762mm"] = 30;
            const weapon = randomBoolean() ? "m9" : "ot38";
            this.weapons[0].typeString = weapon;
            this.weapons[0].typeId = TypeToId[weapon];
            this.switchSlot(0);
        }
        /* Quickswitching test
        this.inventory["762mm"] = 120;
        this.weapons[0].typeString = "sv98";
        this.weapons[0].typeId = TypeToId.sv98;
        this.weapons[1].typeString = "sv98";
        this.weapons[1].typeId = TypeToId.sv98; */

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
        this.yCullDist = this._zoom * 1.25;
        this.zoomDirty = true;
    }

    spawnBullet(offset = 0, weaponTypeString: string): void {
        let shotFx = true;
        const weapon = Weapons[weaponTypeString];
        const spread = degreesToRadians(weapon.shotSpread);
        for(let i = 0; i < weapon.bulletCount; i++) {
            const angle = unitVecToRadians(this.direction) + randomFloat(-spread, spread);
            const bullet: Bullet = new Bullet(
              this,
            //   Vec2(this.position.x + 1.5 * Math.cos(angle), this.position.y + 1.5 * Math.sin(angle)),
              Vec2(this.position.x + (offset * Math.cos(angle + Math.PI / 2)) + 1.3 * Math.cos(angle), this.position.y + (offset * Math.sin(angle + Math.PI / 2)) + 1.3 * Math.sin(angle)),
              Vec2(Math.cos(angle), Math.sin(angle)),
              weapon.bulletType,
              this.activeWeapon,
              shotFx,
              this.layer,
              this.game
            );
            // usas
            if (weapon.toMouseHit) {
                bullet.maxDistance = Math.min(this.distanceToMouse, bullet.maxDistance * 2);
                bullet.clipDistance = true;
            }
            bullet.shotOffhand = this.lastShotHand === "right";
            this.game.bullets.add(bullet);
            this.game.newBullets.add(bullet);
            shotFx = false;
        }
    }

    setScope(scope: string, skipScope?: boolean): void {
        if(this.scope.typeString !== scope && skipScope && scope) {
            const direction = ScopeTypes.indexOf(scope) > ScopeTypes.indexOf(this.scope.typeString) ? 1 : -1;
            while(!this.inventory[scope]) {
                const newScope = ScopeTypes[clamp(ScopeTypes.indexOf(scope) + direction, 0, ScopeTypes.length - 1)];
                if(newScope === scope) break;
                scope = newScope;
            }
        }

        if(!this.inventory[scope]) return;

        this.scope.typeString = scope;
        this.scope.typeId = TypeToId[scope];

        if(this.isMobile) this.zoom = Constants.scopeZoomRadius.mobile[scope];
        else this.zoom = Constants.scopeZoomRadius.desktop[scope];
    }

    get activeWeapon(): any {
        return this.weapons[this.selectedWeaponSlot];
    }

    get activeWeaponInfo(): any {
        return Weapons[this.activeWeapon.typeString];
    }

    switchSlot(slot: number, skipSlots?: boolean): void {
        let chosenSlot = slot;
        this.resetSpeedAfterShooting(this);
        if(!this.weapons[chosenSlot]?.typeId && skipSlots) {
            const wrapSlots = (n: number): number => ((n % 4) + 4) % 4;

            if(!this.weapons[0].typeId && !this.weapons[1].typeId) return;
            const direction = this.selectedWeaponSlot < slot ? 1 : -1;
            chosenSlot = wrapSlots(chosenSlot + direction);
            while(!this.weapons[chosenSlot]?.typeId) {
                chosenSlot = wrapSlots(chosenSlot + direction);
            }
        } else if(!this.weapons[chosenSlot]?.typeId) return;

        this.cancelAction();
        if(this.selectedWeaponSlot !== slot) this.lastWeaponSlot = this.selectedWeaponSlot;
        this.selectedWeaponSlot = chosenSlot;

        if(chosenSlot === 2) this.activeWeapon.cooldownDuration = this.activeWeaponInfo.attack.cooldownTime * 1000;
        else this.activeWeapon.cooldownDuration = this.activeWeaponInfo.fireDelay * 1000;
        if((chosenSlot === 0 || chosenSlot === 1) && this.activeWeapon.ammo === 0) this.reload();

        this.weaponsDirty = true;
        this.game!.fullDirtyObjects.add(this);
        this.fullDirtyObjects.add(this);
    }

    dropItemInSlot(slot: number, item: string, skipItemSwitch?: boolean): void {
        if(this.weapons[slot].typeId === 0) return;
        // For guns
        if(this.weapons[slot].typeString === item) { // Only drop the gun if it's the same as the one we have, AND it's in the selected slot
            const isDualWielded = this.weapons[slot].typeString.endsWith("dual");
            if(this.weapons[slot].ammo as number > 0) {
                // Put the ammo in the gun back in the inventory
                const ammoType: string = Weapons[this.weapons[slot].typeString].ammo;
                (this.inventory[ammoType] as number) += (this.weapons[slot].ammo as number); // TODO Make this.inventory a Map to prevent this mess

                // If the new amount is more than the inventory can hold, drop the extra
                const overAmount: number = this.inventory[ammoType] - Constants.bagSizes[ammoType][this.backpackLevel];
                if(overAmount > 0) {
                    const droppedAmmo = splitUpLoot(this, ammoType, overAmount);
                    for(const l of droppedAmmo) {
                        this.game.dynamicObjects.add(l);
                        this.game.fullDirtyObjects.add(l);
                        this.game.updateObjects = true;
                    }
                    (this.inventory[ammoType] as number) -= overAmount;
                }
                this.inventoryDirty = true;
            }
            if(slot === ItemSlot.Melee) {
                this.weapons[slot] = {
                    typeString: "fists",
                    typeId: TypeToId.fists,
                    ammo: 0,
                    cooldown: 0,
                    cooldownDuration: 250,
                    weaponType: WeaponType.Melee
                };
            } else {
                this.weapons[slot] = {
                    typeString: "",
                    typeId: 0,
                    ammo: 0,
                    cooldown: 0,
                    cooldownDuration: 0,
                    weaponType: WeaponType.Gun
                };
            }
            if(this.selectedWeaponSlot === slot && !skipItemSwitch) this.switchSlot(2);
            this.cancelAction();
            this.weaponsDirty = true;
            if(isDualWielded) {
                const singleGun = item.substring(0, item.lastIndexOf("_"));
                // TODO: Adjust gun positions to reduce overlap.
                const loot = [
                    new Loot(this.game, singleGun, this.position, this.layer, 1),
                    new Loot(this.game, singleGun, this.position, this.layer, 1)
                ];
                for(const gun of loot) {
                    this.game.dynamicObjects.add(gun);
                    this.game.fullDirtyObjects.add(gun);
                }
            } else {
                const loot = new Loot(this.game, item, this.position, this.layer, 1);
                this.game.dynamicObjects.add(loot);
                this.game.fullDirtyObjects.add(loot);
            }
            this.game.updateObjects = true;
        }
        // For individual items
        if(slot === ItemSlot.Primary) {
            const inventoryCount = this.inventory[item];

            const isHelmet = item.startsWith("helmet");
            const isVest = item.startsWith("chest");

            this.cancelAction();

            if(isHelmet || isVest) {
                if(isHelmet) {
                    const level = this.helmetLevel;
                    if(level === 0) return;

                    const loot = new Loot(this.game, `helmet0${this.helmetLevel}`, this.position, this.layer, 1);
                    this.helmetLevel = 0;

                    this.fullDirtyObjects.add(this);
                    this.game.dynamicObjects.add(loot);
                    this.game.fullDirtyObjects.add(loot);
                    this.game.fullDirtyObjects.add(this);
                    this.game.updateObjects = true;
                } else {
                    const level = this.chestLevel;
                    if(level === 0) return;

                    const loot = new Loot(this.game, `chest0${this.chestLevel}`, this.position, this.layer, 1);
                    this.chestLevel = 0;

                    this.fullDirtyObjects.add(this);
                    this.game.dynamicObjects.add(loot);
                    this.game.fullDirtyObjects.add(loot);
                    this.game.fullDirtyObjects.add(this);
                    this.game.updateObjects = true;
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
                    this.game.dynamicObjects.add(loot);
                    this.game.fullDirtyObjects.add(loot);
                    this.game.updateObjects = true;
                    if(this.scope.typeString === item) {
                        return this.setScope(scopeToSwitchTo);
                    } else {
                        return;
                    }
                }

                let amountToDrop = Math.floor(inventoryCount / 2);

                amountToDrop = Math.max(1, amountToDrop);
                if(inventoryCount <= 15 && isAmmo && item === "9mm") {
                    amountToDrop = Math.min(15, inventoryCount);
                } else if(inventoryCount <= 10 && isAmmo && item === "762mm" || item === "556mm") {
                    amountToDrop = Math.min(10, inventoryCount);
                } else if(inventoryCount <= 5 && isAmmo && item === "12gauge") {
                    amountToDrop = Math.min(5, inventoryCount);
                } else if(inventoryCount <= 5 && isAmmo) {
                    amountToDrop = Math.min(5, inventoryCount);
                }
                this.inventory[item] = inventoryCount - amountToDrop;

                this.inventoryDirty = true;
                const loot = splitUpLoot(this, item, amountToDrop);
                for(const l of loot) {
                    this.game.dynamicObjects.add(l);
                    this.game.fullDirtyObjects.add(l);
                    this.game.updateObjects = true;
                }
            }
        }
    }

    swapWeaponSlots(): void {
        const primary = deepCopy(this.weapons[0]);
        this.weapons[0] = deepCopy(this.weapons[1]);
        this.weapons[1] = primary;

        let lastWep = this.lastWeaponSlot;
        if(this.selectedWeaponSlot === 0) this.switchSlot(1);
        else if(this.selectedWeaponSlot === 1) this.switchSlot(0);
        else this.switchSlot(this.selectedWeaponSlot);
        if (lastWep === 0) lastWep = 1;
        else if (lastWep === 1) lastWep = 0;
        this.lastWeaponSlot = lastWep;
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
            this.fullDirtyObjects.add(this);
            this.fullDirtyObjects.add(this);
        }
        this.cancelAction();

        // If the player is punching anything, damage the closest object
        let minDist = Number.MAX_VALUE;
        let closestObject;

        const weapon = Weapons[this.activeWeapon.typeString];
        const offset: Vec2 = Vec2.add(weapon.attack.offset, Vec2(1, 0).mul(this.scale - 1));
        const angle: number = unitVecToRadians(this.direction);

        const position: Vec2 = this.position.clone().add(vec2Rotate(offset, angle));
        const radius: number = weapon.attack.rad;

        for(const object of this.visibleObjects) {
            if(!object.dead && object !== this && sameLayer(this.layer, object.layer) && object.damageable) {
                const record = objectCollision(object, position, radius);
                if(record!.collided && record!.distance < minDist) {
                    minDist = record!.distance;
                    closestObject = object;
                }
            }
        }

        if(closestObject) {
            if(closestObject instanceof Player) {
                setTimeout(() => {
                    closestObject.damage(weapon.damage, this, this.activeWeapon);
                }, 90);
            } else {
                setTimeout(() => {
                    closestObject.damage(weapon.damage * weapon.obstacleDamage, this);
                }, 90);
            }
            if(closestObject.interactable) closestObject.interact(this);
        }
    }

    resetSpeedAfterShooting(player: Player): void {
        player.shooting = false;
        player.recalculateSpeed();
    }

    shootGun(): void {
        if(this.activeWeapon.ammo === 0) {
            this.shooting = false;
            this.reload();
            return;
        }
        const weapon = Weapons[this.activeWeapon.typeString];
        setTimeout(() => this.resetSpeedAfterShooting(this), weapon.fireDelay * 700); //Since RecoilTime is 1000000 on every gun in the data, approximate it with 70% of the time between shots.
        this.cancelAction();
        this.shooting = true;
        this.recalculateSpeed();
        const weaponTypeString = this.activeWeapon.typeString;
        //moved bullet spawning to its own function to clean up the burst logic
        //const spread = degreesToRadians(weapon.shotSpread);
        //let shotFx = true;
        let burstCount = 0;
        let burstDelay = 0;
        if(weapon.fireMode === "burst") {
            burstCount = weapon.burstCount;
            burstDelay = weapon.burstDelay;
        } else {
            burstCount = 1;
            burstDelay = 0;
        }
        for(let i = 0; i < burstCount; i++) { // TODO Update ammo count for every burst shot
            setTimeout(() => {
                // Get the dual offset of the weapon based on the current shooting hand.
                const offset = (weapon.dualOffset * (this.lastShotHand === "right" ? 1 : -1)) || 0;
                this.spawnBullet(offset, weaponTypeString);
                this.weaponsDirty = true;
            }, 1000 * i * burstDelay);
            this.activeWeapon.ammo--;
            if(this.activeWeapon.ammo < 0) this.activeWeapon.ammo = 0;
            if(this.activeWeapon.ammo === 0) {
                this.shooting = false;
                this.reload();
                return;
            }
            this.weaponsDirty = true;
        }

        if(weapon.isDual) {
            if(this.lastShotHand === "right") this.lastShotHand = "left";
            else this.lastShotHand = "right";
        }

        //moved bullet spawning to its own function to clean up burst logic
        /*
        for(let i = 0; i < weapon.bulletCount; i++) {
            const angle = unitVecToRadians(this.direction) + randomFloat(-spread, spread);
            const bullet: Bullet = new Bullet(
                this,
                Vec2(this.position.x + 1.5 * Math.cos(angle), this.position.y + 1.5 * Math.sin(angle)),
                Vec2(Math.cos(angle), Math.sin(angle)),
                weapon.bulletType,
                this.activeWeapon.typeId,
                shotFx,
                this.layer,
                this.game
            );
            this.game.bullets.add(bullet);
            this.game.newBullets.add(bullet);
            shotFx = false;
        }
        this.activeWeapon.ammo--;
        if(this.activeWeapon.ammo < 0) this.activeWeapon.ammo = 0;
        if(this.activeWeapon.ammo === 0) {
            this.shooting = false;
            this.reload();
        }
        this.weaponsDirty = true;
         */
    }

    useBandage(): void {
        if(this.health === 100 || this.inventory.bandage === 0) return;
        this.cancelAction();
        this.doAction("bandage", 3);
    }

    useMedkit(): void {
        if(this.health === 100 || this.inventory.healthkit === 0) return;
        this.cancelAction();
        this.doAction("healthkit", 6);
    }

    useSoda(): void {
        if(this.boost === 100 || this.inventory.soda === 0) return;
        this.cancelAction();
        this.doAction("soda", 3);
    }

    usePills(): void {
        if(this.boost === 100 || this.inventory.painkiller === 0) return;
        this.cancelAction();
        this.doAction("painkiller", 5);
    }

    doAction(typeString: string, duration: number, actionType?: number, skipRecalculateSpeed?: boolean): void {
        if(this.actionDirty) return;
        this.actionItem.typeString = typeString;
        this.actionItem.typeId = TypeToId[typeString];
        this.actionItem.duration = duration;
        this.actionItem.useEnd = Date.now() + duration * 1000;

        this.actionDirty = true;
        this.actionType = actionType ?? Constants.Action.UseItem;
        if(!actionType) this.usingItem = true;
        this.actionSeq = 1;

        if(!skipRecalculateSpeed) this.recalculateSpeed();
        this.game.fullDirtyObjects.add(this);
        this.fullDirtyObjects.add(this);
    }

    cancelAction(): void {
        if(this.actionType === Constants.Action.UseItem) {
            this.usingItem = false;
            this.recalculateSpeed();
        }
        this.actionItem.typeString = "";
        this.actionItem.typeId = 0;
        this.actionDirty = false;
        this.actionType = 0;
        this.actionSeq = 0;
        this.game.fullDirtyObjects.add(this);
        this.fullDirtyObjects.add(this);
    }

    reload(): void {
        if(this.shooting) return;
        const weaponInfo = this.activeWeaponInfo;
        if(this.activeWeapon.ammo !== weaponInfo.maxClip && this.inventory[weaponInfo.ammo] !== 0) { // ammo here refers to the TYPE of ammo used by the gun, not the quantity
            this.doAction(this.activeWeapon.typeString, weaponInfo.reloadTime, Constants.Action.Reload, true);
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

            // Set killedBy
            if(source instanceof Player && source !== this) this.killedBy = source;

            // Update role
            if(this.role === TypeToId.kill_leader) {
                this.game.roleAnnouncements.add(new RoleAnnouncementPacket(this, false, true, source));

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
            this.fullDirtyObjects.add(this);
            this.game.dynamicObjects.delete(this);
            this.game.deletedObjects.add(this);

            // Send death emote
            if(this.loadout.emotes[5] !== 0) {
                this.game.emotes.add(new Emote(this.id, this.position, this.loadout.emotes[5], false));
            }

            // Create dead body
            const deadBody = new DeadBody(this.game, this.layer, this.position, this.id);
            this.game.dynamicObjects.add(deadBody);
            this.game.fullDirtyObjects.add(deadBody);
            this.game.updateObjects = true;

            // Drop loot
            this.dropItemInSlot(0, this.weapons[0].typeString, true);
            this.dropItemInSlot(1, this.weapons[1].typeString, true);
            //if(this.weapons[2].typeString !== "fists") this.dropItemInSlot(2, this.weapons[2].typeString, true);
            for(const item in this.inventory) {
                if(item === "1xscope") continue;
                if(this.inventory[item] > 0) this.dropLoot(item);
            }
            if(this.helmetLevel > 0) this.dropLoot(`helmet0${this.helmetLevel}`);
            if(this.chestLevel > 0) this.dropLoot(`chest0${this.chestLevel}`);
            if(this.backpackLevel > 0) this.dropLoot(`backpack0${this.backpackLevel}`);
            this.selectedWeaponSlot = 2;
            this.weaponsDirty = true;
            this.inventoryDirty = true;

            // Remove from active players; send packets
            this.game.livingPlayers.delete(this);
            removeFrom(this.game.spectatablePlayers, this);
            this.game.kills.add(new KillPacket(this, damageType, source, objectUsed));
            if(!this.disconnected) this.sendPacket(new GameOverPacket(this));

            // Winning logic
            if(this.game.aliveCount <= 1) {
                if(this.game.aliveCount === 1) {
                    const lastManStanding: Player = [...this.game.livingPlayers][0];

                    // Send game over
                    lastManStanding.sendPacket(new GameOverPacket(lastManStanding, true));

                    // End the game in 750ms
                    setTimeout(() => {
                        if(lastManStanding.loadout.emotes[4] !== 0) { // Win emote
                            this.game.emotes.add(new Emote(lastManStanding.id, lastManStanding.position, lastManStanding.loadout.emotes[4], false));
                        }
                        this.game.end();
                    }, 750);
                } else {
                    setTimeout(() => this.game.end(), 750);
                }
            } else {
                let toSpectate;
                if(source instanceof Player && source !== this) toSpectate = source;
                else toSpectate = this.game.randomPlayer();
                for(const spectator of this.spectators) {
                    spectator.spectate(toSpectate);
                }
                this.spectators = new Set<Player>();
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
        this.game.dynamicObjects.add(loot);
        this.game.fullDirtyObjects.add(loot);
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
        if(this.shooting) {
            this.speed *= 0.5;
            this.diagonalSpeed *= 0.5;
        }
    }

    updateVisibleObjects(): void {
        this.movesSinceLastUpdate = 0;
        const newVisibleObjects = new Set<GameObject>(this.game.visibleObjects[this.zoom][Math.round(this.position.x / 10) * 10][Math.round(this.position.y / 10) * 10]);
        const minX = this.position.x - this.xCullDist,
          minY = this.position.y - this.yCullDist,
          maxX = this.position.x + this.xCullDist,
          maxY = this.position.y + this.yCullDist;
        for(const object of this.game.dynamicObjects) {
            if(this === object) continue;
            if(object.position.x > minX &&
              object.position.x < maxX &&
              object.position.y > minY &&
              object.position.y < maxY) {
                newVisibleObjects.add(object);
                if(!this.visibleObjects.has(object)) {
                    this.fullDirtyObjects.add(object);
                }
                if(object instanceof Player && !object.visibleObjects.has(this)) {
                    object.visibleObjects.add(this);
                    object.fullDirtyObjects.add(this);
                }
            } else {
                if(this.visibleObjects.has(object)) {
                    this.deletedObjects.add(object);
                }
            }
        }
        for(const object of newVisibleObjects) {
            if(!this.visibleObjects.has(object)) {
                this.fullDirtyObjects.add(object);
            }
        }
        for(const object of this.visibleObjects) {
            if(!newVisibleObjects.has(object)) {
                this.deletedObjects.add(object);
            }
        }
        this.visibleObjects = newVisibleObjects;
    }

    spectate(spectating?: Player): void {
        if(!spectating) {
            this.socket.close();
            this.game.removePlayer(this);
            return;
        }
        this.isSpectator = true;
        if(this.spectating) {
            this.spectating.spectators.delete(this);
            this.spectating.spectatorCountDirty = true;
        }
        this.spectating = spectating;
        spectating.spectators.add(this);
        spectating.healthDirty = true;
        spectating.boostDirty = true;
        spectating.zoomDirty = true;
        spectating.weaponsDirty = true;
        spectating.inventoryDirty = true;
        spectating.activePlayerIdDirty = true;
        spectating.spectatorCountDirty = true;
        spectating.updateVisibleObjects();
        for(const object of spectating.visibleObjects) {
            spectating.fullDirtyObjects.add(object);
        }
        spectating.fullDirtyObjects.add(spectating);
        if(spectating.partialDirtyObjects.size) spectating.partialDirtyObjects = new Set<GameObject>();
        spectating.fullUpdate = true;
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
        try {
            packet.serialize(stream);
        } catch(e) {
            console.error("Error serializing packet. Details:", e);
        }
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
