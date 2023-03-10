import { Body, Vector } from "matter-js";

import { Game } from "../game";
import { ObjectKind, SurvivBitStream, TypeToId } from "../../utils";

export abstract class GameObject {
    kind: ObjectKind;
    id: number;
    typeString?: string;
    typeId: number;
    _position: Vector;
    layer: number;
    orientation?: number;
    scale: number = 1;
    dead: boolean = false;

    game?: Game;
    body: Body;

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

    get position() {
        return this._position;
    }

    abstract serializePart(stream: SurvivBitStream): void;
    abstract serializeFull(stream: SurvivBitStream): void;

}
