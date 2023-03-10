"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const ws_1 = __importDefault(require("ws"));
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("./utils");
const game_js_1 = require("./game/game.js");
const wsServer = new ws_1.default.Server({ noServer: true });
const game = new game_js_1.Game();
const app = (0, express_1.default)();
app.use(express_1.default.static("public"));
app.use(express_1.default.json());
app.use((0, compression_1.default)());
app.use((0, cookie_parser_1.default)());
app.get("/api/site_info", (req, res) => {
    res.type("application/json");
    res.send(JSON.parse(fs_1.default.readFileSync("json/site_info.json")));
});
app.get("/api/games_modes", (req, res) => {
    res.type("application/json");
    //res.send(JSON.parse(fs.readFileSync("json/games_modes.json")));
    res.send([{ mapName: "main", teamMode: 1 }]);
});
app.get("/api/prestige_battle_modes", (req, res) => {
    res.type("application/json");
    res.send(JSON.parse(fs_1.default.readFileSync("json/prestige_battle_modes.json")));
});
app.post("/api/user/get_user_prestige", (req, res) => {
    res.type("application/json");
    res.send('"0"');
});
const addr = utils_1.ServerOptions.addr || `${utils_1.ServerOptions.host}:${utils_1.ServerOptions.port}`;
app.post("/api/find_game", (req, res) => {
    res.send({ res: [{ zone: req.body.zones[0], gameId: game.id, useHttps: false, hosts: [addr], addrs: [addr] }] });
});
app.post("/api/user/profile", (req, res) => {
    res.type("application/json");
    const loadout = JSON.parse(fs_1.default.readFileSync("json/profile.json"));
    if (req.cookies.loadout)
        loadout.loadout = JSON.parse(req.cookies.loadout);
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
    res.send(JSON.parse(fs_1.default.readFileSync("json/get_pass.json")));
});
let server;
if (utils_1.ServerOptions.https) {
    server = https_1.default.createServer({
        key: fs_1.default.readFileSync(utils_1.ServerOptions.keyFile, "utf8"),
        cert: fs_1.default.readFileSync(utils_1.ServerOptions.certFile, "utf8")
    }, app);
}
else {
    server = http_1.default.createServer(app);
}
server.listen(utils_1.ServerOptions.port, utils_1.ServerOptions.host);
server.on("upgrade", (req, socket, head) => {
    wsServer.handleUpgrade(req, socket, head, socket => {
        wsServer.emit("connection", socket, req);
    });
});
function parseCookies(req) {
    const list = {};
    const cookieHeader = req.headers?.cookie;
    if (!cookieHeader)
        return list;
    cookieHeader.split(`;`).forEach(function (cookie) {
        let [name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name)
            return;
        const value = rest.join(`=`).trim();
        if (!value)
            return;
        list[name] = decodeURIComponent(value);
    });
    return list;
}
wsServer.on("connection", (socket, req) => {
    const cookies = parseCookies(req);
    const p = game.addPlayer(socket, cookies["player-name"] ? cookies["player-name"] : "Player", cookies["loadout"] ? JSON.parse(cookies["loadout"]) : null);
    utils_1.Utils.log("Player joined");
    socket.on("message", data => {
        const stream = new utils_1.SurvivBitStream(data, 6);
        game.onMessage(stream, p);
    });
    socket.on("close", () => {
        utils_1.Utils.log("Player quit");
        game.removePlayer(p);
    });
});
console.log("Surviv Reloaded Server v1.0.0");
// noinspection HttpUrlsUsage
console.log(`Listening on ${utils_1.ServerOptions.https ? "https://" : "http://"}${addr}`);
console.log("Press Ctrl+C to exit.");
process.on("SIGINT", function () {
    console.log("Shutting down...");
    game.end();
    process.exit();
});
//# sourceMappingURL=server.js.map