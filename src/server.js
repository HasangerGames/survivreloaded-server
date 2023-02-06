const ws = require('ws');
const fs = require('fs');
const BitStream = require('bit-buffer').BitStream;
const {Vector, Utils, MsgType} = require('./utils.js');
const {Game, Emote} = require('./game/game.js');

const server = new ws.Server({ port: 8001 });

const game = new Game();

server.on('connection', socket => {
    const p = game.addPlayer(socket, 'Kris Kringle');
    console.log(`[${new Date()}] Kris Kringle joined`);

    socket.on('message', data => {
        const stream = new BitStream(data, 6);
        game.onMessage(stream, p);
    });

    socket.on('close', () => game.removePlayer(p));
});

console.log('SurvivReloaded Server v1.0.0');
console.log('Listening on 0.0.0.0:8001');
console.log('Press Ctrl+C to exit.');

process.on('SIGINT', function() {
    console.log("Shutting down...");
    game.end();
    process.exit();
});
