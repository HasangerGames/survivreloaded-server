import express from "express";
import http from "http";
import https from "https";
import compression from "compression";
import cookieParser from "cookie-parser";

import ws from "ws";
import fs from "fs";

import { ServerOptions, SurvivBitStream, Utils } from "./utils";
import { Game } from "./game/game.js";

const wsServer = new ws.Server({ noServer: true });
const game = new Game();
const app = express();

app.use(express.static("public"));
app.use(express.json());
app.use(compression());
app.use(cookieParser());

app.get("/api/site_info", (req, res) => {
    res.type("application/json");
    res.send(JSON.parse(fs.readFileSync("json/site_info.json") as unknown as string));
});

app.get("/api/games_modes", (req, res) => {
    res.type("application/json");
    // res.send(JSON.parse(fs.readFileSync("json/games_modes.json")));
    res.send([{ mapName: "main", teamMode: 1 }]);
});

app.get("/api/prestige_battle_modes", (req, res) => {
    res.type("application/json");
    res.send(JSON.parse(fs.readFileSync("json/prestige_battle_modes.json") as unknown as string));
});

app.post("/api/user/get_user_prestige", (req, res) => {
    res.type("application/json");
    res.send('"0"');
});

const addr = ServerOptions.addr || `${ServerOptions.host}:${ServerOptions.port}`;
app.post("/api/find_game", (req, res) => {
    res.send({ res: [{ zone: req.body.zones[0], gameId: game.id, useHttps: false, hosts: [addr], addrs: [addr] }] });
});

app.post("/api/user/profile", (req, res) => {
    res.type("application/json");
    const loadout = JSON.parse(fs.readFileSync("json/profile.json") as unknown as string);
    if(req.cookies.loadout) loadout.loadout = JSON.parse(req.cookies.loadout);
    res.send(loadout);
});

app.post("/api/user/loadout", (req, res) => {
    res.cookie("loadout", JSON.stringify(req.body.loadout), { maxAge: 2147483647 });
    res.type("application/json");
    res.send(req.body);
});

app.post("/api/user/load_exclusive_offers", (req, res) => {
    res.type("application/json");
    res.send({ success: true, data: [] });
});

app.post("/api/user/load_previous_offers", (req, res) => {
    res.type("application/json");
    res.send({ success: true, offers: {} });
});

app.post("/api/user/get_pass", (req, res) => {
    res.type("application/json");
    res.send(JSON.parse(fs.readFileSync("json/get_pass.json") as unknown as string));
});

let server;
if(ServerOptions.https) {
    server = https.createServer({
        key: fs.readFileSync(ServerOptions.keyFile, "utf8"),
        cert: fs.readFileSync(ServerOptions.certFile, "utf8")
    }, app);
} else {
    server = http.createServer(app);
}
server.listen(ServerOptions.port, ServerOptions.host);

server.on("upgrade", (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, socket => {
        wsServer.emit("connection", socket, req);
    });
});

function parseCookies(req): any {
    const list = {};
    const cookieHeader = req.headers?.cookie;
    if (!cookieHeader) return list;

    cookieHeader.split(`;`).forEach(cookie => {
        let [name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name) return;
        const value = rest.join(`=`).trim();
        if (!value) return;
        list[name] = decodeURIComponent(value);
    });

    return list;
}

wsServer.on("connection", (socket, req) => {
    const cookies: any = parseCookies(req);
    const p = game.addPlayer(socket, cookies["player-name"] ? cookies["player-name"] : "Player", cookies.loadout ? JSON.parse(cookies.loadout) : null);
    Utils.log("Player joined");

    socket.on("message", data => {
        const stream = new SurvivBitStream(data, 6);
        game.onMessage(stream, p);
    });

    socket.on("close", () => {
        Utils.log("Player quit");
        game.removePlayer(p);
    });
});

console.log("Surviv Reloaded Server v1.0.0");
// noinspection HttpUrlsUsage
console.log(`Listening on ${ServerOptions.https ? "https://" : "http://"}${addr}`);
console.log("Press Ctrl+C to exit.");

process.on("SIGINT", () => {
    console.log("Shutting down...");
    game.end();
    process.exit();
});
