import { Game } from "../game";
import Matter from "matter-js";

export class GameObject {
    id: number;
    game: Game;

    body?: Matter.Body;
}
