import { App, DEDICATED_COMPRESSOR_256KB, SSLApp } from "uWebSockets.js";
import cookie from "cookie";

import { Config, log, MsgType, SurvivBitStream } from "./utils";
import { Game } from "./game/game.js";
import { InputPacket } from "./packets/receiving/inputPacket";
import { EmotePacket } from "./packets/receiving/emotePacket";
import { JoinPacket } from "./packets/receiving/joinPacket";
import { DropItemPacket } from "./packets/receiving/dropItemPacket";
import { SpectatePacket } from "./packets/receiving/spectatePacket";

// Start the game
let game = new Game();

// Initialize the server
let app;
if(Config.webSocketHttps) {
    app = SSLApp({
        key_file_name: Config.keyFile,
        cert_file_name: Config.certFile
    });
} else {
    app = App();
}

const playerCounts = {};
let connectionAttempts = {};
const bannedIPs: string[] = [];

app.get("/", (res) => {
    res.writeStatus("302");
    res.writeHeader("Location", "https://resurviv.io");
    res.end();
});

// noinspection TypeScriptValidateJSTypes
app.ws("/play", {
    compression: DEDICATED_COMPRESSOR_256KB,
    idleTimeout: 30,
    upgrade: (res, req, context) => {
        if(game.over) game = new Game(); // Start a new game if the old one is over
        if(Config.botProtection) {
            const ip = req.getHeader("cf-connecting-ip");
            if(bannedIPs.includes(ip) || playerCounts[ip] >= 5 || connectionAttempts[ip] >= 40) {
                if(!bannedIPs.includes(ip)) bannedIPs.push(ip);
                res.endWithoutBody(0, true);
                log(`Connection blocked: ${ip}`);
            } else {
                if(!playerCounts[ip]) playerCounts[ip] = 1;
                else playerCounts[ip]++;
                if(!connectionAttempts[ip]) connectionAttempts[ip] = 1;
                else connectionAttempts[ip]++;
                log(`${playerCounts[ip]} simultaneous connections: ${ip}`);
                log(`${connectionAttempts[ip]} connection attempts in the last 30 seconds: ${ip}`);
                res.upgrade(
                    {
                        cookies: cookie.parse(req.getHeader("cookie")),
                        ip
                    },
                    req.getHeader("sec-websocket-key"),
                    req.getHeader("sec-websocket-protocol"),
                    req.getHeader("sec-websocket-extensions"),
                    context
                );
            }
        } else {
            res.upgrade(
                {
                    cookies: cookie.parse(req.getHeader("cookie"))
                },
                req.getHeader("sec-websocket-key"),
                req.getHeader("sec-websocket-protocol"),
                req.getHeader("sec-websocket-extensions"),
                context
            );
        }
    },
    open: (socket) => {
        let playerName: string = socket.cookies["player-name"];
        if(!playerName || playerName.length > 16) playerName = "Player";
        socket.player = game.addPlayer(socket, playerName, socket.cookies.loadout ? JSON.parse(socket.cookies.loadout) : null);
        log(`${socket.player.name} joined the game`);
    },
    message: (socket, message) => {
        const stream = new SurvivBitStream(message);
        try {
            const msgType = stream.readUint8();
            switch(msgType) {
                case MsgType.Input:
                    new InputPacket(socket.player).deserialize(stream);
                    break;
                case MsgType.DropItem:
                    new DropItemPacket(socket.player).deserialize(stream);
                    break;
                case MsgType.Emote:
                    new EmotePacket(socket.player).deserialize(stream);
                    break;
                case MsgType.Join:
                    new JoinPacket(socket.player).deserialize(stream);
                    break;
                case MsgType.Spectate:
                    new SpectatePacket(socket.player).deserialize(stream);
                    break;
            }
        } catch(e) {
            console.warn("Error parsing message:", e);
        }
    },
    close: (socket) => {
        if(Config.botProtection) playerCounts[socket.ip]--;
        log(`${socket.player.name} left the game`);
        game.removePlayer(socket.player);
    }
});

process.stdout.on("end", () => {
    log("WebSocket server shutting down...");
    game.end();
    process.exit();
});

app.listen(Config.webSocketHost, Config.webSocketPort, () => {
    // noinspection HttpUrlsUsage
    log(`WebSocket server listening on ${Config.webSocketHost}:${Config.webSocketPort}`);
    log("Press Ctrl+C to exit.");
});

if(Config.botProtection) {
    setInterval(() => {
        connectionAttempts = {};
    }, 30000);
}
