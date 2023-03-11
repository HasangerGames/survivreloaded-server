import { App, DEDICATED_COMPRESSOR_256KB, SSLApp } from "uWebSockets.js";
import cookie from "cookie";
import LiveDirectory from "live-directory";
import fs from "fs";

import {
    getContentType,
    log,
    MsgType,
    readJson,
    readPostedJson,
    ServerOptions,
    streamToBuffer,
    SurvivBitStream
} from "./utils";
import { Game } from "./game/game.js";
import { InputPacket } from "./packets/receiving/inputPacket";
import { EmotePacket } from "./packets/receiving/emotePacket";

const game = new Game();
let app;
if(ServerOptions.https) {
    app = SSLApp({
        key_file_name: fs.readFileSync(ServerOptions.keyFile, "utf8"),
        cert_file_name: fs.readFileSync(ServerOptions.certFile, "utf8")
    });
} else {
    app = App();
}
const staticFiles: LiveDirectory = new LiveDirectory("./public", { static: true });

const addr: string = ServerOptions.addr || `${ServerOptions.host}:${ServerOptions.port}`;

app.get("/*", async (res, req) => {
    const path: string = req.getUrl() === "/" ? "/index.html" : req.getUrl();
    const file = staticFiles.get(path);

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    res.onAborted(() => {});

    if(file === undefined) {
        res.writeStatus("404 Not Found");
        res.end(`<!DOCTYPE html><html lang="en"><body><pre>404 Not Found: ${req.getUrl()}</pre></body></html>`);
        return;
    }

    res = res.writeHeader("Content-Type", getContentType(path));

    if(file.cached) {
        res.end(file.content);
    } else {
        res.end(await streamToBuffer(file.stream()));
    }
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

app.post("/api/find_game", (res) => {
    readPostedJson(res, (body) => {
        res.writeHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ res: [{ zone: body.zones[0], gameId: game.id, useHttps: ServerOptions.useHttps, hosts: [addr], addrs: [addr] }] }));
    }, () => {
        log("/api/find_game: Error retrieving body");
    });
});

app.post("/api/user/profile", (res, req) => {
    const loadout = readJson("json/profile.json");
    const cookies = cookie.parse(req.getHeader("cookie"));
    if(cookies.loadout) loadout.loadout = JSON.parse(cookies.loadout);
    res.writeHeader("Content-Type", "application/json");
    res.end(JSON.stringify(loadout));
});

app.post("/api/user/loadout", (res) => {
    readPostedJson(res, (body) => {
        res.writeHeader("Set-Cookie", cookie.serialize("loadout", JSON.stringify(body.loadout), { maxAge: 2147483647 }));
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

// noinspection TypeScriptValidateJSTypes
app.ws("/play", {
    compression: DEDICATED_COMPRESSOR_256KB,
    idleTimeout: 30,
    upgrade: (res, req, context) => {
        res.upgrade({
                cookies: cookie.parse(req.getHeader("cookie"))
            },
            req.getHeader("sec-websocket-key"),
            req.getHeader("sec-websocket-protocol"),
            req.getHeader("sec-websocket-extensions"),
            context
        );
    },
    open: (socket) => {
        socket.player = game.addPlayer(socket, socket.cookies["player-name"] ? socket.cookies["player-name"] : "Player", socket.cookies.loadout ? JSON.parse(socket.cookies.loadout) : null);
        log(`"${socket.player.name}" joined`);
    },
    message: (socket, message) => {
        const stream = new SurvivBitStream(message, 0);
        try {
            const msgType = stream.readUint8();
            switch(msgType) {
                case MsgType.Input:
                    new InputPacket(socket.player).readData(stream);
                    break;
                case MsgType.Emote:
                    new EmotePacket(socket.player).readData(stream);
                    break;
            }
        } catch(e) {
            // console.warn("Error parsing message:", e);
        }
    },
    close: (socket) => {
        log(`"${socket.player.name}" quit`);
        game.removePlayer(socket.player);
    }
});

process.on("SIGINT", () => {
    console.log("Shutting down...");
    game.end();
    process.exit();
});

log("Surviv Reloaded Server v0.2.0");
app.listen(ServerOptions.host, ServerOptions.port, () => {
    // noinspection HttpUrlsUsage
    log(`Listening on ${ServerOptions.https ? "https://" : "http://"}${addr}`);
    log("Press Ctrl+C to exit.");
});
