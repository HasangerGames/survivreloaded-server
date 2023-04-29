import * as path from "path";
import * as fs from "fs";
import { type Vec2 } from "planck";
import type { HttpResponse } from "uWebSockets.js";
import type { GameObject } from "../game/gameObject";
import type { Bullet } from "../game/bullet";
import { type Player } from "../game/objects/player";

export class Item {
    type: string;
    count: number;

    constructor (type: string, count: number) {
        this.type = type;
        this.count = count;
    }
}

export class DamageRecord {
    damaged: GameObject;
    damager: Player;
    bullet: Bullet;

    constructor (damaged: GameObject, damager: Player, bullet: Bullet) {
        this.damaged = damaged;
        this.damager = damager;
        this.bullet = bullet;
    }
}

export class Emote {
    playerId: number;
    position: Vec2;
    type: string;
    isPing: boolean;
    constructor (playerId, position, type, isPing) {
        this.playerId = playerId;
        this.position = position;
        this.type = type;
        this.isPing = isPing;
    }
}

export function removeFrom<T> (array: T[], object: T): void {
    const index: number = array.indexOf(object);
    if (index !== -1) array.splice(index, 1);
}

export function log (message: string): void {
    const date: Date = new Date();
    console.log(`[${date.toLocaleDateString("en-US")} ${date.toLocaleTimeString("en-US")}] ${message}`);
}

/**
 * Helper function for reading a JSON file.
 * @param path The path to the JSON file.
 */
export function readJson<T> (path: string): T {
    return JSON.parse(fs.readFileSync(path).toString()) as T;
}

/**
 * Helper function for reading a posted JSON body.
 * https://github.com/uNetworking/uWebSockets.js/blob/master/examples/JsonPost.js
 */
export function readPostedJson<T> (
    res: HttpResponse,
    cb: (json: T) => void,
    err: () => void
): void {
    let buffer: Buffer | Uint8Array;
    /* Register data cb */
    res.onData((ab, isLast) => {
        const chunk = Buffer.from(ab);
        if (isLast) {
            let json: T;
            if (buffer) {
                try {
                    // @ts-expect-error JSON.parse can accept a Buffer as an argument
                    json = JSON.parse(Buffer.concat([buffer, chunk]));
                } catch (e) {
                    /* res.close calls onAborted */
                    res.close();
                    return;
                }
                cb(json);
            } else {
                try {
                    // @ts-expect-error JSON.parse can accept a Buffer as an argument
                    json = JSON.parse(chunk);
                } catch (e) {
                    /* res.close calls onAborted */
                    res.close();
                    return;
                }
                cb(json);
            }
        } else {
            if (buffer) {
                buffer = Buffer.concat([buffer, chunk]);
            } else {
                buffer = Buffer.concat([chunk]);
            }
        }
    });

    /* Register error cb */
    res.onAborted(err);
}

/**
 * Get the MIME type of a file.
 * @param filename The name of the file.
 */
export function getContentType (filename: string): string {
    // this should be done with a switch
    let contentType: string;
    if (filename.endsWith(".svg")) contentType = "image/svg+xml";
    else if (filename.endsWith(".mp3")) contentType = "audio/mpeg";
    else if (filename.endsWith(".html")) contentType = "text/html; charset=UTF-8";
    else if (filename.endsWith(".css")) contentType = "text/css";
    else if (filename.endsWith(".js")) contentType = "text/javascript";
    else if (filename.endsWith(".png")) contentType = "image/png";
    else if (filename.endsWith(".ico")) contentType = "image/vnd.microsoft.icon";
    else if (filename.endsWith(".jpg")) contentType = "image/jpeg";
    return contentType!;
}

/**
 * Recursively read a directory.
 * @param dir The absolute path to the directory.
 * @returns An array representation of the directory's contents.
 */
export const readDirectory = (dir: string): string[] => {
    let results: string[] = [];
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.resolve(dir, file);
        const stat = fs.statSync(filePath);

        if (stat?.isDirectory()) {
            const res = readDirectory(filePath);
            results = results.concat(res);
        } else results.push(filePath);
    }

    return results;
};

export function deepCopy<T> (object: T): T {
    return JSON.parse(JSON.stringify(object));
}
