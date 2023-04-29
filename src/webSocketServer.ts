import {
    App,
    DEDICATED_COMPRESSOR_256KB,
    SSLApp,
    type WebSocket
} from "uWebSockets.js";
import cookie from "cookie";

import { Game } from "./game/game";
import type { Player } from "./game/objects/player";

import { InputPacket } from "./packets/receiving/inputPacket";
import { EmotePacket } from "./packets/receiving/emotePacket";
import { JoinPacket } from "./packets/receiving/joinPacket";
import { DropItemPacket } from "./packets/receiving/dropItemPacket";
import { SpectatePacket } from "./packets/receiving/spectatePacket";

import { Config, log, MsgType, SurvivBitStream } from "./utils";

interface Socket extends WebSocket<Record<string, never>> {
    ip: string
    cookies: ReturnType<typeof cookie[`parse`]>
    player: Player
}

// Initialize the game.
let game = new Game();

// Initialize the server.
const app = Config.webSocketHttps
    ? SSLApp({
        key_file_name: Config.keyfile,
        cert_file_name: Config.certFile
    })
    : App();

// Bot protection.
const playerCounts = new Map<string, number>();
const connectionAttempts = new Map<string, number>();

const bannedIPs: string[] = [];

app.get(`/`, (res) => {
    res.writeStatus(`302`);
    res.writeHeader(`Location`, `https://resurviv.io`);
    res.end();
});

app.ws(`/play`, {
    compression: DEDICATED_COMPRESSOR_256KB,
    idleTimeout: 30,

    /**
     * Upgrade the connection to WebSocket.
     */
    upgrade: (res, req, context) => {
        // Start a new game if the old one is over.
        if (game.over) game = new Game();

        if (Config.botProtection) {
            const ip = req.getHeader(`cf-connecting-ip`);
            if (ip !== undefined) {
                if (bannedIPs.includes(ip)) return res.endWithoutBody(0, true);

                const playerIPCount = playerCounts.get(ip);
                const recentIPCount = connectionAttempts.get(ip);

                if (playerIPCount === undefined) playerCounts.set(ip, 1);
                if (recentIPCount === undefined) playerCounts.set(ip, 1);

                if (playerIPCount !== undefined && recentIPCount !== undefined) {
                    if (bannedIPs.includes(ip) || playerIPCount > 5 || recentIPCount > 40) {
                        if (!bannedIPs.includes(ip)) bannedIPs.push(ip);

                        log(`[IP BLOCK]: ${ip}`);
                        res.endWithoutBody(0, true);
                    } else {
                        playerCounts.set(ip, playerIPCount + 1);
                        connectionAttempts.set(ip, recentIPCount + 1);

                        log(`[${ip}] Concurrent connections: ${playerCounts.get(ip)}.`);
                        log(`[${ip}] Connections in last 30 seconds: ${connectionAttempts.get(ip)}.`);

                        res.upgrade(
                            {
                                cookies: cookie.parse(req.getHeader(`cookie`)),
                                ip
                            },
                            req.getHeader(`sec-websocket-key`),
                            req.getHeader(`sec-websocket-protocol`),
                            req.getHeader(`sec-weboscket-extensions`),
                            context
                        );
                    }
                }
            } else {
                res.upgrade(
                    {
                        cookies: cookie.parse(req.getHeader(`cookie`))
                    },
                    req.getHeader(`sec-websocket-key`),
                    req.getHeader(`sec-websocket-protocol`),
                    req.getHeader(`sec-websocket-extensions`),
                    context
                );
            }
        }
    },

    /**
     * Handle opening of the socket.
     * @param socket The socket being opened.
     */
    open: (socket: Socket) => {
        let playerName = socket.cookies[`player-name`];
        if (
            typeof playerName !== `string` ||
            playerName.length < 0 ||
            playerName.length > 16 ||
            playerName === `` ||
            playerName.length === playerName.split(` `).length
        ) playerName = `Player`;

        log(`"${socket.player.name}" joined the game.`);
        socket.player = game.addPlayer(socket, playerName, socket.cookies.loadout);
    },

    /**
     * Handle messages coming from the socket.
     * @param socket The socket in question.
     * @param message The message to handle.
     */
    message: (socket: Socket, message) => {
        const stream = new SurvivBitStream(message);
        try {
            const msgType = stream.readUint8();
            switch (msgType) {
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
        } catch (e) {
            console.warn(`Error parsing message:`, e);
        }
    },

    /**
     * Handle closing of the socket.
     * @param socket The socket being closed.
     */
    close: (socket: Socket) => {
        if (Config.botProtection) playerCounts.set(socket.ip, (playerCounts.get(socket.ip) ?? 0) - 1);

        log(`"${socket.player.name}" left the game.`);
        game.removePlayer(socket.player);
    }
});

process.stdout.on(`end`, () => {
    log(`WebSocket server shutting down...`);

    game?.end();
    process.exit();
});

app.listen(Config.websocketHost, Config.webSocketPort, () => {
    log(`WebSocket server listening on ${Config.webSocketHost}:${Config.webSocketPort}`);
    log(`Press Ctrl+C to exit.`);
});

// Clear connection attempts every 30 seconds.
if (Config.botProtection) {
    setInterval(() => {
        connectionAttempts.clear();
    }, 3e5);
}

export {
    app,
    game,
    type Socket
};
