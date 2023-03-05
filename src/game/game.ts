import crypto from "crypto";
import Matter from "matter-js";

import { Emote, Explosion, GameOptions, InputType, MsgType, Utils, Vector } from "../utils";
import { Map } from "./map";
import { Player } from "./objects/player";
import { Obstacle } from "./objects/obstacle";

class Game {
    id: string;
    map: Map;

    players: Player[];
    dirtyPlayers: Player[];
    aliveCount: number = 0;
    aliveCountDirty: boolean = false;
    playerInfosDirty: boolean = false;
    deletedPlayerIds: number[];
    emotes: Emote[];
    explosions: Explosion[];
    fullDirtyObjects: number[];
    partialDirtyObjects: number[];

    timer: NodeJS.Timer;

    engine: Matter.Engine;

    constructor() {
        this.id = crypto.createHash('md5').update(crypto.randomBytes(512)).digest('hex');

        this.players = [];

        this.emotes = [];
        this.explosions = [];
        this.fullDirtyObjects = [];

        this.timer = setInterval(() => this.tick(), GameOptions.tickDelta);
        this.engine = Matter.Engine.create();
        this.engine.gravity.scale = 0;

        this.map = new Map(this, "main");
    }

    private tick(): void {

        // Update physics engine
        Matter.Engine.update(this.engine, GameOptions.tickDelta);

        // First loop: Calculate movement & animations.
        for(const p of this.players) {
            if(p.dead || p.quit) continue;

            // TODO: Only check objects when player moves 1 unit. No reason to check every 0.2 units.

            // Movement
            p.notMoving = false;
            const s = GameOptions.movementSpeed, ds = GameOptions.diagonalSpeed;
            if(p.movingUp && p.movingLeft) p.setVelocity(-ds, ds);
            else if(p.movingUp && p.movingRight) p.setVelocity(ds, ds);
            else if(p.movingDown && p.movingLeft) p.setVelocity(-ds, -ds);
            else if(p.movingDown && p.movingRight) p.setVelocity(ds, -ds);
            else if(p.movingUp) p.setVelocity(0, s);
            else if(p.movingDown) p.setVelocity(0, -s);
            else if(p.movingLeft) p.setVelocity(-s, 0);
            else if(p.movingRight) p.setVelocity(s, 0);
            else {
                p.setVelocity(0, 0);
                if(!p.notMoving) p.setVelocity(0, 0);
                p.notMoving = true;
            }

            if(p.shootStart) {
                p.shootStart = false;
                if(Date.now() - p.meleeCooldown >= 250) {
                    p.meleeCooldown = Date.now();

                    // Start punching animation
                    if(!p.animActive) {
                        p.animActive = true;
                        p.animType = 1;
                        p.animTime = 0;
                    }

                    // If the player is punching anything, damage the closest object
                    let maxDepth: number = 0, closestObject = null;
                    for(const id of p.visibleObjects) {
                        const object = this.map.objects[id];
                        if(object.dead) continue;
                        if((object instanceof Obstacle && object.destructible) || object instanceof Player) {
                            const collision: Matter.Collision = p.meleeCollisionWith(object);
                            if(collision && collision.depth > maxDepth) {
                                maxDepth = collision.depth;
                                closestObject = object;
                            }
                        }
                    }
                    if(closestObject) {
                        closestObject.damage(p, 24);

                        if(closestObject.isDoor) closestObject.interact(p);

                        if(closestObject instanceof Obstacle) {
                            if(closestObject.dead) this.fullDirtyObjects.push(closestObject.id);
                            else this.partialDirtyObjects.push(closestObject.id);
                        }
                    }
                }
            }

            if(p.animActive) {
                this.fullDirtyObjects.push(p.id);
                p.fullObjects.push(p.id);
                p.animTime++;
                p.animSeq = 1;
                if(p.animTime > 8) {
                    p.animActive = false;
                    p.animType = p.animSeq = p.animTime = 0;
                }
            } else {
                this.partialDirtyObjects.push(p.id);
                p.partialObjects.push(p.id); // TODO Check for movement first
            }
        }

        // Second loop: calculate visible objects & send updates
        for(const p of this.players) {
            p.skipObjectCalculations = !this.fullDirtyObjects.length && !this.partialDirtyObjects.length && p.notMoving;

            if(this.emotes.length > 0) {
                p.emotesDirty = true;
                p.emotes = this.emotes;
            }

            if(this.explosions.length > 0) {
                p.explosionsDirty = true;
                p.explosions = this.explosions;
            }

            if(this.fullDirtyObjects.length > 0) {
                for(const id of this.fullDirtyObjects) {
                    if(p.visibleObjects.includes(id)) p.fullObjects.push(id);
                }
            }

            if(this.partialDirtyObjects.length > 0) {
                for(const id of this.partialDirtyObjects) {
                    if(p.visibleObjects.includes(id)) p.partialObjects.push(id);
                }
            }

            p.sendUpdate();
            if(this.aliveCountDirty) p.sendAliveCounts();
        }
        this.emotes = [];
        this.explosions = [];
        this.fullDirtyObjects = [];
        this.partialDirtyObjects = [];
        this.dirtyPlayers = [];
        this.deletedPlayerIds = [];
    }

    onMessage(stream, p) {
        const msgType = stream.readUint8();
        switch(msgType) {
            case MsgType.Input:
                stream.readUint8(); // Discard second byte (this.seq)

                // Movement and shooting
                p.movingLeft = stream.readBoolean();        // Left
                p.movingRight = stream.readBoolean();       // Right
                p.movingUp = stream.readBoolean();          // Up
                p.movingDown = stream.readBoolean();        // Down

                const shootStart = stream.readBoolean();
                p.shootStart = p.shootStart ? true : shootStart; // Shoot start
                p.shootHold = stream.readBoolean();              // Shoot hold
                stream.readBoolean();                            // Portrait
                stream.readBoolean();                            // Touch move active

                // Direction
                const direction = stream.readUnitVec(10);
                if(p.dir != direction) {
                    p.dir = direction;
                    p.skipObjectCalculations = false;
                }
                stream.readFloat(0, 64, 8);                 // Distance to mouse


                // Other inputs
                const inputCount = stream.readBits(4);
                for(let i = 0; i < inputCount; i++) {
                    const input = stream.readUint8();
                    switch(input) {
                        case InputType.Interact:
                            for(const id of p.visibleObjects) {
                                const object = this.map.objects[id];
                                if(object instanceof Obstacle && object.isDoor && !object.dead) {
                                    const interactionBody: Matter.Body = Matter.Bodies.circle(p.pos.x, p.pos.y, 1 + object.interactionRad);
                                    const collisionResult: Matter.Collision = Matter.Collision.collides(interactionBody, object.body);
                                    if(collisionResult && collisionResult.collides) {
                                        object.interact(p);
                                        this.partialDirtyObjects.push(id);
                                    }
                                }
                            }
                            break;
                    }
                }

                // Misc
                stream.readGameType();   // Item in use
                stream.readBits(5); // Zeroes
                break;

            case MsgType.Emote:
                const pos = stream.readVec(0, 0, 1024, 1024, 16);
                const type = stream.readGameType();
                const isPing = stream.readBoolean();
                stream.readBits(4); // Padding
                if(!p.dead) this.emotes.push(new Emote(p.id, pos, type, isPing));
                break;
        }
    }

    addPlayer(socket, username) {
        let spawnPos;
        if(GameOptions.debugMode) spawnPos = Vector.create(450, 150);
        else spawnPos = Utils.randomVec(75, this.map.width - 75, 75, this.map.height - 75);
        
        const p = new Player(socket, this, username, spawnPos);
        p.id = this.map.objects.length;
        this.map.objects.push(p);
        this.players.push(p);
        this.dirtyPlayers.push(p);
        this.fullDirtyObjects.push(p.id);
        this.aliveCount++;
        this.aliveCountDirty = true;
        this.playerInfosDirty = true;
        p.onJoin();

        return p;
    }

    removePlayer(p) {
        p.dir = Vector.create(1, 0);
        p.quit = true;
        this.deletedPlayerIds.push(p.id);
        this.partialDirtyObjects.push(p.id);
        this.aliveCount--;
        this.aliveCountDirty = true;
    }

    addBody(body) {
        Matter.Composite.add(this.engine.world, body);
    }

    removeBody(body) {
        Matter.Composite.remove(this.engine.world, body);
    }
    
    end() {
        for(const p of this.players) p.socket.close();
        clearInterval(this.timer);
    }

}

// @ts-ignore
export { Game };
