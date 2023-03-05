import express from "express";
import http from "http";
import https from "https";
import compression from "compression";

import ws from "ws";
import fs from "fs";

import { ServerOptions, SurvivBitStream as BitStream, Utils } from "./utils";
import { Game } from "./game/game.js";


const wsServer = new ws.Server({ noServer: true });
const game = new Game();
const app = express();

app.use(express.static("public"));
app.use(express.json());
app.use(compression());

app.get("/api/site_info", (req, res) => {
    res.type("application/json");
    res.send(JSON.parse(fs.readFileSync("json/site_info.json") as unknown as string));
});

app.get("/api/games_modes", (req, res) => {
    res.type("application/json");
    //res.send(JSON.parse(fs.readFileSync("json/games_modes.json")));
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
    res.send({res: [{ zone: req.body.zones[0], gameId: game.id, useHttps: false, hosts: [addr], addrs: [addr] }]});
});

app.post("/api/user/profile", (req, res) => {
    res.type("application/json");
    res.send(JSON.parse(fs.readFileSync("json/profile.json") as unknown as string));
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

server.on("upgrade", (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, socket => {
        wsServer.emit("connection", socket, request);
    });
});

wsServer.on("connection", socket => {
    const p = game.addPlayer(socket, "Player");
    Utils.log("Player joined");

    socket.on("message", data => {
        const stream = new BitStream(data, 6);
        game.onMessage(stream, p);
    });

    socket.on("close", () => {
        Utils.log("Player quit");
        game.removePlayer(p);
    });
});

console.log("Surviv Reloaded Server v1.0.0");
console.log(`Listening on ${ServerOptions.https ? "https://" : "http://"}${addr}`);
console.log("Press Ctrl+C to exit.");

process.on("SIGINT", function() {
    console.log("Shutting down...");
    game.end();
    process.exit();
});
