const crypto = require('crypto');
const {Settings, Utils, Vector, MsgType} = require('../utils.js');
const {Packet} = require('../packet/packet.js');
const {UpdatePacket} = require('../packet/updatePacket.js');
const {MapPacket} = require('../packet/mapPacket.js');
const {Map} = require('./map.js');
const {Player} = require('./player.js');

class Game {

    constructor() {
        this.id = crypto.createHash('md5').update(crypto.randomBytes(512)).digest('hex');

        this.map = new Map();

        this.players = [];
        this.emotes = [];

        this.timer = setInterval(() => this.tick(), Settings.tickDelta);
    }

    tick() {
        for(const p of this.players) {

            // Movement
            const ms = Settings.movementSpeed, msq = ms / Math.sqrt(2);
            if(p.movingLeft && p.movingUp) {
                p.pos.x -= msq;
                p.pos.y += msq;
            } else if(p.movingRight && p.movingUp) {
                p.pos.x += msq;
                p.pos.y += msq;
            } else if(p.movingLeft && p.movingDown) {
                p.pos.x -= msq;
                p.pos.y -= msq;
            } else if(p.movingRight && p.movingDown) {
                p.pos.x += msq;
                p.pos.y -= msq;
            } else {
                if(p.movingLeft) p.pos.x -= ms;
                if(p.movingRight) p.pos.x += ms;
                if(p.movingUp) p.pos.y += ms;
                if(p.movingDown) p.pos.y -= ms;
            }

            // Collision detection w/ edges of map
            if(p.pos.x < 0) p.pos.x = 0;
            else if(p.pos.x > this.map.width) p.pos.x = this.map.width;
            if(p.pos.y < 0) p.pos.y = 0;
            else if(p.pos.y > this.map.height) p.pos.y = this.map.height;

            // Send update
            if(p.shootStart) {
                p.shootStart = false;
                if(!p.animActive) {
                    p.animActive = true;
                    p.animType = 1;
                    p.animTime = 0;
                }
            }
            if(p.animActive) {
                p.animTime++;
                p.animSeq = 1;
                if(p.animTime > 16) {
                    p.animActive = false;
                    p.animType = p.animTime = 0;
                }
            }
            if(this.emotes.length > 0) {
                p.emotesDirty = true;
                p.emotes = this.emotes;
            }

            p.sendUpdate();
        }
        this.emotes = [];
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
                p.shootStart = p.shootStart ? true : shootStart;        // Shoot start
                p.shootHold = stream.readBoolean();         // Shoot hold
                stream.readBoolean();                       // Portrait
                stream.readBoolean();                       // Touch move active

                // Direction
                p.dir = stream.readUnitVec(10);             // Direction
                stream.readFloat(0, 64, 8);                 // Distance to mouse

                // Other inputs
                const inputCount = stream.readBits(4);
                for(let i = 0; i < inputCount; i++)
                    stream.readUint8();

                stream.readBits(11);                        // Item in use
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
        const p = new Player(socket, username, this.map, Utils.randomVec(75, this.map.width - 75, 75, this.map.height - 75));
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

module.exports.Game = Game;
module.exports.Emote = Emote;
