import { type Vector } from "matter-js";

import { type Game } from "./game";
import { type ObjectKind, type SurvivBitStream, TypeToId } from "../utils";
import { Player } from "./objects/player";

export abstract class GameObject {
    kind: ObjectKind;
    id: number;
    typeString?: string;
    typeId: number;
    _position: Vector;
    layer: number;
    orientation?: number;
    scale = 1;
    dead = false;
    showOnMap = false;

    interactable = false;
    interactionRad: number;
    damageable = false;

    game?: Game;

    body: Matter.Body | null;

    protected constructor(id: number,
                          typeString: string,
                          position: Vector,
                          layer: number,
                          orientation?: number,
                          game?: Game) {
        this.id = id;
        this.typeString = typeString;
        if(this.typeString) this.typeId = TypeToId[typeString];
        this._position = position;
        this.layer = layer;
        this.orientation = orientation;
        this.game = game;
    }

    get position(): Vector {
        return this._position;
    }

    abstract serializePartial(stream: SurvivBitStream): void;
    abstract serializeFull(stream: SurvivBitStream): void;

}
