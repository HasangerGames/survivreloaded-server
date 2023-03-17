import { type WebSocket } from "uWebSockets.js";

import {
    CollisionCategory,
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
    boost = 0; // The player's adrenaline. Ranges from 0-100.

    kills = 0;

    downed = false; // Whether the player is downed (knocked out)
    quit = false; // Whether the player has left the game
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
    zoomDirty = true;
    weaponsDirty = true;

    movesSinceLastUpdate = 0;

    useTouch: boolean;
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
        deathEffect: number
    };

    packLevel = 0;
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
        "40mm": 0,
        "45acp": 0,
        mine: 0,
        frag: 0,
        heart_frag: 0,
        smoke: 0,
        strobe: 0,
        mirv: 0,
        snowball: 0,
        water_balloon: 0,
        skitternade: 0,
        antiFire: 0,
        potato: 0,
        bandage: 0,
        healthkit: 0,
        soda: 0,
        chocolateBox: 0,
        bottle: 0,
        gunchilada: 0,
        watermelon: 0,
        nitroLace: 0,
        flask: 0,
        pulseBox: 0,
        painkiller: 0,
        "1xscope": 1,
        "2xscope": 0,
        "4xscope": 0,
        "8xscope": 0,
        "15xscope": 0,
        rainbow_ammo: 0
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
            typeId: 557
        },
        throwable: {
            typeString: "",
            typeId: 0,
            count: 0
        },
        scope: {
            typeString: "1xscope",
            typeId: 463
        }
    };

    role = 0;
    roleLost = false;

    constructor(id: number, position: Vec2, socket: WebSocket<any>, game: Game, username: string, loadout) {
        super(id, "", position, 0);
        this.kind = ObjectKind.Player;

        // Misc
        this.game = game;
        this.map = this.game.map;
        this.socket = socket;
        this.groupId = this.game.players.length - 1;
        this.name = username;
        this.zoom = Constants.scopeZoomRadius.desktop["1xscope"];

        // Set loadout
        if(loadout?.outfit && loadout.melee && loadout.heal && loadout.boost && loadout.emotes && loadout.deathEffect) {
            this.loadout = {
                outfit: TypeToId[loadout.outfit],
                melee: TypeToId[loadout.melee],
                meleeType: loadout.melee,
                heal: TypeToId[loadout.heal],
                boost: TypeToId[loadout.boost],
                emotes: [],
                deathEffect: TypeToId[loadout.deathEffect]
            };
            for(const emote of loadout.emotes) this.loadout.emotes.push(TypeToId[emote]);
        } else {
            this.loadout = {
                outfit: 690,
                melee: 557,
                meleeType: "fists",
                heal: 109,
                boost: 138,
                deathEffect: 0,
                emotes: [195, 193, 196, 194, 0, 0]
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
            filterCategoryBits: CollisionCategory.Player,
            filterMaskBits: CollisionCategory.Obstacle,
            filterGroupIndex: 1
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
        return this.dead ? this.deadPos : this.body.getPosition();
    }

    get zoom(): number {
        return this._zoom;
    }

    set zoom(zoom: number) {
        this._zoom = zoom;
        this.xCullDist = this._zoom * 1.5;
        this.yCullDist = this._zoom;
    }

    get health(): number {
        return this._health;
    }

    damage(amount: number, source): void {
        this._health -= amount;
        this.healthDirty = true;
        if(this._health < 0) this._health = 0;
        if(this._health === 0) {
            this.dead = true;
            if(this.role === TypeToId.kill_leader) {
                this.game!.roleAnnouncements.push(new RoleAnnouncementPacket(this, false, true, source));
                if(this.game!.killLeader === this) {
                    this.game!.killLeader = { id: 0, kills: 0 };
                    this.game!.killLeaderDirty = true;
                }
            }
            this.roleLost = true;
            if(!this.quit) {
                this.game!.aliveCount--;
                this.game!.aliveCountDirty = true;
            }
            if(source instanceof Player) {
                source.kills++;
                this.game!.kills.push(new KillPacket(this, source));
                if(source.kills > 2 && source.kills > this.game!.killLeader.kills) {
                    this.game!.killLeaderDirty = true;
                    if(this.game!.killLeader !== source) {
                        source.role = TypeToId.kill_leader;
                        //this.game!.dirtyStatusPlayers.push(source);
                        this.game!.killLeader = source;
                        this.game!.roleAnnouncements.push(new RoleAnnouncementPacket(source, true, false));
                    }
                }
            }
            this.deadPos = this.body.getPosition();
            this.game!.world.destroyBody(this.body);
            this.fullDirtyObjects.push(this);
            this.game!.fullDirtyObjects.push(this);
            const deadBody = new DeadBody(this.game!.nextObjectId, this.layer, this.position, this.id);
            this.game!.objects.push(deadBody);
            this.game!.fullDirtyObjects.push(deadBody);
            //this.game!.deletedPlayers.push(this);
            removeFrom(this.game!.activePlayers, this);
        }
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
        this.socket.send(stream.buffer.subarray(0, Math.ceil(stream.index / 8)), true, true);
    }

    serializePartial(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeUnitVec(this.direction, 8);
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeGameType(this.loadout.outfit);
        stream.writeGameType(451 + this.packLevel); // Backpack
        stream.writeGameType(this.helmetLevel === 0 ? 0 : 454 + this.helmetLevel); // Helmet
        stream.writeGameType(this.chestLevel === 0 ? 0 : 458 + this.chestLevel); // Vest
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
