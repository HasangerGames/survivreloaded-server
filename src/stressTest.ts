import { WebSocket } from "ws";
import { MsgType, random, SurvivBitStream } from "./utils";
import { Vec2 } from "planck";

const config = {
    address: "wss://test.resurviv.io/play",
    botCount: 50,
    joinDelay: 100
};

for(let i = 0; i < config.botCount; i++) {
    setTimeout(() => {
        let movingUp = false,
            movingDown = false,
            movingLeft = false,
            movingRight = false;
        const ws = new WebSocket(config.address);
        ws.on("error", console.error);
        ws.on("open", () => {
            setInterval(() => {
                const stream = SurvivBitStream.alloc(128);
                stream.writeUint8(MsgType.Input);
                stream.writeUint8(0);
                stream.writeBoolean(movingLeft);
                stream.writeBoolean(movingRight);
                stream.writeBoolean(movingUp);
                stream.writeBoolean(movingDown);

                stream.writeBoolean(false); // Shoot start
                stream.writeBoolean(false); // Shoot hold
                stream.writeBoolean(false); // Portrait
                stream.writeBoolean(false); // Touch move active

                stream.writeUnitVec(Vec2(0, 0), 10); // To mouse dir
                stream.writeFloat(0, 0, 64, 8); // Distance to mouse
                stream.writeBits(0, 4); // Extra inputs
                stream.writeGameType(0); // Item in use
                stream.writeBits(0, 6); // Padding
                ws.send(stream.buffer.subarray(0, Math.ceil(stream.index / 8)));
            }, 30);
        });
        setInterval(() => {
            movingUp = false;
            movingDown = false;
            movingLeft = false;
            movingRight = false;
            const direction: number = random(1, 8);
            switch(direction) {
                case 1:
                    movingUp = true;
                    break;
                case 2:
                    movingDown = true;
                    break;
                case 3:
                    movingLeft = true;
                    break;
                case 4:
                    movingRight = true;
                    break;
                case 5:
                    movingUp = true;
                    movingLeft = true;
                    break;
                case 6:
                    movingUp = true;
                    movingRight = true;
                    break;
                case 7:
                    movingDown = true;
                    movingLeft = true;
                    break;
                case 8:
                    movingDown = true;
                    movingRight = true;
                    break;
            }
        }, 2000);
    }, config.joinDelay * i);
}
