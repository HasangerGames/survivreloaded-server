import { ReceivingPacket } from "../receivingPacket";
import { Constants, InputType, objectCollision, ScopeTypes, type SurvivBitStream, TypeToId } from "../../utils";
import { Vec2 } from "planck";
import { type Obstacle } from "../../game/objects/obstacle";
import { Loot } from "../../game/objects/loot";

export class InputPacket extends ReceivingPacket {

    deserialize(stream: SurvivBitStream): void {
        const p = this.p;
        if (p.dead) return;

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
        if (touchMoveActive) {
            if (!p.isMobile) {
                p.isMobile = true;
                p.zoom = Constants.scopeZoomRadius.mobile["1xscope"];
            }
            p.touchMoveDir = stream.readUnitVec(8);

            // Detect when the player isn't moving
            if (p.touchMoveDir.x === 1 && p.touchMoveDir.y > 0 && p.touchMoveDir.y < 0.01) {
                p.touchMoveDir = Vec2(0, 0);
            }

            stream.readUint8(); // Touch move len
        }

        // Direction
        const direction = stream.readUnitVec(10);
        if (p.direction !== direction) {
            p.direction = direction;
            p.moving = true;
        }
        stream.readFloat(0, 64, 8); // Distance to mouse

        // Other inputs
        const inputCount = stream.readBits(4);
        for (let i = 0; i < inputCount; i++) {
            const input = stream.readUint8();
            switch (input) { // TODO Remove redundant code
                case InputType.Interact: {
                    let minDist = Number.MAX_VALUE;
                    let minDistObject;
                    for (const object of p.visibleObjects) {
                        if (object.interactable) {
                            const record = objectCollision(object, p.position, p.scale + object.interactionRad);
                            if (record?.collided) {
                                if ((object as any).isDoor) (object as Obstacle).interact(p);
                                else if (record.distance < minDist) {
                                    minDist = record.distance;
                                    minDistObject = object;
                                }
                            }
                        }
                    }
                    if (minDistObject) {
                        minDistObject.interact(p);
                    }
                    break;
                }

                case InputType.Loot: {
                    let minDist = Number.MAX_VALUE;
                    let minDistObject;
                    for (const object of p.visibleObjects) {
                        if (object instanceof Loot) {
                            const record = objectCollision(object, p.position, p.scale);
                            if (record?.collided && record.distance < minDist) {
                                minDist = record.distance;
                                minDistObject = object;
                            }
                        }
                    }
                    if (minDistObject) {
                        minDistObject.interact(p);
                    }
                    break;
                }

                case InputType.Use: {
                    //let minDist = Number.MAX_VALUE;
                    //let minDistObject;
                    for (const object of p.visibleObjects) {
                        if ((object as any).isDoor) {
                            const record = objectCollision(object, p.position, p.scale + object.interactionRad);
                            if (record?.collided) (object as Obstacle).interact(p);
                            /*if(record?.collided && record.distance < minDist) {
                                minDist = record.distance;
                                minDistObject = object;
                            }*/
                        }
                    }
                    /*if(minDistObject) {
                        minDistObject.interact(p);
                    }*/
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
                case InputType.EquipThrowable:
                    p.switchSlot(3);
                    break;

                case InputType.EquipPrevWeap:
                    p.switchSlot(p.selectedWeaponSlot - 1, true);
                    break;
                case InputType.EquipNextWeap:
                    p.switchSlot(p.selectedWeaponSlot + 1, true);
                    break;

                case InputType.SwapWeapSlots:
                    p.swapWeaponSlots();
                    break;

                case InputType.EquipOtherGun:
                    if (p.selectedWeaponSlot === 0) p.switchSlot(1);
                    else p.switchSlot(0);
                    break;
                case InputType.EquipLastWeap:
                    p.switchSlot(p.lastWeaponSlot);
                    break;

                case InputType.EquipNextScope:
                    p.setScope(ScopeTypes[ScopeTypes.indexOf(p.scope.typeString) + 1], true);
                    break;

                case InputType.EquipPrevScope:
                    p.setScope(ScopeTypes[ScopeTypes.indexOf(p.scope.typeString) - 1], true);
                    break;

                case InputType.Reload:
                    p.reload();
                    break;
                case InputType.Cancel:
                    p.cancelAction();
                    break;

                case InputType.StowWeapons:
                    p.switchSlot(2);
                    break;

                case InputType.UseBandage:
                    p.useBandage();
                    break;
                case InputType.UseHealthKit:
                    p.useMedkit();
                    break;
                case InputType.UseSoda:
                    p.useSoda();
                    break;
                case InputType.UsePainkiller:
                    p.usePills();
                    break;
            }
        }

        // Item use logic
        switch (stream.readGameType()) {
            case TypeToId.bandage:
                p.useBandage();
                break;
            case TypeToId.healthkit:
                p.useMedkit();
                break;
            case TypeToId.soda:
                p.useSoda();
                break;
            case TypeToId.painkiller:
                p.usePills();
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
