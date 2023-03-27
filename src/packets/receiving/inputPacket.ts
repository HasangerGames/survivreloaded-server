import { ReceivingPacket } from "../receivingPacket";
import { Constants, distanceBetween, InputType, type SurvivBitStream, TypeToId } from "../../utils";
import { Vec2 } from "planck";

export class InputPacket extends ReceivingPacket {

    deserialize(stream: SurvivBitStream): void {
        const p = this.p;
        if(p.dead) return;

        stream.readUint8(); // Discard second byte (this.seq)

        // Movement
        p.movingLeft = stream.readBoolean();
        p.movingRight = stream.readBoolean();
        p.movingUp = stream.readBoolean();
        p.movingDown = stream.readBoolean();

        // Shooting
        const shootStart = stream.readBoolean();
        p.shootStart = p.shootStart ? true : shootStart;
        p.shootHold = stream.readBoolean();

        // Mobile stuff
        stream.readBoolean(); // Portrait
        const touchMoveActive = stream.readBoolean();
        if(touchMoveActive) {
            if(!p.isMobile) {
                p.isMobile = true;
                p.zoom = Constants.scopeZoomRadius.mobile["1xscope"];
            }
            p.touchMoveDir = stream.readUnitVec(8);

            // Detect when the player isn't moving
            if(p.touchMoveDir.x === 1 && p.touchMoveDir.y > 0 && p.touchMoveDir.y < 0.01) {
                p.touchMoveDir = Vec2(0, 0);
            }

            stream.readUint8(); // Touch move len
        }

        // Direction
        const direction = stream.readUnitVec(10);
        if(p.direction !== direction) {
            p.direction = direction;
            p.moving = true;
        }
        stream.readFloat(0, 64, 8); // Distance to mouse

        // Other inputs
        const inputCount = stream.readBits(4);
        for(let i = 0; i < inputCount; i++) {
            const input = stream.readUint8();
            switch(input) {
                case InputType.Interact: {
                    let minDist = Number.MAX_VALUE;
                    let minDistObject;
                    for(const object of p.visibleObjects) {
                        const distance: number = distanceBetween(p.position, object.position);
                        if(object.interactable && distance < 1 + object.interactionRad) {
                            if(distance < minDist) {
                                minDist = distance;
                                minDistObject = object;
                            }
                        }
                    }
                    if(minDistObject) {
                        minDistObject.interact(p);
                    }
                    break;
                }
                case InputType.EquipPrimary:
                    p.switchSlot(0);
                    break;
                case InputType.EquipSecondary:
                    p.switchSlot(1);
                    break;
                case InputType.EquipMelee:
                    p.switchSlot(2);
                    break;
                case InputType.EquipPrevWeap:
                    p.switchSlot((p.weapons.activeSlot - 1) % 4);
                    break;
                case InputType.EquipNextWeap:
                    p.switchSlot((p.weapons.activeSlot + 1) % 4);
                    break;
                case InputType.SwapWeapSlots:
                    p.swapWeaponSlots();
                    break;
            }
        }

        // Item use logic
        switch(stream.readGameType()) {
            case 0:
                break;
            case TypeToId.bandage:
                if(p.health === 100 || p.inventory.bandage === 0) break;
                p.useItem("bandage", 3);
                break;
            case TypeToId.healthkit:
                if(p.health === 100 || p.inventory.healthkit === 0) break;
                p.useItem("healthkit", 6);
                break;
            case TypeToId.soda:
                if(p.boost === 100 || p.inventory.soda === 0) break;
                p.useItem("soda", 3);
                break;
            case TypeToId.painkiller:
                if(p.boost === 100 || p.inventory.painkiller === 0) break;
                p.useItem("painkiller", 5);
                break;
            case TypeToId["1xscope"]:
                p.setScope("1xscope");
                break;
            case TypeToId["2xscope"]:
                p.setScope("2xscope");
                break;
            case TypeToId["4xscope"]:
                p.setScope("4xscope");
                break;
            case TypeToId["8xscope"]:
                p.setScope("8xscope");
                break;
            case TypeToId["15xscope"]:
                p.setScope("15xscope");
                break;
        }

        stream.readBits(6); // Padding
    }

}
