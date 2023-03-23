import { type WebSocket } from "uWebSockets.js";

import {
    AllowedBoost, AllowedEmotes, AllowedHeal,
    AllowedMelee,
    AllowedSkins,
    CollisionCategory,
    Config,
    Constants,
    type Emote,
    type Explosion,
    ObjectKind,
    removeFrom,
    SurvivBitStream,
    TypeToId
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
import { Loot } from "./loot";
import { Obstacle } from "./obstacle";

export class Player extends GameObject {
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

    meleeCooldown = 0;

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

    activeItems = {
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
        },
        scope: {
            typeString: "1xscope",
            typeId: TypeToId["1xscope"]
        }
    };

    actionItem: {
        typeString: string
        typeId: number
        duration: number
    };

    actionItemUseEnd: number;
    actionDirty = false;
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
        this.actionItem = { typeString: "", typeId: 0, duration: 0 };
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
        this.activeItems.melee.typeString = this.loadout.meleeType;
        this.activeItems.melee.typeId = this.loadout.melee;

        // Init body
        this.body = game.world.createBody({
            type: "dynamic",
            position,
            fixedRotation: true
        });
        this.body.createFixture({
            shape: Circle(1),
            friction: 0.0,
            density: 1.0,
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

        this.activeItems.scope.typeString = scope;
        this.activeItems.scope.typeId = TypeToId[scope];

        if(this.isMobile) this.zoom = Constants.scopeZoomRadius.mobile[scope];
        else this.zoom = Constants.scopeZoomRadius.desktop[scope];
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
        this.recalculateSpeed();
    }

    damage(amount: number, source, objectUsed?): void {
        let finalDamage: number = amount;
        finalDamage -= finalDamage * Constants.chestDamageReductionPercentages[this.chestLevel];
        finalDamage -= finalDamage * Constants.helmetDamageReductionPercentages[this.helmetLevel];
        if(this._health - finalDamage < 0) finalDamage += this._health - finalDamage;

        this.damageTaken += finalDamage;
        if(source instanceof Player) source.damageDealt += finalDamage;

        this._health -= finalDamage;
        this.healthDirty = true;

        if(this._health === 0) {
            this.boost = 0;
            this.dead = true;

            // Update role
            if(this.role === TypeToId.kill_leader) {
                this.game.roleAnnouncements.push(new RoleAnnouncementPacket(this, false, true, source));

                // Find a new Kill Leader
                let highestKillCount = 0;
                let highestKillsPlayer;
                for(const p of this.game.players) {
                    if(!p.dead && p.kills > highestKillCount) {
                        highestKillCount = p.kills;
                        highestKillsPlayer = p;
                    }
                }

                // If a new Kill Leader was found, assign the role.
                // Otherwise, leave it vacant.
                if(highestKillCount > 2) {
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
            this.game.fullDirtyObjects.push(this);

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

            // Remove from active players; send packets
            removeFrom(this.game.activePlayers, this);
            this.game.kills.push(new KillPacket(this, source, objectUsed));
            if(!this.disconnected) this.sendPacket(new GameOverPacket(this));
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

    useItem(typeString: string, duration: number): void {
        if(this.actionItem.typeId !== 0) return;
        this.actionItem.typeString = typeString;
        this.actionItem.typeId = TypeToId[typeString];
        this.actionItem.duration = duration;

        this.actionItemUseEnd = Date.now() + duration * 1000;
        this.actionDirty = true;

        this.actionType = Constants.Action.UseItem;
        this.actionSeq = 1;

        this.recalculateSpeed();
        this.game.fullDirtyObjects.push(this);
        this.fullDirtyObjects.push(this);
    }

    recalculateSpeed(): void {
        this.speed = Config.movementSpeed;
        this.diagonalSpeed = Config.diagonalSpeed;
        if(this.actionDirty) {
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
                maxX = this.position.x + this.xCullDist,
                minY = this.position.y - this.yCullDist,
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
                if(this.visibleObjects.includes(object) && !(object instanceof Player)) {
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
        stream.writeGameType(this.loadout.melee); // Active weapon (not necessarily melee)

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
