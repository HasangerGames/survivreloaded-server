import { App, DEDICATED_COMPRESSOR_256KB, SSLApp } from "uWebSockets.js";
import cookie from "cookie";
import fs from "fs";

import { Config, Debug, getContentType, log, MsgType, readJson, readPostedJson, SurvivBitStream } from "./utils";
import { Game } from "./game/game.js";
import { InputPacket } from "./packets/receiving/inputPacket";
import { EmotePacket } from "./packets/receiving/emotePacket";
import { JoinPacket } from "./packets/receiving/joinPacket";

// Start the game
const game = new Game();

// Initialize the server
let app;
if(Config.https) {
    app = SSLApp({
        key_file_name: Config.keyFile,
        cert_file_name: Config.certFile
    });
} else {
    app = App();
}

const playerCounts = {};

// Set up static files
const staticFiles = {};
function walk(dir: string, files: string[] = []): string[] {
    if(dir.includes(".git") || dir.includes("src") || dir.includes(".vscode") || dir.includes(".idea")) return files;
    const dirFiles = fs.readdirSync(dir);
    for(const f of dirFiles) {
        const stat = fs.lstatSync(dir + "/" + f);
        if(stat.isDirectory()) {
            walk(dir + "/" + f, files);
        } else {
            files.push(dir.slice(6) + "/" + f);
        }
    }
    return files;
}
for(const file of walk("public")) {
    staticFiles[file] = fs.readFileSync("public" + file);
}

app.get("/*", async (res, req) => {
    const path: string = req.getUrl() === "/" ? "/index.html" : req.getUrl();
    let file: Buffer | undefined;
    if(Debug.disableStaticFileCache) {
        try {
            file = fs.readFileSync("public" + path);
        } catch(e) {
            file = undefined;
        }
    } else {
        file = staticFiles[path];
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    res.onAborted(() => {});

    if(file === undefined) {
        res.writeStatus("404 Not Found");
        res.end(`<!DOCTYPE html><html lang="en"><body><pre>404 Not Found: ${req.getUrl()}</pre></body></html>`);
        return;
    }

    res.writeHeader("Content-Type", getContentType(path)).end(file);
});

app.get("/api/site_info", (res) => {
    res.writeHeader("Content-Type", "application/json");
    res.end(fs.readFileSync("json/site_info.json"));
});

app.get("/api/games_modes", (res) => {
    res.writeHeader("Content-Type", "application/json");
    res.end(JSON.stringify([{ mapName: "main", teamMode: 1 }]));
});

app.get("/api/prestige_battle_modes", (res) => {
    res.writeHeader("Content-Type", "application/json");
    res.end(fs.readFileSync("json/prestige_battle_modes.json"));
});

app.post("/api/user/get_user_prestige", (res) => {
    res.writeHeader("Content-Type", "application/json");
    res.end('"0"');
});

const addr: string = Config.addr || `${Config.host}:${Config.port}`;
app.post("/api/find_game", (res) => {
    readPostedJson(res, (body) => {
        res.writeHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ res: [{ zone: body.zones[0], gameId: game.id, useHttps: Config.useHttps, hosts: [addr], addrs: [addr] }] }));
    }, () => {
        log("/api/find_game: Error retrieving body");
    });
});

app.post("/api/user/profile", (res, req) => {
    const loadout = readJson("json/profile.json");
    const cookies = cookie.parse(req.getHeader("cookie"));
    //console.log(cookies.loadout);
    if(cookies.loadout) loadout.loadout = JSON.parse(cookies.loadout);
    res.writeHeader("Content-Type", "application/json");
    res.end(JSON.stringify(loadout));
});

app.post("/api/user/loadout", (res) => {
    readPostedJson(res, (body) => {
        res.writeHeader("Set-Cookie", cookie.serialize("loadout", JSON.stringify(body.loadout), { path: "/", maxAge: 2147483647 }));
        res.writeHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body));
    }, () => {
        log("/api/user/loadout: Error retrieving body");
    });
});

app.post("/api/user/load_exclusive_offers", (res) => {
    res.writeHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true, data: [] }));
});

app.post("/api/user/load_previous_offers", (res) => {
    res.writeHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true, offers: {} }));
});

app.post("/api/user/get_pass", (res) => {
    res.writeHeader("Content-Type", "application/json");
    res.end(fs.readFileSync("json/get_pass.json"));
});

function getIP(socket): string {
    return new TextDecoder().decode(socket.getRemoteAddressAsText());
}

// noinspection TypeScriptValidateJSTypes
app.ws("/play", {
    compression: DEDICATED_COMPRESSOR_256KB,
    idleTimeout: 30,
    upgrade: (res, req, context) => {
        res.upgrade(
            {
                cookies: cookie.parse(req.getHeader("cookie"))
            },
            req.getHeader("sec-websocket-key"),
            req.getHeader("sec-websocket-protocol"),
            req.getHeader("sec-websocket-extensions"),
            context
        );
    },
    open: (socket) => {

        // Prevent too many players from joining from one IP
        const ip: string = getIP(socket);
        playerCounts[ip]++;
        if(playerCounts[ip] > 10) socket.close();

        socket.player = game.addPlayer(socket, socket.cookies["player-name"] ? socket.cookies["player-name"] : "Player", socket.cookies.loadout ? JSON.parse(socket.cookies.loadout) : null);
        log(`${socket.player.name} joined the game`);
    },
    message: (socket, message) => {
        const stream = new SurvivBitStream(message, 0);
        try {
            const msgType = stream.readUint8();
            switch(msgType) {
                case MsgType.Input:
                    new InputPacket(socket.player).deserialize(stream);
                    break;
                case MsgType.Emote:
                    new EmotePacket(socket.player).deserialize(stream);
                    break;
                case MsgType.Join:
                    new JoinPacket(socket.player).deserialize(stream);
                    break;
            }
        } catch(e) {
            console.warn("Error parsing message:", e);
        }
    },
    close: (socket) => {
        log(`${socket.player.name} left the game`);
        const ip: string = getIP(socket);
        playerCounts[ip]--;
        game.removePlayer(socket.player);
    }
});

process.on("SIGINT", () => {
    log("Shutting down...");
    game.end();
    process.exit();
});

log("Surviv Reloaded Server v0.3.0");
app.listen(Config.host, Config.port, () => {
    // noinspection HttpUrlsUsage
    log(`Listening on ${Config.https ? "https://" : "http://"}${Config.host}:${Config.port}`);
    log("Press Ctrl+C to exit.");
    if(Debug.autoStopServer) {
        setTimeout(() => process.exit(1), Debug.autoStopAfter);
    }
});
