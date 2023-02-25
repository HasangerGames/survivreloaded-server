const express = require("express");
const http = require("http");
const https = require("https");
const compression = require("compression");
const ws = require("ws");
const fs = require("fs");
const BitStream = require("bit-buffer").BitStream;

const {Vector, Utils, MsgType, ServerOptions} = require("./utils.js");
const {Game, Emote} = require("./game/game.js");


const wsServer = new ws.Server({ noServer: true });
const game = new Game();
const app = express();

app.use(express.static("public"));
app.use(express.json());
app.use(compression());

app.get("/api/site_info", (req, res) => {
    res.type("application/json");
    res.send(JSON.parse(fs.readFileSync("json/site_info.json")));
});

app.get("/api/games_modes", (req, res) => {
    res.type("application/json");
    //res.send(JSON.parse(fs.readFileSync("json/games_modes.json")));
    res.send([{ mapName: "main", teamMode: 1 }]);
});

app.get("/api/prestige_battle_modes", (req, res) => {
    res.type("application/json");
    res.send(JSON.parse(fs.readFileSync("json/prestige_battle_modes.json")));
});

app.post("/api/user/get_user_prestige", (req, res) => {
    res.type("application/json");
    res.send('"0"');
});

const addr = `${ServerOptions.host}:${ServerOptions.port}`;
app.post("/api/find_game", (req, res) => {
    res.send({res: [{ zone: req.body.zones[0], gameId: game.id, useHttps: false, hosts: [addr], addrs: [addr] }]});
    //if(usingLocal.get()) return object.toString();
    //else return HttpClient.newHttpClient().send(HttpRequest.newBuilder().uri(new URI("https://surviv.io/api/find_game")).header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString("{\"version\":131,\"region\":\"eu\",\"zones\":[\"fra\",\"waw\"],\"playerCount\":1,\"autoFill\":true,\"gameModeIdx\":0,\"isMobile\":false,\"adminCreate\":false,\"privCode\":false}")).build(), HttpResponse.BodyHandlers.ofString()).body();
});

app.post("/api/user/profile", (req, res) => {
    res.type("application/json");
    res.send(JSON.parse(fs.readFileSync("json/profile.json")));
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
    res.send(JSON.parse(fs.readFileSync("json/get_pass.json")));
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
server.listen(ServerOptions.port);

server.on("upgrade", (request, socket, head) => {
    wsServer.handleUpgrade(request, socket, head, socket => {
        wsServer.emit("connection", socket, request);
    });
});

wsServer.on("connection", socket => {
    const p = game.addPlayer(socket, "Player");
    console.log(`[${new Date()}] Player joined`);

    socket.on("message", data => {
        const stream = new BitStream(data, 6);
        game.onMessage(stream, p);
    });

    socket.on("close", () => game.removePlayer(p));
});

console.log("Surviv Reloaded Server v1.0.0");
console.log(`Listening on ${ServerOptions.https ? "https://" : "http://"}${addr}`);
console.log("Press Ctrl+C to exit.");

process.on("SIGINT", function() {
    console.log("Shutting down...");
    game.end();
    process.exit();
});
