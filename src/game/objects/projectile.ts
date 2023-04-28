import { ObjectKind, type SurvivBitStream, Constants, Weapons } from "../../utils";
import { GameObject } from "../gameObject";
import { type Vec2, type Body, Circle } from "planck";
import { type Game } from "../game";
import { Explosion } from "../explosion";
import { type Player } from "./player";

export class Projectile extends GameObject {

    zPos = 2;
    direction: Vec2;

    data: any;

    body: Body;

    isPlayer = false;
    isObstacle = false;
    isBullet = false;
    isLoot = false;
    isProjectile = true;

    player: Player;

    collidesWith = {
        player: false,
        obstacle: true,
        bullet: false,
        loot: false,
        projectile: false
    };

    constructor(
        typeString: string,
        game: Game,
        position: Vec2,
        layer: number,
        direction: Vec2,
        player: Player
    ) {
        super(game, typeString, position, layer);
        this.kind = ObjectKind.Projectile;

        this.direction = direction;

        this.player = player;

        this.data = Weapons[this.typeString];

        this.body = this.game.world.createBody({
            type: "dynamic",
            position,
            fixedRotation: true,
            linearDamping: 0.0005,
            linearVelocity: this.direction.clone().mul((this.data.throwPhysics.speed / 1000))
        });

        this.body.createFixture({
            shape: Circle(0.5),
            restitution: 0.5,
            density: 0.0,
            friction: 0.0,
            userData: this
        });

        setTimeout(() => {
            this.explode();
        }, this.data.fuseTime * 1000);

        this.game.dynamicObjects.add(this);
        this.game.projectiles.add(this);
    }

    update(): void {
        if (this.zPos > 0) {
            this.zPos -= 0.05;
            this.game.partialDirtyObjects.add(this);
        }
        if(this.position.x !== this.body.getPosition().x || this.position.y !== this.body.getPosition().y) {
            this._position = this.body.getPosition().clone();
            this.game.partialDirtyObjects.add(this);
        }
    }

    explode(): void {
        this.game.explosions.add(new Explosion(this.position, this.data.explosionType, this.layer, this.player, this));
        this.game.projectiles.delete(this);
        this.game.dynamicObjects.delete(this);
        this.game.deletedObjects.add(this);
        this.game.world.destroyBody(this.body);
    }

    serializePartial(stream: SurvivBitStream): void {
        stream.writeVec(this.position, 0, 0, 1024, 1024, 16);
        stream.writeFloat(this.zPos, 0, Constants.projectile.maxHeight, 10);
        stream.writeUnitVec(this.direction, 7);
    }

    serializeFull(stream: SurvivBitStream): void {
        stream.writeGameType(this.typeId);
        stream.writeBits(this.layer, 2);
        stream.writeBits(0, 4); // padding
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    damage(amount: number, source): void {}
}
