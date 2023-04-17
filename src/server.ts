import { App, SSLApp } from "uWebSockets.js";
import cookie from "cookie";
import fs from "fs";
import { Worker } from "node:worker_threads";

import { Config, Debug, getContentType, log, readJson, readPostedJson } from "./utils";
import { exec, spawn } from "child_process";

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

app.post("/api/find_game", (res) => {
    readPostedJson(res, (body) => {
        const addr: string = Config.useWebSocketDevAddress ? Config.webSocketDevAddress : Config.webSocketRegions[body?.region] ?? Config.webSocketRegions[Config.defaultRegion];
        res.writeHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ res: [{ zone: body.zones[0], gameId: "", useHttps: Config.useHttps, hosts: [addr], addrs: [addr] }] }));
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
        res.writeHeader("Set-Cookie", cookie.serialize("loadout", JSON.stringify(body.loadout), { path: "/", domain: "resurviv.io", maxAge: 2147483647 }));
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

const shutdownHandler = (): void => {
    log("Shutting down...");
    webSocketProcess.kill("SIGKILL");
    process.exit();
};

process.on("SIGINT", shutdownHandler);
process.on("SIGTERM", shutdownHandler);

// Code to handle the WebSocket server
let lastDataReceivedTime = Date.now() + 30000;
let webSocketProcess;
function spawnWebSocketProcess(): void {
    webSocketProcess = spawn("node", ["--enable-source-maps", "dist/webSocketServer.js"]);
    webSocketProcess.stdout!.on("data", data => {
        lastDataReceivedTime = Date.now();
        process.stdout.write(data);
    });
    webSocketProcess.stderr!.on("data", data => process.stderr.write(data));
}
setInterval(() => {
    if(Date.now() - lastDataReceivedTime > 10000) {
        log("WebSocket process hasn't sent data in more than 10 seconds. Restarting...");
        lastDataReceivedTime = Date.now() + 30000;
        webSocketProcess.kill("SIGKILL");
        setTimeout(() => spawnWebSocketProcess(), 1000);
    }
}, 10000);

// Start the servers
log("Surviv Reloaded v0.6.2");
app.listen(Config.host, Config.port, () => {
    // noinspection HttpUrlsUsage
    log(`HTTP server listening on ${Config.host}:${Config.port}`);
    log("WebSocket server is starting...");
    spawnWebSocketProcess();
});
