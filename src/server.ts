import { version } from "../package.json";

import {
    App,
    SSLApp
} from "uWebSockets.js";
import cookie from "cookie";

import { type ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

import { Config, Debug } from "./utils/data";
import { getContentType, log, readDirectory, readPostedJSON } from "./utils/misc";

// Initialize the server.
const app = Config.webSocketHttps
    ? SSLApp({
        key_file_name: Config.keyFile,
        cert_file_name: Config.certFile
    })
    : App();

const staticFiles: Record<string, Buffer> = {};
for (const file of readDirectory(path.resolve(__dirname, "../../public"))) staticFiles[file.replace("\\", "/")] = fs.readFileSync(file);

app.get("/*", (res, req) => {
    /* eslint-disable-next-line @typescript-eslint/no-empty-function */
    res.onAborted(() => {});

    const path = req.getUrl() === "/" ? "/index.html" : req.getUrl();

    let file: Buffer | undefined;

    if (Debug.disableStaticFileCache) {
        try {
            file = fs.readFileSync(`public${path}`);
        } catch (e) {
            file = undefined;
        }
    } else file = staticFiles[path];

    if (file === undefined) {
        res.writeStatus("404 Not Found");
        res.end(`<!DOCTYPE html><html lang="en"><body><pre>404 Not Found: ${req.getUrl()}</pre></body></html>`);
        return;
    }

    res.writeHeader("Content-Type", getContentType(path)).end(file);
});

app.get("/api/site_info", res => {
    res.writeHeader("Content-Type", "application/json");
    res.end(fs.readFileSync(path.resolve(__dirname, "../../json/site_info.json")));
});

app.get("/api/games_modes", res => {
    res.writeHeader("Content-Type", "application/json");
    res.end(JSON.stringify([{ mapName: "main", teamMode: 1 }]));
});

app.get("/api/prestige_battle_modes", res => {
    res.writeHeader("Content-Type", "application/json");
    res.end(fs.readFileSync(path.resolve(__dirname, "../../json/prestige_battle_modes.json")));
});

app.post("/api/user/get_user_prestige", res => {
    res.writeHeader("Content-Type", "application/json");
    res.end("\"0\"");
});

app.post("/api/find_game", res => {
    readPostedJSON(res, (body: { region: string | number, zones: any[] }) => {
        const addr: string = Config.useWebSocketDevAddress ? Config.webSocketDevAddress : (Config.webSocketRegions[body?.region] ?? Config.webSocketRegions[Config.defaultRegion]);

        res.writeHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ res: [{ zone: body.zones[0], gameId: "", useHttps: Config.https, hosts: [addr], addrs: [addr] }] }));
    }, () => {
        log("/api/find_game: Error retrieving body");
    });
});

app.post("/api/user/profile", (res, req) => {
    const loadout = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../json/profile.json"), "utf-8"));
    const cookies = cookie.parse(req.getHeader("cookie"));

    if (cookies.loadout) loadout.loadout = JSON.parse(cookies.loadout);

    /**
     * @note JSON.stringify() is slow.
     */
    res.writeHeader("Content-Type", "application/json");
    res.end(JSON.stringify(loadout));
});

app.post("/api/user/loadout", res => {
    readPostedJSON(res, (body: { loadout: any }) => {
        res.writeHeader("Set-Cookie", cookie.serialize("loadout", JSON.stringify(body.loadout), { path: "/", domain: "resurviv.io", maxAge: 2147483647 }));
        res.writeHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body));
    }, () => {
        log("/api/user/loadout: Error retrieving body");
    });
});

app.post("/api/user/load_exclusive_offers", res => {
    res.writeHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true, data: [] }));
});

app.post("/api/user/load_previous_offers", res => {
    res.writeHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true, offers: {} }));
});

app.post("/api/user/get_pass", res => {
    res.writeHeader("Content-Type", "application/json");
    res.end(fs.readFileSync(path.resolve(__dirname, "../../json/get_pass.json")));
});

let lastDataReceivedTime = Date.now() + 3e4;
let webSocketProcess: ChildProcessWithoutNullStreams;

const shutdownHandler = (): void => {
    log("Shutting down...");

    webSocketProcess.kill("SIGKILL");
    process.exit();
};

process.on("SIGINT", shutdownHandler);
process.on("SIGTERM", shutdownHandler);

/**
 * Create a new game.
 */
const spawnWebSocketProcess = (): void => {
    webSocketProcess = spawn("node", ["--enable-source-maps", "dist/src/webSocketServer.js"]);
    webSocketProcess.stdout.on("data", data => {
        lastDataReceivedTime = Date.now();
        process.stdout.write(data);
    });

    webSocketProcess.stderr.on("data", data => process.stderr.write(data));
};

setInterval(() => {
    if (Date.now() - lastDataReceivedTime > 1e4) {
        log("WebSocket process has not sent data in more than 10 seconds. Restarting...");
        lastDataReceivedTime = Date.now() + 3e4;
        webSocketProcess.kill("SIGKILL");

        setTimeout(spawnWebSocketProcess, 1e3);
    }
}, 1e4);

log(`Surviv Reloaded v${version}`);
app.listen(Config.host, Config.port, () => {
    log(`HTTP server listening on ${Config.host}:${Config.port}`);
    log("WebSocket server is starting...");

    spawnWebSocketProcess();
});

export {
    app
};
