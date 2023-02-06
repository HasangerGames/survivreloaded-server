const crypto = require('crypto');
const {GameOptions, Objects, MsgType, InputType, Utils, Vector} = require('../utils.js');
const {Map} = require('./map.js');
const {Player} = require('./player.js');

class Game {

    constructor() {
        this.id = crypto.createHash('md5').update(crypto.randomBytes(512)).digest('hex');

        this.map = new Map("main");

        this.players = [];

        this.emotes = [];
        this.explosions = [];
        this.dirtyObjects = [];

        this.timer = setInterval(() => this.tick(), GameOptions.tickDelta);
    }

    tick() {
        for(const p of this.players) {

            // TODO: Only check objects when player moves 1 unit. No reason to check every 0.2 units.
            // TODO: If collision is detected, move player as far as possible in the desired direction.

            // Movement
            const speed = GameOptions.movementSpeed, diagonalSpeed = speed / Math.sqrt(2);
            const oldPos = p.pos;
            if(p.movingLeft && p.movingUp) {
                const result = p.moveUp(diagonalSpeed);
                if(!(result.collision && result.type == 0))
                    p.moveLeft(diagonalSpeed);
            } else if(p.movingRight && p.movingUp) {
                const result = p.moveUp(diagonalSpeed);
                if(!(result.collision && result.type == 0))
                    p.moveRight(diagonalSpeed);
            } else if(p.movingLeft && p.movingDown) {
                const result = p.moveDown(diagonalSpeed);
                if(!(result.collision && result.type == 0))
                    p.moveLeft(diagonalSpeed);
            } else if(p.movingRight && p.movingDown) {
                const result = p.moveDown(diagonalSpeed);
                if(!(result.collision && result.type == 0))
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
                if(p.pos.x < 0) p.pos.x = 0;
                else if(p.pos.x > this.map.width) p.pos.x = this.map.width;
                if(p.pos.y < 0) p.pos.y = 0;
                else if(p.pos.y > this.map.height) p.pos.y = this.map.height;
            }

            // Send update
            p.playerDirty = true; // REMOVE ME LATER

            if(p.shootStart) {
                p.shootStart = false;
                if(!p.animActive) {
                    p.animActive = true;
                    p.animType = 1;
                    p.animTime = 0;
                }
            }

            if(p.animActive) {
                p.playerDirty = true;
                p.animTime++;
                p.animSeq = 1;
                if(p.animTime > 16) {
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
                for(const id of this.dirtyObjects) p.fullObjects.push(id);
            }

            for(const id of p.visibleObjectIds) {
                if(this.map.objects[id].damage) this.map.objects[id].damage(1);
            }

            p.sendUpdate();

            p.skipObjectCalculations = true;
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
                            //let minDist = Number.MAX_SAFE_INTEGER, minDistId = -1;
                            for(const id of p.visibleObjectIds) {
                                const object = this.map.objects[id];
                                if(object.isDoor && !object.dead && Utils.rectCollision(object.collisionMin, object.collisionMax, p.pos, 1 + object.interactionRad)) {
                                    object.interact(p);
                                    this.dirtyObjects.push(id);
                                    //const dist = Utils.distanceBetween(p.pos, object.doorHinge);
                                    //if( && dist < minDist) {
                                    //    minDist = dist;
                                    //    minDistId = id;
                                    //}
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
                const pos = stream.readVec(0, 0, 1024, 1024, 16);
                const type = stream.readBits(11);
                const isPing = stream.readBoolean();
                stream.readBits(4); // Zeroes
                this.emotes.push(new Emote(p.id, pos, type, isPing));
                break;
        }
    }

    addPlayer(socket, username) {
        let spawnPos;
        if(global.DEBUG_MODE) spawnPos = new Vector(450, 150);
        else spawnPos = Utils.randomVec(75, this.map.width - 75, 75, this.map.height - 75);
        
        const p = new Player(socket, this, username, spawnPos);
        p.id = this.map.objects.length;
        this.map.objects.push(p);
        this.players.push(p);
        p.onJoin();

        return p;
    }

    removePlayer(p) {
        this.players = this.players.remove(p);
    }

    end() {
        for(const p of this.players) {
            //p.sendDisconnect("Disconnected");
            this.players.remove(p);
        }
        clearInterval(this.timer);
    }

}

class Emote {
    constructor(playerId, pos, type, isPing) {
        this.playerId = playerId;
        this.pos = pos;
        this.type = type;
        this.isPing = isPing;
    }
}

class Explosion {
    constructor(pos, type, layer) {
        this.pos = pos;
        this.type = type;
        this.layer = layer;
    }
}

module.exports.Game = Game;
module.exports.Emote = Emote;
