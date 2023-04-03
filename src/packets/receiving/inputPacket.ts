import { ReceivingPacket } from "../receivingPacket";
import {
    Constants,
    InputType,
    objectCollision,
    sameLayer,
    ScopeTypes,
    type SurvivBitStream,
    TypeToId
} from "../../utils";
import { Vec2 } from "planck";
import { type Obstacle } from "../../game/objects/obstacle";
import { Loot } from "../../game/objects/loot";

export class InputPacket extends ReceivingPacket {
    deserialize (stream: SurvivBitStream): void {
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
        p.distanceToMouse = stream.readFloat(0, 64, 8); // Distance to mouse

        // Other inputs
        const inputCount = stream.readBits(4);
        for (let i = 0; i < inputCount; i++) {
            const input = stream.readUint8();
            switch (input) { // TODO Remove redundant code
                case InputType.Interact: {
                    let minDistInteractable = Number.MAX_VALUE; let minDist = Number.MAX_VALUE;
                    let minDistInteractableObject, minDistObject;
                    for (const object of p.visibleObjects) {
                        if (object.interactable && sameLayer(p.layer, object.layer)) {
                            const record = objectCollision(object, p.position, p.scale + object.interactionRad);
                            if (record?.collided) {
                                if ((object as any).isDoor) p.interactWith(object as Obstacle);
                                else if (record.distance < minDist) {
                                    if (record.distance < minDistInteractable && (!(object instanceof Loot) || object.canPickUpItem(p))) {
                                        minDistInteractable = record.distance;
                                        minDistInteractableObject = object;
                                    }
                                    minDist = record.distance;
                                    minDistObject = object;
                                }
                            }
                        }
                    }
                    if (minDistInteractableObject) {
                        p.interactWith(minDistInteractableObject);
                    } else if (minDistObject) {
                        p.interactWith(minDistObject);
                    }
                    break;
                }

                case InputType.Loot: {
                    let minDistInteractable = Number.MAX_VALUE; let minDist = Number.MAX_VALUE;
                    let minDistInteractableObject, minDistObject;
                    for (const object of p.visibleObjects) {
                        if (object instanceof Loot && object.interactable && sameLayer(p.layer, object.layer)) {
                            const record = objectCollision(object, p.position, p.scale + object.interactionRad);
                            if (record?.collided && record.distance < minDist) {
                                if (record.distance < minDistInteractable && object.canPickUpItem(p)) {
                                    minDistInteractable = record.distance;
                                    minDistInteractableObject = object;
                                }
                                minDist = record.distance;
                                minDistObject = object;
                            }
                        }
                    }
                    if (minDistInteractableObject) {
                        p.interactWith(minDistInteractableObject);
                    } else if (minDistObject) {
                        p.interactWith(minDistObject);
                    }
                    break;
                }

                case InputType.Use: {
                    for (const object of p.visibleObjects) {
                        if (((object as any).isDoor || (object as any).isButton || (object as any).isPuzzlePiece) && sameLayer(object.layer, p.layer)) {
                            const record = objectCollision(object, p.position, p.scale + object.interactionRad);
                            if (record?.collided) p.interactWith(object as Obstacle);
                        }
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
                    if (p.weapons[0]?.typeId && p.weapons[1]?.typeId) p.switchSlot(p.selectedWeaponSlot === 0 ? 1 : 0);
                    else if (p.selectedWeaponSlot === 2 && p.weapons[0]?.typeId) p.switchSlot(0);
                    else if (p.selectedWeaponSlot === 2 && p.weapons[1]?.typeId) p.switchSlot(1);
                    else p.switchSlot(2);
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
