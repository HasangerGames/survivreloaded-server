import crypto from "crypto";
import Matter from "matter-js";

import { Emote, Explosion, GameOptions, InputType, MsgType, Utils, Vector } from "../utils";
import { Map } from "./map";
import { Player } from "./player";
import { Obstacle } from "./miscObjects";

class Game {
    id: string;
    map: Map;

    players: Player[];
    aliveCount: number = 0;
    playerInfosDirty: boolean = false;
    emotes: Emote[];
    explosions: Explosion[];
    dirtyObjects: number[];

    timer: NodeJS.Timer;

    engine: Matter.Engine;

    constructor() {
        this.id = crypto.createHash('md5').update(crypto.randomBytes(512)).digest('hex');

        this.players = [];

        this.emotes = [];
        this.explosions = [];
        this.dirtyObjects = [];

        this.timer = setInterval(() => this.tick(), GameOptions.tickDelta);
        this.engine = Matter.Engine.create();
        this.engine.gravity.scale = 0;

        this.map = new Map(this, "main");
    }

    tick() {
        Matter.Engine.update(this.engine, GameOptions.tickDelta);
        for(const p of this.players) {
            p.playerInfos = this.players;

            // TODO: Only check objects when player moves 1 unit. No reason to check every 0.2 units.

            // Movement
            const speed = GameOptions.movementSpeed, diagonalSpeed = speed / Math.sqrt(2);
            const oldPos = p.pos;
            if(p.movingLeft && p.movingUp) {
                const result = p.moveUp(diagonalSpeed);
                //if(!(result.collision && result.type == 0))
                    p.moveLeft(diagonalSpeed);
            } else if(p.movingRight && p.movingUp) {
                const result = p.moveUp(diagonalSpeed);
                //if(!(result.collision && result.type == 0))
                    p.moveRight(diagonalSpeed);
            } else if(p.movingLeft && p.movingDown) {
                const result = p.moveDown(diagonalSpeed);
                //if(!(result.collision && result.type == 0))
                    p.moveLeft(diagonalSpeed);
            } else if(p.movingRight && p.movingDown) {
                const result = p.moveDown(diagonalSpeed);
                //if(!(result.collision && result.type == 0))
                    p.moveRight(diagonalSpeed);
            } else {
                if(p.movingLeft) p.moveLeft(speed);
                if(p.movingRight) p.moveRight(speed);
                if(p.movingUp) p.moveUp(speed);
                if(p.movingDown) p.moveDown(speed);
            }
            if(p.movingUp || p.movingDown || p.movingLeft || p.movingRight) {
                p.skipObjectCalculations = false;

                // Collision detection w/ edges of map
                /*if(p.x() < 0) p.x() = 0;
                else if(p.x() > this.map.width) p.x() = this.map.width;
                if(p.pos.y < 0) p.pos.y = 0;
                else if(p.pos.y > this.map.height) p.pos.y = this.map.height;*/
            }

            // Send update
            p.playerDirty = true; // REMOVE ME LATER

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

                    // Check if the player is punching anything
                    for(const id of p.visibleObjectIds) {
                        const object = this.map.objects[id];
                        if(object instanceof Obstacle && object.destructible && p.canMelee(object)) {
                            object.damage(24);
                            if(object.isDoor) object.interact(p);
                            this.dirtyObjects.push(id);
                        }
                    }
                }
            }

            if(p.animActive) {
                p.playerDirty = true;
                p.animTime++;
                p.animSeq = 1;
                if(p.animTime > 8) {
                    p.animActive = false;
                    p.animType = p.animSeq = p.animTime = 0;
                }
            }

            if(this.emotes.length > 0) {
                p.emotesDirty = true;
                p.emotes = this.emotes;
            }

            if(this.explosions.length > 0) {
                p.explosionsDirty = true;
                p.explosions = this.explosions;
            }

            if(this.dirtyObjects.length > 0) {
                p.fullObjectsDirty = true;
                for(const id of this.dirtyObjects) {
                    if(p.visibleObjectIds.includes(id)) p.fullObjects.push(id);
                }
            }

            if(isNaN(p.x()) || isNaN(p.y())) {
                console.log("oopsie");
                Matter.Body.set(p.body, "position", { x: 360, y: 360 });
            }

            p.sendUpdate();
        }
        this.emotes = [];
        this.explosions = [];
        this.dirtyObjects = [];
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
                            for(const id of p.visibleObjectIds) {
                                const object = this.map.objects[id];
                                if(object instanceof Obstacle && object.isDoor
                                    && !object.dead && Utils.rectCollision(object.collisionMin, object.collisionMax, p.pos, 1 + object.interactionRad)) {
                                    object.interact(p);
                                    this.dirtyObjects.push(id);
                                }
                            }
                            break;
                    }
                }


                // Misc
                stream.readGameType();                      // Item in use
                stream.readBits(5);                         // Zeroes
                break;

            case MsgType.Emote:
                const pos = stream.readVec(Vector.create(0, 0), Vector.create(1024, 1024), 16);
                const type = stream.readGameType();
                const isPing = stream.readBoolean();
                stream.readBits(4); // Padding
                this.emotes.push(new Emote(p.id, pos, type, isPing));
                break;
        }
    }

    addPlayer(socket, username) {
        let spawnPos;
        if(global.DEBUG_MODE) spawnPos = Vector.create(450, 150);
        else spawnPos = Utils.randomVec(75, this.map.width - 75, 75, this.map.height - 75);
        
        const p = new Player(socket, this, username, spawnPos);
        p.id = this.map.objects.length;
        this.map.objects.push(p);
        this.players.push(p);
        this.aliveCount++;
        this.playerInfosDirty = true;
        p.onJoin();

        return p;
    }

    removePlayer(p) {
        this.players = this.players.splice(this.players.indexOf(p), 1);
    }

    addBody(body) {
        Matter.Composite.add(this.engine.world, body);
    }

    removeBody(body) {
        Matter.Composite.remove(this.engine.world, body);
    }
    
    end() {
        for(const p of this.players) {
            //p.sendDisconnect("Disconnected");
            this.players.splice(this.players.indexOf(p), 1);
        }
        clearInterval(this.timer);
    }

}

// @ts-ignore
export { Game };
